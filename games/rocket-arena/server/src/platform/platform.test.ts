import test from 'node:test';
import assert from 'node:assert/strict';
import { AdmissionError, enforceAdmission, type PlatformProfile, type PlatformSession } from './admission.js';
import { LaunchTickets } from './tickets.js';
import { PlatformSeats } from './seats.js';
import { captureSeats, restoreSeats, RoomCheckpoints, PAUSED_RETENTION_MS, type SavedRoom } from './checkpoint.js';

const profile: PlatformProfile = { userId: 'kid', role: 'kid', name: 'אורמן <חבר>', grade: 'ג', gender: 'boy' };
const session: PlatformSession = { id: 'session', host_id: 'kid', gender: 'boy', status: 'waiting', is_open: true,
  invitation_code: 'private-code', player_ids: ['kid'], player_names: [profile.name], game_state: null,
  games: { game_url: 'rocket-arena', is_active: true } };

test('admission enforces game, eligibility, invitation, roster and observer roles', () => {
  const base = { profile, session, observer: false, challenged: false, withinRecess: true };
  assert.equal(enforceAdmission(base).profile.name, 'אורמן <חבר>');
  const rejected = (change: Partial<typeof base>, code: string) => assert.throws(() => enforceAdmission({ ...base, ...change }),
    error => error instanceof AdmissionError && error.code === code);
  rejected({ withinRecess: false }, 'RECESS_DENIED');
  rejected({ observer: true }, 'OBSERVER_FORBIDDEN');
  rejected({ profile: { ...profile, gender: 'girl' } }, 'GENDER_MISMATCH');
  rejected({ session: { ...session, status: 'completed' } }, 'SESSION_COMPLETED');
  rejected({ session: { ...session, games: { ...session.games, game_url: 'minecraft' } } }, 'GAME_UNAVAILABLE');
  rejected({ session: { ...session, games: { ...session.games, is_active: false } } }, 'GAME_UNAVAILABLE');
  const stranger = { ...base, profile: { ...profile, userId: 'friend' }, session: { ...session, is_open: false } };
  assert.throws(() => enforceAdmission(stranger), /SESSION_CLOSED/);
  assert.ok(enforceAdmission({ ...stranger, invitationCode: 'private-code' }));
  assert.ok(enforceAdmission({ ...stranger, challenged: true }));
  assert.throws(() => enforceAdmission({ ...stranger, session: { ...session, status: 'paused' } }), /NOT_IN_ROSTER/);
  assert.ok(enforceAdmission({ ...base, profile: { ...profile, role: 'teacher', gender: 'girl' }, observer: true, withinRecess: false }));
});

test('launch tickets reject tampering, another room/allocation, expiry and replay', () => {
  const tickets = new LaunchTickets('fixture-secret-with-at-least-32-characters');
  const scope = { userId: 'kid', sessionId: 'session', roomId: 'room', allocationId: 'allocation', observer: false };
  const ticket = tickets.issue(scope, 1000);
  assert.throws(() => tickets.consume(ticket.slice(0, -2) + 'xx', 'room', 'allocation', 1001));
  assert.throws(() => tickets.consume(ticket, 'another-room', 'allocation', 1001));
  assert.throws(() => tickets.consume(ticket, 'room', 'another-allocation', 1001));
  assert.equal(tickets.consume(ticket, 'room', 'allocation', 1001).userId, 'kid');
  assert.throws(() => tickets.consume(ticket, 'room', 'allocation', 1002));
  assert.throws(() => tickets.consume(tickets.issue(scope, 1000), 'room', 'allocation', 31_000));
});

test('late join replaces a bot at kickoff while reconnect reclaims the same physical actor', () => {
  const seats = new PlatformSeats('kid');
  seats.join('kid', 'אני', 'socket1', 'waiting', 0);
  const actor = seats.actorForConnection('socket1');
  assert.equal(actor, 'rocket-0');
  seats.join('friend', 'חבר', 'socket2', 'playing', 1);
  assert.equal(seats.actorForConnection('socket2'), null);
  assert.equal(seats.pending.size, 1);
  seats.kickoff();
  assert.equal(seats.actorForConnection('socket2'), 'rocket-1');
  seats.leave('socket1', false, 100);
  seats.expire(30_099);
  assert.equal(seats.seats[0]!.human?.userId, 'kid');
  seats.join('kid', 'אני', 'socket3', 'playing', 30_099);
  assert.equal(seats.actorForConnection('socket3'), actor);
  seats.leave('socket3', false, 40_000);
  seats.expire(70_000);
  assert.equal(seats.seats[0]!.human, null);
  seats.join('kid', 'אני', 'socket4', 'playing', 70_001);
  assert.equal(seats.actorForConnection('socket4'), null);
  seats.kickoff();
  assert.equal(seats.actorForConnection('socket4'), actor);
  assert.equal(seats.seats.length, 8);
});

