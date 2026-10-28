export type WorldState = 'playing' | 'paused' | 'ended';
export type PauseReason =
  | 'allowed'
  | 'manual'
  | 'session'
  | 'no_participants'
  | 'policy_unavailable'
  | 'ended';
export type LifecycleView = Readonly<{
  type: 'lifecycle';
  state: WorldState;
  reason: PauseReason;
  tick: number;
}>;
export function isLifecycleView(value: unknown): value is LifecycleView {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).length !== 4 ||
    v.type !== 'lifecycle' ||
    !Number.isSafeInteger(v.tick) ||
    (v.tick as number) < 0
  )
    return false;
  return v.state === 'playing'
    ? v.reason === 'allowed'
    : v.state === 'ended'
      ? v.reason === 'ended'
      : v.state === 'paused' &&
        ['manual', 'session', 'no_participants', 'policy_unavailable'].includes(v.reason as string);
}
