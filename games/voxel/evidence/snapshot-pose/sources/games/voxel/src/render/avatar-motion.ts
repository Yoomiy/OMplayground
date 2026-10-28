import type { AvatarPose } from './avatars.ts';
export function avatarIdentity(id: string): number {
  let hash = 2166136261;
  for (let i = 0; i < id.length; i++) hash = Math.imul(hash ^ id.charCodeAt(i), 16777619);
  return hash >>> 0;
}
export function avatarSwing(
  actor: AvatarPose,
  seconds: number,
  hash = avatarIdentity(actor.id),
): number {
  return actor.flying
    ? 0
    : Math.sin(seconds * 10 + (hash % 16)) * Math.min(0.7, actor.speed * 0.13);
}
