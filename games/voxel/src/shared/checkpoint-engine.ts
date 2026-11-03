// Reviewed additive Wasm export only: biome_at reads the existing generator.
// Terrain, physics, semantic IDs and every saved representation are unchanged.
export const PRE_BIOME_ENGINE = 'cafaedd1659c408eb5d7f548043e8632647fbbd93bb03044f189f0a1b20cc388';
export const BIOME_QUERY_ENGINE =
  '83a2ee1a6f731a6b6f515f16a121ca38311bb126266508d394177127f8ea1237';
export function compatibleCheckpointEngine(saved: unknown, current: string): boolean {
  return saved === current || (current === BIOME_QUERY_ENGINE && saved === PRE_BIOME_ENGINE);
}
