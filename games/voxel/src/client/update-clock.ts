/** A delayed RAF timestamp must never rewind an update already driven by the fallback timer. */
export function updateClock(previous: number, timestamp: number): { now: number; dt: number } {
  const now = Math.max(previous, timestamp);
  return { now, dt: Math.min(0.1, (now - previous) / 1000) };
}
