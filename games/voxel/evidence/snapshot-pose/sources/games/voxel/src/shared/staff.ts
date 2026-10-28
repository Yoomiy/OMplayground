import type { GameMode } from './gameplay.ts';
/** Trusted service/worker commands, never accepted on the gameplay socket. */
export type StaffCommand =
  | Readonly<{ kind: 'mode'; mode: GameMode }>
  | Readonly<{ kind: 'teleport'; target: string }>;
export type StaffResult = Readonly<{
  ok: boolean;
  reason:
    | 'mode'
    | 'teleport'
    | 'unchanged'
    | 'not_present'
    | 'not_ready'
    | 'ended'
    | 'invalid'
    | 'expired'
    | 'retired';
}>;
export function readStaffCommand(value: unknown): StaffCommand | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).length !== 2) return null;
  if (v.kind === 'mode' && ['creative', 'survival'].includes(v.mode as string))
    return Object.freeze({ kind: 'mode', mode: v.mode as GameMode });
  if (
    v.kind === 'teleport' &&
    typeof v.target === 'string' &&
    v.target.length > 0 &&
    v.target.length <= 128
  )
    return Object.freeze({ kind: 'teleport', target: v.target });
  return null;
}
export function readStaffResult(value: unknown): StaffResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (
    Object.keys(v).length !== 2 ||
    typeof v.ok !== 'boolean' ||
    !(
      v.ok
        ? ['mode', 'teleport', 'unchanged']
        : ['not_present', 'not_ready', 'ended', 'invalid', 'expired', 'retired']
    ).includes(v.reason as string)
  )
    return null;
  return Object.freeze({ ok: v.ok, reason: v.reason as StaffResult['reason'] });
}