test('capacity includes queued/reserved humans, host transfers, explicit leave and removal', () => {
  const seats = new PlatformSeats('kid0');
  for (let index = 0; index < 8; index++) seats.join(`kid${index}`, `חבר ${index}`, `socket${index}`, index ? 'playing' : 'waiting', 0);
  assert.throws(() => seats.join('ninth', 'תשיעי', 'socket9', 'playing', 0), /ROOM_FULL/);
  assert.throws(() => seats.join('kid0', 'אני', 'duplicate', 'playing', 0), /ALREADY_CONNECTED/);
  seats.kickoff();
  seats.leave('socket0', false, 0);
  assert.equal(seats.hostUserId, 'kid1');
  assert.throws(() => seats.join('ninth', 'תשיעי', 'socket9', 'playing', 0), /ROOM_FULL/);
  seats.leave('socket1', true, 0);
  assert.equal(seats.seats[1]!.human, null);
  seats.remove('kid2');
  assert.throws(() => seats.join('kid2', 'חבר', 'new', 'waiting', 0), /REMOVED_FROM_ROOM/);
  seats.join('ninth', 'תשיעי', 'socket9', 'playing', 0);
  assert.equal(seats.humans().length, 7);
});

test('bots are opt-in, counts are bounded, humans replace bots and leaving does not add a bot', () => {
  const seats = new PlatformSeats('host');
  seats.join('host', 'מארח', 'host-socket', 'waiting', 0);
  assert.equal(seats.botCount(), 0);
  for (const invalid of [-1, 8, 1.5, '2', null]) assert.throws(() => seats.setBots(invalid), /BAD_BOT_COUNT/);
  seats.setBots(7);
  assert.equal(seats.botCount(), 7);
  seats.join('friend', 'חבר', 'friend-socket', 'waiting', 0);
  assert.equal(seats.botCount(), 6);
  seats.leave('friend-socket', true, 0);
  assert.equal(seats.botCount(), 6);
  seats.setBots(0);
  assert.equal(seats.botCount(), 0);
  assert.equal(seats.humans().length, 1);
});

test('a saved lobby keeps its returning host during reload, then transfers on timeout or departure', () => {
  const lobby = () => {
    const old = new PlatformSeats('host');
    old.join('host', 'מארח', 'old-host', 'waiting', 0);
    old.join('friend', 'חבר', 'old-friend', 'waiting', 0);
    const restored = new PlatformSeats('host');
    restoreSeats(restored, { version: 1, sessionId: 'session', expiresAt: PAUSED_RETENTION_MS, waiting: true,
      progress: { blueScore: 0, orangeScore: 0, regulationStepsRemaining: 18000, regulationCutoffResolved: false },
      ...captureSeats(old) }, ['host', 'friend']);
    restored.retainHostUntil(30_000);
    return restored;
  };
  const returned = lobby();
  returned.join('friend', 'חבר', 'new-friend', 'waiting', 100);
  assert.equal(returned.hostUserId, 'host');
  returned.join('host', 'מארח', 'new-host', 'waiting', 200);
  assert.equal(returned.hostUserId, 'host');
  returned.leave('new-host', true, 300);
  assert.equal(returned.hostUserId, 'friend'); // A new deliberate departure transfers immediately.

  const absent = lobby();
  absent.join('friend', 'חבר', 'new-friend', 'waiting', 100);
  absent.expire(29_999);
  assert.equal(absent.hostUserId, 'host');
  const revision = absent.revision;
  absent.expire(30_000);
  assert.equal(absent.hostUserId, 'friend');
  assert.ok(absent.revision > revision); // Publish fallback hosting even without another join.

  const removed = lobby();
  removed.join('friend', 'חבר', 'new-friend', 'waiting', 100);
  removed.remove('host');
  assert.equal(removed.hostUserId, 'friend'); // Grace never blocks moderation.
});

