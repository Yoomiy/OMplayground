import assert from 'node:assert/strict';
import test from 'node:test';
import type RAPIER from '@dimforge/rapier3d-compat';
import { createFiniteRigidBodyStateTracker, recoverFiniteRigidBodyState,
  recoverAndBoundRigidBodyMotion, type FiniteRigidBodyState } from '../src/finite-state.js';

test('recovery remains deeply immutable, repairs independent fields and retains bounded fallback', () => {
  let observed: FiniteRigidBodyState = { translation: { x: 1, y: 2, z: 3 },
    rotation: { x: 0, y: 0, z: 0, w: 1 }, linearVelocity: { x: 10, y: 0, z: 0 },
    angularVelocity: { x: 0, y: 2, z: 0 } };
  const body = { translation: () => observed.translation, rotation: () => observed.rotation,
    linvel: () => observed.linearVelocity, angvel: () => observed.angularVelocity,
    setTranslation: (v: any) => { observed = { ...observed, translation: v }; },
    setRotation: (v: any) => { observed = { ...observed, rotation: v }; },
    setLinvel: (v: any) => { observed = { ...observed, linearVelocity: v }; },
    setAngvel: (v: any) => { observed = { ...observed, angularVelocity: v }; } } as unknown as RAPIER.RigidBody;
  const tracker = createFiniteRigidBodyStateTracker(body);
  const initial = tracker.lastFinite;
  assert.ok(Object.isFrozen(initial));
  for (const value of Object.values(initial)) assert.ok(Object.isFrozen(value));
  assert.throws(() => { (initial.translation as any).x = 99; }, TypeError);
  observed = { ...observed, translation: { x: NaN, y: 0, z: 0 },
    linearVelocity: { x: 30, y: 40, z: 0 }, angularVelocity: { x: 0, y: 10, z: 0 } };
  const bounded = recoverAndBoundRigidBodyMotion(body, tracker, 5, 2);
  assert.deepEqual(bounded.translation, initial.translation);
  assert.deepEqual(bounded.linearVelocity, { x: 3, y: 4, z: 0 });
  assert.deepEqual(bounded.angularVelocity, { x: 0, y: 2, z: 0 });
  assert.ok(Object.isFrozen(bounded));
  for (const value of Object.values(bounded)) assert.ok(Object.isFrozen(value));
  observed = { ...observed, linearVelocity: { x: Infinity, y: 0, z: 0 },
    angularVelocity: { x: 0, y: NaN, z: 0 }, rotation: { x: 0, y: 0, z: 0, w: 0 } };
  const repaired = recoverFiniteRigidBodyState(body, tracker);
  assert.deepEqual(repaired, bounded, 'invalid values recover from the bounded last-finite state');
  assert.deepEqual(initial.linearVelocity, { x: 10, y: 0, z: 0 }, 'retained old states must not change');
  assert.throws(() => recoverAndBoundRigidBodyMotion(body, tracker, -1, 2), RangeError);
});
