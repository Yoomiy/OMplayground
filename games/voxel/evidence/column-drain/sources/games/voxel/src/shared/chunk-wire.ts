/** Ordered baselines/patches contain a column revision and a subscription incarnation. */
export type ChunkFrame = {
  kind: 'baseline' | 'patch';
  x: number;
  z: number;
  subscription: number;
  revision: number;
  edits: readonly (readonly [number, number])[];
};
const HEADER = 24;
export const chunkByteLength = (edits: number): number => HEADER + edits * 6;
export const MAX_COLUMN_REVISION = 0xffffffff;
export function encodeChunk(frame: ChunkFrame): Uint8Array {
  const bytes = new Uint8Array(chunkByteLength(frame.edits.length)),
    view = new DataView(bytes.buffer);
  bytes.set(new TextEncoder().encode(frame.kind === 'baseline' ? 'VXB2' : 'VXP2'));
  view.setInt32(4, frame.x, true);
  view.setInt32(8, frame.z, true);
  view.setUint32(12, frame.subscription, true);
  view.setUint32(16, frame.revision, true);
  view.setUint32(20, frame.edits.length, true);
  frame.edits.forEach(([local, state], i) => {
    view.setUint32(HEADER + i * 6, local, true);
    view.setUint16(HEADER + i * 6 + 4, state, true);
  });
  return bytes;
}
export function decodeChunk(bytes: Uint8Array, stateCount: number): ChunkFrame | null {
  if (bytes.byteLength < HEADER) return null;
  const tag = new TextDecoder().decode(bytes.subarray(0, 4));
  if (tag !== 'VXB2' && tag !== 'VXP2') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
    x = view.getInt32(4, true),
    z = view.getInt32(8, true),
    subscription = view.getUint32(12, true),
    revision = view.getUint32(16, true),
    count = view.getUint32(20, true);
  if (
    x < -16 ||
    x > 15 ||
    z < -16 ||
    z > 15 ||
    !subscription ||
    count > 65536 ||
    bytes.byteLength !== HEADER + count * 6
  )
    return null;
  const edits: [number, number][] = [],
    seen = new Set<number>();
  for (let i = 0; i < count; i++) {
    const local = view.getUint32(HEADER + i * 6, true),
      state = view.getUint16(HEADER + i * 6 + 4, true);
    if (local >= 65536 || state >= stateCount || state === 65535 || seen.has(local)) return null;
    seen.add(local);
    edits.push([local, state]);
  }
  return { kind: tag === 'VXB2' ? 'baseline' : 'patch', x, z, subscription, revision, edits };
}
export function localIndex(x: number, y: number, z: number): number {
  return (y << 8) | ((z & 15) << 4) | (x & 15);
}
export function worldCell(cx: number, cz: number, local: number): [number, number, number] {
  return [cx * 16 + (local & 15), local >>> 8, cz * 16 + ((local >>> 4) & 15)];
}
