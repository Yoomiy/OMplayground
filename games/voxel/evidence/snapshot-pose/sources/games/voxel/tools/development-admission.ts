import type { AdmittedActor } from '../src/sim/game-room.ts';
import type { AdmissionGrant } from '../src/server/admission.ts';
/** Explicitly trusted local/test policy; production uses the school service. */
export function developmentAdmission(actor: AdmittedActor): AdmissionGrant {
  if (process.env.NODE_ENV === 'production')
    throw new Error('development admission cannot run in production');
  const authorize = () => ({
    actor: { id: actor.id, role: actor.role, capabilities: { ...actor.capabilities } },
    expiresAt: Date.now() + 30000,
  });
  return { ...authorize(), revalidate: async () => authorize() };
}
