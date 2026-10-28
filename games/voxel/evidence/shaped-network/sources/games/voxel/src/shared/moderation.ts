export type ModerationAction = 'remove' | 'ban' | 'unban';
export const readModerationAction = (value: unknown): ModerationAction | null =>
  value === 'remove' || value === 'ban' || value === 'unban' ? value : null;
export type ModerationReceipt = Readonly<{
  requestId: string;
  action: ModerationAction;
  target: string;
  revision: number;
  banned: boolean;
  current: boolean;
  applied: true;
  saved: false;
  revocationRequested: boolean;
}>;
export function readModerationReceipt(value: unknown): ModerationReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>,
    action = readModerationAction(v.action);
  if (
    Object.keys(v).length !== 9 ||
    !action ||
    typeof v.requestId !== 'string' ||
    typeof v.target !== 'string' ||
    !Number.isSafeInteger(v.revision) ||
    (v.revision as number) < 0 ||
    (v.revision === 0 && action !== 'unban') ||
    typeof v.banned !== 'boolean' ||
    typeof v.current !== 'boolean' ||
    v.applied !== true ||
    v.saved !== false ||
    v.revocationRequested !== (v.current && action !== 'unban') ||
    (action === 'ban' && !v.banned) ||
    (action === 'unban' && v.banned)
  )
    return null;
  return Object.freeze({ ...v, action }) as ModerationReceipt;
}
