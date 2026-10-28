/** Plain platform media values; no signaling, SFU, renderer or audio handles. */
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const record = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const revision = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export type MediaAction = 'mute' | 'unmute';
export type MediaAuthorization = Readonly<{
  revision: number;
  cutoff: number;
  publish: boolean;
  hidden: boolean;
}>;
export function readMediaAuthorization(v: unknown): MediaAuthorization | null {
  if (
    !record(v) ||
    Object.keys(v).length !== 4 ||
    !revision(v.revision) ||
    !revision(v.cutoff) ||
    v.cutoff > v.revision ||
    typeof v.publish !== 'boolean' ||
    typeof v.hidden !== 'boolean' ||
    (v.hidden && v.publish)
  )
    return null;
  return Object.freeze({ ...v }) as MediaAuthorization;
}
export type VoiceTicket = Readonly<{
  ticket: string;
  expiresAt: number;
  publish: boolean;
  hidden: boolean;
  actorId: string;
  bindingId: string;
}>;
export function readVoiceTicket(v: unknown): VoiceTicket | null {
  if (
    !record(v) ||
    Object.keys(v).length !== 6 ||
    typeof v.ticket !== 'string' ||
    !/^[A-Za-z0-9_-]{43}$/.test(v.ticket) ||
    !Number.isSafeInteger(v.expiresAt) ||
    (v.expiresAt as number) <= 0 ||
    typeof v.publish !== 'boolean' ||
    typeof v.hidden !== 'boolean' ||
    (v.hidden && v.publish) ||
    typeof v.actorId !== 'string' ||
    !UUID.test(v.actorId) ||
    typeof v.bindingId !== 'string' ||
    !UUID.test(v.bindingId)
  )
    return null;
  return Object.freeze({ ...v }) as VoiceTicket;
}
export type MediaReceipt = Readonly<{
  requestId: string;
  action: MediaAction;
  target: string | null;
  revision: number;
  muted: boolean;
  current: boolean;
  applied: true;
  persisted: true;
  saved: false;
  revocationRequested: boolean;
}>;
export function readMediaReceipt(v: unknown): MediaReceipt | null {
  if (
    !record(v) ||
    Object.keys(v).length !== 10 ||
    typeof v.requestId !== 'string' ||
    !UUID.test(v.requestId) ||
    !['mute', 'unmute'].includes(v.action as string) ||
    !(v.target === null || (typeof v.target === 'string' && UUID.test(v.target))) ||
    !revision(v.revision) ||
    typeof v.muted !== 'boolean' ||
    v.muted !== (v.action === 'mute') ||
    (v.muted && v.revision === 0) ||
    typeof v.current !== 'boolean' ||
    v.applied !== true ||
    v.persisted !== true ||
    v.saved !== false ||
    v.revocationRequested !== (v.current && v.revision > 0)
  )
    return null;
  return Object.freeze({ ...v }) as MediaReceipt;
}
export type MediaState = Readonly<{
  revision: number;
  allMuted: boolean;
  targets: ReadonlyArray<
    Readonly<{ id: string; name: string; muted: boolean; effectiveMuted: boolean }>
  >;
}>;
export function readMediaState(v: unknown): MediaState | null {
  if (
    !record(v) ||
    Object.keys(v).length !== 3 ||
    !revision(v.revision) ||
    typeof v.allMuted !== 'boolean' ||
    !Array.isArray(v.targets)
  )
    return null;
  const allMuted = v.allMuted;
  if (
    v.targets.some(
      (t: unknown) =>
        !record(t) ||
        Object.keys(t).length !== 4 ||
        typeof t.id !== 'string' ||
        !UUID.test(t.id) ||
        typeof t.name !== 'string' ||
        typeof t.muted !== 'boolean' ||
        t.effectiveMuted !== (allMuted || t.muted),
    )
  )
    return null;
  const targets = v.targets as Array<MediaState['targets'][number]>;
  if (new Set(targets.map((t) => t.id)).size !== targets.length) return null;
  return Object.freeze({
    revision: v.revision,
    allMuted,
    targets: Object.freeze(targets.map((t) => Object.freeze({ ...t }))),
  });
}
