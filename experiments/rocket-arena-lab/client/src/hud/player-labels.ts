import type { Group, PerspectiveCamera } from 'three';
import type { StatePlayer } from '../networking/state-listener.js';
import { formatPlayerName, t, UI_FONT } from '../ui/i18n.js';
import { PlayerLabelProjector, resolvePlayerLabelOverlaps, type PlayerLabelPose } from './player-label-layout.js';

interface Label extends PlayerLabelPose {
  element: HTMLDivElement; name: HTMLElement; you: HTMLElement;
  rawName: string; team: string; shown: boolean; lastX: number; lastY: number;
  lastAnchorX: number;
}

export function playerLabelsEnabled(): boolean {
  return typeof window==='undefined' || new URLSearchParams(window.location.search).get('names')!=='off';
}

/** Eight cached browser text nodes, projected from the displayed car poses.
 * Adds no WebGL geometry/materials/draw calls, text textures, timers or network data. */
export function createPlayerLabels(container: HTMLElement) {
  const root=document.createElement('div');root.className='player-label-layer';root.setAttribute('aria-hidden','true');
  const style=document.createElement('style');
  style.textContent=`
    .player-label-layer{position:absolute;inset:0;overflow:hidden;pointer-events:none;z-index:8;direction:ltr;contain:layout style paint}
    .player-label{position:absolute;left:0;top:0;box-sizing:border-box;width:132px;height:23px;display:flex;align-items:center;justify-content:center;gap:5px;padding:2px 6px;border:1px solid var(--team-color);border-radius:5px;background:rgba(9,15,26,.82);color:#fff;font:12px/17px ${UI_FONT};white-space:nowrap;direction:ltr}
    .player-label[hidden]{display:none}
    .player-label bdi{min-width:0;overflow:hidden;text-overflow:ellipsis;unicode-bidi:isolate}
    .player-label small{font:inherit;font-weight:bold;flex:none;unicode-bidi:isolate}
    .player-label[data-local=true]{border:2px solid white;font-weight:bold;background:rgba(9,15,26,.9);z-index:1}
    .player-label[data-local=true]::after{content:'';position:absolute;bottom:-6px;left:var(--anchor-x,calc(50% - 4px));border-left:4px solid transparent;border-right:4px solid transparent;border-top:5px solid white}
  `;
  root.append(style);container.append(root);
  const labels=new Map<string,Label>(), projected:PlayerLabelPose[]=[], projector=new PlayerLabelProjector();
  let width=0,height=0,disposed=false;
  const enabled=playerLabelsEnabled();
  const remove=(id:string,label:Label)=>{label.element.remove();labels.delete(id);};
  function clear():void { for(const [id,label] of labels)remove(id,label);projected.length=0; }
  return {
    resize(nextWidth:number,nextHeight:number):void {width=nextWidth;height=nextHeight;},
    clear,
    update(camera:PerspectiveCamera,meshes:ReadonlyMap<string,Group>,players:Readonly<Record<string,Readonly<StatePlayer>>>|null,localId:string):void {
      if(disposed || !enabled || !players){clear();return;}
      for(const [id,label] of labels)if(!players[id] || !meshes.has(id))remove(id,label);
      projector.begin(camera);projected.length=0;
      let count=0;
      for(const [id,mesh] of meshes){
        const player=players[id];if(!player || count++>=8)continue;
        let label=labels.get(id);
        if(!label){
          const element=document.createElement('div');element.className='player-label';element.hidden=true;
          const name=document.createElement('bdi');name.dir='auto';
          const you=document.createElement('small');you.dir='auto';you.textContent=t('You');
          element.append(name,you);root.append(element);
          label={id,element,name,you,rawName:'',team:'',shown:false,lastX:NaN,lastY:NaN,lastAnchorX:NaN,
            x:0,y:0,depth:0,local:id===localId,visible:false};labels.set(id,label);
          element.dataset.local=String(label.local);you.hidden=!label.local;
        }
        if(label.rawName!==player.name){label.name.textContent=formatPlayerName(player.name);label.rawName=player.name;}
        if(label.team!==player.team){label.element.style.setProperty('--team-color',player.team==='blue'?'#6fc7ff':'#ffb660');label.team=player.team;}
        projector.project(label,mesh.position,width,height);projected.push(label);
      }
      resolvePlayerLabelOverlaps(projected);
      for(const pose of projected){
        const label=labels.get(pose.id)!;
        if(label.shown!==pose.visible){label.element.hidden=!pose.visible;label.shown=pose.visible;}
        if(pose.visible && (label.lastX!==pose.x || label.lastY!==pose.y)){
          label.element.style.transform=`translate(${pose.x-66}px,${pose.y-28}px)`;
          label.lastX=pose.x;label.lastY=pose.y;
        }
        if(pose.visible && pose.local){
          const anchor=Math.max(2,Math.min(122,(pose.anchorX ?? pose.x)-pose.x+62));
          if(anchor!==label.lastAnchorX){label.element.style.setProperty('--anchor-x',`${anchor}px`);label.lastAnchorX=anchor;}
        }
      }
    },
    dispose():void {if(disposed)return;disposed=true;clear();root.remove();},
  };
}
