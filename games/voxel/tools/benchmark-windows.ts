/** Keep only authoritative worker intervals wholly inside endpoint sampling.
 * Archived releases without these bounds remain observable, but cannot claim
 * steady-window coverage from a delayed supervisor receipt timestamp.
 */
export function containedWindows<
  T extends {
    windowMs: number;
    windowStartedAtMs?: number;
    windowEndedAtMs?: number;
  },
>(windows: readonly T[], start: number, end: number): T[] {
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start)
    throw new Error('invalid benchmark interval');
  return windows.filter((w) => {
    const a = w.windowStartedAtMs,
      b = w.windowEndedAtMs;
    return (
      a !== undefined &&
      b !== undefined &&
      Number.isFinite(a) &&
      Number.isFinite(b) &&
      Number.isFinite(w.windowMs) &&
      w.windowMs > 0 &&
      a >= start &&
      b <= end &&
      b > a &&
      Math.abs(b - a - w.windowMs) < 1e-6
    );
  });
}