test('host team assignment uses free positions and swaps a full team without exceeding capacity', () => {
  const seats = new PlatformSeats('host');
  seats.join('host', 'מארח', 'host-socket', 'waiting', 0);
  seats.assignTeam('rocket-0', 'orange');
  assert.equal(seats.actorForConnection('host-socket'), 'rocket-1');
  assert.throws(() => seats.assignTeam('rocket-0', 'blue'), /BAD_TEAM/);
  seats.setBots(7);
  seats.assignTeam('rocket-1', 'blue');
  assert.equal(seats.actorForConnection('host-socket'), 'rocket-0');
  assert.equal(seats.botCount(), 7);
  for (let user = 1; user < 8; user++) seats.join(`kid${user}`, `חבר ${user}`, `socket${user}`, 'waiting', 0);
  const target = seats.seats[1]!.human!.userId;
  seats.assignTeam('rocket-0', 'orange');
  assert.equal(seats.actorForConnection('host-socket'), 'rocket-1');
  assert.equal(seats.seats[0]!.human!.userId, target);
  assert.equal(seats.humans().length, 8);
  assert.equal(seats.botCount(), 0);
});

test('host queues late arrivals into chosen bot slots without changing active play or stealing another plan', () => {
  const seats = new PlatformSeats('host');
  seats.join('host', 'מארח', 'socket', 'waiting', 0); seats.setBots(7);
  seats.join('first', 'ראשון', 'first-socket', 'playing', 0);
  seats.join('second', 'שני', 'second-socket', 'playing', 0);
  seats.planPending('second', 'rocket-1');
  assert.throws(() => seats.planPending('first', 'rocket-0'), /BAD_PENDING_SLOT/);
  assert.throws(() => seats.planPending('first', 'rocket-1'), /BAD_PENDING_SLOT/);
  assert.throws(() => seats.planPending('missing', 'rocket-2'), /BAD_PENDING_SLOT/);
  assert.equal(seats.botCount(), 7);
  assert.equal(seats.actorForConnection('second-socket'), null);
  seats.kickoff();
  assert.equal(seats.actorForConnection('second-socket'), 'rocket-1');
  assert.equal(seats.actorForConnection('first-socket'), 'rocket-2');
  assert.equal(seats.botCount(), 5);
  assert.equal(seats.pending.size, 0);
});

test('paused departures preserve roster and signed checkpoints restore disconnected seats but honor app removals', () => {
  const seats = new PlatformSeats('host');
  seats.join('host', 'מארח', 'socket', 'waiting', 0); seats.setBots(2);
  seats.join('late', 'מצטרף', 'late-socket', 'playing', 0); seats.planPending('late', 'rocket-1');
  seats.retainRoster(); seats.leave('socket', true, 0, true); seats.leave('late-socket', true, 0, true);
  seats.expire(PAUSED_RETENTION_MS);
  assert.equal(seats.humans().length, 2);
  const payload: SavedRoom = { version: 1, sessionId: 'session', waiting: false, expiresAt: PAUSED_RETENTION_MS,
    progress: { blueScore: 2, orangeScore: 1, regulationStepsRemaining: 1200, regulationCutoffResolved: false }, ...captureSeats(seats) };
  const checkpoints = new RoomCheckpoints('stable-fixture-secret');
  const signed = checkpoints.sign(payload);
  assert.deepEqual(checkpoints.read(signed, 'session', 1), payload);
  const reorder = (value: any): any => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([key, child]) => [key, reorder(child)])) : value;
  assert.deepEqual(checkpoints.read(reorder(signed), 'session', 1), payload);
  assert.equal(checkpoints.read({ ...signed, payload: { ...payload, expiresAt: PAUSED_RETENTION_MS * 2 } }, 'session', 1), null);
  assert.equal(checkpoints.read(signed, 'other-session', 1), null);
  assert.equal(checkpoints.read(signed, 'session', PAUSED_RETENTION_MS), null);
  assert.equal(new RoomCheckpoints('different-secret').read(signed, 'session', 1), null);
  const restored = new PlatformSeats('host');
  restoreSeats(restored, payload, ['host']);
  assert.equal(restored.humans().length, 1);
  assert.equal(restored.botCount(), 2);
  restored.join('host', 'מארח', 'returned', 'countdown', 1);
  assert.equal(restored.actorForConnection('returned'), 'rocket-0');
});
