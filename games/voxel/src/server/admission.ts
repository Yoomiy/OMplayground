import { isAvatarId } from '../shared/avatars.ts';
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
  Readonly<{
    revalidate: (stage?: 'ticket' | 'actor') => Promise<Authorization | null>;
    /** A joined school's session has a local cutoff and best-effort background checks. */
    connected?: () => ConnectedPolicy;
  }>;
export type ConnectedPolicy = Readonly<{
  authorization: Authorization;
  expiresReason: 'RECESS_CLOSED' | 'RECOVERING';
  recheckMs: number;
  revalidate: () => Promise<Authorization | null>;
}>;
export class AuthorizationDenied extends Error {
  readonly code: 'UNAUTHORIZED' | 'RECESS_CLOSED';
  constructor(code: 'UNAUTHORIZED' | 'RECESS_CLOSED') {
    super(code);
    this.code = code;
  }
}
type AuthorizationFailure = Readonly<{
  authorizationFailure: 'expired' | 'denied' | 'changed' | 'session_ended';
  renewalMs: number;
  renewalAttempts: number;
  renewalFailures: number;
  lastRenewalFailure: string;
  renewalInFlight: boolean;
  proofRemainingMs: number;
  proofLifetimeMs: number;
}>;
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
export function readAuthorization(
  value: unknown,
  now: number,
  expectedId?: string,
  maxLifetimeMs = MAX_AUTHORIZATION_MS,
): Authorization {
  if (
    (!object(value, ['actor', 'expiresAt']) &&
      !object(value, ['actor', 'expiresAt', 'membershipRevision'])) ||
    ('membershipRevision' in value &&
      (!Number.isSafeInteger(value.membershipRevision) ||
        (value.membershipRevision as number) < 0)) ||
    (!object(value.actor, ['id', 'role', 'capabilities']) &&
      !object(value.actor, ['id', 'role', 'capabilities', 'avatar'])) ||
    ('avatar' in value.actor && !isAvatarId(value.actor.avatar)) ||
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
    value.expiresAt > now + maxLifetimeMs
  )
    throw new Error('invalid server authorization');
  return Object.freeze({
    actor: Object.freeze({
      id: value.actor.id,
      ...(value.actor.avatar === undefined ? {} : { avatar: value.actor.avatar }),
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
  private policy: ConnectedPolicy | undefined;
  private current: Authorization;
  private deadline: number;
  private renewal: ReturnType<typeof setTimeout> | null = null;
  private expiry: ReturnType<typeof setTimeout> | null = null;
  private closed = false;
  private renewalStarted: number | null = null;
  private renewalMs = 0;
  private renewalPending = false;
  private lastAttemptMs = 0;
  private renewalAttempts = 0;
  private renewalFailures = 0;
  private lastRenewalFailure = 'none';
  private proofLifetimeMs: number;
  private readonly initialMembershipRevision: number;
  private apply: (deadline: number) => void;
  private lost: (
    reason: 'UNAUTHORIZED' | 'RECOVERING' | 'SESSION_ENDED' | 'RECESS_CLOSED',
    detail: AuthorizationFailure,
  ) => void;
  constructor(
    grant: AdmissionGrant,
    current: Authorization,
    apply: (deadline: number) => void,
    lost: (
      reason: 'UNAUTHORIZED' | 'RECOVERING' | 'SESSION_ENDED' | 'RECESS_CLOSED',
      detail: AuthorizationFailure,
    ) => void,
  ) {
    this.grant = grant;
    this.policy = grant.connected?.();
    if (this.policy) {
      const connected = readAuthorization(
        this.policy.authorization,
        Date.now(),
        current.actor.id,
        24 * 60 * 60000,
      );
      if (
        JSON.stringify(connected.actor) !== JSON.stringify(current.actor) ||
        !Number.isFinite(this.policy.recheckMs) ||
        this.policy.recheckMs < 1 ||
        this.policy.recheckMs > 60000
      )
        throw new Error('invalid connected policy');
      this.current = connected;
    } else this.current = current;
    this.initialMembershipRevision = current.membershipRevision ?? 0;
    this.apply = apply;
    this.lost = lost;
    this.proofLifetimeMs = this.current.expiresAt - Date.now();
    this.deadline = performance.now() + this.proofLifetimeMs;
    // Allocation and membership IO can consume most of the ticket proof. Start
    // its first connected check now, while that proof is still valid.
    this.schedule(!this.policy);
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
    if (!this.closed) this.fail(this.policy?.expiresReason ?? 'RECOVERING');
    return false;
  }
  private schedule(immediate = false) {
    const remaining = this.deadline - performance.now();
    // A missed renewal stops authority at the same deadline, but is not a
    // confirmed revocation. A fresh admission may retry after the outage.
    this.expiry = setTimeout(
      () => this.fail(this.policy?.expiresReason ?? 'RECOVERING'),
      Math.max(0, remaining),
    );
    // School proofs expire from request START, not response arrival. Reserve
    // the observed provider duration as well as half the remaining lifetime.
    this.renewal = setTimeout(
      () => void this.renew(),
      this.policy
        ? Math.min(this.policy.recheckMs, remaining)
        : immediate
          ? 0
          : Math.max(0, remaining / 2 - this.renewalMs),
    );
  }
  private async renew() {
    if (!this.valid()) return;
    this.renewalAttempts++;
    this.renewalStarted = performance.now();
    this.renewalPending = true;
    try {
      const value = this.policy
        ? await this.policy.revalidate()
        : await this.grant.revalidate('actor');
      this.lastAttemptMs = performance.now() - this.renewalStarted;
      this.renewalPending = false;
      if (!this.valid()) return;
      if (value === null) {
        this.fail('UNAUTHORIZED', 'denied');
        return;
      }
      const next = readAuthorization(
        value,
        Date.now(),
        this.current.actor.id,
        this.policy ? 24 * 60 * 60000 : MAX_AUTHORIZATION_MS,
      );
      if (JSON.stringify(next.actor) !== JSON.stringify(this.current.actor)) {
        this.fail('UNAUTHORIZED', 'changed');
        return; // Changed participation/capabilities require a fresh baseline.
      }
      if (this.expiry) clearTimeout(this.expiry);
      this.renewalMs = performance.now() - this.renewalStarted;
      this.renewalStarted = null;
      this.current = next;
      this.proofLifetimeMs = next.expiresAt - Date.now();
      this.lastRenewalFailure = 'none';
      this.deadline = performance.now() + this.proofLifetimeMs;
      this.apply(this.deadline);
      this.schedule();
    } catch (error) {
      this.lastAttemptMs = performance.now() - this.renewalStarted!;
      this.renewalPending = false;
      this.renewalFailures++;
      this.lastRenewalFailure =
        error instanceof Error && ['TimeoutError', 'AbortError'].includes(error.name)
          ? error.name
          : error instanceof Error && error.message === 'invalid server authorization'
            ? 'invalid_authorization'
            : 'provider_error';
      if (!this.valid()) return;
      if (isSessionEnded(error)) this.fail('SESSION_ENDED', 'session_ended');
      else if (
        error instanceof AuthorizationDenied ||
        (error instanceof Error &&
          ['RECESS_CLOSED', 'UNAUTHORIZED'].includes((error as { code?: string }).code ?? ''))
      )
        this.fail((error as AuthorizationDenied).code, 'denied');
      else {
        // A transient provider error does not revoke an unexpired proof. Retry
        // without moving its independent expiry or allowing late resurrection.
        this.renewal = setTimeout(
          () => void this.renew(),
          this.policy
            ? Math.min(5000, Math.max(1, this.deadline - performance.now()))
            : Math.min(250, Math.max(1, (this.deadline - performance.now()) / 2)),
        );
      }
    }
  }
  private fail(
    reason: 'UNAUTHORIZED' | 'RECOVERING' | 'SESSION_ENDED' | 'RECESS_CLOSED',
    authorizationFailure: AuthorizationFailure['authorizationFailure'] = 'expired',
  ) {
    if (this.closed) return;
    this.close();
    this.lost(reason, {
      authorizationFailure,
      renewalAttempts: this.renewalAttempts,
      renewalFailures: this.renewalFailures,
      lastRenewalFailure: this.lastRenewalFailure,
      renewalInFlight: this.renewalPending,
      proofRemainingMs: Math.round(this.deadline - performance.now()),
      proofLifetimeMs: Math.round(this.proofLifetimeMs),
      renewalMs: Math.round(
        this.renewalPending && this.renewalStarted !== null
          ? performance.now() - this.renewalStarted
          : this.lastAttemptMs,
      ),
    });
  }
  close() {
    this.closed = true;
    if (this.renewal) clearTimeout(this.renewal);
    if (this.expiry) clearTimeout(this.expiry);
  }
}
