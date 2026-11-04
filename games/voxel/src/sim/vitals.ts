import { MAX_HEALTH, MAX_FOOD, MAX_AIR, RESPAWN_TICKS, VITALS_VERSION } from '../shared/vitals.ts';
import type { VitalsView } from '../shared/vitals.ts';

/** Private durable state, independent of the smaller owner-facing VitalsView. */
export type VitalsCheckpoint = Readonly<{
  schema: 1;
  health: number;
  food: number;
  air: number;
  deadTicks: number;
  elapsed: number;
  regeneration: number;
  solar: number;
  vision: number;
  starvation: number;
  lava: number;
  drowning: number;
  exhaustion: number;
  eatDelay: number;
  peak: number | null;
  attackDelay: number;
  hurtDelay: number;
  protection: number;
}>;
const checkpointBounds = {
  health: MAX_HEALTH,
  food: MAX_FOOD,
  air: MAX_AIR,
  deadTicks: RESPAWN_TICKS,
  elapsed: 3599,
  regeneration: 149,
  solar: 149,
  vision: 899,
  starvation: 119,
  lava: 14,
  drowning: 29,
  eatDelay: 15,
  attackDelay: 60,
  hurtDelay: 10,
  protection: 60,
} as const;
const checkpointFields = Object.keys(checkpointBounds) as (keyof typeof checkpointBounds)[];
function validCheckpoint(value: unknown): value is VitalsCheckpoint {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return (
    v.schema === 1 &&
    Object.keys(v).length === checkpointFields.length + 3 &&
    Object.keys(v).every(
      (key) =>
        key === 'schema' ||
        key === 'exhaustion' ||
        key === 'peak' ||
        Object.hasOwn(checkpointBounds, key),
    ) &&
    checkpointFields.every(
      (key) =>
        Number.isSafeInteger(v[key]) &&
        (v[key] as number) >= 0 &&
        (v[key] as number) <= checkpointBounds[key],
    ) &&
    typeof v.exhaustion === 'number' &&
    Number.isFinite(v.exhaustion) &&
    v.exhaustion >= 0 &&
    v.exhaustion < 4 &&
    (v.peak === null ||
      (typeof v.peak === 'number' && Number.isFinite(v.peak) && v.peak >= 0 && v.peak <= 256)) &&
    (v.health === 0 ? v.protection === 0 : v.deadTicks === 0)
  );
}

