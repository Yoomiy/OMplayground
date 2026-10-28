import type { AdmittedActor } from '../sim/game-room.ts';
export type AdmissionRequest = Readonly<{
  room: string;
  invitationCode?: string;
  participation?: 'player' | 'observer';
}>;
export type Authorization = Readonly<{
  actor: AdmittedActor;
  expiresAt: number;
  membershipRevision?: number;
}>;
export type AdmissionGrant = Authorization &
  Readonly<{ revalidate: (stage?: 'ticket' | 'actor') => Promise<Authorization | null> }>;
export class SessionEnded extends Error {
  readonly code = 'SESSION_ENDED';
  constructor() {
    super('SESSION_ENDED');
  }
}
export function isSessionEnded(error: unknown): boolean {
  return error instanceof Error && (error as { code?: unknown }).code === 'SESSION_ENDED';
}
const MAX_AUTHORIZATION_MS = 60000;
function object(value: unknown, fields: readonly string[]): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    Object.keys(value).length === fields.length &&
    fields.every((key) => Object.hasOwn(value, key))
  );
}
/** Private server grant, never decoded from a browser-supplied role or timer. */
export function readAuthorization(value: unknown, now: number, expectedId?: string): Authorization {
  if (
    (!object(value, ['actor', 'expiresAt']) &&
      !object(value, ['actor', 'expiresAt', 'membershipRevision'])) ||
    ('membershipRevision' in value &&
      (!Number.isSafeInteger(value.membershipRevision) ||
        (value.membershipRevision as number) < 0)) ||
    !object(value.actor, ['id', 'role', 'capabilities']) ||
    typeof value.actor.id !== 'string' ||
    !value.actor.id.length ||
    value.actor.id.length > 128 ||
    (expectedId !== undefined && value.actor.id !== expectedId) ||
    !['participant', 'observer'].includes(value.actor.role as string) ||
    !object(value.actor.capabilities, ['build', 'fly', 'observe', 'combat', 'explosives']) ||
    !Object.values(value.actor.capabilities).every((flag) => typeof flag === 'boolean') ||
    (value.actor.role === 'observer' && value.actor.capabilities.observe !== true) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isFinite(value.expiresAt) ||
    value.expiresAt <= now ||
    value.expiresAt > now + MAX_AUTHORIZATION_MS
  )
    throw new Error('invalid server authorization');
  return Object.freeze({
    actor: Object.freeze({
      id: value.actor.id,
      role: value.actor.role,
      capabilities: Object.freeze({
        build: value.actor.capabilities.build,
        fly: value.actor.capabilities.fly,
        observe: value.actor.capabilities.observe,
        combat: value.actor.capabilities.combat,
        explosives: value.actor.capabilities.explosives,
      }),
    }) as AdmittedActor,
    expiresAt: value.expiresAt,
    ...(value.membershipRevision === undefined
      ? {}
      : { membershipRevision: value.membershipRevision as number }),
  });
}
/** A delayed provider response cannot revive an already expired connection. */
export class ConnectionAuthorization {
  private grant: AdmissionGrant;
  private current: Authorization;
  private deadline: number;
  private renewal: ReturnType<typeof setTimeout> | null = null;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private readonly initialMembershipRevision: number;
  private apply: (deadline: number) => void;
  private lost: (reason: 'UNAUTHORIZED' | 'RECOVERING' | 'SESSION_ENDED') => void;
  constructor(
    grant: AdmissionGrant,
    current: Authorization,
    apply: (deadline: number) => void,
    lost: (reason: 'UNAUTHORIZED' | 'RECOVERING' | 'SESSION_ENDED') => void,
  ) {
    this.grant = grant;
    this.current = current;
    this.initialMembershipRevision = current.membershipRevision ?? 0;
    this.apply = apply;
    this.lost = lost;
    this.deadline = performance.now() + current.expiresAt - Date.now();
    this.schedule();
  }
  get until() {
    return this.deadline;
  }
  get actorId() {
    return this.current.actor.id;
  }
  get actorRole() {
    return this.current.actor.role;
  }
  /** Renewal cannot upgrade a connection past a later removal boundary. */
  get admissionRevision() {
    return this.initialMembershipRevision;
  }
  valid() {
    if (!this.closed && performance.now() < this.deadline) return true;
    if (!this.closed) this.fail('UNAUTHORIZED');
    return false;
  }
  private schedule() {
    const remaining = this.deadline - performance.now();
    this.expiry = setTimeout(() => this.fail('UNAUTHORIZED'), Math.max(0, remaining));
    this.renewal = setTimeout(() => void this.renew(), Math.max(0, remaining / 2));
  }
  private async renew() {
    if (!this.valid()) return;
    try {
      const value = await this.grant.revalidate('actor');
      if (!this.valid()) return;
      if (value === null) {
        this.fail('UNAUTHORIZED');
        return;
      }
      const next = readAuthorization(value, Date.now(), this.current.actor.id);
      if (JSON.stringify(next.actor) !== JSON.stringify(this.current.actor)) {
        this.fail('UNAUTHORIZED');
        return; // Changed participation/capabilities require a fresh baseline.
      }
      if (this.expiry) clearTimeout(this.expiry);
      this.current = next;
      this.deadline = performance.now() + next.expiresAt - Date.now();
      this.apply(this.deadline);
      this.schedule();
    } catch (error) {
      if (this.valid()) this.fail(isSessionEnded(error) ? 'SESSION_ENDED' : 'RECOVERING');
    }
  }
  private fail(reason: 'UNAUTHORIZED' | 'RECOVERING' | 'SESSION_ENDED') {
    if (this.closed) return;
    this.close();
    this.lost(reason);
  }
  close() {
    this.closed = true;
    if (this.renewal) clearTimeout(this.renewal);
    if (this.expiry) clearTimeout(this.expiry);
  }
}
