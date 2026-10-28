import type { BlockDefinition } from './content.ts';
import type { Cell } from './protocol.ts';
function mix(value: number): number {
  let n = value >>> 0;
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d);
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b);
  return (n ^ (n >>> 16)) >>> 0;
}
/** Stable authority-side forage roll from durable world identity and the committed column revision. */
export function blockDrops(
  rule: Pick<BlockDefinition, 'drops' | 'forage'>,
  seed: number,
  cell: Cell,
  revision: number,
): { itemType: string; count: number }[] {
  const drops = rule.drops.map((drop) => ({ ...drop }));
  if (!rule.forage) return drops;
  const { none, entries } = rule.forage,
    total = entries.reduce((sum, entry) => sum + entry.weight, none);
  const hash = mix(
    seed ^
      Math.imul(cell[0], 0x1f123bb5) ^
      Math.imul(cell[1], 0x5f356495) ^
      Math.imul(cell[2], 0x6c8e9cf5) ^
      mix(revision >>> 0) ^
      mix(Math.floor(revision / 0x100000000)),
  );
  let roll = (hash % total) - none;
  if (roll < 0) return drops;
  for (const entry of entries) {
    if (roll < entry.weight) {
      drops.push({ itemType: entry.itemType, count: entry.count });
      break;
    }
    roll -= entry.weight;
  }
  return drops;
}