/** All durations and effort are earned by the room's fixed ticks and authoritative motion. */
export class Vitals {
  private health = MAX_HEALTH;
  private food = MAX_FOOD;
  private air = MAX_AIR;
  private deadTicks = 0;
  private elapsed = 0;
  private regeneration = 0;
  private solar = 0;
  private vision = 0;
  private starvation = 0;
  private lava = 0;
  private drowning = 0;
  private exhaustion = 0;
  private eatDelay = 0;
  private peak: number | null = null;
  private attackDelay = 0;
  private hurtDelay = 0;
  private protection = 0;
  checkpoint(): VitalsCheckpoint {
    return Object.freeze({
      schema: 1,
      health: this.health,
      food: this.food,
      air: this.air,
      deadTicks: this.deadTicks,
      elapsed: this.elapsed,
      regeneration: this.regeneration,
      solar: this.solar,
      vision: this.vision,
      starvation: this.starvation,
      lava: this.lava,
      drowning: this.drowning,
      exhaustion: this.exhaustion,
      eatDelay: this.eatDelay,
      peak: this.peak,
      attackDelay: this.attackDelay,
      hurtDelay: this.hurtDelay,
      protection: this.protection,
    });
  }
  /** Validate the whole object before constructing any replacement live state. */
  static fromCheckpoint(value: unknown): Vitals {
    if (!validCheckpoint(value)) throw new Error('invalid vitals checkpoint');
    const restored = new Vitals();
    for (const field of checkpointFields) restored[field] = value[field];
    restored.exhaustion = value.exhaustion;
    restored.peak = value.peak;
    return restored;
  }
  get dead(): boolean {
    return this.health === 0;
  }
  view(): VitalsView {
    return {
      version: VITALS_VERSION,
      health: this.health,
      food: this.food,
      air: this.air,
      dead: this.dead,
      respawnIn: this.deadTicks,
      attackCooldown: this.attackDelay,
      protection: this.protection,
    };
  }
  effort(amount: number): void {
    if (this.dead || !Number.isFinite(amount) || amount <= 0) return;
    this.exhaustion += amount;
    const spent = Math.floor(this.exhaustion / 4);
    this.exhaustion %= 4;
    this.food = Math.max(0, this.food - spent);
  }
  damage(amount: number): boolean {
    if (this.dead || !Number.isFinite(amount) || amount <= 0) return false;
    this.health = Math.max(0, this.health - Math.ceil(amount));
    this.regeneration = 0;
    this.solar = 0;
    if (this.dead) {
      this.deadTicks = RESPAWN_TICKS;
      this.protection = 0;
    }
    return this.dead;
  }
  get canBeHit(): boolean {
    return !this.dead && this.protection === 0 && this.hurtDelay === 0;
  }
  beginAttack(cooldown: number): boolean {
    if (this.dead || this.attackDelay) return false;
    this.attackDelay = cooldown;
    this.protection = 0;
    return true;
  }
  strikeDamage(amount: number): boolean {
    if (!this.canBeHit) return false;
    this.hurtDelay = 10;
    this.damage(amount);
    return true;
  }
  eat(nutrition: number): 'eaten' | 'full' | 'cooldown' | 'dead' {
    if (!Number.isInteger(nutrition) || nutrition < 1 || nutrition > MAX_FOOD)
      throw new Error('invalid food nutrition');
    if (this.dead) return 'dead';
    if (this.food >= MAX_FOOD) return 'full';
    if (this.eatDelay) return 'cooldown';
    this.food = Math.min(MAX_FOOD, this.food + nutrition);
    this.eatDelay = 15;
    return 'eaten';
  }
  movement(
    before: ArrayLike<number>,
    after: ArrayLike<number>,
    climbing: boolean,
    fallReduction: number,
    sprint: boolean,
  ): { damage: number; impact: number } {
    if (this.dead) return { damage: 0, impact: 0 };
    const distance = Math.min(1, Math.hypot(after[0] - before[0], after[2] - before[2]));
    this.effort(distance * (sprint ? 0.1 : 0.01));
    if (after[7] || after[9] || after[10] || climbing) {
      this.peak = null;
      return { damage: 0, impact: 0 };
    }
    this.peak = Math.max(this.peak ?? before[1], before[1], after[1]);
    if (!after[6]) return { damage: 0, impact: 0 };
    const fallDistance = Math.max(0, this.peak - after[1] - 3),
      impact = Math.floor(fallDistance + 1e-6);
    const damage = Math.floor(fallDistance * (1 - fallReduction) + 1e-6);
    this.peak = null;
    this.damage(damage);
    return { damage, impact };
  }
  /** One owned medallion heal after five continuous eligible room seconds. */
  sunlight(eligible: boolean): boolean {
    if (!eligible || this.dead || this.health >= MAX_HEALTH) {
      this.solar = 0;
      return false;
    }
    if (++this.solar < 150) return false;
    this.solar = 0;
    this.health++;
    return true;
  }
  visibility(active: boolean): boolean {
    if (!active || this.dead) {
      this.vision = 0;
      return false;
    }
    if (++this.vision < 900) return false;
    this.vision = 0;
    return true;
  }
  step(state: ArrayLike<number>): void {
    if (this.dead) {
      this.deadTicks = Math.max(0, this.deadTicks - 1);
      return;
    }
    this.elapsed = (this.elapsed + 1) % 3600;
    this.attackDelay = Math.max(0, this.attackDelay - 1);
    this.hurtDelay = Math.max(0, this.hurtDelay - 1);
    this.protection = Math.max(0, this.protection - 1);
    this.eatDelay = Math.max(0, this.eatDelay - 1);
    if (this.elapsed === 0) this.food = Math.max(0, this.food - 1);
    if (this.food === 0) {
      if (++this.starvation >= 120) {
        this.starvation = 0;
        this.damage(1);
      }
    } else this.starvation = 0;
    if (this.food >= 18 && this.health < MAX_HEALTH) {
      if (++this.regeneration >= 150) {
        this.regeneration = 0;
        this.health++;
        this.effort(1);
      }
    } else this.regeneration = 0;
    if (state[8]) {
      this.air = Math.max(0, this.air - 1);
      if (!this.air && ++this.drowning >= 30) {
        this.drowning = 0;
        this.damage(2);
      }
    } else {
      this.air = Math.min(MAX_AIR, this.air + 10);
      this.drowning = 0;
    }
    if (state[9]) {
      if (++this.lava >= 15) {
        this.lava = 0;
        this.damage(4);
      }
    } else this.lava = 0;
  }
  resetMotion(): void {
    this.peak = null;
  }
  respawn(): boolean {
    if (!this.dead || this.deadTicks) return false;
    this.health = MAX_HEALTH;
    this.food = MAX_FOOD;
    this.air = MAX_AIR;
    this.attackDelay = this.hurtDelay = 0;
    this.protection = 60;
    this.peak = null;
    this.exhaustion =
      this.elapsed =
      this.regeneration =
      this.solar =
      this.vision =
      this.starvation =
      this.lava =
      this.drowning =
      this.eatDelay =
        0;
    return true;
  }
}
