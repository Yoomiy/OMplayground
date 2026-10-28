import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { content, engine, flatWorld } from './fixture.ts';
import { roomFixture } from './room-fixture.ts';
import { ingredientMatches } from '../../src/shared/recipes.ts';
import { miningPlan } from '../../src/sim/mining.ts';
import { COLORS } from '../../content/helpers.ts';
import { textures } from '../../tools/compile-content.ts';
import { blockDrops } from '../../src/shared/loot.ts';
import type { InventoryCommand, InventoryArea } from '../../src/shared/inventory.ts';
import type { Cell } from '../../src/shared/protocol.ts';
import type { ClientMessage } from '../../src/shared/protocol.ts';

test('natural generation retains all three wood identities instead of falling back on unmatched native axis states', () => {
  const generator = new engine.TerrainGen(4242),
    missing = new Set([
      'oak_log',
      'birch_log',
      'spruce_log',
      'oak_leaves',
      'birch_leaves',
      'spruce_leaves',
    ]);
  try {
    for (let x = -16; x < 16 && missing.size; x += 4)
      for (let z = -16; z < 16 && missing.size; z += 4) {
        const bytes = generator.generate(x, z),
          view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        for (let offset = 1032; offset < bytes.length; offset += 2)
          missing.delete(content.manifest.blocks[view.getUint16(offset, true)].name);
      }
    assert.deepEqual(
      [...missing],
      [],
      'bounded natural samples must contain actual semantic logs/leaves, not stone aliases',
    );
  } finally {
    generator.free();
  }
});

test('weighted mining loot uses the committed revision once and a failed native edit awards nothing', () => {
  const f = roomFixture();
  try {
    f.tick(20);
    const target = f.target('short_grass'),
      rule = content.manifest.behavior.find((block) => block.family === 'short_grass')!;
    let expected = blockDrops(
      rule,
      4242,
      target,
      f.store.revision(target[0] >> 4, target[2] >> 4) + 1,
    );
    for (let n = 0; expected.length < 2 && n < 128; n++) {
      f.store.set(
        target[0] + 4,
        target[1],
        target[2],
        n % 2 ? content.defaults.stone : content.defaults.dirt,
      );
      expected = blockDrops(
        rule,
        4242,
        target,
        f.store.revision(target[0] >> 4, target[2] >> 4) + 1,
      );
    }
    assert.equal(
      expected.length,
      2,
      'exercise an actual weighted bonus, not only the guaranteed fiber',
    );
    f.aim(target);
    const command = (): Extract<ClientMessage, { type: 'mining' }> => ({
      type: 'mining',
      epoch: f.player().epoch,
      sequence: f.next(),
      inputSequence: f.inputs.get('a')!,
      target,
      revision: f.store.revision(target[0] >> 4, target[2] >> 4),
      inventoryRevision: f.room.inventories.held('a').revision,
    });
    const before = f.room.inventories.view('a'),
      revision = f.store.revision(target[0] >> 4, target[2] >> 4),
      original = f.store.set,
      ticks = miningPlan(rule, undefined).ticks + 1;
    let failedWrites = 0;
    assert.equal(f.send(command()).outcome?.ok, true);
    try {
      f.store.set = () => {
        failedWrites++;
        return null;
      };
      f.tick(ticks);
    } finally {
      f.store.set = original;
    }
    assert.equal(failedWrites, 1);
    assert.equal(f.player().mining, null);
    assert.equal(f.store.world.get_block(...target), content.defaults.short_grass);
    assert.equal(f.store.revision(target[0] >> 4, target[2] >> 4), revision);
    assert.deepEqual(f.room.inventories.view('a'), before);
    assert.equal(f.room.drops.size, 0);
    const accepted = command();
    assert.equal(f.send(accepted).outcome?.ok, true);
    f.tick(ticks);
    const p = f.state(),
      loot = () =>
        f.room.drops
          .nearby([p[0], p[1], p[2]], 32)
          .map((drop) => drop.stack)
          .sort((a, b) => a.itemType.localeCompare(b.itemType));
    assert.deepEqual(
      loot(),
      expected.sort((a, b) => a.itemType.localeCompare(b.itemType)),
    );
    assert.equal(f.store.revision(target[0] >> 4, target[2] >> 4), revision + 1);
    assert.equal(f.send(accepted).status, 'cached');
    for (let n = 0; n < 140; n++)
      f.send({ type: 'flight', epoch: f.player().epoch, sequence: f.next(), on: true });
    assert.equal(f.send(accepted).status, 'retired');
    assert.deepEqual(loot(), expected);
  } finally {
    f.room.dispose();
  }
});

