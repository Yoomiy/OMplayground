/** Explicitly curated categories for the local presets built with Blockyard (not inferred from names). */
export const AVATAR_POOLS: Readonly<Record<'boy' | 'girl', readonly number[]>> = Object.freeze({
  boy: Object.freeze([0, 1, 3, 4, 5, 7]),
  girl: Object.freeze([2, 6, 8, 9, 10, 11]),
});
export const AVATAR_COUNT = 12;
export function isAvatarId(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value < AVATAR_COUNT;
}
export function avatarIdentity(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}
/** Called with a verified profile gender by the school server; guests/admins use the full set. */
export function selectAvatar(id: string, gender: 'boy' | 'girl' | null = null): number {
  const hash = avatarIdentity(id);
  return gender ? AVATAR_POOLS[gender][hash % AVATAR_POOLS[gender].length] : hash % AVATAR_COUNT;
}
