import { initSync, set_content } from '../../engine/pkg/voxel_engine.js';
import * as engine from '../../engine/pkg/voxel_engine.js';
import wasmUrl from '../../engine/pkg/voxel_engine_bg.wasm?url';
import manifest from '../../artifacts/content.json' with { type: 'json' };
import build from '../../artifacts/build.json' with { type: 'json' };
import type { ContentManifest } from '../shared/content.ts';
import type { BuildIdentity } from '../shared/protocol.ts';
export const content = manifest as ContentManifest;
export const identity = build as BuildIdentity;
let loading: Promise<{ module: WebAssembly.Module; memory: WebAssembly.Memory }> | null = null;
export function loadEngine(): Promise<{ module: WebAssembly.Module; memory: WebAssembly.Memory }> {
  return (loading ??= (async () => {
    const response = await fetch(wasmUrl);
    if (!response.ok) throw new Error('engine download failed');
    const bytes = await response.arrayBuffer();
    const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), (b) =>
      b.toString(16).padStart(2, '0'),
    ).join('');
    if (digest !== identity.engineHash || identity.contentHash !== content.hash)
      throw new Error('incompatible engine/content artifacts');
    const module = await WebAssembly.compile(bytes),
      output = initSync({ module });
    set_content(JSON.stringify(content));
    return { module, memory: output.memory };
  })());
}
export function supportProblem(): string | null {
  if (typeof WebAssembly !== 'object' || typeof Worker !== 'function')
    return 'הדפדפן אינו תומך בהפעלת המשחק';
  const simd = new Uint8Array([
    0,
    97,
    115,
    109,
    1,
    0,
    0,
    0,
    1,
    5,
    1,
    96,
    0,
    1,
    123,
    3,
    2,
    1,
    0,
    10,
    22,
    1,
    20,
    0,
    253,
    12,
    ...new Array(16).fill(0),
    11,
  ]);
  if (!WebAssembly.validate(simd)) return 'נדרש דפדפן התומך ב־WebAssembly SIMD';
  const gl = document.createElement('canvas').getContext('webgl2');
  if (!gl) return 'נדרשת תמיכה ב־WebGL2';
  gl.getExtension('WEBGL_lose_context')?.loseContext();
  return null;
}
export { engine };
