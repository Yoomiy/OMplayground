import type { AvatarPose } from './avatars.ts';
import { avatarIdentity } from '../shared/avatars.ts';
export { avatarIdentity } from '../shared/avatars.ts';
export function avatarSwing(
  actor: AvatarPose,
  seconds: number,
  hash = avatarIdentity(actor.id),
): number {
  return (
    (actor.actionSwing ?? 0) +
    (actor.flying ? 0 : Math.sin(seconds * 10 + (hash % 16)) * Math.min(0.7, actor.speed * 0.13))
  );
}
