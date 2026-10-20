interface FrameScheduler {
  request(callback: FrameRequestCallback): number;
  cancel(id: number): void;
}

/** Owns exactly one render chain, including callbacks already queued at stop. */
export class ClientLoop {
  private frame: number | null = null;
  private running = false;
  private disposed = false;
  private generation = 0;

  constructor(private readonly render: FrameRequestCallback,
    private readonly scheduler: FrameScheduler = {
      request: callback => requestAnimationFrame(callback),
      cancel: id => cancelAnimationFrame(id),
    }) {}

  start(): void {
    if (this.disposed || this.running) return;
    this.running = true;
    this.schedule(++this.generation);
  }

  private schedule(generation: number): void {
    this.frame = this.scheduler.request(now => {
      if (!this.running || generation !== this.generation) return;
      this.frame = null;
      this.render(now);
      if (this.running && generation === this.generation) this.schedule(generation);
    });
  }

  stop(): void {
    this.running = false;
    this.generation++;
    if (this.frame !== null) this.scheduler.cancel(this.frame);
    this.frame = null;
  }

  dispose(): void {
    this.stop();
    this.disposed = true;
  }
}
