import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { launchSoftwareBrowser } from './browser-harness.ts';
import { installMemoryProbe } from './browser-memory-probe.ts';

const browser = await launchSoftwareBrowser();
try {
  const context = await browser.newContext();
  await context.addInitScript(installMemoryProbe);
  const page = await context.newPage();
  const result = await page.evaluate(() => {
    const probe = () => (window as any).voxelMemoryProbe();
    const canvas = document.createElement('canvas'),
      gl = canvas.getContext('webgl2')!;
    if (!gl) throw Error('WebGL2 unavailable');
    const a = gl.createBuffer(),
      b = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, a);
    gl.bufferData(gl.ARRAY_BUFFER, 64, gl.STATIC_DRAW);
    const allocated = probe();
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(10), gl.STATIC_DRAW, 2, 3);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(8), gl.STATIC_DRAW);
    const resized = probe();
    gl.deleteBuffer(a);
    gl.deleteBuffer(b);
    gl.deleteBuffer(b);
    const removed = probe();
    // One exported memory, initially one page, then grown to two pages.
    const instance = new WebAssembly.Instance(
      new WebAssembly.Module(
        new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 5, 3, 1, 0, 1, 7, 10, 1, 6, 109, 101, 109, 111, 114, 121, 2,
          0,
        ]),
      ),
    );
    const memory = instance.exports.memory as WebAssembly.Memory;
    const initialWasm = probe();
    memory.grow(1);
    const grownWasm = probe();
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return { allocated, resized, removed, initialWasm, grownWasm };
  });
  assert.equal(result.allocated.gpuBuffers.live, 2);
  assert.equal(result.allocated.gpuBuffers.bytes, 64);
  assert.equal(result.resized.gpuBuffers.bytes, 28);
  assert.deepEqual(result.removed.gpuBuffers, {
    created: 2,
    deleted: 2,
    live: 0,
    bytes: 0,
    peakBytes: 64,
  });
  assert.deepEqual(result.initialWasm.wasm, [65536]);
  assert.deepEqual(result.grownWasm.wasm, [131072]);
  const report = { result: 'BROWSER_MEMORY_PROBE_KNOWN_ALLOCATION_PASS', ...result };
  mkdirSync(new URL('../test-results/', import.meta.url), { recursive: true });
  writeFileSync(
    new URL('../test-results/browser-memory-probe.json', import.meta.url),
    JSON.stringify(report, null, 2) + '\n',
  );
  console.log(JSON.stringify(report));
  await context.close();
} finally {
  await browser.close();
}
