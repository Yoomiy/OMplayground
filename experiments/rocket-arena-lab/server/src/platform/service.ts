import * as colyseus from '@colyseus/core';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { AdmissionError, type Admission } from './admission.js';
import { PlatformGateway } from './gateway.js';
import { LaunchTickets } from './tickets.js';
import { configurePlatformRooms, PlaygroundRoom } from './playground-room.js';
import { platformLog } from './logging.js';
import { RoomCheckpoints } from './checkpoint.js';

const { matchMaker } = colyseus;
export interface ServiceOptions { gateway: PlatformGateway; ticketSecret: string; origins: string[]; clientDir: string; maxRooms: number;
  release?: string;
  createVoiceToken?: (args: { sessionId: string; userId: string; displayName: string }) => Promise<{ token: string; serverUrl: string }> }

export function createPlatformService(options: ServiceOptions) {
  const tickets = new LaunchTickets(options.ticketSecret);
  const checkpoints = new RoomCheckpoints(options.ticketSecret);
  const internalKey = randomBytes(32).toString('hex');
  const instanceId = randomUUID();
  const allocations = new Map<string, Promise<{ roomId: string; allocationId: string }>>();
  const origins = new Set(options.origins);
  const clientDir = resolve(options.clientDir);
  const launchRates = new Map<string, { at: number; count: number }>();
  const voiceTokens = new Map<string, { expiresAt: number; pending: Promise<{ token: string; serverUrl: string }> }>();
  let draining = false;
  if (!origins.size || !Number.isSafeInteger(options.maxRooms) || options.maxRooms < 1) throw new Error('App origins and a positive room limit are required');
  for (const origin of origins) if (new URL(origin).origin !== origin) throw new Error('APP_ORIGINS must contain exact origins');

  configurePlatformRooms({ gateway: options.gateway, tickets, checkpoints, internalKey, onDispose(sessionId, roomId) {
    const pending = allocations.get(sessionId);
    void pending?.then(allocation => { if (allocation.roomId === roomId) allocations.delete(sessionId); }, () => {});
  } });

  async function allocate(admission: Admission) {
    const sessionId = admission.session.id;
    const existing = allocations.get(sessionId);
    if (existing) return existing;
    if (draining || allocations.size >= options.maxRooms) throw new AdmissionError('SERVICE_BUSY', 503);
    const pending = (async () => {
      const session = await options.gateway.session(sessionId);
      if (session.status === 'completed') throw new AdmissionError('SESSION_COMPLETED', 409);
      let saved = null;
      if (session.game_state !== null) {
        if (session.game_state.rocket !== true) throw new AdmissionError('INCOMPATIBLE_SESSION', 409);
        if (Number(session.game_state.leaseUntil) > Date.now()) throw new AdmissionError('SESSION_RECOVERING', 503);
        saved = checkpoints.read(session.game_state.checkpoint, sessionId);
        if (!saved) {
          const expired = checkpoints.read(session.game_state.checkpoint, sessionId, 0) !== null;
          await options.gateway.update(session, { status: 'completed', ended_at: new Date().toISOString(),
            connected_player_ids: [], connected_player_names: [], is_open: false,
            game_state: { ...session.game_state, reason: 'checkpoint-unavailable-or-expired', phase: 'ended' } });
          throw new AdmissionError(expired ? 'SESSION_COMPLETED' : 'MATCH_INTERRUPTED', 409);
        }
      }
      const allocationId = randomUUID();
      await options.gateway.update(session, { ...(saved ? { status: 'paused' } : {}), connected_player_ids: [], connected_player_names: [],
        game_state: { rocket: true, version: 1, instanceId, allocationId,
          ...(saved ? { checkpoint: checkpoints.sign(saved) } : {}), leaseUntil: Date.now() + 60_000, phase: 'allocated' } });
      let room: PlaygroundRoom | undefined;
      try {
        const listing = await matchMaker.createRoom('playground', { internalKey, admission: { ...admission, session }, allocationId, saved });
        room = matchMaker.getRoomById(listing.roomId) as PlaygroundRoom | undefined;
        if (!room) throw new AdmissionError('ROOM_UNAVAILABLE', 503);
        await room.whenReady();
        return { roomId: listing.roomId, allocationId };
      } catch (error) {
        await room?.abortInitialization().catch(() => {});
        try {
          const claimed = await options.gateway.session(sessionId);
          if (claimed.status !== 'completed' && claimed.game_state?.allocationId === allocationId) {
            await options.gateway.update(claimed, {
              status: saved ? 'paused' : session.status,
              connected_player_ids: [], connected_player_names: [],
              // Keep the signed checkpoint and its original expiry. With no
              // checkpoint, undo only our claim so a fresh room can retry too.
              game_state: saved ? { ...session.game_state, allocationId, leaseUntil: 0, reason: 'allocation-failed' } : null,
            });
          }
        } catch (releaseError) {
          // The claimed checkpoint is still durable; a failed release falls
          // back to the existing lease timeout, never to session completion.
          platformLog('error', 'ROCKET_RECOVERY_RELEASE_FAILED', { sessionId, allocationId, err: releaseError });
        }
        platformLog('error', 'ROCKET_ALLOCATION_FAILED', { sessionId, allocationId, checkpointRetained: !!saved, err: error });
        throw error;
      }
    })();
    allocations.set(sessionId, pending);
    void pending.catch(() => { if (allocations.get(sessionId) === pending) allocations.delete(sessionId); });
    return pending;
  }

  function json(res: ServerResponse, status: number, body: unknown): void {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(body));
  }
  async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
    let raw = '';
    for await (const chunk of req) {
      raw += chunk.toString();
      if (raw.length > 12_000) throw new AdmissionError('REQUEST_TOO_LARGE', 413);
    }
    try { const value = JSON.parse(raw); if (value && typeof value === 'object' && !Array.isArray(value)) return value; }
    catch { /* Return one public parse error. */ }
    throw new AdmissionError('BAD_REQUEST', 400);
  }

  async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const correlationId = randomUUID();
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    const origin = req.headers.origin;
    if (origin && origins.has(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    }
    if (req.method === 'OPTIONS') { res.writeHead(origin && origins.has(origin) ? 204 : 403); res.end(); return; }
    const url = new URL(req.url ?? '/', 'http://rocket.internal');
    if (url.pathname === '/health') { json(res, 200, { ok: true, service: 'playground-rocket', protocol: 1, release: options.release ?? 'development' }); return; }
    if (url.pathname === '/ready') { json(res, draining ? 503 : 200, { ok: !draining, activeRooms: allocations.size, maxRooms: options.maxRooms, release: options.release ?? 'development' }); return; }
    if (url.pathname === '/api/rocket/config') { json(res, 200, { protocol: 1, appOrigins: [...origins], release: options.release ?? 'development',
      capabilities: ['lobby-controls', 'session-chat', 'voice', 'retained-matches', 'queued-roster', 'rematch', 'save-outcomes'] }); return; }
    if (['/api/rocket/chat', '/api/rocket/voice'].includes(url.pathname) && req.method === 'POST') {
      if (!origin || !origins.has(origin)) throw new AdmissionError('ORIGIN_FORBIDDEN');
      if (draining) throw new AdmissionError('SERVICE_DRAINING', 503);
      const profile = await options.gateway.authenticate(req.headers.authorization?.replace(/^Bearer\s+/i, ''));
      const input = await body(req);
      if (typeof input.sessionId !== 'string') throw new AdmissionError('BAD_SESSION', 400);
      const allocation = await allocations.get(input.sessionId);
      const room = allocation && matchMaker.getRoomById(allocation.roomId) as PlaygroundRoom | undefined;
      if (!room) throw new AdmissionError('NOT_IN_ROOM');
      const admission = await room.authorizeSocial(profile);
      const rateKey = `${profile.userId}:${url.pathname}`;
      const now = Date.now();
      for (const [key, rate] of launchRates) if (now - rate.at >= 60_000) launchRates.delete(key);
      const previous = launchRates.get(rateKey);
      const chat = url.pathname.endsWith('/chat');
      if (previous && (chat ? now - previous.at < 700 : now - previous.at < 60_000 && previous.count >= 20)) {
        res.setHeader('Retry-After', chat ? '1' : String(Math.max(1, Math.ceil((60_000 - (now - previous.at)) / 1000))));
        throw new AdmissionError('RATE_LIMITED', 429);
      }
      if (launchRates.size >= 10_000) throw new AdmissionError('RATE_LIMITED', 429);
      launchRates.set(rateKey, !chat && previous && now - previous.at < 60_000
        ? { at: previous.at, count: previous.count + 1 } : { at: now, count: 1 });
      if (chat) {
        await options.gateway.sendChat(admission, input.message);
        json(res, 200, { ok: true });
      } else {
        // Authorization above is always fresh. StrictMode/remounts may request
        // the same reusable LiveKit token concurrently; mint it only once.
        for (const [key, token] of voiceTokens) if (token.expiresAt <= now) voiceTokens.delete(key);
        const key = `${allocation!.allocationId}:${profile.userId}:${profile.role}:${admission.observer}`;
        let cached = voiceTokens.get(key);
        if (!cached) {
          if (!options.createVoiceToken) throw new AdmissionError('VOICE_UNAVAILABLE', 503);
          if (voiceTokens.size >= 1000) throw new AdmissionError('SERVICE_BUSY', 503);
          const pending = options.createVoiceToken({ sessionId: input.sessionId, userId: profile.userId, displayName: profile.name });
          cached = { expiresAt: now + 30_000, pending };
          voiceTokens.set(key, cached);
          void pending.catch(() => { if (voiceTokens.get(key)?.pending === pending) voiceTokens.delete(key); });
        }
        let voice;
        try {
          voice = await cached.pending;
        }
        catch { throw new AdmissionError('VOICE_UNAVAILABLE', 503); }
        platformLog('info', 'ROCKET_VOICE_TOKEN_ISSUED', { sessionId: input.sessionId, userId: profile.userId, correlationId, observer: admission.observer });
        json(res, 200, { token: voice.token, serverUrl: voice.serverUrl });
      }
      return;
    }
    if (url.pathname === '/api/rocket/launch' && req.method === 'POST') {
      if (!origin || !origins.has(origin)) throw new AdmissionError('ORIGIN_FORBIDDEN');
      if (draining) throw new AdmissionError('SERVICE_DRAINING', 503);
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const profile = await options.gateway.authenticate(token);
      const now = Date.now();
      for (const [key, rate] of launchRates) if (now - rate.at >= 60_000) launchRates.delete(key);
      const rate = launchRates.get(profile.userId) ?? { at: now, count: 0 };
      if (++rate.count > 20 || launchRates.size >= 10_000) throw new AdmissionError('RATE_LIMITED', 429);
      launchRates.set(profile.userId, rate);
      const input = await body(req);
      if (typeof input.sessionId !== 'string' || (input.invitationCode !== undefined && (typeof input.invitationCode !== 'string' || input.invitationCode.length > 100))) throw new AdmissionError('BAD_REQUEST', 400);
      const observer = profile.role !== 'kid' && input.participation !== 'player';
      const admission = await options.gateway.admit(profile, input.sessionId, observer, input.invitationCode as string | undefined);
      admission.correlationId = correlationId;
      const allocation = await allocate(admission);
      const room = matchMaker.getRoomById(allocation.roomId) as PlaygroundRoom | undefined;
      if (!room) throw new AdmissionError('ROOM_UNAVAILABLE', 503);
      room.assertAdmission(admission);
      const ticket = tickets.issue({ userId: profile.userId, sessionId: input.sessionId,
        roomId: allocation.roomId, allocationId: allocation.allocationId, observer,
        correlationId, ...(typeof input.invitationCode === 'string' ? { invitationCode: input.invitationCode } : {}) });
      const listing = await matchMaker.query({ roomId: allocation.roomId });
      if (!listing[0]) throw new AdmissionError('ROOM_UNAVAILABLE', 503);
      const reservation = await matchMaker.reserveSeatFor(listing[0], { ticket });
      platformLog('info', 'ROCKET_LAUNCH_COMPLETED', { correlationId, sessionId: input.sessionId, roomId: allocation.roomId, observer });
      json(res, 200, { version: 1, sessionId: input.sessionId, reservation }); return;
    }
    // All matchmaking reservations go through authenticated launch, including refresh.
    if (url.pathname.startsWith('/matchmake') || url.pathname.startsWith('/game')) { json(res, 403, { code: 'AUTHENTICATED_LAUNCH_REQUIRED' }); return; }
    if (req.method !== 'GET' && req.method !== 'HEAD') { json(res, 405, { code: 'METHOD_NOT_ALLOWED' }); return; }
    let pathname: string;
    try { pathname = decodeURIComponent(url.pathname); } catch { throw new AdmissionError('BAD_PATH', 400); }
    const file = resolve(clientDir, `.${pathname === '/' ? '/index.html' : pathname}`);
    if (!file.startsWith(clientDir + sep)) throw new AdmissionError('BAD_PATH', 400);
    let metadata;
    try { metadata = await stat(file); } catch { json(res, 404, { code: 'NOT_FOUND' }); return; }
    if (!metadata.isFile()) { json(res, 404, { code: 'NOT_FOUND' }); return; }
    const extension = extname(file);
    const types: Record<string, string> = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript', '.css': 'text/css', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav' };
    res.setHeader('Content-Type', types[extension] ?? 'application/octet-stream');
    res.setHeader('Content-Length', metadata.size);
    res.setHeader('Cache-Control', pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
    if (extension === '.html') res.setHeader('Content-Security-Policy', `frame-ancestors ${[...origins].join(' ')}`);
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).on('error', () => res.destroy()).pipe(res);
  }

  return {
    roomClass: PlaygroundRoom,
    handle(req: IncomingMessage, res: ServerResponse): void {
      void handler(req, res).catch(error => {
        const known = error instanceof AdmissionError;
        platformLog(known && error.status < 500 ? 'warn' : 'error', 'ROCKET_REQUEST_FAILED', {
          correlationId: res.getHeader('X-Correlation-ID'), code: known ? error.code : 'SERVICE_UNAVAILABLE',
          method: req.method, path: req.url?.split('?')[0],
          ...(!known && error instanceof Error ? { err: error } : {}) });
        json(res, known ? error.status : 503, { code: known ? error.code : 'SERVICE_UNAVAILABLE' });
      });
    },
    async drain(): Promise<void> {
      draining = true;
      await Promise.all([...allocations.values()].map(async pending => {
        const allocation = await pending.catch(() => null);
        const room = allocation && matchMaker.getRoomById(allocation.roomId) as PlaygroundRoom | undefined;
        await room?.hibernate('server-shutdown');
      }));
    },
  };
}
