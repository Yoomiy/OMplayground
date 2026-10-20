import test from 'node:test';
import assert from 'node:assert/strict';
import { PlatformGateway } from './gateway.js';
import type { PlatformProfile, PlatformSession } from './admission.js';
import { configurePlatformLogger } from './logging.js';

test('database failures report the operation and Postgres code without credentials, query values or response text', async () => {
  const events: Record<string, unknown>[] = [];
  configurePlatformLogger({ debug: () => {}, info: value => events.push(value), warn: value => events.push(value), error: value => events.push(value) });
  try {
    const gateway = new PlatformGateway('https://fixture.invalid', 'private-service-key', (async () => new Response(
      JSON.stringify({ code: '42501', message: 'private-response-body' }), { status: 403 },
    )) as typeof fetch);
    await assert.rejects(gateway.withinRecess({ userId: 'kid', role: 'kid', gender: 'boy', grade: 'ג', name: 'חבר' }), /PLATFORM_UNAVAILABLE/);
    assert.ok(events.some(event => event.resource === 'recess_schedules' && event.method === 'GET' && event.status === 403 && event.databaseCode === '42501'));
    assert.equal(JSON.stringify(events).includes('private-service-key'), false);
    assert.equal(JSON.stringify(events).includes('private-response-body'), false);
    assert.equal(JSON.stringify(events).includes('is_active=eq.true'), false);
  } finally { configurePlatformLogger({ debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }); }
});

test('gateway applies class exceptions over school recess and fails closed on schedule errors', async () => {
  let reads = 0;
  let failed = false;
  const windows = Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, start_time: '00:00', end_time: '23:59', is_active: true }));
  const request = (async (input: string | URL | Request) => {
    reads++;
    const url = String(input);
    if (failed) return new Response('{}', { status: 503 });
    const value = url.includes('class_recess_schedule_settings') ? [{ grade: 'closed', gender: 'boy', override_enabled: true }]
      : url.includes('class_recess_schedule_exceptions') ? windows.map(row => ({ ...row, grade: 'closed', gender: 'boy', mode: 'class_time' }))
      : windows;
    return new Response(JSON.stringify(value), { status: 200 });
  }) as typeof fetch;
  const gateway = new PlatformGateway('https://fixture.invalid', 'fixture-secret', request);
  const kid: PlatformProfile = { userId: 'kid', role: 'kid', gender: 'boy', grade: 'ג', name: 'חבר' };
  assert.equal(await gateway.withinRecess(kid), true);
  assert.equal(await gateway.withinRecess({ ...kid, grade: 'closed' }), false);
  assert.equal(await gateway.withinRecess({ ...kid, grade: null }), false);
  assert.equal(reads, 3); // Cache one successful schedule snapshot, not an allow decision.
  failed = true;
  const unavailable = new PlatformGateway('https://fixture.invalid', 'fixture-secret', request);
  await assert.rejects(unavailable.withinRecess(kid), /PLATFORM_UNAVAILABLE/);
});

test('cached schedules still enforce the actual Jerusalem recess boundary', async t => {
  // Monday, 09:59:55 in Jerusalem (summer time).
  t.mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-01T06:59:55Z') });
  let reads = 0;
  const gateway = new PlatformGateway('https://fixture.invalid', 'fixture-secret', (async input => {
    reads++;
    const rows = String(input).includes('/recess_schedules?')
      ? [{ day_of_week: 1, start_time: '10:00', end_time: '10:01', is_active: true }] : [];
    return new Response(JSON.stringify(rows), { status: 200 });
  }) as typeof fetch);
  const kid: PlatformProfile = { userId: 'kid', role: 'kid', gender: 'boy', grade: 'ג', name: 'חבר' };
  assert.equal(await gateway.withinRecess(kid), false);
  t.mock.timers.setTime(new Date('2026-06-01T07:00:00Z').getTime());
  assert.equal(await gateway.withinRecess(kid), true);
  assert.equal(reads, 3, 'a cached schedule must not cache an access decision');
  t.mock.timers.setTime(new Date('2026-06-01T07:01:00Z').getTime());
  assert.equal(await gateway.withinRecess(kid), false, 'the ending minute is excluded');
});

