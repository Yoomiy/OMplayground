import assert from 'node:assert/strict';
import { test } from 'node:test';
import { engine } from './fixture.ts';

test('biome query is deterministic and does not mutate generated terrain', () => {
  const generator = new engine.TerrainGen(4242);
  try {
    const before = generator.generate(0, 0);
    const biome = generator.biome_at(8, 8);
    assert.match(
      biome,
      /^(Ocean|DeepOcean|FrozenOcean|Beach|SnowyBeach|River|FrozenRiver|Plains|Forest|BirchForest|Taiga|SnowyTaiga|SnowyPlains|Desert|Savanna|Mountains|SnowyPeaks)$/,
    );
    assert.equal(generator.biome_at(8, 8), biome);
    assert.deepEqual(generator.generate(0, 0), before);
  } finally {
    generator.free();
  }
});
