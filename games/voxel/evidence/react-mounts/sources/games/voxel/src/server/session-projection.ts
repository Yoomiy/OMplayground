import type { RoomLease } from './checkpoint-storage.ts';
import type { Authorization } from './admission.ts';
import type { AdmittedActor } from '../sim/game-room.ts';
import type { WorldState } from '../shared/lifecycle.ts';

export type SessionView = Readonly<{ state: WorldState; participants: readonly string[] }>;
/** Platform IO is service-owned; this package has no Supabase/profile dependency. */
export type SessionProjection = Readonly<{
  initialize(lease: RoomLease): Promise<void>;
  accept(
    lease: RoomLease,
    actor: AdmittedActor,
    proof: Pick<Authorization, 'expiresAt' | 'membershipRevision'>,
  ): Promise<void>;
  project(lease: RoomLease, sequence: number, view: SessionView): Promise<boolean>;
}>;

/** One in-flight view and one replacement, regardless of update frequency. */
export class SessionOutbox {
  private sequence = 0;
  private pending: SessionView | null = null;
  private running: Promise<void> | null = null;
  private stopped = false;
  private finished = false;
  private terminal = false;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private write: (sequence: number, view: SessionView) => Promise<boolean>;
  private onError: () => void;
  constructor(
    write: (sequence: number, view: SessionView) => Promise<boolean>,
    onError: () => void,
  ) {
    this.write = write;
    this.onError = onError;
  }
  offer(view: SessionView) {
    if (this.stopped) return;
    this.terminal ||= view.state === 'ended';
    this.pending = Object.freeze({
      state: this.terminal ? 'ended' : view.state,
      participants: Object.freeze([...new Set(view.participants)]),
    });
    if (!this.running && !this.retry) this.start();
  }
  private start() {
    const task = this.run();
    this.running = task;
    void task.then(() => {
      this.running = null;
      if (this.pending && !this.stopped)
        this.retry = setTimeout(() => {
          this.retry = null;
          if (!this.stopped) this.start();
        }, 500);
    });
  }
  private async run() {
    while (this.pending && !this.stopped) {
      const view = this.pending;
      this.pending = null;
      try {
        if (this.sequence === Number.MAX_SAFE_INTEGER)
          throw new Error('projection sequence exhausted');
        if (!(await this.write(++this.sequence, view)))
          throw new Error('session projection fenced');
      } catch {
        // Newer full state supersedes failed state, except completion is terminal.
        if (!this.pending) this.pending = view;
        this.onError();
        return;
      }
    }
  }
  /** Stop accepting worker updates, then persist final empty presence before lease release. */
  async finish() {
    if (this.finished) return;
    this.stopped = true;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    await this.running;
    this.pending = null;
    if (this.sequence === Number.MAX_SAFE_INTEGER) throw new Error('projection sequence exhausted');
    if (
      !(await this.write(++this.sequence, {
        state: this.terminal ? 'ended' : 'paused',
        participants: [],
      }))
    )
      throw new Error('session projection unavailable');
    this.finished = true;
  }
  close() {
    this.stopped = true;
    this.pending = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
  }
}
