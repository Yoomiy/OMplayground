import assert from 'node:assert/strict';
import { test } from 'node:test';
import { source } from '../content/index.ts';
import { COLORS } from '../content/helpers.ts';
import { compileContent, textures } from '../tools/compile-content.ts';
import { Inventories } from '../src/sim/inventory.ts';
import { makeStack, matchRecipe, validStack } from '../src/shared/inventory.ts';
import { blockDrops } from '../src/shared/loot.ts';
import { itemGeometry } from '../src/render/held-block.ts';
import { worldItemMaterial } from '../src/render/held-block.ts';
import { Texture } from 'three';
import { parseClientMessage } from '../src/shared/protocol.ts';
import { creativePalette } from '../src/client/palette.ts';
import type { ItemDefinition } from '../src/shared/content.ts';
const { manifest: content } = compileContent(source);
const items = new Map(content.items.map((item) => [item.itemType, item]));

test('creative catalog has stable unique state keys even when multiple owned items place the same block', () => {
  const choices = creativePalette(content),
    water = content.blocks.findIndex((block) => block.name === 'water');
  assert.equal(choices.length, new Set(choices.map((choice) => choice.key)).size);
  assert.equal(choices.filter((choice) => choice.state === water).length, 1);
  assert.ok(
    content.items.some((item) => item.itemType === 'water_bucket' && item.places === 'water'),
  );
  assert.equal(
    choices.length,
    new Set(
      content.items.flatMap((item) =>
        item.places &&
        content.blocks.some((block) => block.name === item.places && block.placeable !== false)
          ? [item.places]
          : [],
      ),
    ).size,
  );
  assert.deepEqual(
    creativePalette({ ...content, items: [...content.items, ...content.items] }),
    choices,
  );
});

test('mixed wood and fuel recipes use authored tags, reject forged stack tags and overlapping literals', () => {
  const stack = (kind: string) => makeStack(items.get(kind)!, 1);
  const mixed = ['birch_planks', 'spruce_planks', 'oak_planks', 'birch_planks'].map(stack);
  assert.equal(matchRecipe(mixed, 2, content.recipes, items)?.key, 'crafting_table');
  assert.equal(
    matchRecipe([stack('sand'), stack('coal'), null, null], 2, content.recipes, items)?.key,
    'glass',
  );
  assert.equal(
    matchRecipe([stack('sand'), stack('charcoal'), null, null], 2, content.recipes, items)?.key,
    'glass',
  );
  assert.equal(validStack({ itemType: 'dirt', count: 1, tags: ['planks'] }, items), false);
  assert.equal(matchRecipe(Array(4).fill(stack('dirt')), 2, content.recipes, items), null);
  assert.throws(
    () =>
      compileContent({
        ...source,
        recipes: [
          ...source.recipes,
          {
            key: 'ambiguous_wood',
            size: 2,
            ingredients: ['birch_planks', 'spruce_planks', 'oak_planks', 'birch_planks'],
            result: { itemType: 'stick', count: 1 },
          },
        ],
      }),
    /overlapping recipes/,
  );
  assert.equal(
    compileContent({ ...source, items: [...source.items].reverse() }).manifest.hash,
    content.hash,
  );
});

test('water containers exchange in place even in a full bag, and reject stale, repeated or failed mutations', () => {
  const inventory = new Inventories(content, { station: () => null, canUse: () => true });
  inventory.join('a');
  inventory.receive('a', makeStack(items.get('bucket')!, 1));
  for (let i = 1; i < 36; i++) inventory.receive('a', makeStack(items.get('stone')!, 64));
  const view = () => inventory.view('a'),
    start = view();
  assert.ok(start.bag.every(Boolean));
  let calls = 0;
  const change = () => {
    calls++;
    return true;
  };
  assert.equal(inventory.collect('a', start.revision - 1, 'water', change).reason, 'conflict');
  assert.equal(inventory.collect('a', start.revision, 'lava', change).reason, 'container_required');
  assert.equal(calls, 0);
  assert.equal(inventory.collect('a', start.revision, 'water', () => false).ok, false);
  assert.throws(
    () =>
      inventory.collect('a', start.revision, 'water', () => {
        throw new Error('world failure');
      }),
    /world failure/,
  );
  assert.deepEqual(view(), start);
  assert.equal(inventory.collect('a', start.revision, 'water', change).ok, true);
  assert.deepEqual(view().bag[0], { itemType: 'water_bucket', count: 1 });
  assert.deepEqual(view().bag.slice(1), start.bag.slice(1));
  assert.equal(inventory.collect('a', start.revision, 'water', change).ok, false);
  const filled = view();
  assert.equal(inventory.place('a', filled.revision, 'water', () => false).ok, false);
  assert.deepEqual(view(), filled);
  assert.equal(inventory.place('a', filled.revision, 'water', change).ok, true);
  assert.deepEqual(view().bag, start.bag);
  assert.equal(view().revision, start.revision + 2);
  assert.equal(calls, 2);
});

