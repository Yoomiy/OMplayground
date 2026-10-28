import type { EngineConfig, EngineJob, EngineResult, JobIdentity } from './jobs.ts';
import { sameJob } from './jobs.ts';
type Pending = {
  job: EngineJob;
  resolve: (result: EngineResult) => void;
  reject: (error: Error) => void;
};
type Slot = {
  worker: Worker;
  ready: boolean;
  live: boolean;
  pending: Pending | null;
  restarts: number;
  timer: ReturnType<typeof setTimeout> | null;
  fail: (reason: string) => void;
};
export class EnginePool {
  private slots: Slot[] = [];
  private config: EngineConfig;
  private nextId = 0;
  private disposed = false;
  readonly count: number;
  constructor(config: EngineConfig, cores: number, onFailure: (reason: string) => void) {
    this.config = config;
    this.count = Math.max(1, Math.min(4, Math.floor(cores / 2) || 1));
    try {
      for (let i = 0; i < this.count; i++) this.slots.push(this.create(0, onFailure));
    } catch (error) {
      this.dispose();
      throw error;
    }
  }
  private create(restarts: number, onFailure: (reason: string) => void): Slot {
    const worker = new Worker(new URL('./engine-worker.ts', import.meta.url), { type: 'module' }),
      slot: Slot = {
        worker,
        ready: false,
        live: true,
        pending: null,
        restarts,
        timer: null,
        fail: () => {},
      };
    const fail = (reason: string) => {
      if (this.disposed || !slot.live) return;
      if (slot.timer) clearTimeout(slot.timer);
      slot.timer = null;
      slot.pending?.reject(new Error(reason));
      slot.pending = null;
      slot.ready = false;
      slot.live = false;
      worker.terminate();
      const index = this.slots.indexOf(slot);
      if (index < 0) return;
      if (restarts < 2) {
        try {
          this.slots[index] = this.create(restarts + 1, onFailure);
        } catch {
          onFailure('generation worker could not restart');
        }
      } else onFailure('generation worker could not recover');
    };
    slot.fail = fail;
    slot.timer = setTimeout(() => fail('engine worker startup timed out'), 10000);
    worker.onerror = (event) => {
      event.preventDefault();
      fail(event.message || 'engine worker crashed');
    };
    worker.onmessage = ({ data }) => {
      if (this.disposed || !slot.live) return;
      if (!data || typeof data !== 'object') {
        fail('malformed worker response');
        return;
      }
      if (data.type === 'ready') {
        if (slot.ready || slot.pending) {
          fail('duplicate worker readiness');
          return;
        }
        if (slot.timer) clearTimeout(slot.timer);
        slot.timer = null;
        slot.ready = true;
        return;
      }
      if (data.type === 'failed') {
        fail(data.reason || 'engine job failed');
        return;
      }
      const pending = slot.pending;
      if (
        data.type !== 'result' ||
        !pending ||
        !data.result ||
        !data.result.tag ||
        data.result.id !== pending.job.id ||
        data.result.kind !== pending.job.kind ||
        !sameJob(data.result.tag, pending.job.tag) ||
        !(pending.job.kind === 'generate'
          ? data.result.data instanceof Uint8Array
          : data.result.data instanceof Uint32Array)
      ) {
        fail('stale or malformed worker response');
        return;
      }
      if (slot.timer) clearTimeout(slot.timer);
      slot.timer = null;
      slot.pending = null;
      pending.resolve(data.result);
    };
    try {
      worker.postMessage({ type: 'init', config: this.config });
    } catch (error) {
      if (slot.timer) clearTimeout(slot.timer);
      slot.live = false;
      worker.terminate();
      throw error;
    }
    return slot;
  }
  get liveCount(): number {
    return this.slots.filter((slot) => slot.live).length;
  }
  get available(): number {
    return this.slots.filter((s) => s.ready && !s.pending).length;
  }
  get active(): number {
    return this.slots.filter((s) => s.pending).length;
  }
  submit(kind: 'generate' | 'mesh', tag: JobIdentity, region?: Uint8Array): Promise<EngineResult> {
    const slot = this.slots.find((s) => s.ready && !s.pending);
    if (!slot || this.disposed) return Promise.reject(new Error('worker pool busy'));
    const job: EngineJob =
      kind === 'generate'
        ? { kind, id: ++this.nextId, tag }
        : { kind, id: ++this.nextId, tag, region: region! };
    return new Promise((resolve, reject) => {
      slot.pending = { job, resolve, reject };
      slot.timer = setTimeout(() => slot.fail('engine job timed out'), 10000);
      try {
        slot.worker.postMessage(
          { type: 'job', job },
          kind === 'mesh' ? [region!.buffer as ArrayBuffer] : [],
        );
      } catch (error) {
        slot.fail(error instanceof Error ? error.message : 'worker transfer failed');
      }
    });
  }
  dispose(): void {
    this.disposed = true;
    for (const slot of this.slots) {
      if (slot.timer) clearTimeout(slot.timer);
      slot.pending?.reject(new Error('runtime disposed'));
      slot.worker.terminate();
      slot.live = false;
    }
    this.slots = [];
  }
}