test('lifecycle writes use compare-and-swap rather than overwrite concurrent moderation', async () => {
  const session: PlatformSession = { id: 'session', status: 'playing', game_state: { allocationId: 'generation' },
    player_ids: ['kid'], player_names: ['חבר'], host_id: 'kid', is_open: true, gender: 'boy', invitation_code: null,
    games: { game_url: 'rocket-arena', is_active: true } };
  let requestUrl = '';
  const gateway = new PlatformGateway('https://fixture.invalid', 'fixture-secret', (async (input, init) => {
    requestUrl = String(input);
    assert.equal(init?.method, 'PATCH');
    assert.equal(requestUrl.includes('fixture-secret'), false);
    return new Response('[]', { status: 200 });
  }) as typeof fetch);
  await assert.rejects(gateway.update(session, { status: 'paused' }), /SESSION_CHANGED/);
  const filters = new URL(requestUrl).searchParams;
  assert.equal(filters.get('status'), 'eq.playing');
  assert.equal(filters.get('game_state'), 'eq.{"allocationId":"generation"}');
  assert.equal(filters.get('player_ids'), 'eq.{kid}');
});

test('versioned checkpoint writes use a short revision filter and rotate that revision', async () => {
  const session: PlatformSession = { id: 'session', status: 'paused', game_state: { revision: 'old-revision', checkpoint: 'x'.repeat(16000) },
    player_ids: ['kid'], player_names: ['חבר'], host_id: 'kid', is_open: true, gender: 'boy', invitation_code: null,
    games: { game_url: 'rocket-arena', is_active: true } };
  const gateway = new PlatformGateway('https://fixture.invalid', 'fixture-secret', (async (input, init) => {
    const url = new URL(String(input));
    assert.ok(String(input).length < 300);
    assert.equal(url.searchParams.get('game_state->>revision'), 'eq.old-revision');
    assert.equal(url.searchParams.has('game_state'), false);
    const patch = JSON.parse(String(init!.body));
    assert.notEqual(patch.game_state.revision, 'old-revision');
    assert.equal(patch.game_state.checkpoint.length, 16000);
    return new Response('[{}]', { status: 200 });
  }) as typeof fetch);
  await gateway.update(session, { game_state: session.game_state });
});

test('rematch consent requires completed membership and fresh game, gender, recess and observer policy', async () => {
  const session: PlatformSession = { id: '00000000-0000-4000-8000-000000000001', status: 'completed', game_state: null,
    player_ids: ['kid'], player_names: ['חבר'], host_id: 'kid', is_open: false, gender: 'boy', invitation_code: null,
    games: { game_url: 'rocket-arena', is_active: true } };
  const gateway = new PlatformGateway('https://fixture.invalid', 'fixture-secret', (async () =>
    new Response(JSON.stringify([session]), { status: 200 })) as typeof fetch);
  let eligible = true;
  gateway.withinRecess = async () => eligible;
  const kid: PlatformProfile = { userId: 'kid', name: 'חבר', role: 'kid', gender: 'boy', grade: 'ג' };
  assert.equal((await gateway.admitRematch(kid, session.id, false)).session.status, 'completed');
  await assert.rejects(gateway.admit(kid, session.id, false), /SESSION_COMPLETED/); // No ordinary join bypass.
  await assert.rejects(gateway.admitRematch({ ...kid, userId: 'outsider' }, session.id, false), /NOT_IN_ROSTER/);
  await assert.rejects(gateway.admitRematch({ ...kid, gender: 'girl' }, session.id, false), /GENDER_MISMATCH/);
  await assert.rejects(gateway.admitRematch(kid, session.id, true), /OBSERVER_FORBIDDEN/);
  eligible = false;
  await assert.rejects(gateway.admitRematch(kid, session.id, false), /RECESS_DENIED/);
  eligible = true; session.games.is_active = false;
  await assert.rejects(gateway.admitRematch(kid, session.id, false), /GAME_UNAVAILABLE/);
  session.games.is_active = true; session.status = 'playing';
  await assert.rejects(gateway.admitRematch(kid, session.id, false), /SESSION_CHANGED/);
});