test('empty owned inventory progresses through native harvest, placed workbench, four tool tiers, refining, armor, bucket and cooked food', () => {
  // Only terrain is arranged by this fixture. Every owned item is mined/picked up or crafted;
  // there are no inventory grants. This is a controlled domain/native route, not a seed travel test.
  const f = roomFixture(),
    inventory = f.room.inventories,
    items = new Map(content.manifest.items.map((item) => [item.itemType, item]));
  try {
    f.tick(20);
    assert.ok(inventory.view('a').bag.every((slot) => slot === null));
    const view = () => inventory.view('a');
    const run = (command: InventoryCommand) => {
      const result = inventory.transact('a', command, false);
      assert.equal(result.ok, true, JSON.stringify({ command, result, view: view() }));
    };
    const amount = (kind: string) =>
      view().bag.reduce((n, stack) => n + (stack?.itemType === kind ? stack.count : 0), 0);
    const move = (
      from: InventoryArea,
      slot: number,
      to: InventoryArea,
      target: number,
      count: number,
    ) =>
      run({
        kind: 'move',
        from: { area: from, slot },
        to: { area: to, slot: target },
        count,
        revision: view().revision,
        containerId: null,
        containerRevision: null,
      });
    const select = (kind: string) => {
      let slot = view().bag.findIndex((stack) => stack?.itemType === kind);
      assert.ok(slot >= 0, kind);
      if (slot >= 9) {
        move('bag', slot, 'bag', 0, view().bag[slot]!.count);
        slot = 0;
      }
      run({ kind: 'select', slot, revision: view().revision });
    };
    const harvest = (family: string) => {
      const p = f.state(),
        cell: Cell = [Math.floor(p[0]), 65, Math.floor(p[2]) - 1];
      assert.ok(f.store.set(...cell, content.defaults[family]));
      f.aim(cell);
      const held = inventory.held('a').stack,
        item = held ? items.get(held.itemType) : undefined,
        rule = content.manifest.behavior.find((block) => block.family === family)!,
        plan = miningPlan(rule, item);
      assert.equal(plan.allowed, true, `${family} with ${held?.itemType}`);
      const result = f.start(cell);
      assert.equal(result.outcome?.ok, true, JSON.stringify(result));
      f.tick(plan.ticks + 30);
      assert.equal(f.store.world.get_block(...cell), 0, family);
      assert.equal(
        f.room.drops.size,
        0,
        `all ${family} loot must be picked up through native reach/LOS`,
      );
    };
    const craft = (key: string, count = 1) => {
      const recipe = content.manifest.recipes.find((recipe) => recipe.key === key)!;
      assert.ok(recipe, key);
      const area = recipe.size === 2 ? 'craft2' : 'craft3';
      assert.ok(view()[area].every((slot) => slot === null));
      recipe.ingredients.forEach((ingredient, target) => {
        if (!ingredient) return;
        const slot = view().bag.findIndex(
          (stack) =>
            !!stack && stack.count >= count && ingredientMatches(ingredient, stack.itemType, items),
        );
        assert.ok(slot >= 0, `${key} needs ${count} ${ingredient}`);
        move('bag', slot, area, target, count);
      });
      run({ kind: 'craft', grid: recipe.size, count, revision: view().revision });
      assert.ok(view()[area].every((slot) => slot === null));
    };
    for (const wood of ['oak', 'birch', 'spruce', 'oak']) harvest(`${wood}_log`);
    craft('oak_planks', 2);
    craft('birch_planks');
    craft('spruce_planks');
    craft('crafting_table');
    craft('stick', 2);
    select('crafting_table');
    const p = f.state();
    f.aim([Math.floor(p[0]) + 3, 63, Math.floor(p[2])]);
    const c = f.player().controls,
      s = f.state(),
      cos = Math.cos(c.pitch),
      hit = f.store.world.raycast(
        s[0],
        s[1] + 1.62,
        s[2],
        Math.sin(c.yaw) * cos,
        Math.sin(c.pitch),
        -Math.cos(c.yaw) * cos,
        6,
      );
    assert.equal(hit[0], 1);
    const target: Cell = [hit[1], hit[2], hit[3]],
      result = f.send({
        type: 'action',
        kind: 'place',
        epoch: f.player().epoch,
        sequence: f.next(),
        inputSequence: f.inputs.get('a')!,
        target,
        state: content.defaults.crafting_table,
        inventoryRevision: view().revision,
        revisions: [
          {
            x: target[0] >> 4,
            z: target[2] >> 4,
            revision: f.store.revision(target[0] >> 4, target[2] >> 4),
          },
        ],
      });
    assert.equal(result.outcome?.ok, true, JSON.stringify(result));
    const table = result.outcome!.cell!;
    f.aim(table);
    run({ kind: 'open', target: table });
    craft('wooden_pickaxe');
    select('wooden_pickaxe');
    const ore = f.target('iron_ore');
    f.aim(ore);
    assert.equal(f.start(ore).outcome?.reason, 'tool_required');
    f.store.set(...ore, 0);
    for (let n = 0; n < 3; n++) harvest('stone');
    craft('stone_pickaxe');
    select('stone_pickaxe');
    const diamond = f.target('diamond_ore');
    f.aim(diamond);
    assert.equal(f.start(diamond).outcome?.reason, 'tool_required');
    f.store.set(...diamond, 0);
    for (let n = 0; n < 13; n++) harvest('coal_ore');
    for (let n = 0; n < 11; n++) harvest('iron_ore');
    assert.equal(amount('iron_ore'), 11);
    assert.equal(amount('coal'), 13);
    craft('iron_ingot', 11);
    craft('iron_pickaxe');
    select('iron_pickaxe');
    for (let n = 0; n < 3; n++) harvest('diamond_ore');
    craft('diamond_pickaxe');
    assert.equal(items.get('diamond_pickaxe')!.tool!.tier, 4);
    assert.equal(
      view().bag.find((stack) => stack?.itemType === 'diamond_pickaxe')!.instance!.durability,
      400,
    );
    craft('iron_vest');
    craft('bucket');
    const vest = view().bag.findIndex((stack) => stack?.itemType === 'iron_vest');
    move('bag', vest, 'equipment', 1, 1);
    f.tick();
    assert.equal(inventory.appearance('a').equipment.body, 'iron_vest');
    assert.equal(f.baseline('a').movement.speed, 0.95);
    select('diamond_pickaxe');
    for (let n = 0; n < 160 && (amount('wheat') < 3 || amount('potato') < 1); n++)
      harvest('short_grass');
    assert.ok(
      amount('wheat') >= 3 && amount('potato') >= 1,
      'the fixed forage route must produce ingredients',
    );
    craft('bread');
    craft('baked_potato');
    assert.equal(amount('bread'), 1);
    assert.equal(amount('baked_potato'), 1);
    assert.equal(amount('bucket'), 1);
    assert.equal(amount('iron_ingot'), 0);
    assert.equal(view().equipment[1]?.instance?.durability, 240);
  } finally {
    f.room.dispose();
  }
});

