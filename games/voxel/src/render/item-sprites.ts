import type { ItemDefinition } from '../shared/content.ts';
import { ITEM_PIXELS } from './upstream/blockyard/item-pixels.ts';

const cache = new Map<string, Uint8Array>();
/** Upstream sprites plus documented palette variants, shared by inventory, held items and drops. */
export function itemSprite(item: ItemDefinition): Uint8Array | null {
  const hex = ITEM_PIXELS[item.itemType];
  if (!hex || item.places) return null;
  let pixels = cache.get(item.itemType);
  if (!pixels) {
    pixels = Uint8Array.from({ length: hex.length / 2 }, (_, i) =>
      parseInt(hex.slice(i * 2, i * 2 + 2), 16),
    );
    cache.set(item.itemType, pixels);
  }
  return pixels;
}
