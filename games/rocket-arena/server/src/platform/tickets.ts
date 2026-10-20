import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { AdmissionError } from './admission.js';

interface Ticket {
  version: 1;
  userId: string;
  sessionId: string;
  allocationId: string;
  roomId: string;
  observer: boolean;
  invitationCode?: string;
  correlationId?: string;
  expiresAt: number;
  nonce: string;
}

/** Single-use, short-lived tickets are scoped to this service and room. */
export class LaunchTickets {
  private readonly used = new Map<string, number>();
  constructor(private readonly secret: string) {
    if (secret.length < 32) throw new Error('ROCKET_TICKET_SECRET must contain at least 32 characters');
  }
  issue(scope: Omit<Ticket, 'version' | 'expiresAt' | 'nonce'>, now = Date.now()): string {
    const body = Buffer.from(JSON.stringify({ ...scope, version: 1, expiresAt: now + 30_000, nonce: randomUUID() })).toString('base64url');
    return `${body}.${this.sign(body).toString('base64url')}`;
  }
  consume(token: unknown, roomId: string, allocationId: string, now = Date.now()): Ticket {
    if (typeof token !== 'string' || token.length > 2048) throw new AdmissionError('INVALID_TICKET', 401);
    const [body, signature, extra] = token.split('.');
    if (!body || !signature || extra) throw new AdmissionError('INVALID_TICKET', 401);
    const expected = this.sign(body), supplied = Buffer.from(signature, 'base64url');
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new AdmissionError('INVALID_TICKET', 401);
    let ticket: Ticket;
    try { ticket = JSON.parse(Buffer.from(body, 'base64url').toString()); }
    catch { throw new AdmissionError('INVALID_TICKET', 401); }
    for (const [nonce, expiry] of this.used) if (expiry <= now) this.used.delete(nonce);
    if (ticket.version !== 1 || ticket.roomId !== roomId || ticket.allocationId !== allocationId
      || typeof ticket.sessionId !== 'string' || typeof ticket.userId !== 'string'
      || typeof ticket.observer !== 'boolean' || typeof ticket.nonce !== 'string'
      || !Number.isFinite(ticket.expiresAt) || ticket.expiresAt <= now || ticket.expiresAt > now + 30_000
      || this.used.has(ticket.nonce)) throw new AdmissionError('EXPIRED_OR_USED_TICKET', 401);
    if (this.used.size >= 10_000) throw new AdmissionError('SERVICE_BUSY', 503);
    this.used.set(ticket.nonce, ticket.expiresAt);
    return ticket;
  }
  private sign(body: string): Buffer { return createHmac('sha256', this.secret).update(body).digest(); }
}