test('compiler and wire enforce reciprocal nonstacking fluid containers and carry no client reward', () => {
  const mutate = (kind: string, patch: Partial<ItemDefinition>) =>
    compileContent({
      ...source,
      items: source.items.map((item) => (item.itemType === kind ? { ...item, ...patch } : item)),
    });
  assert.throws(() => mutate('bucket', { maxStack: 64 }), /collectible container/);
  assert.throws(
    () => mutate('bucket', { collects: { family: 'stone', result: 'water_bucket' } }),
    /collectible container/,
  );
  assert.throws(() => mutate('water_bucket', { remainder: 'diamond' }), /container|remainder/);
  assert.throws(() => mutate('water_bucket', { remainder: '' }), /container|remainder/);
  const intent = {
    type: 'action',
    kind: 'collect',
    epoch: 1,
    sequence: 1,
    inputSequence: 2,
    target: [1, 64, 1],
    state: 0,
    inventoryRevision: 0,
    revisions: [{ x: 0, z: 0, revision: 0 }],
  };
  assert.deepEqual(parseClientMessage(JSON.stringify(intent)), intent);
  assert.equal(parseClientMessage(JSON.stringify({ ...intent, state: 1 })), null);
  assert.equal(parseClientMessage(JSON.stringify({ ...intent, result: 'water_bucket' })), null);
});

test('filled buckets retain an opaque metal shell and contain a separate water-textured surface', () => {
  const texture = new Texture();
  try {
    for (const kind of ['bucket', 'water_bucket']) {
      const item = items.get(kind)!,
        material = worldItemMaterial(item, content.blocks, texture, texture),
        geometry = itemGeometry(item, content.blocks);
      try {
        assert.equal(material.transparent, false);
        assert.equal(material.depthWrite, true);
        assert.equal(material.uniforms.uAlpha.value, 1);
        const layers = new Set(Array.from(geometry.getAttribute('layer').array));
        assert.ok(layers.has(textures.indexOf('iron_block')));
        assert.equal(layers.has(textures.indexOf('water')), kind === 'water_bucket');
      } finally {
        material.dispose();
        geometry.dispose();
      }
    }
  } finally {
    texture.dispose();
  }
});

test('forage is deterministic from seed, cell and full committed revision, retains guaranteed loot and covers its weighted outcomes', () => {
  const grass = content.behavior.find((block) => block.family === 'short_grass')!;
  const counts = new Map<string, number>();
  const original = JSON.stringify(grass);
  for (let n = 0; n < 20000; n++) {
    const cell = [(n % 127) - 63, 65, Math.floor(n / 127) - 78] as const;
    const result = blockDrops(grass, 4242, cell, n + 2 ** 32);
    assert.deepEqual(result, blockDrops(grass, 4242, cell, n + 2 ** 32));
    assert.deepEqual(result[0], { itemType: 'plant_fiber', count: 1 });
    assert.ok(result.length === 1 || result.length === 2);
    const kind = result[1]?.itemType ?? 'none';
    counts.set(kind, (counts.get(kind) ?? 0) + 1);
  }
  const total =
    grass.forage!.none + grass.forage!.entries.reduce((sum, entry) => sum + entry.weight, 0);
  for (const entry of [
    { itemType: 'none', weight: grass.forage!.none },
    ...grass.forage!.entries,
  ]) {
    const expected = (20000 * entry.weight) / total;
    assert.ok(
      Math.abs((counts.get(entry.itemType) ?? 0) - expected) < Math.max(30, expected * 0.25),
      entry.itemType,
    );
  }
  assert.equal(JSON.stringify(grass), original);
  const samples = (seed: number, revision: number) =>
    Array.from({ length: 64 }, (_, i) => blockDrops(grass, seed, [i, 64, -2], revision));
  assert.notDeepEqual(samples(1, 0), samples(1, 2 ** 32));
  assert.notDeepEqual(samples(1, 0), samples(2, 0));
});

test('all authored item forms have finite geometry, real texture layers and complete solid colored glass palettes', () => {
  for (const item of content.items) {
    const geometry = itemGeometry(item, content.blocks);
    try {
      const position = geometry.getAttribute('position'),
        layer = geometry.getAttribute('layer');
      assert.ok(position.count > 0, item.itemType);
      assert.ok(Array.from(position.array).every(Number.isFinite), item.itemType);
      assert.ok(
        Array.from(layer.array).every((value) => value >= 0 && value < textures.length),
        item.itemType,
      );
      geometry.computeBoundingBox();
      assert.ok(
        geometry.boundingBox!.min.y >= -0.6 && geometry.boundingBox!.max.y <= 0.6,
        item.itemType,
      );
    } finally {
      geometry.dispose();
    }
  }
  for (const color of COLORS) {
    const glass = content.blocks.find((block) => block.name === `${color}_stained_glass`)!;
    assert.equal(glass.shape, 'cube');
    assert.equal(glass.solid, true);
    assert.equal(glass.opaque, false);
    assert.equal(glass.opacity, 0);
    assert.equal(glass.layer, 2);
    assert.equal(textures[glass.tex[0]], `${color}_stained_glass`);
  }
});
