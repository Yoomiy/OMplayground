/** Real HTTP/WSS/physics against an isolated Supabase API fixture. No real DB. */
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as colyseus from '@colyseus/core';
import wsTransport from '@colyseus/ws-transport';
import { Client, type Room } from 'colyseus.js';
import { createPlatformService } from '../server/src/platform/service.js';
import { RoomCheckpoints } from '../server/src/platform/checkpoint.js';
import { PlatformGateway } from '../server/src/platform/gateway.js';
import { PlaygroundRoom } from '../server/src/platform/playground-room.js';
import { configurePlatformLogger } from '../server/src/platform/logging.js';
import type { PlatformSession } from '../server/src/platform/admission.js';
import { ClientTelemetry } from '../client/src/prediction/telemetry.js';
import { isPlatformView, type PlatformView } from '../client/src/platform/protocol.js';
import { createGameVoiceToken } from '../../../apps/game-server/src/gameVoiceToken.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const repo = fileURLToPath(new URL('../../../', import.meta.url));
const origin = 'http://127.0.0.1:19008';
const endpoint = 'http://127.0.0.1:19006';
const uid = (index: number) => `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
const sessions = new Map<string, PlatformSession>();
const profileDelays = new Map<number, number>();
const disabled = new Set<number>();
const recessDenied = new Set<number>();
const names = (index: number) => index === 1 ? 'אורמן <QA>' : `חבר ${index}`;
let platformFailure = false;
let failedPatch: { sessionId: string; reason: string; commitBeforeFailure?: boolean } | null = null;
const logs: Record<string, any>[] = [];
let debugEnabled = false;
configurePlatformLogger({
  debug: value => logs.push({ level: 'debug', ...value }),
  info: value => logs.push({ level: 'info', ...value }),
  warn: value => logs.push({ level: 'warn', ...value }),
  error: value => logs.push({ level: 'error', ...value }),
  isLevelEnabled: level => level !== 'debug' || debugEnabled,
});
let heldSessionRead: { sessionId: string; reached(): void; released: Promise<void> } | null = null;
const chatMessages: Record<string, unknown>[] = [];
let voiceMints = 0;
process.env.LIVEKIT_URL = 'wss://fixture-livekit.invalid';
process.env.LIVEKIT_API_KEY = 'fixture-api-key';
process.env.LIVEKIT_API_SECRET = 'fixture-api-secret-more-than-32-characters';
const newSession = (index: number, isOpen = true): string => {
  const id = uid(100 + index);
  sessions.set(id, { id, host_id: uid(1), gender: 'boy', status: 'waiting', is_open: isOpen,
    invitation_code: 'fixture-private-code', player_ids: [uid(1)], player_names: [names(1)], game_state: null,
    games: { game_url: 'rocket-arena', is_active: true } });
  return id;
};
const send = (res: http.ServerResponse, status: number, data: unknown) => {
  res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(data));
};
const jsonb = (value: any): any => Array.isArray(value) ? value.map(jsonb)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value)
    .sort(([left], [right]) => left.length - right.length || left.localeCompare(right, 'en'))
    .map(([key, child]) => [key, jsonb(child)])) : value;
const fixture = http.createServer((req, res) => {
  void (async () => {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] ?? 'authorization,apikey,content-type,x-client-info,accept-profile');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (platformFailure) { send(res, 503, {}); return; }
    const url = new URL(req.url ?? '/', 'http://fixture');
    if (url.pathname === '/auth/v1/user') {
      const index = Number(req.headers.authorization?.replace('Bearer fixture-token-', ''));
      if (index < 1 || index > 20 || !Number.isInteger(index)) { send(res, 401, {}); return; }
      send(res, 200, { id: uid(index) }); return;
    }
    const table = url.pathname.replace('/rest/v1/', '');
    if (table === 'chat_messages' && req.method === 'GET') {
      send(res, 200, chatMessages.filter(line => `eq.${line.session_id}` === url.searchParams.get('session_id'))); return;
    }
    if (req.headers.apikey !== 'fixture-service-key') { send(res, 401, {}); return; }
    if (table === 'chat_messages' && req.method === 'POST') {
      let raw = ''; for await (const chunk of req) raw += chunk.toString();
      const line = { ...JSON.parse(raw), id: uid(900 + chatMessages.length), timestamp: new Date().toISOString(), is_deleted: false };
      chatMessages.push(line); send(res, 201, [line]); return;
    }
    if (table === 'audit_log' && req.method === 'POST') { send(res, 201, []); return; }
    if (table === 'kid_profiles') {
      const index = Number(url.searchParams.get('id')?.slice(-12));
      if (profileDelays.has(index)) await new Promise(resolve => setTimeout(resolve, profileDelays.get(index)));
      send(res, 200, index < 1 || index > 20 ? [] : [{ id: uid(index), full_name: names(index),
        role: index === 20 ? 'teacher' : 'kid', gender: index === 19 ? 'girl' : 'boy',
        grade: recessDenied.has(index) ? 'closed' : 'ג', is_active: !disabled.has(index) }]); return;
    }
    if (table === 'admin_profiles' || table === 'game_challenges') { send(res, 200, []); return; }
    if (table === 'class_recess_schedule_settings') { send(res, 200, [{ grade: 'closed', gender: 'boy', override_enabled: true }]); return; }
    if (table === 'class_recess_schedule_exceptions') { send(res, 200, Array.from({ length: 7 }, (_, day_of_week) => ({ grade: 'closed', gender: 'boy', day_of_week, start_time: '00:00', end_time: '23:59', is_active: true, mode: 'class_time' }))); return; }
    if (table === 'recess_schedules') { send(res, 200, Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, start_time: '00:00', end_time: '23:59', is_active: true }))); return; }
    if (table === 'game_sessions') {
      if (req.method === 'GET' && url.searchParams.get('game_state->>rocket') === 'eq.true') {
        const leaseFilter = /^\(game_state->leaseUntil.gt.0,game_state->leaseUntil.lte.(\d+)\)$/.exec(url.searchParams.get('and') ?? '');
        assert.ok(leaseFilter);
        const cutoff = Number(leaseFilter[1]);
        const after = url.searchParams.get('id')?.replace('gt.', '') ?? '';
        send(res, 200, [...sessions.values()].filter(session => session.id > after
          && ['waiting', 'playing', 'paused'].includes(session.status) && session.game_state?.rocket === true
          && Number(session.game_state.leaseUntil) > 0 && Number(session.game_state.leaseUntil) <= cutoff)
          .sort((left, right) => left.id.localeCompare(right.id)).slice(0, Number(url.searchParams.get('limit'))));
        return;
      }
      const session = sessions.get(url.searchParams.get('id')?.replace('eq.', '') ?? '');
      if (!session) { send(res, 200, []); return; }
      if (req.method === 'GET' && heldSessionRead?.sessionId === session.id) {
        const held = heldSessionRead; heldSessionRead = null;
        const snapshot = structuredClone(session);
        held.reached(); await held.released;
        send(res, 200, [snapshot]); return;
      }
      if (req.method === 'PATCH') {
        let raw = ''; for await (const chunk of req) raw += chunk.toString();
        const patch = JSON.parse(raw);
        if (failedPatch?.sessionId === session.id && patch.game_state?.reason === failedPatch.reason) {
          const commit = failedPatch.commitBeforeFailure; failedPatch = null;
          if (commit) Object.assign(session, jsonb(patch));
          send(res, 503, {}); return;
        }
        const stateMatch = session.game_state === null ? 'is.null' : `eq.${JSON.stringify(session.game_state)}`;
        const metadataMatch = typeof session.game_state?.revision === 'string'
          ? url.searchParams.get('game_state->>revision') === `eq.${session.game_state.revision}`
          : url.searchParams.get('game_state') === stateMatch;
        if (url.searchParams.get('status') !== `eq.${session.status}` || !metadataMatch
          || url.searchParams.get('player_ids') !== `eq.{${session.player_ids.join(',')}}`) { send(res, 200, []); return; }
        Object.assign(session, jsonb(JSON.parse(raw)));
      }
      send(res, 200, [session]); return;
    }
    send(res, 404, {});
  })().catch(error => { console.error(error); send(res, 500, {}); });
});

const backend = http.createServer();
const transport = new wsTransport.WebSocketTransport({ server: backend, maxPayload: 16 * 1024 });
(transport as any).wss.on('connection', (socket: any) => {
  socket.on('close', (code: number) => {
    if (socket.pingCount >= 2) console.log('QA_HEARTBEAT_CLOSE', { code, unansweredPings: socket.pingCount });
  });
});
const gameServer = new colyseus.Server({ gracefullyShutdown: false, greet: false, transport });
const gateway = new PlatformGateway('http://127.0.0.1:19007', 'fixture-service-key');
const serviceOptions = { gateway, ticketSecret: 'fixture-secret-with-more-than-32-characters',
  origins: [origin], clientDir: `${root}/client/dist`, createVoiceToken: async (args: { sessionId: string; userId: string; displayName: string }) => { voiceMints++; await new Promise(resolve => setTimeout(resolve, 30)); return createGameVoiceToken(args); }, release: 'fixture-release' };
let service = createPlatformService(serviceOptions);
gameServer.define('playground', service.roomClass);
backend.removeAllListeners('request'); backend.on('request', service.handle);
const rooms: Room[] = [];
const clients = new Client(endpoint.replace('http', 'ws'));
const views = new Map<Room, PlatformView>();
const frames = new Map<Room, { tick: number; phase: string; cars: { sessionId: string; position: { x: number; y: number; z: number }; acknowledgedSequence: number }[] }>();
const errors = new Map<Room, string[]>();
const endedEvents = new Map<Room, string[]>();
const rematches = new Map<Room, boolean[]>();
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function until(predicate: () => unknown, description: string, timeout = 10_000) {
  const started = Date.now();
  while (!await predicate()) { if (Date.now() - started > timeout) throw new Error(`Timed out: ${description}`); await pause(30); }
}
async function launch(sessionId: string, user = 1, extra: Record<string, unknown> = {}, requestOrigin = origin) {
  const response = await fetch(`${endpoint}/api/rocket/launch`, { method: 'POST', headers: {
    Origin: requestOrigin, Authorization: `Bearer fixture-token-${user}`, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ sessionId, ...extra }) });
  return { status: response.status, data: await response.json() as Record<string, any> };
}
async function join(sessionId: string, user: number, extra: Record<string, unknown> = {}): Promise<Room> {
  const result = await launch(sessionId, user, extra);
  assert.equal(result.status, 200, JSON.stringify({ ...result.data,
    failures: logs.filter(line => line.level === 'error').slice(-3).map(line => ({ ...line, err: line.err?.stack })) }));
  if (extra.slowJoin) profileDelays.set(user, 1500);
  let room: Room;
  try { room = await clients.consumeSeatReservation(result.data.reservation); }
  finally { profileDelays.delete(user); }
  rooms.push(room); errors.set(room, []);
  room.onMessage('platform-state', (value: unknown) => { if (isPlatformView(value, sessionId)) views.set(room, value); });
  room.onMessage('prediction-state', frame => frames.set(room, frame));
  room.onMessage('state-sync', () => {});
  room.onMessage('platform-error', (value: { code: string }) => errors.get(room)!.push(value.code));
  endedEvents.set(room, []);
  room.onMessage('platform-ended', (value: { reason: string }) => endedEvents.get(room)!.push(value.reason));
  rematches.set(room, []);
  room.onMessage('platform-rematch', (value: { join: boolean }) => rematches.get(room)!.push(value.join));
  room.send('platform-ready');
  await until(() => views.has(room), 'authorized room welcome');
  return room;
}
async function disposeCompletedRooms() {
  for (const client of rooms) {
    const room = colyseus.matchMaker.getRoomById(client.id) as any;
    if (room?.completed) await room.finish('finished');
  }
}
async function social(kind: 'chat' | 'voice', sessionId: string, user: number, extra: Record<string, unknown> = {}) {
  const response = await fetch(`${endpoint}/api/rocket/${kind}`, { method: 'POST', headers: {
    Origin: origin, Authorization: `Bearer fixture-token-${user}`, 'Content-Type': 'application/json',
  }, body: JSON.stringify({ sessionId, ...extra }) });
  return { status: response.status, data: await response.json() as Record<string, any> };
}

const report: Record<string, unknown> = { fixture: true, productionDatabaseUsed: false };
let vite: ReturnType<typeof spawn> | undefined;
let qaFilesCreated = false;
const qaHtml = `${repo}/apps/web/rocket-integration-qa.html`;
const qaTsx = `${repo}/apps/web/src/rocket-integration-qa.tsx`;
try {
  await mkdir(`${root}/.run`, { recursive: true });
  fixture.listen(19007, '127.0.0.1'); await once(fixture, 'listening');
  await gameServer.listen(19006, '127.0.0.1');
  service.startRecovery();
  const config = await (await fetch(`${endpoint}/api/rocket/config`)).json() as { release: string; capabilities: string[] };
  assert.equal(config.release, 'fixture-release');
  assert.deepEqual(config.capabilities, ['lobby-controls', 'session-chat', 'voice', 'retained-matches', 'queued-roster', 'rematch', 'save-outcomes', 'platform-only']);
  // Exercise concurrent rooms beyond the former default cap, using real engines.
  const concurrentRooms = await Promise.all([13, 14, 15].map(async user => {
    const id = newSession(40 + user);
    Object.assign(sessions.get(id)!, { host_id: uid(user), player_ids: [uid(user)], player_names: [names(user)] });
    return join(id, user);
  }));
  const concurrentIds = new Set(concurrentRooms.map(room => room.id));
  const ready = await (await fetch(`${endpoint}/ready`)).json() as { activeRooms: number; maxRooms?: number };
  assert.equal(ready.activeRooms, 3);
  assert.equal(ready.maxRooms, undefined);
  assert.deepEqual(logs.filter(line => line.context.event === 'ROCKET_ROOM_READY' && concurrentIds.has(line.roomId))
    .map(line => line.activeRooms).sort(), [1, 2, 3]);
  await Promise.all(concurrentRooms.map(room =>
    (colyseus.matchMaker.getRoomById(room.id) as PlaygroundRoom).hibernate('fixture-room-count')));
  await until(() => concurrentRooms.every(room => !colyseus.matchMaker.getRoomById(room.id)), 'concurrent rooms disposed');
  assert.deepEqual(logs.filter(line => line.context.event === 'ROCKET_ROOM_DISPOSED' && concurrentIds.has(line.roomId))
    .map(line => line.activeRooms).sort(), [0, 1, 2]);
  assert.equal(((await (await fetch(`${endpoint}/ready`)).json()) as { activeRooms: number }).activeRooms, 0);
  report.uncappedRoomsAndLifecycleCounts = 'PASS';
  const sessionId = newSession(1);
  assert.equal((await fetch(`${endpoint}/matchmake/custom`)).status, 403);
  assert.equal((await launch(sessionId, 1, {}, 'https://untrusted.example')).status, 403);
  assert.equal((await launch(sessionId, 19)).data.code, 'GENDER_MISMATCH');
  assert.equal((await launch(sessionId, 18, { participation: 'observer' })).status, 200); // Kids remain players.
  const [first, concurrent] = await Promise.all([launch(sessionId), launch(sessionId, 2)]);
  assert.equal(first.status, 200); assert.equal(concurrent.status, 200);
  assert.equal(first.data.reservation.room.roomId, concurrent.data.reservation.room.roomId);
  report.admissionAndAllocation = 'PASS';
  const observer = await join(sessionId, 20);
  const waitingRoom = colyseus.matchMaker.getRoomById(observer.id) as unknown as { sweep(): Promise<void> };
  await waitingRoom.sweep();
  assert.deepEqual(sessions.get(sessionId)!.player_ids, [uid(1)]);
  report.teacherBeforeHostKeepsRoster = 'PASS';
  observer.send('platform-control', { action: 'start' });
  await until(() => errors.get(observer)!.includes('NO_PLAYERS'), 'no bots-only room start');
  const host = await join(sessionId, 1);
  const metrics = new ClientTelemetry('fixture-run', 'fixture-release');
  metrics.configure({ mode: 'predicted', phase: 'waiting', players: 1, source: 'node',
    visibility: 'none', focused: false, width: 0, height: 0, dpr: 1, cores: 2 }, 0);
  metrics.recovery('server_stale');
  const sample = metrics.flush(100, 'periodic');
  assert.ok(sample);
  host.send('client-metrics', sample);
  await pause(100);
  assert.ok(!logs.some(line => ['ROCKET_CLIENT_WINDOW', 'ROCKET_ROOM_SAMPLE'].includes(line.context.event)));
  debugEnabled = true;
  try {
    host.send('client-metrics', sample);
    await until(() => logs.some(line => line.context.event === 'ROCKET_CLIENT_WINDOW'), 'opt-in client diagnostics');
    await waitingRoom.sweep();
    assert.ok(logs.some(line => line.context.event === 'ROCKET_ROOM_SAMPLE'));
    assert.ok(logs.filter(line => ['ROCKET_CLIENT_WINDOW', 'ROCKET_ROOM_SAMPLE'].includes(line.context.event))
      .every(line => line.level === 'debug' && line.context.status === 'success'));
  } finally { debugEnabled = false; }
  report.diagnosticsRequireDebugLevel = 'PASS';
  assert.equal(views.get(host)!.actorId, 'rocket-0');
  assert.equal(views.get(observer)!.observer, true);
  assert.equal(views.get(observer)!.actorId, null);
  assert.equal(views.get(host)!.players.filter(player => player.kind === 'human').length, 1);
  // Sparse rosters must publish the actual platform host, even outside slot zero.
  host.send('platform-control', { action: 'team', actorId: 'rocket-0', team: 'orange' });
  await until(() => views.get(host)?.actorId === 'rocket-1' && (host.state as any).hostSessionId === 'rocket-1'
    && frames.get(host)?.cars.length === 1 && frames.get(host)!.cars[0]!.sessionId === 'rocket-1', 'solo orange team retains a serializable host');
  assert.equal((host.state as any).players.get('rocket-1').isHost, true);
  await pause(350);
  host.send('platform-control', { action: 'team', actorId: 'rocket-1', team: 'blue' });
  await until(() => views.get(host)?.actorId === 'rocket-0' && (host.state as any).hostSessionId === 'rocket-0', 'solo host can switch back');
  await pause(350);

  const friend = await join(sessionId, 2);
  const actor = views.get(friend)!.actorId;
  assert.equal(actor, 'rocket-1');
  await until(() => frames.get(host)?.cars.length === 2, 'no automatic bots or unused cars on wire');
  assert.equal(views.get(host)!.players.filter(player => player.kind === 'bot').length, 0);
  friend.send('platform-control', { action: 'bots', count: 6 });
  await until(() => errors.get(friend)!.includes('CONTROL_FORBIDDEN'), 'reject non-host bot configuration');
  host.send('platform-control', { action: 'bots', count: 6 });
  await until(() => views.get(host)!.players.filter(player => player.kind === 'bot').length === 6, 'opt-in bot count');
  await pause(350);
  host.send('platform-control', { action: 'team', actorId: 'rocket-0', team: 'orange' });
  await until(() => views.get(host)!.players.find(player => player.userId === uid(1))?.team === 'orange', 'host team assignment');
  await until(() => (host.state as any).hostSessionId === views.get(host)!.actorId, 'full-roster engine host follows platform host');
  await pause(350);
  host.send('platform-control', { action: 'bots', count: 0 });
  await until(() => views.get(host)!.players.filter(player => player.kind === 'bot').length === 0
    && frames.get(host)?.cars.length === 2 && (host.state as any).hostSessionId === views.get(host)!.actorId, 'removing bots keeps a nonzero-slot host valid');
  await pause(350);
  host.send('platform-control', { action: 'bots', count: 6 });
  await until(() => views.get(host)!.players.filter(player => player.kind === 'bot').length === 6, 'restore explicit bots after sparse team check');

  await pause(350);
  host.send('platform-control', { action: 'team', actorId: views.get(host)!.actorId, team: 'blue' });
  await until(() => views.get(host)!.players.find(player => player.userId === uid(1))?.team === 'blue', 'host team restore');
  report.optionalBotsAndHostTeams = 'PASS';
  assert.equal((await social('voice', sessionId, 9)).data.code, 'NOT_IN_ROOM');
  assert.equal((await social('chat', sessionId, 20, { message: 'observer' })).data.code, 'READ_ONLY');
  assert.equal((await social('chat', sessionId, 1, { message: 'שלום <חברים>', sender_id: uid(9) })).status, 200);
  assert.equal(chatMessages[0]!.sender_id, uid(1));
  assert.equal(chatMessages[0]!.sender_name, names(1));
  assert.equal(chatMessages[0]!.message, 'שלום <חברים>');
  assert.equal((await social('chat', sessionId, 1, { message: 'too fast' })).status, 429);
  const [voice, duplicateVoice, thirdVoice] = await Promise.all(Array.from({ length: 3 }, () => social('voice', sessionId, 1)));
  assert.equal(duplicateVoice.status, 200); assert.equal(thirdVoice.status, 200);
  assert.equal(voice.data.token, duplicateVoice.data.token); assert.equal(voiceMints, 1);
  assert.equal(voice.status, 200);
  const claims = JSON.parse(Buffer.from(voice.data.token.split('.')[1], 'base64url').toString());
  assert.equal(claims.sub, uid(1)); assert.equal(claims.video.room, `game-session-${sessionId}`);
  assert.deepEqual(claims.video.canPublishSources, ['microphone']);
  report.persistedChatAndScopedVoiceTokens = 'PASS';
  await pause(350);
  host.send('platform-control', { action: 'start' });
  await until(() => frames.get(host)?.phase === 'playing', 'match kickoff');
  host.send('platform-control', { action: 'bots', count: 0 });
  await until(() => errors.get(host)!.includes('LOBBY_ONLY'), 'freeze bot configuration once playing');
  const beforeMotion = frames.get(host)!.cars.map(car => ({ ...car.position }));
  await pause(1200);
  const afterMotion = frames.get(host)!.cars;
  assert.ok(afterMotion.slice(2).some((car, index) => Math.hypot(car.position.x - beforeMotion[index + 2]!.x,
    car.position.z - beforeMotion[index + 2]!.z) > .5));
  friend.send('platform-control', { action: 'pause' });
  await until(() => errors.get(friend)!.includes('CONTROL_FORBIDDEN'), 'reject non-host pause');
  host.send('platform-control', { action: 'pause' });
  await until(() => views.get(host)?.paused, 'host pause');
  const frozen = frames.get(host)!.tick;
  await pause(500); assert.equal(frames.get(host)!.tick, frozen);
  // Hold a pre-resume DB snapshot inside a periodic sweep. Resume must queue
  // behind it rather than let that old snapshot put the room back on pause.
  const controlledRoom = colyseus.matchMaker.getRoomById(host.id) as any;
  await until(() => !controlledRoom.sweepRunning && !controlledRoom.pendingControls, 'previous room operations drained');
  let readReached = false;
  let releaseRead = () => {};
  const released = new Promise<void>(resolve => { releaseRead = resolve; });
  heldSessionRead = { sessionId, reached: () => { readReached = true; }, released };
  const inFlightSweep = controlledRoom.sweep();
  try {
    await until(() => readReached, 'sweep holds pre-resume database snapshot');
    host.send('platform-control', { action: 'resume' });
    await until(() => controlledRoom.pendingControls > 0, 'resume queued during delayed sweep');
    await pause(100);
    assert.equal(controlledRoom.paused, true, 'control cannot race the held reconciliation');
  } finally { releaseRead(); }
  await inFlightSweep;
  await until(() => !views.get(host)?.paused && frames.get(host)!.tick > frozen, 'resume live simulation');
  await controlledRoom.sweep();
  assert.equal(sessions.get(sessionId)!.status, 'playing');
  assert.equal(controlledRoom.paused, false);
  report.resumeSweepOrdering = 'PASS';
  report.botsAuthorityAndPause = 'PASS';
  const late = await join(sessionId, 3);
  assert.equal(views.get(late)!.pending, true);
  assert.equal(views.get(late)!.actorId, null);
  await until(() => views.get(host)!.pendingPlayers.some(player => player.userId === uid(3)), 'host sees queued recruit');
  assert.equal(views.get(host)!.observers[0]!.role, 'teacher');
  late.send('platform-control', { action: 'assign-pending', userId: uid(3), actorId: 'rocket-7' });
  await until(() => errors.get(late)!.includes('CONTROL_FORBIDDEN'), 'recruit cannot assign itself');
  await pause(350);
  host.send('platform-control', { action: 'assign-pending', userId: uid(3), actorId: 'rocket-7' });
  await until(() => views.get(host)!.pendingPlayers.find(player => player.userId === uid(3))?.actorId === 'rocket-7', 'host plans bot replacement');
  assert.equal(views.get(late)!.actorId, null); // Plan cannot change physics mid-play.

  controlledRoom.clients.find((client: colyseus.Client) => client.sessionId === friend.sessionId).ref.terminate();
  // An abrupt transport loss reserves the car and produces one warning with
  // the actual abnormal WebSocket close code, rather than a silent departure.
  await until(() => logs.some(line => line.context.event === 'ROCKET_SOCKET_CLOSED' && line.connectionId === friend.sessionId), 'abnormal socket close log');
  const lostSocket = logs.find(line => line.context.event === 'ROCKET_SOCKET_CLOSED' && line.connectionId === friend.sessionId)!;
  assert.equal(lostSocket.closeCode, 1006);
  assert.equal(lostSocket.level, 'warn');
  await until(() => views.get(host)!.players.some(player => player.actorId === actor && !player.connected), 'reserve disconnected car');
  const returned = await join(sessionId, 2);
  assert.equal(views.get(returned)!.actorId, actor);
  observer.send('platform-control', { action: 'remove', userId: uid(2) });
  await until(() => errors.get(returned)!.includes('REMOVED_FROM_ROOM'), 'teacher removal');
  const removedLaunch = await launch(sessionId, 2);
  assert.equal(removedLaunch.data.code, 'REMOVED_FROM_ROOM');
  report.lateJoinReconnectAndTeacher = 'PASS';
  await pause(350); // Respect the same bounded control rate as the browser UI.
  host.send('platform-control', { action: 'end' });
  await until(() => sessions.get(sessionId)!.status === 'completed', 'persist accepted end');
  await until(() => views.get(host)?.phase === 'ended' && views.get(host)?.canRematch, 'ended match retains rematch controls');
  assert.equal((await launch(sessionId)).data.code, 'SESSION_COMPLETED');
  // Pending recruits participate too; only those who consent follow the next round.
  late.send('platform-control', { action: 'rematch' });
  await until(() => errors.get(late)!.includes('CONTROL_FORBIDDEN'), 'non-host cannot request rematch');
  await pause(350);
  host.send('platform-control', { action: 'rematch' });
  await until(() => views.get(late)?.rematch?.accepted.includes(uid(1)), 'rematch offer reaches recruit');
  const oldAllocation = sessions.get(sessionId)!.game_state!.allocationId;
  assert.equal(sessions.get(sessionId)!.status, 'completed'); // No restart before responses.
  await pause(350);
  late.send('platform-control', { action: 'rematch-response', accept: true });
  await until(() => sessions.get(sessionId)!.status === 'waiting', 'consented rematch resets platform session');
  await until(() => !colyseus.matchMaker.getRoomById(host.id), 'old room disposed after rematch');
  await until(() => logs.filter(line => line.context.event === 'ROCKET_SOCKET_CLOSED' && line.roomId === host.id && line.reason === 'rematch').length === 3,
    'all old rematch sockets report closure');
  const oldLifecycle = logs.filter(line => line.roomId === host.id);
  assert.equal(oldLifecycle.filter(line => line.context.event === 'ROCKET_ROOM_READY').length, 1);
  const disposed = oldLifecycle.filter(line => line.context.event === 'ROCKET_ROOM_DISPOSED');
  assert.equal(disposed.length, 1);
  assert.equal(disposed[0].reason, 'rematch');
  for (const connection of [host, late, observer]) {
    const joined = oldLifecycle.find(line => line.context.event === 'ROCKET_JOIN_COMPLETED' && line.connectionId === connection.sessionId);
    const closed = oldLifecycle.find(line => line.context.event === 'ROCKET_SOCKET_CLOSED' && line.connectionId === connection.sessionId);
    assert.ok(joined && closed);
    assert.equal(closed.reason, 'rematch');
    assert.equal(closed.userId, joined.userId);
    assert.equal(closed.correlationId, joined.correlationId);
    assert.equal(closed.allocationId, joined.allocationId);
    assert.equal(typeof closed.closeCode, 'number');
    assert.ok(closed.duration_ms >= 0);
  }
  report.roomAndSocketLifecycle = 'PASS';
  await until(() => rematches.get(host)!.at(-1) === true && rematches.get(late)!.at(-1) === true && rematches.get(observer)!.at(-1) === true, 'consenters and observer follow rematch');
  assert.notEqual(sessions.get(sessionId)!.game_state!.allocationId, oldAllocation);
  assert.equal(sessions.get(sessionId)!.game_state!.blueScore, 0);
  assert.deepEqual(new Set(sessions.get(sessionId)!.player_ids), new Set([uid(1), uid(3)]));
  assert.equal((await launch(sessionId, 2)).data.code, 'REMOVED_FROM_ROOM'); // Ban survives signed next-round checkpoint.
  const rematchFriend = await join(sessionId, 3); // The other client deliberately finishes reloading first.
  assert.equal(views.get(rematchFriend)!.hostUserId, uid(1));
  assert.equal(views.get(rematchFriend)!.canControl, false);
  const rematchHost = await join(sessionId, 1, { slowJoin: true });
  assert.equal(views.get(rematchHost)!.canControl, true);
  assert.notEqual(rematchHost.id, host.id);
  assert.equal(views.get(rematchHost)!.phase, 'waiting');
  assert.equal(views.get(rematchHost)!.paused, false);
  assert.equal(views.get(rematchHost)!.actorId, views.get(host)!.actorId);
  await until(() => views.get(rematchHost)!.players.filter(player => player.kind === 'bot').length === 5, 'planned recruit replaces chosen bot');
  assert.equal(views.get(rematchFriend)!.actorId, 'rocket-7');
  assert.ok(views.get(rematchFriend)!.actorId); // Previously pending players get a lobby car.
  rematchHost.send('platform-control', { action: 'start' });
  await until(() => frames.get(rematchHost)?.phase === 'playing', 'fresh rematch starts with coherent snapshots');
  rematchHost.send('platform-control', { action: 'end' });
  await until(() => views.get(rematchHost)?.phase === 'ended', 'end second round');
  await pause(350);
  rematchHost.send('platform-control', { action: 'rematch' });
  await until(() => !!views.get(rematchFriend)?.rematch, 'second rematch offer');
  rematchFriend.send('platform-control', { action: 'rematch-response', accept: false });
  await until(() => sessions.get(sessionId)!.status === 'waiting', 'declining does not block willing players');
  assert.deepEqual(sessions.get(sessionId)!.player_ids, [uid(1)]);
  await until(() => rematches.get(rematchFriend)!.at(-1) === false, 'decliner is not instructed to follow');
  await until(() => !colyseus.matchMaker.getRoomById(rematchHost.id), 'second rematch old room closed');
  const finalRematch = await join(sessionId, 1);
  const naturalRoom = colyseus.matchMaker.getRoomById(finalRematch.id) as any;
  naturalRoom.core.restoreProgressAtKickoff({ blueScore: 1, orangeScore: 0, regulationStepsRemaining: 1, regulationCutoffResolved: false });
  await until(() => views.get(finalRematch)?.phase === 'ended', 'natural completion offers rematch');
  assert.equal(views.get(finalRematch)!.canRematch, true);
  assert.equal(views.get(finalRematch)!.canControl, false);
  assert.deepEqual(views.get(finalRematch)!.score, { blue: 1, orange: 0 });
  assert.equal(sessions.get(sessionId)!.game_state!.reason, 'finished');
  assert.ok(sessions.get(sessionId)!.game_state!.result);
  await disposeCompletedRooms();
  report.rematchConsentAndFreshRound = 'PASS';

  const capacitySession = newSession(2);
  const eight: Room[] = [];
  for (let user = 1; user <= 8; user++) eight.push(await join(capacitySession, user));
  assert.equal(views.get(eight[7]!)!.players.filter(player => player.kind === 'human').length, 8);
  const ninth = await launch(capacitySession, 9);
  assert.equal(ninth.data.code, 'ROOM_FULL');
  await join(capacitySession, 20);
  eight[0]!.send('platform-control', { action: 'start' });
  await until(() => frames.get(eight[0]!)?.phase === 'playing', 'eight-human kickoff');
  assert.equal(frames.get(eight[0]!)!.cars.length, 8);
  report.eightHumansPlusTeacher = 'PASS';
  await eight[0]!.leave();
  await until(() => views.get(eight[1]!)?.canControl && (eight[1]!.state as any).hostSessionId === views.get(eight[1]!)!.actorId
    && frames.get(eight[1]!)?.cars.length === 7, 'host departure with no bot replacement preserves visible host');
  assert.equal((eight[1]!.state as any).players.get(views.get(eight[1]!)!.actorId).isHost, true);
  eight[1]!.send('platform-control', { action: 'end' });
  await until(() => sessions.get(capacitySession)!.status === 'completed', 'eight-human end');
  await pause(300); await disposeCompletedRooms();

  const closedSession = newSession(3, false);
  assert.equal((await launch(closedSession, 3)).data.code, 'SESSION_CLOSED');
  const invited = await join(closedSession, 3, { invitationCode: 'fixture-private-code' });
  assert.ok(views.get(invited)!.actorId);
  invited.send('platform-control', { action: 'end' });
  await until(() => sessions.get(closedSession)!.status === 'completed', 'invited host transfer and end');
  await pause(300); await disposeCompletedRooms();
  report.privateInvitations = 'PASS';

  const soloSession = newSession(5);
  const solo = await join(soloSession, 1);
  solo.send('platform-control', { action: 'team', actorId: views.get(solo)!.actorId, team: 'orange' });
  await until(() => views.get(solo)?.actorId === 'rocket-1' && (solo.state as any).hostSessionId === 'rocket-1', 'move solo host before match start');
  await pause(350);

  solo.send('platform-control', { action: 'start' });
  await until(() => frames.get(solo)?.phase === 'playing', 'solo practice with no bots');
  assert.equal(frames.get(solo)!.cars.length, 1);
  assert.equal(views.get(solo)!.players.filter(player => player.kind === 'bot').length, 0);
  solo.send('platform-control', { action: 'end' });
  await until(() => sessions.get(soloSession)!.status === 'completed', 'solo end');
  await pause(300); await disposeCompletedRooms();
  report.soloWithoutBots = 'PASS';
  report.sparseHostTeamSwitchAndTransfer = 'PASS';

  // Empty paused games leave memory but stay discoverable and resumable in the app.
  const retainedSession = newSession(6);
  const retained = await join(retainedSession, 1);
  retained.send('platform-control', { action: 'bots', count: 3 });
  await until(() => views.get(retained)!.players.filter(player => player.kind === 'bot').length === 3, 'retained bots');
  await pause(350);
  retained.send('platform-control', { action: 'start' });
  await until(() => frames.get(retained)?.phase === 'playing', 'retention kickoff');
  await pause(500);
  retained.send('platform-control', { action: 'pause' });
  await until(() => views.get(retained)?.paused, 'pause before leaving');
  const savedState = sessions.get(retainedSession)!.game_state!;
  const savedProgress = (savedState.checkpoint as any).payload.progress;
  const savedActivity = sessions.get(retainedSession)!.last_activity;
  const originalRoomId = retained.id;
  await retained.leave();
  await until(async () => {
    const ready = await (await fetch(`${endpoint}/ready`)).json() as { activeRooms: number };
    return ready.activeRooms === 0;
  }, 'empty paused room releases service capacity');
  assert.equal(sessions.get(retainedSession)!.status, 'paused');
  assert.deepEqual(sessions.get(retainedSession)!.player_ids, [uid(1)]);
  assert.deepEqual(sessions.get(retainedSession)!.connected_player_ids, []);
  assert.equal(sessions.get(retainedSession)!.last_activity, savedActivity);
  assert.equal((await launch(retainedSession, 3)).data.code, 'NOT_IN_ROSTER');
  const restored = await join(retainedSession, 1);
  assert.notEqual(restored.id, originalRoomId);
  assert.equal(views.get(restored)!.paused, true);
  assert.equal(views.get(restored)!.actorId, 'rocket-0');
  assert.equal(views.get(restored)!.players.filter(player => player.kind === 'bot').length, 3);
  const restoredRoom = colyseus.matchMaker.getRoomById(restored.id) as unknown as {
    core: { matchFlowState: typeof savedProgress }; createdAt: number; activeAgeMs: number; maintenance(): void; sweep(): Promise<void>;
  };
  assert.equal(restoredRoom.core.matchFlowState.regulationStepsRemaining, savedProgress.regulationStepsRemaining);
  assert.equal(restoredRoom.core.matchFlowState.blueScore, savedProgress.blueScore);
  restoredRoom.createdAt = Date.now() - 31 * 60_000;
  restoredRoom.activeAgeMs = 31 * 60_000;
  restoredRoom.maintenance(); await restoredRoom.sweep();
  assert.equal(sessions.get(retainedSession)!.status, 'paused'); // No old 30-minute paused-game expiry.
  assert.equal(sessions.get(retainedSession)!.last_activity, savedActivity);
  restoredRoom.createdAt = Date.now(); restoredRoom.activeAgeMs = 0;
  restored.send('platform-control', { action: 'resume' });
  await until(() => frames.get(restored)?.phase === 'playing', 'resume retained game at kickoff');
  assert.ok(restoredRoom.core.matchFlowState.regulationStepsRemaining <= savedProgress.regulationStepsRemaining);
  failedPatch = { sessionId: retainedSession, reason: 'stopped' };
  restored.send('platform-control', { action: 'end' });
  await until(() => errors.get(restored)!.includes('PLATFORM_UNAVAILABLE'), 'failed stop reports a retryable save error');
  assert.equal(sessions.get(retainedSession)!.status, 'playing');
  assert.equal(views.get(restored)!.canRematch, false);
  const beforeRetryTick = frames.get(restored)!.tick;
  await until(() => frames.get(restored)!.tick > beforeRetryTick, 'failed stop restores the running simulation');
  await restoredRoom.sweep();
  assert.equal(sessions.get(retainedSession)!.status, 'playing', 'reconciliation survives a rejected stop write');
  assert.ok(colyseus.matchMaker.getRoomById(restored.id));
  await pause(350);
  restored.send('platform-control', { action: 'end' });
  await until(() => sessions.get(retainedSession)!.status === 'completed', 'explicit stop stays completed');
  const stopped = sessions.get(retainedSession)! as PlatformSession & { stopped_by: string; ended_at: string };
  assert.equal(stopped.stopped_by, uid(1)); assert.equal(stopped.is_open, false); assert.ok(stopped.ended_at);
  assert.equal(stopped.last_activity, stopped.ended_at);
  assert.deepEqual(stopped.player_ids, [uid(1)]);
  assert.deepEqual(stopped.connected_player_ids, []);
  assert.equal(stopped.game_state!.phase, 'ended');
  assert.equal(stopped.game_state!.reason, 'stopped');
  assert.equal(stopped.game_state!.checkpoint, null);
  assert.equal(stopped.game_state!.blueScore, restoredRoom.core.matchFlowState.blueScore);
  assert.equal(stopped.game_state!.orangeScore, restoredRoom.core.matchFlowState.orangeScore);
  assert.equal(stopped.game_state!.regulationStepsRemaining, restoredRoom.core.matchFlowState.regulationStepsRemaining);
  assert.equal(stopped.game_state!.regulationCutoffResolved, restoredRoom.core.matchFlowState.regulationCutoffResolved);
  assert.equal(stopped.game_state!.botCount, 3);
  assert.deepEqual(stopped.game_state!.teams, savedState.teams);
  const finalState = structuredClone(stopped.game_state);
  await pause(300); await disposeCompletedRooms();
  assert.deepEqual(sessions.get(retainedSession)!.game_state, finalState, 'disposal preserves the final DB state');
  report.pausedRetentionAndStopParity = 'PASS';
  report.failedStopCanRetry = 'PASS';
  const expiredSession = newSession(7);
  const expiredPayload = { ...(savedState.checkpoint as any).payload, sessionId: expiredSession, expiresAt: Date.now() - 1 };
  sessions.get(expiredSession)!.status = 'paused';
  sessions.get(expiredSession)!.game_state = { rocket: true, leaseUntil: 0,
    checkpoint: new RoomCheckpoints(serviceOptions.ticketSecret).sign(expiredPayload) };
  assert.equal((await launch(expiredSession)).data.code, 'SESSION_COMPLETED');
  assert.equal(sessions.get(expiredSession)!.status, 'completed');
  report.pausedExpiry = 'PASS';



  const savedLobbySession = newSession(10);
  const lobbyHost = await join(savedLobbySession, 1);
  const lobbyTeacher = await join(savedLobbySession, 20);
  lobbyHost.send('platform-control', { action: 'bots', count: 2 });
  await until(() => views.get(lobbyHost)!.players.filter(player => player.kind === 'bot').length === 2, 'saved lobby bots');
  await lobbyHost.leave();
  await until(() => sessions.get(savedLobbySession)!.status === 'paused', 'empty lobby pauses');
  await pause(1100);
  assert.ok(colyseus.matchMaker.getRoomById(lobbyTeacher.id)); // Staff may keep observing a paused room.
  const lobbyReturned = await join(savedLobbySession, 1);
  assert.equal(views.get(lobbyReturned)!.phase, 'waiting'); assert.equal(views.get(lobbyReturned)!.paused, false);
  await lobbyTeacher.leave(); await lobbyReturned.leave();
  await until(() => !colyseus.matchMaker.getRoomById(lobbyReturned.id), 'empty saved lobby hibernates');
  const lobbyRestored = await join(savedLobbySession, 1);
  assert.equal(views.get(lobbyRestored)!.phase, 'waiting'); assert.equal(views.get(lobbyRestored)!.paused, false);
  assert.equal(views.get(lobbyRestored)!.players.filter(player => player.kind === 'bot').length, 2);
  lobbyRestored.send('platform-control', { action: 'start' });
  await until(() => frames.get(lobbyRestored)?.phase === 'playing', 'restored lobby can start normally');
  lobbyRestored.send('platform-control', { action: 'end' });
  await until(() => sessions.get(savedLobbySession)!.status === 'completed', 'saved lobby end');
  await pause(300); await disposeCompletedRooms();
  report.savedWaitingRoomAndStaffPresence = 'PASS';

  if (process.argv.includes('--browser')) {
    const browserSession = newSession(4);
    await writeFile(qaHtml, '<!doctype html><html><body style="margin:0"><div id="root"></div><script type="module" src="/src/rocket-integration-qa.tsx"></script></body></html>', { flag: 'wx' });
    try {
      await writeFile(qaTsx, `import {createRoot} from 'react-dom/client'; import {BrowserRouter} from 'react-router-dom';
