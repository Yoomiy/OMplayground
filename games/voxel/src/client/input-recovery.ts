/** Local backpressure is recoverable; a bounded baseline handshake precedes readmission. */
export class InputRecovery {
  private began: number | null = null;
  private requested: number | null = null;
  pauses = 0;
  recoveries = 0;
  get waiting() {
    return this.began !== null;
  }
  pause(now: number): boolean {
    if (this.waiting) return false;
    this.began = now;
    this.requested = null;
    this.pauses++;
    return true;
  }
  observe(pendingSeconds: number): boolean {
    if (!this.waiting || pendingSeconds >= 0.25) return false;
    this.recoveries++;
    this.reset();
    return true;
  }
  requestResync(now: number): boolean {
    if (this.began === null || this.requested !== null || now - this.began < 10000) return false;
    this.requested = now;
    return true;
  }
  shouldReconnect(now: number) {
    return this.requested !== null && now - this.requested >= 10000;
  }
  reset() {
    this.began = this.requested = null;
  }
}
