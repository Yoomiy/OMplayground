import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compileContent } from '../tools/compile-content.ts';
import { source } from '../content/index.ts';
test('semantic manifest and IDs are deterministic across authoring order', () => {
  const a = compileContent(source),
    b = compileContent({
      ...source,
      blocks: [...source.blocks].reverse(),
      items: [...source.items].reverse(),
    });
  assert.equal(a.manifest.hash, b.manifest.hash);
  assert.deepEqual(a.states, b.states);
  const reversedKeys = JSON.parse(
    JSON.stringify(source, (_key, value: unknown) =>
      value && typeof value === 'object' && !Array.isArray(value)
        ? Object.fromEntries(Object.entries(value).reverse())
        : value,
    ),
  );
  assert.equal(a.manifest.hash, compileContent(reversedKeys).manifest.hash);
  assert.equal(a.defaults.air, 0);
  assert.equal(a.manifest.schema, 2);
  assert.equal(a.manifest.blocks[a.defaults.ladder].solid, false);
});
test('compiler assigns ordinary states across the u8 boundary with no reserved stock pool', () => {
  const plain = source.blocks.find((b) => b.family === 'stone')!;
  const blocks = Array.from({ length: 300 }, (_, n) => ({
    ...plain,
    family: `test_${String(n).padStart(3, '0')}`,
    drops: [],
  }));
  const result = compileContent({ ...source, blocks: [...source.blocks, ...blocks] });
  assert.ok(result.defaults.test_299 > 255);
  assert.ok(result.defaults.bedrock < 187);
  assert.equal(result.manifest.blocks[result.defaults.test_299].name, 'test_299');
});
test('unknown references, duplicate states, malformed shapes, and recipes fail the build', () => {
  assert.throws(
    () => compileContent({ ...source, blocks: [...source.blocks, source.blocks[0]] }),
    /duplicate/,
  );
  assert.throws(
    () =>
      compileContent({
        ...source,
        items: [
          ...source.items,
          { itemType: 'broken', labelKey: 'item.broken', maxStack: 64, places: 'missing' },
        ],
      }),
    /unknown/,
  );
  assert.throws(
    () =>
      compileContent({
        ...source,
        recipes: [
          {
            key: 'bad',
            size: 2,
            ingredients: ['missing', null, null, null],
            result: { itemType: 'stone', count: 1 },
          },
        ],
      }),
    /ingredients/,
  );
  const stone = source.blocks.find((b) => b.family === 'stone')!;
  for (const engine of [
    { shape: 'boxes', boxes: [[0, 0, 0, 17, 16, 16]], textures: Array(6).fill('stone') },
    { shape: 'cube', textures: Array(6).fill('missing') },
    { shape: 'cube', textures: Array(6).fill('stone'), emit: 16 },
  ])
    assert.throws(() =>
      compileContent({
        ...source,
        blocks: source.blocks.map((b) =>
          b === stone ? { ...b, variants: { '': engine as (typeof stone.variants)[string] } } : b,
        ),
      }),
    );
});
