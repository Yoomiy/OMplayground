/** Preserve terminal writes across transient database failures and room deletion. */
export class CompletionQueue {
  private jobs = new Map<string, () => Promise<void>>();
  private flights = new Map<string, Promise<void>>();
  has(id: string) {
    return this.jobs.has(id);
  }
  stage(id: string, write: () => Promise<void>) {
    if (!this.jobs.has(id)) this.jobs.set(id, write);
  }
  ids() {
    return [...this.jobs.keys()];
  }
  flush(id: string): Promise<void> {
    const existing = this.flights.get(id);
    if (existing) return existing;
    const job = this.jobs.get(id);
    if (!job) return Promise.resolve();
    const flight = Promise.resolve()
      .then(job)
      .then(() => {
        if (this.jobs.get(id) === job) this.jobs.delete(id);
      })
      .finally(() => {
        this.flights.delete(id);
      });
    this.flights.set(id, flight);
    return flight;
  }
}
