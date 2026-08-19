export class KeyedSingleFlight {
  private readonly operations = new Map<string, Promise<void>>();

  run(key: string, work: () => void | Promise<void>): { started: boolean; promise: Promise<void> } {
    const existing = this.operations.get(key);
    if (existing) return { started: false, promise: existing };

    let promise: Promise<void>;
    try {
      promise = Promise.resolve(work());
    } catch (error) {
      promise = Promise.reject(error);
    }
    this.operations.set(key, promise);
    void promise.finally(() => {
      if (this.operations.get(key) === promise) this.operations.delete(key);
    }).catch(() => {});
    return { started: true, promise };
  }
}
