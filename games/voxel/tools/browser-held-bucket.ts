import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build as bundle } from 'esbuild';
import { launchSoftwareBrowser } from './browser-harness.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const temp = mkdtempSync(join(tmpdir(), 'voxel-held-bucket-'));
const folder = new URL('../test-results/held-bucket/', import.meta.url);
mkdirSync(folder, { recursive: true });
const build = JSON.parse(readFileSync(new URL('../artifacts/build.json', import.meta.url), 'utf8'));
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
assert.equal(sha(readFileSync(join(root, 'dist-server/engine.wasm'))), build.engineHash);
const entry = `
import * as THREE from 'three';
import {HeldBlockRenderer} from './src/render/held-block.ts';
import {initSync,set_content,generate_textures,texture_layer_count} from './engine/pkg/voxel_engine.js';
import content from './artifacts/content.json';
initSync({module:await (await fetch('/engine.wasm')).arrayBuffer()});
set_content(JSON.stringify(content));
const bytes=generate_textures(),layers=texture_layer_count(),size=layers*16*16*4;
const texture=(data,srgb)=>{const t=new THREE.DataArrayTexture(data,16,16,layers);t.format=THREE.RGBAFormat;t.magFilter=THREE.NearestFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.colorSpace=srgb?THREE.SRGBColorSpace:THREE.NoColorSpace;t.needsUpdate=true;return t};
const albedo=texture(bytes.slice(0,size),true),surface=texture(bytes.slice(size,size*2),false);
const canvas=document.querySelector('canvas'),gl=new THREE.WebGLRenderer({canvas,antialias:false,preserveDrawingBuffer:true});
gl.setPixelRatio(1);gl.outputColorSpace=THREE.LinearSRGBColorSpace;gl.setClearColor(0xc5bfa7);
const held=new HeldBlockRenderer(content.blocks,content.items,albedo,surface);
let options;
const draw=kind=>{const {width,height,swing}=options;gl.setSize(width,height);gl.clear();if(swing)held.swing(1000);else held.clear();held.draw(gl,width/height,0,0,swing?1130:2000,1,true,kind);const pixels=new Uint8Array(width*height*4);gl.getContext().readPixels(0,0,width,height,gl.getContext().RGBA,gl.getContext().UNSIGNED_BYTE,pixels);return pixels};
window.renderKind=draw;
window.compareHeld=(width,height,swing)=>{options={width,height,swing};const empty=draw('bucket'),filled=draw('water_bucket'),again=draw('bucket'),refilled=draw('water_bucket');let changed=0,blue=0,mismatch=0,visible=0,center=0,minShellX=width,maxShellX=-1;const background=[filled[0],filled[1],filled[2]];
for(let i=0;i<filled.length;i+=4){if(empty[i]!==filled[i]||empty[i+1]!==filled[i+1]||empty[i+2]!==filled[i+2]){changed++;if(filled[i+2]>filled[i]+12&&filled[i+2]>filled[i+1]+5)blue++;}if(empty[i]!==again[i]||filled[i]!==refilled[i]||empty[i+1]!==again[i+1]||filled[i+1]!==refilled[i+1]||empty[i+2]!==again[i+2]||filled[i+2]!==refilled[i+2])mismatch++;
if(filled[i]!==background[0]||filled[i+1]!==background[1]||filled[i+2]!==background[2]){visible++;const x=(i/4)%width,y=Math.floor(i/4/width);if(Math.abs(x-width/2)<16&&Math.abs(y-height/2)<16)center++;if(filled[i]>40&&Math.abs(filled[i]-filled[i+1])<4&&Math.abs(filled[i+1]-filled[i+2])<4){minShellX=Math.min(minShellX,x);maxShellX=Math.max(maxShellX,x);}}}
return {width,height,swing,changedPixels:changed,waterPixels:blue,visiblePixels:visible,stalePixels:mismatch,centerPixels:center,shellBounds:[minShellX,maxShellX],shellMargin:Math.min(minShellX,width-1-maxShellX)};};
window.cleanupHeld=()=>{held.dispose();albedo.dispose();surface.dispose();gl.renderLists.dispose();const result={...gl.info.memory};gl.dispose();return result;};
window.ready=true;
`;
await bundle({
  stdin: { contents: entry, resolveDir: root, sourcefile: 'held-bucket-fixture.ts', loader: 'ts' },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outfile: join(temp, 'fixture.js'),
  logLevel: 'silent',
});
const server = createServer((req, res) => {
  const file =
    req.url === '/fixture.js'
      ? join(temp, 'fixture.js')
      : req.url === '/engine.wasm'
        ? join(root, 'dist-server/engine.wasm')
        : null;
  if (req.url === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }
  res.writeHead(200, {
    'Content-Type': file
      ? file.endsWith('wasm')
        ? 'application/wasm'
        : 'text/javascript'
      : 'text/html',
  });
  res.end(
    file
      ? readFileSync(file)
      : '<!doctype html><style>body{margin:0}</style><canvas></canvas><script type="module" src="/fixture.js"></script>',
  );
});
await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
const address = server.address();
assert(address && typeof address === 'object');
let browser: Awaited<ReturnType<typeof launchSoftwareBrowser>> | undefined;
const report: Record<string, any> = {
  result: 'FAIL',
  checkedAt: new Date().toISOString(),
  buildId: build.buildId,
  engineHash: build.engineHash,
  rendererSourceSha256: sha(readFileSync(join(root, 'src/render/held-block.ts'))),
  scope:
    'Actual held renderer and native procedural texture arrays on software Chromium; isolated view-model visibility/cache/cleanup, not gameplay or physical-device qualification',
  cases: [],
  errors: [],
};
try {
  browser = await launchSoftwareBrowser();
  const page = await browser.newPage();
  page.on('pageerror', (e) => report.errors.push(e.message));
  page.on('console', (e) => {
    if (e.type() === 'error') report.errors.push(e.text());
  });
  await page.goto(`http://127.0.0.1:${address.port}`);
  await page.waitForFunction(() => (window as any).ready === true);
  for (const [name, width, height] of [
    ['desktop', 900, 650],
    ['portrait', 390, 780],
    ['tablet', 768, 1024],
  ] as const) {
    await page.setViewportSize({ width, height });
    for (const swing of [false, true]) {
      const result = await page.evaluate(
        ({ width, height, swing }) => (window as any).compareHeld(width, height, swing),
        { width, height, swing },
      );
      report.cases.push({ name, ...result });
      const suffix = swing ? 'swing' : 'idle';
      await page.screenshot({ path: new URL(`${name}-${suffix}-filled.png`, folder).pathname });
      await page.evaluate(() => (window as any).renderKind('bucket'));
      await page.screenshot({ path: new URL(`${name}-${suffix}-empty.png`, folder).pathname });
    }
  }
  report.cleanup = await page.evaluate(() => (window as any).cleanupHeld());
  assert.deepEqual(report.cleanup, { geometries: 0, textures: 0 });
  assert.deepEqual(report.errors, []);
  if (process.env.VOXEL_HELD_PROBE !== '1')
    for (const c of report.cases) {
      assert(c.waterPixels >= 40, `${c.name} ${c.swing ? 'swing' : 'idle'} needs visible water`);
      assert(c.visiblePixels >= 500, `${c.name} held model visible`);
      assert(c.shellMargin >= 8, `${c.name} bucket shell must fit the viewport`);
      assert.equal(c.stalePixels, 0);
      assert.equal(c.centerPixels, 0, 'held model must leave the reticle clear');
    }
  report.result = process.env.VOXEL_HELD_PROBE === '1' ? 'OBSERVATION' : 'PASS';
} finally {
  writeFileSync(new URL('report.json', folder), JSON.stringify(report, null, 2) + '\n');
  await browser?.close();
  await new Promise<void>((r, j) => server.close((e) => (e ? j(e) : r())));
  rmSync(temp, { recursive: true, force: true });
}
console.log(JSON.stringify(report));
