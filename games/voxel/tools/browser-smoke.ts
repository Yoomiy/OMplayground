import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { once } from 'node:events';
import { chromium } from 'playwright';
import { engine, content, wasmBytes, wasmModule } from '../tests/wasm/fixture.ts';
// The scenario is plain JS so workers and Node execute exactly the same trace.
// @ts-expect-error Plain browser-compatible module has no declarations.
import { runScenario } from './wasm-scenario.mjs';
const files: Record<string, { type: string; data: string | Uint8Array }> = {
  '/engine.js': {
    type: 'text/javascript',
    data: readFileSync(new URL('../engine/pkg/voxel_engine.js', import.meta.url)),
  },
  '/engine.wasm': { type: 'application/wasm', data: wasmBytes },
  '/scenario.js': {
    type: 'text/javascript',
    data: readFileSync(new URL('wasm-scenario.mjs', import.meta.url)),
  },
  '/': {
    type: 'text/html',
    data: '<!doctype html><html><title>Voxel Wasm smoke</title><body>Voxel compute smoke</body></html>',
  },
};
const worker = `import {initSync} from '/engine.js'; import * as engine from '/engine.js'; import {runScenario} from '/scenario.js';
self.onmessage = async ({data}) => { try { initSync({module:data.module}); self.postMessage({result:await runScenario(engine,data.manifest)}); } catch(error) { self.postMessage({error:String(error)}); } };`;
files['/worker.js'] = { type: 'text/javascript', data: worker };
const server = createServer((req, res) => {
  const file = files[req.url || '/'];
  if (!file) {
    res.writeHead(404);
    res.end();
    return;
  }
  res.writeHead(200, { 'Content-Type': file.type, 'Cache-Control': 'no-store' });
  res.end(file.data);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
const address = server.address();
assert.ok(address && typeof address === 'object');
const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'],
});
const errors: string[] = [];
try {
  const expected = await runScenario(engine, content.manifest);
  const baseline = JSON.parse(
    readFileSync(new URL('../artifacts/content.json', import.meta.url), 'utf8'),
  );
  const baseEngine = await import(
    new URL('../engine/pkg/voxel_engine.js?baseline', import.meta.url).href
  );
  baseEngine.initSync({ module: wasmModule });
  const expectedBaseline = await runScenario(baseEngine, baseline);
  const page = await browser.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${address.port}`, { waitUntil: 'domcontentloaded' });
  const observed = await page.evaluate(
    async ({ manifest, baseline }) => {
      // Dynamic URL imports are resolved by the browser, not this Node TypeScript module.
      const dynamicImport = (url: string) => import(url);
      const engine = await dynamicImport('/engine.js'),
        { runScenario } = await dynamicImport('/scenario.js');
      const module = await WebAssembly.compileStreaming(fetch('/engine.wasm'));
      engine.initSync({ module });
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) throw new Error('WebGL2 unavailable');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      const main = await runScenario(engine, manifest);
      async function inWorker(manifest: unknown) {
        const worker = new Worker('/worker.js', { type: 'module' });
        try {
          return await new Promise<unknown>((resolve, reject) => {
            const deadline = setTimeout(() => reject(new Error('worker timed out')), 20000);
            worker.onerror = (event) => {
              clearTimeout(deadline);
              reject(new Error(event.message));
            };
            worker.onmessage = ({ data }) => {
              clearTimeout(deadline);
              data.error ? reject(new Error(data.error)) : resolve(data.result);
            };
            worker.postMessage({ module, manifest });
          });
        } finally {
          worker.terminate();
        }
      }
      return { main, background: await inWorker(manifest), baseline: await inWorker(baseline) };
    },
    { manifest: content.manifest, baseline },
  );
  assert.deepEqual(observed.main, expected);
  assert.deepEqual(observed.background, expected);
  assert.deepEqual(observed.baseline, expectedBaseline);
  assert.deepEqual(errors, []);
  const result = {
    result: 'PASS',
    scope:
      'Release Wasm compute parity in Node, Chromium, and a module worker; WebGL2 availability only; no renderer or hardware FPS claim',
    browser: browser.version(),
    engineHash: createHash('sha256').update(wasmBytes).digest('hex'),
    contentHash: baseline.hash,
    highIdFixtureHash: content.manifest.hash,
    highIdScenario: expected,
    productionContentScenario: expectedBaseline,
    errors,
  };
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../test-results/browser-wasm.json', import.meta.url),
    JSON.stringify(result, null, 2) + '\n',
  );
  console.log(
    `Node/Chromium/worker parity passes: high state ${expected.high}, mesh ${expected.meshHash.slice(0, 12)}`,
  );
} finally {
  await browser.close();
  await new Promise<void>((resolve) => server.close(() => resolve()));
}
