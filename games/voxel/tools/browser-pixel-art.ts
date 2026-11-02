import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';
import { source } from '../content/index.ts';
import { compileContent } from './compile-content.ts';
import { engine } from '../tests/wasm/fixture.ts';
import { launchSoftwareBrowser } from './browser-harness.ts';

// Exercise actual GPU materials, icon routing and texture pixels independently of world movement.
const bundled = await build({
  stdin: {
    resolveDir: new URL('..', import.meta.url).pathname,
    contents: `
import * as THREE from 'three';
import {AvatarRenderer} from './src/render/avatars.ts';
import {ItemIcons} from './src/render/item-icons.ts';
import {itemSprite} from './src/render/item-sprites.ts';
import {HeldBlockRenderer} from './src/render/held-block.ts';
import {DropRenderer} from './src/render/drops.ts';
import {avatarVariant} from './src/render/avatar-model.ts';
import {selectAvatar} from './src/shared/avatars.ts';
import {emptyAppearance} from './src/shared/appearance.ts';
window.drawArt = (content, bytes) => {
  const title = text => {const h = document.createElement('h2');h.textContent=text;document.body.append(h);};
  const grid = () => {const div=document.createElement('div');div.className='grid';document.body.append(div);return div;};
  const cell = (parent,label) => {const div=document.createElement('div');parent.append(div);const span=document.createElement('span');span.textContent=label.replaceAll('_',' ');div.append(span);return div;};
  const picture=(parent,data) => {const c=document.createElement('canvas');c.width=c.height=16;const ctx=c.getContext('2d');const image=ctx.createImageData(16,16);image.data.set(data);ctx.putImageData(image,0,0);parent.prepend(c);};
  const canvas=document.createElement('canvas');
  const gl=new THREE.WebGLRenderer({canvas,antialias:false});
  gl.outputColorSpace=THREE.LinearSRGBColorSpace;
  gl.setSize(1080,360);gl.setClearColor(0x293442);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(35,3,.1,100);
  camera.position.set(2,2.3,-6.8);camera.lookAt(0,.9,0);
  const size=bytes.length/2,albedo=new Uint8Array(bytes.slice(0,size)),material=new Uint8Array(bytes.slice(size));

  const texture=(data,srgb)=>{const t=new THREE.DataArrayTexture(data,16,16,size/1024);t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t;};
  const a=texture(albedo,true),m=texture(material,false);
  const avatars=new AvatarRenderer(scene,content.blocks,content.items,a,m);
  const actors=Array.from({length:8},(_,i)=>{let id='';for(let n=0;;n++){id='art-player-'+n;if(avatarVariant(id)===i)break;}return {id,position:[(3.5-i)*1.08,0,0],yaw:i===2?.4:0,pitch:0,speed:0,flying:false,appearance:emptyAppearance()};});
  camera.position.set(0,1.7,-7);camera.lookAt(0,.95,0);
  avatars.update(actors,new THREE.Vector3(),[0,1.7,-7],0,1);
  title('Original Blockyard avatars / all eight guest presets');document.body.append(canvas);gl.render(scene,camera);
  const calls=gl.info.render.calls;
  const context=gl.getContext(),still=new Uint8Array(1080*360*4),moving=new Uint8Array(still.length);
  context.readPixels(0,0,1080,360,context.RGBA,context.UNSIGNED_BYTE,still);
  avatars.update(actors.map(actor=>({...actor,pitch:.25,speed:4})),new THREE.Vector3(),[0,1.7,-7],.23,1);
  gl.render(scene,camera);context.readPixels(0,0,1080,360,context.RGBA,context.UNSIGNED_BYTE,moving);
  const animatedChannels=moving.reduce((n,value,i)=>n+(value!==still[i]?1:0),0);
  avatars.update(actors,new THREE.Vector3(),[0,1.7,-7],0,1);gl.render(scene,camera);
  const icons=new ItemIcons(gl,content.blocks,content.items,a,m);
  let readbacks=0;const read=gl.readRenderTargetPixels.bind(gl);gl.readRenderTargetPixels=(...args)=>{readbacks++;return read(...args);};
  title('Blockyard sprites / seven originals + stone palette variant');const items=grid();
  for(const item of content.items.filter(i=>itemSprite(i))){
    const image=document.createElement('img');image.src=icons.get(item.itemType);cell(items,item.itemType).prepend(image);
    if(icons.get(item.itemType,true)!==image.src)throw Error('icon cache mismatch');
  }
  const spriteReadbacks=readbacks;
  title('No upstream sprite match / existing world-model thumbnails');const fallback=grid();
  for(const id of ['wooden_axe','apple','carrot','bucket','heavy_shield']){
    const image=document.createElement('img');image.src=icons.get(id);cell(fallback,id).prepend(image);
  }
  icons.get('stone');const modelReadbacks=readbacks-spriteReadbacks;
  for(const previous of [true,false]){
    title(previous?'Previous held pose / centered sprite':'Blockyard grip pose / handle pixel in the fist');
    const hands=document.createElement('div');hands.style.display='flex';document.body.append(hands);
    for(const id of ['wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe']){
      const canvas=document.createElement('canvas'),renderer=new THREE.WebGLRenderer({canvas,antialias:false});
      renderer.outputColorSpace=THREE.LinearSRGBColorSpace;renderer.setSize(270,169);renderer.setClearColor(0x293442);renderer.clear();
      const held=new HeldBlockRenderer(content.blocks,content.items,a,m);held.draw(renderer,270/169,0,0,0,1,true,id);
      if(previous){
        // Reconstruct the previous resting transform for direct visual comparison only.
        held.grip.position.set(.34,-.29,-.7);held.grip.rotation.set(-.15,.35,-.1);held.grip.scale.setScalar(1);
        held.block.position.set(0,.04,-.06);held.block.rotation.set(0,0,0);held.block.scale.setScalar(.48);
        held.hand.position.set(0,-.22,.08);held.hand.rotation.set(0,0,0);held.hand.scale.setScalar(1);
        held.sleeve.position.set(0,-.38,.09);held.sleeve.rotation.set(0,0,0);held.sleeve.scale.setScalar(1);
        held.camera.fov=55;held.camera.updateProjectionMatrix();renderer.clear();renderer.render(held.scene,held.camera);
      }
      hands.append(canvas);held.dispose();renderer.dispose();
    }
  }
  title('Profile-based selection / boys on the left, girls on the right');
  const genderCanvas=document.createElement('canvas'),genderGL=new THREE.WebGLRenderer({canvas:genderCanvas,antialias:false});
  genderGL.outputColorSpace=THREE.LinearSRGBColorSpace;genderGL.setSize(1080,300);genderGL.setClearColor(0x293442);
  const genderScene=new THREE.Scene(),genderCamera=new THREE.PerspectiveCamera(35,1080/300,.1,20);
  genderCamera.position.set(0,1.7,-5);genderCamera.lookAt(0,.9,0);
  const genderAvatars=new AvatarRenderer(genderScene,content.blocks,content.items,a,m);
  const genderActors=['boy','boy','girl','girl'].map((gender,i)=>{
    const id='profile-preview-'+i;return {id,avatar:selectAvatar(id,gender),position:[(1.5-i)*1.1,0,0],yaw:0,pitch:0,speed:0,flying:false,appearance:{...emptyAppearance(),held:'stone_pickaxe'}};
  });
  genderAvatars.update(genderActors,new THREE.Vector3(),[0,1.7,-5],0,1);genderGL.render(genderScene,genderCamera);
  const assigned=genderActors.map(actor=>actor.avatar),shown=genderAvatars.samples.map(actor=>actor.variant);
  document.body.append(genderCanvas);genderAvatars.dispose();genderGL.dispose();
  title('Dropped items / same sprite meshes in instanced world batches');
  const dropCanvas=document.createElement('canvas'),dropGL=new THREE.WebGLRenderer({canvas:dropCanvas,antialias:false});
  dropGL.outputColorSpace=THREE.LinearSRGBColorSpace;dropGL.setSize(1080,260);dropGL.setClearColor(0x293442);
  const dropScene=new THREE.Scene(),dropCamera=new THREE.PerspectiveCamera(35,1080/260,.01,10);
  dropCamera.position.set(0,.5,1.5);dropCamera.lookAt(0,.16,0);
  const drops=new DropRenderer(dropScene,content.blocks,content.items,a,m);
  drops.update(['wooden_pickaxe','stone_pickaxe','iron_pickaxe','diamond_pickaxe'].map((id,i)=>({id:'drop-'+i*17,revision:1,stack:{itemType:id,count:1},position:[(i-1.5)*.5,0,0]})),new THREE.Vector3(),.5,1);
  dropGL.render(dropScene,dropCamera);const dropCalls=dropGL.info.render.calls;document.body.append(dropCanvas);
  drops.dispose();dropGL.dispose();
  icons.dispose();avatars.dispose();a.dispose();m.dispose();gl.dispose();
  return {calls,spriteReadbacks,modelReadbacks,animatedChannels,dropCalls,assigned,shown};
};`,
  },
  bundle: true,
  format: 'iife',
  write: false,
});
const browser = await launchSoftwareBrowser();
try {
  const page = await browser.newPage({
    viewport: { width: 1120, height: 960 },
    deviceScaleFactor: 1,
  });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (event) => {
    if (event.type() === 'error') errors.push(event.text());
  });
  await page.setContent(`<!doctype html><style>
body{margin:20px;background:#18212b;color:#e5edf2;font:14px system-ui}h2{font-size:18px;margin:24px 0 12px}
.grid{display:grid;grid-template-columns:repeat(10,1fr);gap:14px}.grid>div{display:flex;align-items:center;flex-direction:column;gap:7px;text-align:center;font-size:11px}
.grid canvas,.grid img{width:64px;height:64px;image-rendering:pixelated;background:conic-gradient(#303b47 25%,#394552 0 50%,#303b47 0 75%,#394552 0) 0 0/16px 16px}
</style><h1>Voxel pixel-art review</h1>`);
  await page.addScriptTag({ content: bundled.outputFiles[0].text });
  const result = await page.evaluate(
    ({ manifest, pixels }) => (window as any).drawArt(manifest, pixels),
    {
      manifest: compileContent(source).manifest,
      pixels: Array.from(engine.generate_textures()),
    },
  );
  await page.evaluate(() => Promise.all(Array.from(document.images, (image) => image.decode())));
  assert.deepEqual(errors, []);
  assert.equal(result.calls, 8, 'one draw call per upstream preset, regardless of player count');
  assert.equal(result.spriteReadbacks, 0, 'item sprites must not read pixels back from the GPU');
  assert.equal(result.modelReadbacks, 6, 'unmatched items and blocks retain model thumbnails');
  assert.deepEqual(
    [...result.shown].sort(),
    [...result.assigned].sort(),
    'server-selected presets must reach the GPU batches',
  );
  assert.ok(result.assigned.slice(0, 2).every((id: number) => [0, 1, 3, 4, 5, 7].includes(id)));
  assert.ok(result.assigned.slice(2).every((id: number) => [2, 6].includes(id)));
  assert.equal(result.dropCalls, 4, 'one instanced draw per visible dropped tool kind');
  assert.ok(
    result.animatedChannels > 100,
    'per-player look and limb animation must change GPU output',
  );
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: new URL('../test-results/pixel-art.png', import.meta.url).pathname,
    fullPage: true,
  });
  writeFileSync(
    new URL('../test-results/pixel-art.json', import.meta.url),
    JSON.stringify({ ...result, errors }, null, 2) + '\n',
  );
  console.log('Pixel-art browser checks pass', result);
} finally {
  await browser.close();
}
