import { Matrix4, Vector4, type PerspectiveCamera } from 'three';

export interface PlayerLabelPose {
  id: string; x: number; y: number; depth: number; local: boolean; visible: boolean;
  anchorX?: number;
}

/** Reused projection workspace. Coordinates are CSS pixels, never render-scale pixels. */
export class PlayerLabelProjector {
  private clip = new Vector4();
  private viewProjection = new Matrix4();
  begin(camera: PerspectiveCamera): void {
    camera.updateMatrixWorld();
    this.viewProjection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  }
  project(out: PlayerLabelPose, position: Readonly<{x:number;y:number;z:number}>, width:number, height:number): void {
    out.visible = false;
    if (!(width > 0 && height > 0)) return;
    const clip = this.clip.set(position.x, position.y + 1.25, position.z, 1).applyMatrix4(this.viewProjection);
    if (!Number.isFinite(clip.x) || !Number.isFinite(clip.y) || !Number.isFinite(clip.z)
      || !Number.isFinite(clip.w) || clip.w <= 0) return;
    const x = clip.x / clip.w, y = clip.y / clip.w, z = clip.z / clip.w;
    if (z < -1 || z > 1 || Math.abs(x) > 1 || Math.abs(y) > 1) return;
    out.x = Math.round((x + 1) * width / 2);
    out.y = Math.round((1 - y) * height / 2);
    out.anchorX = out.x;
    out.depth = clip.w;
    if(out.local && width>=136 && height>=40){
      out.x=Math.max(68,Math.min(width-68,out.x));out.y=Math.max(32,out.y);out.visible=true;return;
    }
    // Keep a readable label above its anchor instead of pinning it to an edge.
    out.visible = out.x >= 68 && out.x <= width - 68 && out.y >= 32 && out.y <= height;
  }
}

/** At most eight labels: own car wins, then nearer cars. No scene raycasts or layout reads. */
export function resolvePlayerLabelOverlaps(labels: PlayerLabelPose[]): void {
  labels.sort((a,b) => Number(b.local) - Number(a.local) || a.depth - b.depth || a.id.localeCompare(b.id));
  for (let i=0;i<labels.length;i++) {
    const current=labels[i];if(!current.visible)continue;
    for(let j=0;j<i;j++) {
      const other=labels[j];
      if(other.visible && Math.abs(current.x-other.x)<136 && Math.abs(current.y-other.y)<26) {
        current.visible=false;break;
      }
    }
  }
}
