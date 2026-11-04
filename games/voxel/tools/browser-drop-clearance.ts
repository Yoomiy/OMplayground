import assert from 'node:assert/strict';
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { source } from '../content/index.ts';
import { compileContent } from './compile-content.ts';
import { launchSoftwareBrowser } from './browser-harness.ts';

// Direct page injection: no gateway, HTTP listener or development server.
const compiled = compileContent(source);
const content = compiled.manifest;
const wasm = readFileSync(new URL('../engine/pkg/voxel_engine_bg.wasm', import.meta.url)).toString(
  'base64',
);
const bundle = await build({
  stdin: {
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
    contents: `
    import * as THREE from 'three';
    import { DropRenderer } from './src/render/drops.ts';
    import { initSync, set_content, generate_textures, texture_layer_count, VoxelWorld, TerrainGen } from './engine/pkg/voxel_engine.js';
    initSync({ module: Uint8Array.from(atob(${JSON.stringify(wasm)}), c => c.charCodeAt(0)) });
    const content = ${JSON.stringify(content)};
    set_content(JSON.stringify(content));
    const world = new VoxelWorld(), gen = new TerrainGen(4242);
    const state = name => (${JSON.stringify(compiled.defaults)})[name];
    gen.set_void(); gen.set_void_ground(0, state('stone'), state('stone'), 1);
    for (let z=-1; z<=1; z++) for (let x=-1; x<=1; x++) world.insert_column(x,z,gen.generate(x,z));
    world.set_block(2,1,0,state('stone'));
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#d9e5ef');
    const gl = new THREE.WebGLRenderer({ antialias: true }); gl.setSize(800,600); document.body.append(gl.domElement);
    const camera = new THREE.PerspectiveCamera(45,800/600,0.01,30); camera.position.set(0,2.3,3.2); camera.lookAt(1.6,1.25,0.5);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(4,1,4),new THREE.MeshBasicMaterial({color:0x8a947b})); floor.position.set(1.5,0.5,1.5);scene.add(floor);
    const wall = new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0x9ca5ad}));wall.position.set(2.5,1.5,0.5);scene.add(wall);
    const pixels=generate_textures(), layers=texture_layer_count(), size=layers*16*16*4;
    const albedo=new THREE.DataArrayTexture(pixels.slice(0,size),16,16,layers), material=new THREE.DataArrayTexture(pixels.slice(size,size*2),16,16,layers);
    for(const t of [albedo,material]) { t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.needsUpdate=true; }
    const drops = new DropRenderer(scene,content.blocks,content.items,albedo,material);
    const values=[{id:'drop-1',revision:1,stack:{itemType:'stone',count:1},position:[1.875,1,0.5]},
      {id:'drop-2',revision:1,stack:{itemType:'stone_pickaxe',count:1},position:[0.9,1,0.5]}];
    for(let frame=0;frame<240;frame++) { drops.update(values,new THREE.Vector3(),frame/60,1,world);gl.render(scene,camera); }
    window.dropCheck={batches:scene.children.length-2,visible:drops.stats.visible,calls:gl.info.render.calls};
  `,
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  write: false,
});
const browser = await launchSoftwareBrowser();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') errors.push(e.text());
  });
  await page.setContent('<style>body{margin:0}</style>');
  await page.addScriptTag({ type: 'module', content: bundle.outputFiles[0].text });
  await page.waitForFunction(() => (window as any).dropCheck);
  const result = await page.evaluate(() => (window as any).dropCheck);
  assert.deepEqual(errors, []);
  assert.equal(result.visible, 2);
  assert.equal(result.batches, 2, 'only the two item types; no halo');
  assert.equal(result.calls, 4, 'floor, wall and two instanced item batches');
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  await page.screenshot({
    path: fileURLToPath(new URL('../test-results/drop-clearance.png', import.meta.url)),
  });
  console.log(
    'Direct WebGL drop check passes: no halo, instanced items, 240 frames, no shader errors.',
  );
} finally {
  await browser.close();
}
