import { createHash } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { source } from '../content/index.ts';
import type { ContentSource } from '../src/shared/content.ts';
import { validStack, EQUIPMENT } from '../src/shared/inventory.ts';
import { recipesOverlap } from '../src/shared/recipes.ts';
export const textures: string[] = JSON.parse(
  readFileSync(new URL('../content/texture-layers.json', import.meta.url), 'utf8'),
);
const keyPattern = /^[a-z][a-z0-9_]{0,63}$/;
function canonical<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, entry: unknown) =>
      entry && typeof entry === 'object' && !Array.isArray(entry)
        ? Object.fromEntries(Object.entries(entry).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
        : entry,
    ),
  );
}
function requireThat(ok: unknown, reason: string): asserts ok {
  if (!ok) throw new Error(reason);
}
export function compileContent(input: ContentSource) {
  const families = [...input.blocks].sort((a, b) =>
    a.family === 'air' ? -1 : b.family === 'air' ? 1 : a.family.localeCompare(b.family, 'en'),
  );
  const familyNames = new Set<string>(),
    itemNames = new Set<string>(),
    states: Record<string, number> = Object.create(null),
    defaults: Record<string, number> = Object.create(null);
  const rows: {
    family: (typeof families)[number];
    state: string;
    engine: (typeof families)[number]['variants'][string];
  }[] = [];
  for (const family of families) {
    requireThat(
      keyPattern.test(family.family) && !familyNames.has(family.family),
      `invalid/duplicate family ${family.family}`,
    );
    familyNames.add(family.family);
    requireThat(
      family.labelKey && family.soundGroup && ['none', 'below', 'wall'].includes(family.support),
      'missing behavior metadata',
    );
    requireThat(
      family.interaction === undefined || ['workbench', 'container'].includes(family.interaction),
      'invalid block interaction',
    );
    requireThat(
      family.blastResistance === undefined ||
        (Number.isFinite(family.blastResistance) &&
          family.blastResistance >= 0 &&
          family.blastResistance <= 100),
      'invalid blast resistance',
    );
    requireThat(
      family.explosive === undefined ||
        (Number.isInteger(family.explosive.fuse) &&
          family.explosive.fuse >= 30 &&
          family.explosive.fuse <= 900 &&
          Number.isInteger(family.explosive.radius) &&
          family.explosive.radius >= 1 &&
          family.explosive.radius <= 4 &&
          Number.isInteger(family.explosive.damage) &&
          family.explosive.damage >= 1 &&
          family.explosive.damage <= 20),
      'invalid explosive rule',
    );
    requireThat(
      Number.isFinite(family.mining.seconds) && family.mining.seconds >= 0,
      'invalid mining duration',
    );
    requireThat(
      family.mining.seconds <= 3600 &&
        (family.mining.tool === undefined ||
          ['pickaxe', 'axe', 'shovel'].includes(family.mining.tool)) &&
        (family.mining.requiresTool === undefined ||
          typeof family.mining.requiresTool === 'boolean') &&
        (!family.mining.requiresTool || !!family.mining.tool) &&
        (family.mining.tier === undefined ||
          (Number.isInteger(family.mining.tier) &&
            family.mining.tier >= 0 &&
            family.mining.tier <= 10)),
      'invalid mining rule',
    );
    const variants = Object.entries(family.variants).sort(([a], [b]) => a.localeCompare(b, 'en'));
    requireThat(variants.length > 0, 'family needs states');
    for (const [state, engine] of variants) {
      const props = state
        .split(',')
        .filter(Boolean)
        .map((p) => p.split('='));
      requireThat(
        props.every((p) => p.length === 2 && p.every((v) => keyPattern.test(v))) &&
          new Set(props.map((p) => p[0])).size === props.length,
        'invalid state combination',
      );
      requireThat(
        state ===
          props
            .map((p) => p.join('='))
            .sort()
            .join(','),
        'state properties must be canonical',
      );
      states[`${family.family}[${state}]`] = rows.length;
      defaults[family.family] ??= rows.length;
      rows.push({ family, state, engine });
    }
  }
  requireThat(
    rows.length <= 65535 &&
      rows[0]?.family.family === 'air' &&
      rows[0].state === '' &&
      rows[0].engine.shape === 'air',
    'air must be state zero',
  );
  for (const item of input.items) {
    requireThat(
      keyPattern.test(item.itemType) && !itemNames.has(item.itemType),
      'invalid/duplicate item',
    );
    itemNames.add(item.itemType);
    requireThat(
      item.tags === undefined ||
        (Array.isArray(item.tags) &&
          item.tags.every((tag) => keyPattern.test(tag)) &&
          new Set(item.tags).size === item.tags.length),
      'invalid item tags',
    );
    requireThat(
      item.material === undefined || familyNames.has(item.material),
      'unknown item material',
    );
    requireThat(
      item.color === undefined ||
        (Array.isArray(item.color) &&
          item.color.length === 3 &&
          item.color.every((n) => Number.isFinite(n) && n >= 0 && n <= 2)),
      'invalid item color',
    );
    requireThat(
      Number.isSafeInteger(item.maxStack) && item.maxStack >= 1 && item.maxStack <= 999,
      'invalid max stack',
    );
    requireThat(!item.places || familyNames.has(item.places), 'unknown placeable family');
    if (item.collects !== undefined) {
      requireThat(
        item.collects && typeof item.collects === 'object',
        'invalid collectible container',
      );
      const filled = input.items.find((candidate) => candidate.itemType === item.collects!.result);
      const fluid = families.find((family) => family.family === item.collects!.family);
      requireThat(
        item.maxStack === 1 &&
          !item.durability &&
          !item.places &&
          !item.remainder &&
          Object.keys(item.collects).sort().join(',') === 'family,result' &&
          !!fluid &&
          Object.values(fluid.variants).every((state) => state.shape === 'liquid') &&
          !!filled &&
          filled.maxStack === 1 &&
          filled.places === fluid.family &&
          filled.remainder === item.itemType,
        'invalid collectible container',
      );
    }
    if (item.remainder !== undefined) {
      requireThat(
        typeof item.remainder === 'string' && keyPattern.test(item.remainder),
        'invalid placement remainder',
      );
      const empty = input.items.find((candidate) => candidate.itemType === item.remainder);
      requireThat(
        item.maxStack === 1 &&
          !item.durability &&
          !!item.places &&
          !!empty &&
          empty.collects?.result === item.itemType &&
          empty.collects?.family === item.places,
        'invalid placement remainder',
      );
    }
    requireThat(
      item.durability === undefined ||
        (Number.isSafeInteger(item.durability) && item.durability > 0 && item.maxStack === 1),
      'invalid durability',
    );
    requireThat(
      item.equipment === undefined || (EQUIPMENT.includes(item.equipment) && item.maxStack === 1),
      'invalid equipment',
    );
    requireThat(
      item.combat === undefined ||
        (Number.isInteger(item.combat.damage) &&
          item.combat.damage >= 1 &&
          item.combat.damage <= 20 &&
          Number.isInteger(item.combat.cooldown) &&
          item.combat.cooldown >= 3 &&
          item.combat.cooldown <= 60 &&
          Number.isFinite(item.combat.reach) &&
          item.combat.reach >= 1 &&
          item.combat.reach <= 4 &&
          !!item.durability),
      'invalid combat profile',
    );
    requireThat(
      item.igniter === undefined || (item.igniter === true && !!item.durability),
      'invalid igniter',
    );
    requireThat(
      item.food === undefined ||
        (Number.isInteger(item.food) &&
          item.food >= 1 &&
          item.food <= 20 &&
          !item.durability &&
          !item.equipment),
      'invalid food',
    );
    requireThat(
      item.activation === undefined ||
        (item.activation === 'held' && !!item.tool && !!item.durability && !item.equipment),
      'invalid item activation',
    );
    requireThat(
      item.modifiers === undefined ||
        ((!!item.equipment || item.activation === 'held') &&
          !!item.durability &&
          Object.entries(item.modifiers).every(([key, value]) =>
            item.activation === 'held' && key !== 'speed'
              ? false
              : ['speed', 'gravity', 'control', 'jump'].includes(key)
                ? Number.isFinite(value) && value >= 0.25 && value <= 2
                : ['fall', 'armor'].includes(key) &&
                  Number.isFinite(value) &&
                  value >= 0 &&
                  value <= (key === 'fall' ? 0.9 : 0.8),
          )),
      'invalid equipment modifiers',
    );
    requireThat(
      item.perks === undefined ||
        (!!item.equipment &&
          !!item.durability &&
          Object.entries(item.perks).every(
            ([key, value]) => ['fallImmune', 'sunRegen', 'vision'].includes(key) && value === true,
          )),
      'invalid equipment perks',
    );
    requireThat(
      item.tool === undefined ||
        (['pickaxe', 'axe', 'shovel'].includes(item.tool.kind) &&
          Number.isFinite(item.tool.speed) &&
          item.tool.speed >= 1 &&
          item.tool.speed <= 20 &&
          Number.isInteger(item.tool.tier) &&
          item.tool.tier >= 0 &&
          item.tool.tier <= 10 &&
          !!item.durability),
      'invalid tool',
    );
    requireThat(
      item.model === undefined ||
        [
          'pickaxe',
          'axe',
          'shovel',
          'stick',
          'boots',
          'apple',
          'shield',
          'talisman',
          'medallion',
          'powder',
          'igniter',
          'ingot',
          'gem',
          'fiber',
          'grain',
          'loaf',
          'cookie',
          'melon',
          'carrot',
          'potato',
          'cake',
          'sheet',
          'armor',
          'bucket',
        ].includes(item.model),
      'invalid item model',
    );
  }
  for (const family of families) {
    for (const drop of family.drops)
      requireThat(
        itemNames.has(drop.itemType) &&
          Number.isSafeInteger(drop.count) &&
          drop.count > 0 &&
          drop.count <=
            (input.items.find((item) => item.itemType === drop.itemType)?.maxStack ?? 0) &&
          family.drops.length <= 32,
        'invalid drop',
      );
    if (family.forage) {
      const forage = family.forage;
      requireThat(
        Number.isSafeInteger(forage.none) &&
          forage.none >= 0 &&
          forage.none <= 65535 &&
          Array.isArray(forage.entries) &&
          forage.entries.length > 0,
        'invalid forage',
      );
      requireThat(
        forage.entries.every(
          (entry) =>
            itemNames.has(entry.itemType) &&
            Number.isSafeInteger(entry.count) &&
            entry.count > 0 &&
            entry.count <=
              (input.items.find((item) => item.itemType === entry.itemType)?.maxStack ?? 0) &&
            Number.isSafeInteger(entry.weight) &&
            entry.weight > 0,
        ),
        'invalid forage entry',
      );
      requireThat(
        forage.entries.reduce((sum, entry) => sum + entry.weight, forage.none) <= 65535,
        'invalid forage weight',
      );
    }
  }
  const engineBlocks = rows.map(({ family, state, engine }, id) => {
    const { textures: names, double, ...rest } = engine;
    requireThat(
      [
        'air',
        'cube',
        'cross',
        'liquid',
        'slab',
        'stairs',
        'torch',
        'wall_torch',
        'boxes',
        'fence',
        'pane',
        'post',
      ].includes(engine.shape),
      'unknown shape',
    );
    if (id === 0)
      requireThat(
        engine.shape === 'air' &&
          engine.solid !== true &&
          engine.opaque !== true &&
          (engine.opacity ?? 0) === 0 &&
          (engine.emit ?? 0) === 0,
        'invalid air physics/light',
      );
    else requireThat(engine.shape !== 'air', 'only state zero may be air');
    for (const key of [
      'solid',
      'opaque',
      'top',
      'climbable',
      'tint',
      'leaves',
      'replaceable',
      'breakable',
      'placeable',
      'cull_self',
    ] as const)
      requireThat(engine[key] === undefined || typeof engine[key] === 'boolean', `invalid ${key}`);
    requireThat(
      names.length === 6 && names.every((n) => textures.includes(n)),
      'unknown texture layer',
    );
    for (const k of ['emit', 'opacity'] as const)
      requireThat(
        engine[k] === undefined ||
          (Number.isInteger(engine[k]) && engine[k]! >= 0 && engine[k]! <= 15),
        `invalid ${k}`,
      );
    requireThat(
      engine.layer === undefined || [0, 1, 2].includes(engine.layer),
      'invalid render layer',
    );
    requireThat(
      engine.facing === undefined ||
        (Number.isInteger(engine.facing) && engine.facing >= 0 && engine.facing <= 3),
      'invalid facing',
    );
    if (engine.shape === 'boxes')
      requireThat(
        engine.boxes && engine.boxes.length > 0 && engine.boxes.length <= 16,
        'boxes required',
      );
    if (engine.boxes)
      for (const box of engine.boxes)
        requireThat(
          box.length === 6 &&
            box.every((n) => Number.isInteger(n) && n >= 0 && n <= 16) &&
            [0, 1, 2].every((k) => box[k] < box[k + 3]),
          'invalid shape bounds',
        );
    requireThat(!double || Object.hasOwn(defaults, double), 'unknown double block');
    return {
      name: family.family,
      state,
      ...rest,
      ...(engine.shape === 'boxes' ? { turn: engine.facing ?? 0 } : {}),
      tex: names.map((n) => textures.indexOf(n)),
      double: double ? defaults[double] : 0,
    };
  });
  const recipes = [...input.recipes].sort((a, b) => a.key.localeCompare(b.key, 'en'));
  const recipeKeys = new Set<string>();
  const recipeItems = new Map(input.items.map((item) => [item.itemType, item]));
  const recipeTags = new Set(input.items.flatMap((item) => item.tags ?? []));
  for (const recipe of recipes) {
    requireThat(keyPattern.test(recipe.key) && !recipeKeys.has(recipe.key), 'duplicate recipe');
    recipeKeys.add(recipe.key);
    requireThat(
      [2, 3].includes(recipe.size) &&
        recipe.ingredients.length === recipe.size ** 2 &&
        recipe.ingredients.some(Boolean) &&
        recipe.ingredients.every(
          (i) =>
            i === null || itemNames.has(i) || (i.startsWith('#') && recipeTags.has(i.slice(1))),
        ),
      'invalid recipe ingredients',
    );
    const item = input.items.find((i) => i.itemType === recipe.result.itemType);
    requireThat(
      item &&
        Number.isSafeInteger(recipe.result.count) &&
        recipe.result.count > 0 &&
        recipe.result.count <= item.maxStack,
      'invalid recipe result',
    );
    requireThat(
      validStack(recipe.result, new Map(input.items.map((i) => [i.itemType, i]))),
      'invalid recipe stack',
    );
  }
  for (let i = 0; i < recipes.length; i++)
    for (let j = 0; j < i; j++)
      requireThat(
        !recipesOverlap(recipes[i], recipes[j], recipeItems),
        `overlapping recipes ${recipes[i].key} and ${recipes[j].key}`,
      );
  requireThat(
    Object.hasOwn(defaults, input.terrainFallback) && defaults[input.terrainFallback] > 0,
    'unknown or air terrain fallback',
  );
  const terrain = Object.fromEntries(
    Object.entries(input.terrainAliases)
      .sort(([a], [b]) => a.localeCompare(b, 'en'))
      .map(([k, v]) => {
        requireThat(keyPattern.test(k) && Object.hasOwn(defaults, v), 'unknown terrain alias');
        return [k, defaults[v]];
      }),
  );
  const body = canonical({
    schema: 2,
    height: 256,
    blocks: engineBlocks,
    terrainFallback: defaults[input.terrainFallback],
    terrain,
    behavior: families.map(({ variants, ...b }) => b),
    items: [...input.items]
      .map((item) => ({ ...item, ...(item.tags ? { tags: [...item.tags].sort() } : {}) }))
      .sort((a, b) => a.itemType.localeCompare(b.itemType, 'en')),
    recipes,
  });
  const hash = createHash('sha256').update(JSON.stringify(body)).digest('hex');
  return { manifest: canonical({ ...body, hash }), states, defaults };
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = compileContent(source),
    dir = new URL('../artifacts/', import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL('content.json', dir), JSON.stringify(result.manifest) + '\n');
  writeFileSync(
    new URL('content-bindings.ts', dir),
    `// Generated by tools/compile-content.ts\nexport const CONTENT_HASH = ${JSON.stringify(result.manifest.hash)};\nexport const STATES = ${JSON.stringify(result.states)} as const;\nexport const DEFAULT_STATES = ${JSON.stringify(result.defaults)} as const;\n`,
  );
  console.log(
    `Compiled ${result.manifest.blocks.length} block states; content ${result.manifest.hash.slice(0, 12)}`,
  );
}
