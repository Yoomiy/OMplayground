import { stepMovement } from '../shared/movement.ts';
import type { MovementWorld } from '../shared/movement.ts';
import { InputQueue } from './input-queue.ts';
import { FixedScheduler } from './scheduler.ts';
/** Headless clock/authority foundation. Player count never participates in admission. */
export class MovementRoom {
  private actors = new Map<string, { slot: number; queue: InputQueue }>();
  private clock: FixedScheduler;
  private world: MovementWorld;
  constructor(world: MovementWorld, now: number) {
    this.world = world;
    this.clock = new FixedScheduler(now);
  }
  add(id: string, slot: number, epoch: number): void {
    if (this.actors.has(id)) throw new Error('actor already installed');
    this.actors.set(id, { slot, queue: new InputQueue(epoch) });
  }
  remove(id: string): void {
    this.actors.delete(id);
  }
  receive(id: string, frame: unknown, now: number) {
    return this.actors.get(id)?.queue.receive(frame, now) ?? 'stale_epoch';
  }
  invalidate(id: string, epoch: number): void {
    this.actors.get(id)?.queue.reset(epoch);
  }
  ack(id: string): number {
    return this.actors.get(id)?.queue.ack ?? 0;
  }
  advance(now: number): { steps: number; droppedMs: number; resync: Set<string> } {
    const resync = new Set<string>();
    const result = this.clock.advance(now, () => {
      for (let substep = 0; substep < 2; substep++)
        for (const [id, actor] of this.actors) {
          const input = actor.queue.take(now);
          if (input.resync) resync.add(id);
          stepMovement(this.world, actor.slot, input.controls);
        }
    });
    return { ...result, resync };
  }
  /** Pause/resume resets the scheduler so paused wall time cannot become movement time. */
  resetClock(now: number): void {
    this.clock.reset(now);
  }
}
