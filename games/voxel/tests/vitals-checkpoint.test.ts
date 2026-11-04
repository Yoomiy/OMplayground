import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Vitals } from '../src/sim/vitals.ts';
import { parseClientMessage } from '../src/shared/protocol.ts';
const dry = new Float64Array(17);
const persisted = (v: Vitals) => Vitals.fromCheckpoint(JSON.parse(JSON.stringify(v.checkpoint())));

test('repeated JSON checkpoint recovery matches uninterrupted vitals timers and effects over multiple hunger cycles', () => {
  const original = new Vitals();
  original.damage(7);
  original.effort(16.7);
  original.eat(1);
  original.beginAttack(37);
  original.strikeDamage(1);
  let recovered = persisted(original);
  for (let tick = 0; tick < 8100; tick++) {
    const state = new Float64Array(17);
    state[8] = Number(tick >= 1500 && tick < 1850);
    state[9] = Number(tick >= 2200 && tick < 2240);
    const effects = (v: Vitals) => {
      if (tick % 211 === 0) v.damage(1);
      if (tick === 2300) v.eat(20);
      v.step(state);
      return [
        v.sunlight(tick < 1500),
        v.visibility(true),
        tick % 89 === 0 ? v.beginAttack(37) : null,
        tick % 67 === 0 ? v.eat(1) : null,
        v.respawn(),
      ];
    };
    assert.deepEqual(effects(recovered), effects(original), `effects at tick ${tick}`);
    assert.deepEqual(recovered.view(), original.view(), `view at tick ${tick}`);
    assert.deepEqual(
      recovered.checkpoint(),
      original.checkpoint(),
      `private phase at tick ${tick}`,
    );
    assert.ok(original.checkpoint().elapsed < 3600);
    if (tick % 97 === 33) recovered = persisted(recovered);
  }
});

test('checkpoint recovery preserves a partial fall, exact respawn remainder and immutable captured state', () => {
  const falling = (y: number, ground = false) =>
    new Float64Array([0, y, 0, 0, 0, 0, Number(ground), 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const original = new Vitals();
  original.movement(falling(20), falling(11), false, 0, false);
  const captured = original.checkpoint(),
    recovered = persisted(original);
  assert.equal(Object.isFrozen(captured), true);
  assert.deepEqual(
    recovered.movement(falling(11), falling(1, true), false, 0.25, false),
    original.movement(falling(11), falling(1, true), false, 0.25, false),
  );
  assert.equal(original.view().health, 8);
  assert.equal(captured.peak, 20);
  assert.equal(captured.health, 20);
  original.damage(20);
  for (let i = 0; i < 17; i++) original.step(dry);
  const dead = persisted(original);
  assert.equal(dead.view().respawnIn, 43);
  for (let i = 0; i < 42; i++) dead.step(dry);
  assert.equal(dead.respawn(), false);
  dead.step(dry);
  assert.equal(dead.respawn(), true);
  assert.equal(dead.view().protection, 60);
  assert.equal(persisted(dead).view().protection, 60);
});

test('private checkpoint decoding rejects unknown schemas, invalid timer phases, nonfinite state and incoherent death without accepting client save claims', () => {
  const initial = new Vitals().checkpoint();
  for (const patch of [
    { schema: 2 },
    { extra: 1 },
    { health: 21 },
    { food: -1 },
    { air: 301 },
    { deadTicks: 61 },
    { elapsed: 3600 },
    { regeneration: 150 },
    { solar: 150 },
    { vision: 900 },
    { starvation: 120 },
    { lava: 15 },
    { drowning: 30 },
    { eatDelay: 16 },
    { attackDelay: 61 },
    { hurtDelay: 11 },
    { protection: 61 },
    { exhaustion: 4 },
    { exhaustion: NaN },
    { peak: Infinity },
    { peak: -1 },
    { elapsed: 0.5 },
    { health: 20, deadTicks: 1 },
    { health: 0, protection: 1 },
  ])
    assert.throws(
      () => Vitals.fromCheckpoint({ ...initial, ...patch }),
      /invalid vitals checkpoint/,
    );
  for (const invalid of [
    null,
    [],
    { ...initial, peak: undefined },
    { ...initial, food: undefined },
  ])
    assert.throws(() => Vitals.fromCheckpoint(invalid), /invalid vitals checkpoint/);
  const inherited = Object.assign(
    Object.create(initial),
    Object.fromEntries(Object.keys(initial).map((_, i) => [`unknown_${i}`, 1])),
  );
  assert.throws(() => Vitals.fromCheckpoint(inherited), /invalid vitals checkpoint/);
  assert.equal(parseClientMessage(JSON.stringify({ type: 'checkpoint', vitals: initial })), null);
  const restored = Vitals.fromCheckpoint(initial);
  restored.effort(4);
  assert.equal(initial.food, 20);
  assert.equal(restored.view().food, 19);
});
