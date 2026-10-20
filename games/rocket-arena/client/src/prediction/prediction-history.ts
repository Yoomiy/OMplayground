import type { BodyState, PredictionFrame } from '@rocket-arena/simulation/protocol';

const close = (a: number, b: number, tolerance: number) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) <= tolerance;
function vector(a: BodyState['position'], b: BodyState['position'], tolerance: number): boolean {
  return [a.x, a.y, a.z, b.x, b.y, b.z].every(Number.isFinite)
    && Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) <= tolerance;
}
function body(a: BodyState, b: BodyState): boolean {
  // q and -q represent the same rotation. Bound the chord distance in either sign.
  const q = a.rotation, r = b.rotation;
  return vector(a.position, b.position, .02) && vector(a.velocity, b.velocity, .05)
    && vector(a.angularVelocity, b.angularVelocity, .02)
    && Math.min(Math.hypot(q.x-r.x, q.y-r.y, q.z-r.z, q.w-r.w),
      Math.hypot(q.x+r.x, q.y+r.y, q.z+r.z, q.w+r.w)) <= .0025;
}
function same(a: unknown, b: unknown): boolean {
  if (typeof a === 'number' || typeof b === 'number') return Number.isFinite(a) && a === b;
  if (a === b) return true;
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const left = a as Record<string, unknown>, right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every(key => Object.hasOwn(right, key) && same(left[key], right[key]));
}

/** Server tick and command application tick must agree; a command ID alone is insufficient. */
export class PredictionHistory {
  private frames = new Map<number, PredictionFrame>();
  record(frame: PredictionFrame): void {
    this.frames.set(frame.tick, frame);
    while (this.frames.size > 64) this.frames.delete(this.frames.keys().next().value!);
  }
  clear(): void { this.frames.clear(); }
  get size(): number { return this.frames.size; }
  has(tick: number): boolean { return this.frames.has(tick); }

  check(authority: PredictionFrame, live: PredictionFrame, localId: string): 'match' | 'missing' | 'different' {
    const expected = this.frames.get(authority.tick);
    const actualLocal = authority.cars.find(car => car.sessionId === localId);
    if (!expected || !actualLocal || !Number.isSafeInteger(actualLocal.inputAppliedTick)
      || actualLocal.inputAppliedTick! < 0 || actualLocal.inputAppliedTick! > authority.tick
      || live.tick < authority.tick) return 'missing';
    if (expected.phase !== authority.phase || expected.kickoffEpoch !== authority.kickoffEpoch
      || live.phase !== authority.phase || live.kickoffEpoch !== authority.kickoffEpoch
      || expected.cars.length !== authority.cars.length || live.cars.length !== authority.cars.length
      || !body(expected.ball, authority.ball)) return 'different';
    for (const actual of authority.cars) {
      const predicted = expected.cars.find(car => car.sessionId === actual.sessionId);
      const current = live.cars.find(car => car.sessionId === actual.sessionId);
      if (!predicted || !current || !body(predicted, actual) || !same(predicted.input, actual.input)
        // A remote control change must invalidate already-predicted future steps too.
        || (actual.sessionId !== localId && !same(current.input, actual.input))
        || !same(predicted.jumpAirState, actual.jumpAirState)
        || !close(predicted.boostAmount, actual.boostAmount, .05)
        || !close(predicted.boostRechargeDelaySeconds, actual.boostRechargeDelaySeconds, .001)
        || predicted.boostRechargeArmed !== actual.boostRechargeArmed
        || predicted.dodgeIntentSteps !== actual.dodgeIntentSteps
        || predicted.wallDriveEngaged !== actual.wallDriveEngaged) return 'different';
      if (actual.sessionId === localId && (predicted.acknowledgedSequence !== actual.acknowledgedSequence
        || predicted.inputAppliedTick !== actual.inputAppliedTick)) return 'different';
    }
    if (expected.boostPadCooldowns.length !== authority.boostPadCooldowns.length) return 'different';
    for (const actual of authority.boostPadCooldowns) {
      const predicted = expected.boostPadCooldowns.find(pad => pad.index === actual.index);
      if (!predicted || !close(predicted.secondsRemaining, actual.secondsRemaining, .001)) return 'different';
    }
    return 'match';
  }
}
