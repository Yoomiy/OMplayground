import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { source } from '../content/index.ts';
import { compileContent } from './compile-content.ts';
import { ITEM_LABELS } from '../src/client/content-labels.ts';
import { NATURAL_FAMILIES, CREATIVE_ONLY_ITEMS } from '../content/availability.ts';
import { ingredientMatches } from '../src/shared/recipes.ts';
const root = new URL('../', import.meta.url),
  repo = new URL('../../../', import.meta.url);
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
const legacy = read('content/legacy-inventory.json'),
  decisions = read('content/disposition.json');
const content = compileContent(source).manifest,
  items = new Map(content.items.map((item) => [item.itemType, item]));
assert.equal(decisions.schema, 1);
assert.deepEqual(decisions.sources, legacy.sources);
for (const input of decisions.sources)
  assert.equal(
    createHash('sha256')
      .update(readFileSync(new URL(input.path, repo)))
      .digest('hex'),
    input.hash,
    `changed legacy source ${input.path}`,
  );
const required = new Set(
  ['blocks', 'items', 'recipes'].flatMap((category) =>
    legacy[category].map((entry: { key: string }) => `${category}:${entry.key}`),
  ),
);
const seen = new Set<string>(),
  pending: { category: string; key: string; missing: string[] }[] = [];
for (const entry of decisions.entries) {
  const identity = `${entry.category}:${entry.legacyKey}`;
  assert.ok(required.has(identity) && !seen.has(identity), identity);
  seen.add(identity);
  assert.ok(['retain', 'replace', 'combine', 'remove'].includes(entry.decision));
  assert.ok(typeof entry.reason === 'string' && entry.reason.length >= 30, identity);
  assert.equal(entry.targets.length === 0, entry.decision === 'remove', identity);
  const missing: string[] = [];
  for (const target of entry.targets) {
    const exists =
      target.kind === 'block'
        ? content.behavior.some((block) => block.family === target.key)
        : target.kind === 'item'
          ? items.has(target.key)
          : target.kind === 'recipe'
            ? content.recipes.some((recipe) => recipe.key === target.key)
            : target.kind === 'loot'
              ? content.behavior.some(
                  (block) =>
                    block.family === target.key &&
                    block.drops.some((drop) => drop.itemType === target.itemType),
                )
              : false;
    if (!exists) missing.push(`${target.kind}:${target.key}`);
  }
  if (
    entry.requires?.includes('bucket_transfer') &&
    !(
      items.get('bucket')?.collects?.family === 'water' &&
      items.get('bucket')?.collects?.result === 'water_bucket' &&
      items.get('water_bucket')?.places === 'water' &&
      items.get('water_bucket')?.remainder === 'bucket' &&
      content.recipes.some(
        (recipe) => recipe.key === 'bucket' && recipe.result.itemType === 'bucket',
      )
    )
  )
    missing.push('behavior:bucket_transfer');
  if (missing.length) {
    assert.deepEqual(
      entry.requires,
      ['bucket_transfer'],
      `unplanned missing targets ${identity}: ${missing.join(',')}`,
    );
    pending.push({ category: entry.category, key: entry.legacyKey, missing });
  }
}
assert.equal(seen.size, required.size);
for (const item of content.items)
  assert.ok(ITEM_LABELS[item.itemType], `missing Hebrew label ${item.itemType}`);
const available = new Set<string>(),
  world = new Set<string>(NATURAL_FAMILIES);
let changed = true;
while (changed) {
  changed = false;
  const add = (kind: string) => {
    if (!available.has(kind)) {
      available.add(kind);
      changed = true;
    }
  };
  for (const family of world) {
    const rule = content.behavior.find((block) => block.family === family);
    if (!rule) continue;
    const states = content.blocks.filter((block) => block.name === family);
    if (states.every((state) => state.breakable === false)) continue;
    if (
      rule.mining.requiresTool &&
      ![...available].some((kind) => {
        const tool = items.get(kind)?.tool;
        return !!tool && tool.kind === rule.mining.tool && tool.tier >= (rule.mining.tier ?? 0);
      })
    )
      continue;
    for (const drop of rule.drops) add(drop.itemType);
    for (const drop of rule.forage?.entries ?? []) add(drop.itemType);
  }
  for (const recipe of content.recipes)
    if (
      recipe.ingredients.every(
        (ingredient) =>
          ingredient === null ||
          [...available].some((kind) => ingredientMatches(ingredient, kind, items)),
      )
    )
      add(recipe.result.itemType);
  for (const kind of available) {
    const collection = items.get(kind)?.collects;
    if (collection && world.has(collection.family)) add(collection.result);
    const family = items.get(kind)?.places;
    if (family && !world.has(family)) {
      world.add(family);
      changed = true;
    }
  }
}
const unobtainable = content.items
  .filter(
    (item) =>
      !available.has(item.itemType) &&
      !(CREATIVE_ONLY_ITEMS as readonly string[]).includes(item.itemType),
  )
  .map((item) => item.itemType);
const report = {
  result: pending.length || unobtainable.length ? 'INCOMPLETE_CONTENT_GATE' : 'PASS',
  checkedAt: new Date().toISOString(),
  contentHash: content.hash,
  legacyEntries: seen.size,
  decisions: Object.fromEntries(
    ['retain', 'replace', 'combine', 'remove'].map((key) => [
      key,
      decisions.entries.filter((entry: { decision: string }) => entry.decision === key).length,
    ]),
  ),
  pending,
  unobtainable,
  potentiallyReachable: available.size,
  creativeOnly: CREATIVE_ONLY_ITEMS,
  limits:
    'Reachability is a potential-source dependency audit, not a proof of quantities, seed coverage, travel time, balance, bucket behavior or the full survival game.',
};
mkdirSync(new URL('test-results/', root), { recursive: true });
writeFileSync(
  new URL('test-results/content-disposition.json', root),
  JSON.stringify(report, null, 2) + '\n',
);
console.log(JSON.stringify(report, null, 2));
if (process.argv.includes('--require-complete') && (pending.length || unobtainable.length))
  process.exitCode = 1;