import {StrictMode} from 'react'; import {RocketSessionContainer} from './game/RocketSessionContainer'; import {supabase} from './lib/supabase'; import './index.css';
const params=new URLSearchParams(location.search); Object.defineProperty(supabase.auth,'getSession',{value:async()=>({data:{session:{access_token:'fixture-token-'+(params.get('qaUser')||1)}},error:null})});
Object.defineProperty(supabase,'channel',{value:()=>{const channel={on:()=>channel,subscribe:()=>channel};return channel;}}); Object.defineProperty(supabase,'removeChannel',{value:async()=>{}});
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><RocketSessionContainer sessionId="${browserSession}"/></BrowserRouter></StrictMode>);`, { flag: 'wx' });
      qaFilesCreated = true;
    } catch (error) { await unlink(qaHtml); throw error; }
    vite = spawn(process.execPath, [`${repo}/node_modules/vite/bin/vite.js`, '--host', '127.0.0.1', '--port', '19008', '--strictPort'], {
      cwd: `${repo}/apps/web`, env: { ...process.env, VITE_ROCKET_SERVICE_URL: endpoint,
        VITE_SUPABASE_URL: 'http://127.0.0.1:19007', VITE_SUPABASE_ANON_KEY: 'fixture-anon-key' }, stdio: 'ignore',
    });
    await until(() => fetch(`${origin}/rocket-integration-qa.html`).then(response => response.ok).catch(() => false), 'QA parent Vite');
    const { runBrowserChecks } = await import('./check-app-browser.mjs');
    report.browser = await runBrowserChecks(origin, browserSession, async (freeze: boolean) => {
      // Test-only in-process control: hold a Playing boundary while the second
      // software-rendered browser loads, so a natural bot goal cannot race the
      // late-join assertion. No test endpoint/control is shipped to clients.
      const listing = (await colyseus.matchMaker.query({ name: 'playground' })).find(row => {
        const room = colyseus.matchMaker.getRoomById(row.roomId) as unknown as { sessionId: string };
        return room.sessionId === browserSession;
      });
      assert.ok(listing);
      const room = colyseus.matchMaker.getRoomById(listing.roomId) as unknown as {
        core: { matchFlowState: { phase: string }; setPaused(value: boolean): void };
      };
      if (freeze) await until(() => room.core.matchFlowState.phase === 'playing', 'stable playing boundary');
      room.core.setPaused(freeze);
    }, async () => {
      const listing = (await colyseus.matchMaker.query({ name: 'playground' })).find(row =>
        (colyseus.matchMaker.getRoomById(row.roomId) as any).sessionId === browserSession);
      assert.ok(listing);
      failedPatch = { sessionId: browserSession, reason: 'fixture-browser-save-failure' };
      await (colyseus.matchMaker.getRoomById(listing.roomId) as PlaygroundRoom).hibernate('fixture-browser-save-failure');
      assert.notEqual(sessions.get(browserSession)!.status, 'completed');
      sessions.get(browserSession)!.game_state!.leaseUntil = 0; // Simulate lease expiry before manual retry.
    });
  }
  const recessSession = newSession(9);
  const recessHost = await join(recessSession, 1);
  const recessFriend = await join(recessSession, 2);
  recessHost.send('platform-control', { action: 'bots', count: 2 });
  await until(() => views.get(recessHost)!.players.filter(player => player.kind === 'bot').length === 2, 'recess bots');
  await pause(350);
  recessHost.send('platform-control', { action: 'start' });
  await until(() => frames.get(recessHost)?.phase === 'playing', 'start per-class recess check');
  const recessRoom = colyseus.matchMaker.getRoomById(recessHost.id) as unknown as {
    sweep(): Promise<void>;
    core: { matchFlowState: { blueScore: number; orangeScore: number; regulationStepsRemaining: number;
      regulationActivePlayStepsCompleted: number; regulationCutoffResolved: boolean };
      commitMatchFlowState(flow: unknown): void };
  };
  recessDenied.add(2);
  await recessRoom.sweep();
  await until(() => errors.get(recessFriend)!.includes('RECESS_DENIED'), 'evict only the child whose recess ended');
  assert.equal(views.get(recessHost)!.paused, false);
  assert.equal(sessions.get(recessSession)!.status, 'playing');
  recessDenied.clear();
  const recessReturned = await join(recessSession, 2);
  // Distinct nonzero progress catches an accidental reset on save/recovery.
  const recessFlow = recessRoom.core.matchFlowState;
  recessRoom.core.commitMatchFlowState(Object.freeze({ ...recessFlow, blueScore: 2, orangeScore: 1, regulationStepsRemaining: 4321,
    regulationActivePlayStepsCompleted: recessFlow.regulationActivePlayStepsCompleted + recessFlow.regulationStepsRemaining - 4321 }));
  recessDenied.add(1); recessDenied.add(2);
  // Let the production 15-second eligibility timer enforce simultaneous expiry.
  await until(() => !colyseus.matchMaker.getRoomById(recessHost.id), 'scheduled recess enforcement saves empty room', 20_000);
  assert.equal(sessions.get(recessSession)!.status, 'paused');
  assert.deepEqual(new Set(sessions.get(recessSession)!.player_ids), new Set([uid(1), uid(2)]));
  assert.deepEqual(sessions.get(recessSession)!.connected_player_ids, []);
  const recessState = sessions.get(recessSession)!.game_state!;
  const recessSave = new RoomCheckpoints(serviceOptions.ticketSecret).read(recessState.checkpoint, recessSession);
  assert.ok(recessSave, 'Supabase round-trip retains a valid signed checkpoint');
  assert.ok(recessSave.progress.blueScore >= 2);
  assert.ok(recessSave.progress.orangeScore >= 1);
  assert.ok(recessSave.progress.regulationStepsRemaining > 0 && recessSave.progress.regulationStepsRemaining <= 4321);
  assert.ok(Math.abs(recessSave.expiresAt - Date.parse(sessions.get(recessSession)!.last_activity!) - 24 * 60 * 60_000) < 10);
  assert.equal(recessState.botCount, 2);
  assert.equal((await launch(recessSession, 1)).data.code, 'RECESS_DENIED');
  assert.equal((await launch(recessSession, 2)).data.code, 'RECESS_DENIED');
  assert.deepEqual(sessions.get(recessSession)!.game_state, recessState, 'denied re-entry preserves saved state');
  recessDenied.clear();
  const recessRestored = await join(recessSession, 1);
  const recruitRestored = await join(recessSession, 2);
  assert.ok(views.get(recruitRestored)!.actorId); // Restored pending recruit enters at this recovery kickoff.
  assert.equal(views.get(recruitRestored)!.pending, false);
  assert.equal(views.get(recessRestored)!.paused, true);
  assert.deepEqual(views.get(recessRestored)!.score, { blue: recessSave.progress.blueScore, orange: recessSave.progress.orangeScore });
  assert.equal(views.get(recessRestored)!.players.filter(player => player.kind === 'bot').length, 2);
  const recoveredRecessRoom = colyseus.matchMaker.getRoomById(recessRestored.id) as unknown as typeof recessRoom;
  assert.deepEqual({ blueScore: recoveredRecessRoom.core.matchFlowState.blueScore,
    orangeScore: recoveredRecessRoom.core.matchFlowState.orangeScore,
    regulationStepsRemaining: recoveredRecessRoom.core.matchFlowState.regulationStepsRemaining,
    regulationCutoffResolved: recoveredRecessRoom.core.matchFlowState.regulationCutoffResolved }, recessSave.progress);
  recessRestored.send('platform-control', { action: 'resume' });
  await until(() => frames.get(recessRestored)?.phase === 'playing', 'resume saved recess game');
  await pause(350);
  recessRestored.send('platform-control', { action: 'end' });
  await until(() => sessions.get(recessSession)!.status === 'completed', 'stop restored recess game');
  await pause(300); await disposeCompletedRooms();
  report.perClassRecessAndRetainedRoster = 'PASS';
  const departureSession = newSession(30, false);
  const departureHost = await join(departureSession, 10, { invitationCode: 'fixture-private-code' });
  const departureFriend = await join(departureSession, 11, { invitationCode: 'fixture-private-code' });
  departureHost.send('platform-control', { action: 'start' });
  await until(() => frames.get(departureHost)?.phase === 'playing', 'start departure regression');
  await departureHost.leave();
  await until(() => sessions.get(departureSession)!.connected_player_ids?.length === 1, 'first active departure persisted');
  assert.ok(sessions.get(departureSession)!.player_ids.includes(uid(10)), 'first leaver retains saved membership');
  await departureFriend.leave();
  await until(() => !colyseus.matchMaker.getRoomById(departureFriend.id), 'last departure saves room');
  assert.equal(sessions.get(departureSession)!.status, 'paused');
  assert.ok(sessions.get(departureSession)!.player_ids.includes(uid(10)));
  assert.ok(sessions.get(departureSession)!.player_ids.includes(uid(11)));
  assert.equal((await launch(departureSession, 12, { invitationCode: 'fixture-private-code' })).data.code, 'NOT_IN_ROSTER');
  const firstLeaverBack = await join(departureSession, 10, { slowJoin: true });
  const lastLeaverBack = await join(departureSession, 11);
  assert.equal(firstLeaverBack.id, lastLeaverBack.id);
  assert.equal(views.get(firstLeaverBack)!.paused, true);
  firstLeaverBack.send('platform-control', { action: 'end' });
  await until(() => sessions.get(departureSession)!.status === 'completed', 'close departure test');
  await disposeCompletedRooms();
  report.allLeaversReturnAndSlowRestore = 'PASS';

  const restartSession = newSession(8);
  const beforeRestart = await join(restartSession, 1);
  beforeRestart.send('platform-control', { action: 'start' });
  await until(() => frames.get(beforeRestart)?.phase === 'playing', 'start before graceful restart');
  await service.drain();
  await until(() => !colyseus.matchMaker.getRoomById(beforeRestart.id), 'old service room disposed');
  assert.equal(sessions.get(restartSession)!.status, 'paused');
  assert.deepEqual(sessions.get(restartSession)!.connected_player_ids, []);
  const restartProgress = (sessions.get(restartSession)!.game_state!.checkpoint as any).payload.progress;
  service = createPlatformService(serviceOptions);
  service.startRecovery();
  gameServer.define('playground', service.roomClass);
  backend.removeAllListeners('request'); backend.on('request', service.handle);
  const afterRestart = await join(restartSession, 1);
  assert.equal(views.get(afterRestart)!.paused, true);
  const restartRoom = colyseus.matchMaker.getRoomById(afterRestart.id) as unknown as { core: { matchFlowState: typeof restartProgress } };
  assert.equal(restartRoom.core.matchFlowState.regulationStepsRemaining, restartProgress.regulationStepsRemaining);
  afterRestart.send('platform-control', { action: 'end' });
  await until(() => sessions.get(restartSession)!.status === 'completed', 'stop after fresh service recovery');
  report.gracefulRestartRecovery = 'PASS';
  await disposeCompletedRooms();

  // A dead process cannot clear its connection roster. The recovery timer must
  // make private matches discoverable without any player launching them first.
  const crashedSession = newSession(80, false);
  const crashedCheckpoint = { ...recessSave, sessionId: crashedSession, hostUserId: uid(10),
    seats: recessSave.seats.map(seat => ({ ...seat, human: seat.human
      ? { ...seat.human, userId: seat.human.userId === uid(1) ? uid(10) : uid(11) } : null })),
    pending: [], expiresAt: Date.now() + 24 * 60 * 60_000 - 60_000 };
  Object.assign(sessions.get(crashedSession)!, { status: 'playing', host_id: uid(10), player_ids: [uid(10), uid(11)],
    player_names: [names(10), names(11)], connected_player_ids: [uid(10), uid(11)], connected_player_names: [names(10), names(11)],
    game_state: { rocket: true, version: 1, allocationId: 'dead-process', leaseUntil: Date.now() - 1,
      checkpoint: new RoomCheckpoints(serviceOptions.ticketSecret).sign(crashedCheckpoint) } });
  const crashedSigned = structuredClone(sessions.get(crashedSession)!.game_state!.checkpoint);
  await until(() => sessions.get(crashedSession)!.status === 'paused', 'background crash recovery restores saved-game discovery', 20_000);
  assert.deepEqual(sessions.get(crashedSession)!.connected_player_ids, []);
  assert.deepEqual(sessions.get(crashedSession)!.connected_player_names, []);
  assert.deepEqual(sessions.get(crashedSession)!.player_ids, [uid(10), uid(11)]);
  assert.equal(sessions.get(crashedSession)!.is_open, false);
  assert.deepEqual(sessions.get(crashedSession)!.game_state!.checkpoint, crashedSigned);
  assert.equal(Date.parse(sessions.get(crashedSession)!.last_activity!), crashedCheckpoint.expiresAt - 24 * 60 * 60_000);
  assert.ok(logs.some(line => line.context.event === 'ROCKET_ALLOCATION_RECOVERED' && line.sessionId === crashedSession));
  assert.ok(!logs.some(line => line.context.event === 'ROCKET_LAUNCH_COMPLETED' && line.sessionId === crashedSession));
  const crashRecovered = await join(crashedSession, 10);
  assert.equal(views.get(crashRecovered)!.paused, true);
  assert.deepEqual(views.get(crashRecovered)!.score, { blue: recessSave.progress.blueScore, orange: recessSave.progress.orangeScore });
  crashRecovered.send('platform-control', { action: 'end' });
  await until(() => sessions.get(crashedSession)!.status === 'completed', 'stop crash-recovered private game');
  await disposeCompletedRooms();
  report.uncleanRestartSavedGameDiscovery = 'PASS';

  const ambiguousStopSession = newSession(81);
  Object.assign(sessions.get(ambiguousStopSession)!, { host_id: uid(14), player_ids: [uid(14)], player_names: [names(14)] });
  const ambiguousStop = await join(ambiguousStopSession, 14);
  failedPatch = { sessionId: ambiguousStopSession, reason: 'stopped', commitBeforeFailure: true };
  ambiguousStop.send('platform-control', { action: 'end' });
  await until(() => views.get(ambiguousStop)!.canRematch, 'read-back confirms an ambiguously acknowledged stop');
  assert.equal(sessions.get(ambiguousStopSession)!.status, 'completed');
  assert.deepEqual(errors.get(ambiguousStop), []);
  await disposeCompletedRooms();
  report.stopLostAcknowledgementConfirmed = 'PASS';

  // Faults cross the real allocation, database and transport boundaries. The
  // fixture alone can fail writes/engine startup; no public fault-injection API.
  const failureSession = newSession(61);
  const originalOnCreate = PlaygroundRoom.prototype.onCreate;
  PlaygroundRoom.prototype.onCreate = () => { throw new Error('fixture-allocation-failure'); };
  try { assert.equal((await launch(failureSession, 13)).status, 503); }
  finally { PlaygroundRoom.prototype.onCreate = originalOnCreate; }
  assert.equal(sessions.get(failureSession)!.game_state, null);
  assert.equal(sessions.get(failureSession)!.status, 'waiting');
  const failureClient = await join(failureSession, 13);
  const lastConfirmed = structuredClone(sessions.get(failureSession)!.game_state!.checkpoint);
  let logStart = logs.length;
  failedPatch = { sessionId: failureSession, reason: 'fixture-save-failure' };
  await (colyseus.matchMaker.getRoomById(failureClient.id) as PlaygroundRoom).hibernate('fixture-save-failure');
  await until(() => endedEvents.get(failureClient)!.includes('save-unconfirmed'), 'failed save is explicit to connected player');
  assert.deepEqual(sessions.get(failureSession)!.game_state!.checkpoint, lastConfirmed);
  assert.notEqual(sessions.get(failureSession)!.status, 'completed');
  assert.ok(logs.slice(logStart).some(line => line.context.event === 'ROCKET_ROOM_SAVE_UNCONFIRMED'));
  assert.ok(!logs.slice(logStart).some(line => line.context.event === 'ROCKET_ROOM_SAVED'));
  sessions.get(failureSession)!.game_state!.leaseUntil = 0; // Simulate old lease expiry, only in fixture.

  PlaygroundRoom.prototype.onCreate = () => { throw new Error('fixture-saved-allocation-failure'); };
  try { assert.equal((await launch(failureSession, 13)).status, 503); }
  finally { PlaygroundRoom.prototype.onCreate = originalOnCreate; }
  assert.deepEqual(sessions.get(failureSession)!.game_state!.checkpoint, lastConfirmed);
  assert.equal(sessions.get(failureSession)!.game_state!.leaseUntil, 0);
  assert.equal(sessions.get(failureSession)!.status, 'paused', 'failed recovery remains in the saved-games list, including waiting-room saves');

  const originalInitialize = (PlaygroundRoom.prototype as any).initialize;
  (PlaygroundRoom.prototype as any).initialize = async function () {
    await originalInitialize.call(this);
    throw new Error('fixture-async-initialization-failure');
  };
  try { assert.equal((await launch(failureSession, 13)).status, 503); }
  finally { (PlaygroundRoom.prototype as any).initialize = originalInitialize; }
  assert.deepEqual(sessions.get(failureSession)!.game_state!.checkpoint, lastConfirmed);
  assert.equal(sessions.get(failureSession)!.game_state!.leaseUntil, 0);
  assert.notEqual(sessions.get(failureSession)!.status, 'completed');
  assert.equal((await colyseus.matchMaker.query({})).length, 0, 'failed startup releases physics room');

  (PlaygroundRoom.prototype as any).initialize = async function () {
    this.core.initializeWorld = async () => { throw new Error('fixture-world-initialization-fatal'); };
    await originalInitialize.call(this);
  };
  try { assert.equal((await launch(failureSession, 13)).status, 503); }
  finally { (PlaygroundRoom.prototype as any).initialize = originalInitialize; }
  assert.deepEqual(sessions.get(failureSession)!.game_state!.checkpoint, lastConfirmed);
  assert.equal(sessions.get(failureSession)!.game_state!.leaseUntil, 0);
  assert.notEqual(sessions.get(failureSession)!.status, 'completed');
  assert.equal((await colyseus.matchMaker.query({})).length, 0, 'fatal engine initialization releases physics room');

  failedPatch = { sessionId: failureSession, reason: 'allocation-failed' };
  PlaygroundRoom.prototype.onCreate = () => { throw new Error('fixture-release-failure'); };
  try { assert.equal((await launch(failureSession, 13)).status, 503); }
  finally { PlaygroundRoom.prototype.onCreate = originalOnCreate; }
  assert.deepEqual(sessions.get(failureSession)!.game_state!.checkpoint, lastConfirmed);
  assert.ok(Number(sessions.get(failureSession)!.game_state!.leaseUntil) > Date.now());
  assert.notEqual(sessions.get(failureSession)!.status, 'completed');
  sessions.get(failureSession)!.game_state!.leaseUntil = 0;

  const recoveredFailure = await join(failureSession, 13);
  logStart = logs.length;
  failedPatch = { sessionId: failureSession, reason: 'fixture-ambiguous-save', commitBeforeFailure: true };
  await (colyseus.matchMaker.getRoomById(recoveredFailure.id) as PlaygroundRoom).hibernate('fixture-ambiguous-save');
  await until(() => endedEvents.get(recoveredFailure)!.includes('save-unconfirmed'), 'lost acknowledgement is not reported as saved');
  assert.equal(sessions.get(failureSession)!.status, 'paused');
  assert.ok(!logs.slice(logStart).some(line => line.context.event === 'ROCKET_ROOM_SAVED'));
  const confirmedClient = await join(failureSession, 13);
  await (colyseus.matchMaker.getRoomById(confirmedClient.id) as PlaygroundRoom).hibernate('fixture-confirmed-save');
  await until(() => endedEvents.get(confirmedClient)!.includes('saved'), 'acknowledged save reports success');
  assert.ok(logs.some(line => line.context.event === 'ROCKET_ROOM_SAVED' && line.reason === 'fixture-confirmed-save'));

  // A competing owner or a moderator completion must survive rollback.
  PlaygroundRoom.prototype.onCreate = () => {
    sessions.get(failureSession)!.game_state!.allocationId = 'fixture-new-owner';
    throw new Error('fixture-owner-changed');
  };
  try { assert.equal((await launch(failureSession, 13)).status, 503); }
  finally { PlaygroundRoom.prototype.onCreate = originalOnCreate; }
  assert.equal(sessions.get(failureSession)!.game_state!.allocationId, 'fixture-new-owner');
  sessions.get(failureSession)!.game_state!.leaseUntil = 0;
  PlaygroundRoom.prototype.onCreate = () => {
    sessions.get(failureSession)!.status = 'completed';
    throw new Error('fixture-moderator-completed');
  };
  try { assert.equal((await launch(failureSession, 13)).status, 503); }
  finally { PlaygroundRoom.prototype.onCreate = originalOnCreate; }
  assert.equal(sessions.get(failureSession)!.status, 'completed');
  report.allocationFailurePreservesCheckpoint = 'PASS';
  report.saveFailureAndLostAcknowledgement = 'PASS';
  report.recoveryOwnershipFencing = 'PASS';
  platformFailure = false;
  report.status = 'PASS';
  await writeFile(`${root}/.run/${process.argv.includes('--browser') ? 'app-browser-report' : 'app-integration-report'}.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} finally {
  for (const room of rooms) {
    if (room.connection.isOpen) { try { await Promise.race([room.leave(), pause(2000)]); } catch {} }
  }
  if (vite) { vite.kill('SIGTERM'); await once(vite, 'exit').catch(() => {}); }
  if (qaFilesCreated) { await unlink(qaHtml); await unlink(qaTsx); }
  await service.drain();
  await gameServer.gracefullyShutdown(false);
  await new Promise<void>(resolve => fixture.close(() => resolve()));
}