test('actual Wasm emits distinct complete texture palettes and stained glass remains solid, transparent and stationary', () => {
  const pixels = engine.generate_textures(),
    width = 16 * 16 * 4;
  assert.equal(engine.texture_layer_count(), textures.length);
  assert.equal(pixels.length, textures.length * width * 2);
  for (const group of ['wool', 'concrete', 'stained_glass']) {
    const hashes = COLORS.map((color) => {
      const index = textures.indexOf(`${color}_${group}`);
      assert.ok(index >= 0);
      return createHash('sha256')
        .update(pixels.subarray(index * width, (index + 1) * width))
        .digest('hex');
    });
    assert.equal(new Set(hashes).size, 16, group);
  }
  const world = flatWorld();
  try {
    const glass = content.defaults.red_stained_glass;
    world.set_block(2, 2, 2, glass);
    assert.equal(world.collision_top(2, 2, 2), 1);
    assert.equal(world.line_clear(0.5, 2.5, 2.5, 4.5, 2.5, 2.5), false);
    assert.equal(world.raycast_liquids(2.5, 4, 2.5, 0, -1, 0, 6)[8], 1);
    assert.deepEqual(Array.from(world.target_boxes(2, 2, 2)), [0, 0, 0, 16, 16, 16]);
    const registry = JSON.parse(engine.block_registry_json()),
      definition = registry.blocks[glass];
    assert.equal(definition.solid, true);
    assert.equal(definition.opacity, 0);
    assert.equal(definition.anim, 0);
  } finally {
    world.free();
  }
});
