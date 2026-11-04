import type { AdmittedActor } from '../sim/game-room.ts';
import { readAuthorization } from './admission.ts';

export const OWNER_AUTHORIZATION_MS = 5000;
export type OwnerResolver = (room: string, owner: string) => Promise<AdmittedActor | null>;
export type OwnerAuthorizations = readonly (readonly [string, AdmittedActor | null])[];

/** A work budget, never a limit on owners. Unknown results cannot become denials. */
export async function resolveOwnerAuthorizations(
  resolve: OwnerResolver,
  room: string,
  owners: readonly string[],
): Promise<OwnerAuthorizations> {
  if (
    !Array.isArray(owners) ||
    new Set(owners).size !== owners.length ||
    owners.some((id) => typeof id !== 'string' || !id.length || id.length > 128)
  )
    throw new Error('invalid owner identities');
  let next = 0;
  const results: (readonly [string, AdmittedActor | null])[] = new Array(owners.length);
  const workers = await Promise.allSettled(
    Array.from({ length: Math.min(4, owners.length) }, async () => {
      for (;;) {
        const index = next++;
        if (index >= owners.length) return;
        const id = owners[index],
          value = await resolve(room, id),
          now = Date.now();
        const actor =
          value === null
            ? null
            : readAuthorization({ actor: value, expiresAt: now + OWNER_AUTHORIZATION_MS }, now, id)
                .actor;
        results[index] = Object.freeze([id, actor] as const);
      }
    }),
  );
  if (workers.some((result) => result.status === 'rejected'))
    throw new Error('owner authorization unavailable');
  return Object.freeze(results);
}
