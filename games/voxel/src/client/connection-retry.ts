/** Retry transport/provider failures; confirmed access decisions need a new user action. */
export function retryableAdmission(error: unknown): boolean {
  if (error && typeof error === 'object') {
    if ('retryable' in error && typeof error.retryable === 'boolean') return error.retryable;
    if (
      'code' in error &&
      [
        'UNAUTHORIZED',
        'FORBIDDEN',
        'BANNED',
        'SESSION_ENDED',
        'RECESS_CLOSED',
        'INCOMPATIBLE',
        'REPLACED',
        'MODE_DENIED',
        'GENDER_MISMATCH',
        'SESSION_CLOSED',
        'PAUSED_ROSTER',
      ].includes(String(error.code))
    )
      return false;
  }
  return true;
}

export class ConnectionRetry {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private disposed = false;
  constructor(privateRun: () => void) {
    this.run = privateRun;
  }
  private run: () => void;
  schedule() {
    if (this.disposed || this.timer) return;
    const delay = Math.min(10000, 1500 * 2 ** Math.min(this.attempts++, 3));
    this.timer = setTimeout(() => {
      this.timer = null;
      this.run();
    }, delay);
  }
  cancel() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  reset() {
    this.attempts = 0;
    this.cancel();
  }
  dispose() {
    this.disposed = true;
    this.cancel();
  }
}
