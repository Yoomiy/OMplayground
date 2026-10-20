import test from 'node:test';
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import { PlaygroundRoom, configurePlatformRooms } from './playground-room.js';
import { PlatformGateway } from './gateway.js';
import { LaunchTickets } from './tickets.js';
import { RoomCheckpoints } from './checkpoint.js';

const secret = 'fixture-completion-secret-more-than-32-characters';
function fixture(paused = false, phase = 'playing') {
  let storedStatus = 'playing';
  const gateway = new PlatformGateway('https://fixture.invalid', 'fixture-key', (async () =>
    new Response(JSON.stringify([{ status: storedStatus, game_state: { allocationId: 'owner' } }]), { status: 200 })) as typeof fetch);
  configurePlatformRooms({ gateway, tickets: new LaunchTickets(secret), checkpoints: new RoomCheckpoints(secret),
    internalKey: 'unused', onReady: () => 1, onDispose: () => 0 });
  // These checks isolate the completion transaction; the app integration fixture
  // exercises fully allocated Colyseus rooms and their timers/transports.
  const room = Object.create(PlaygroundRoom.prototype) as any;
  Object.defineProperty(room, 'roomId', { value: 'fixture-room' });
  Object.assign(room, { sessionId: '00000000-0000-4000-8000-000000000001', allocationId: 'owner', paused,
    disposed: false, completed: false, completing: false, completionRetryAt: 0,
    core: { matchFlowState: { phase, terminalResult: null },
      setPaused(value: boolean) { simulationPaused = value; }, advanceSimulation: () => ({ snapshotDue: false }) } });
  let simulationPaused = paused;
  let writes = 0;
  let publications = 0;
  room.publishPlatformState = () => { publications++; };
  room.publishSnapshot = () => {};
  room.persist = async () => { writes++; throw new Error('fixture-write-failed'); };
  return { room, get writes() { return writes; }, get publications() { return publications; },
    get simulationPaused() { return simulationPaused; },
    commitBeforeFailure() { storedStatus = 'completed'; },
    restoreDatabase() { room.persist = async () => { writes++; storedStatus = 'completed'; }; } };
}

for (const paused of [false, true]) test(`failed completion restores the previous ${paused ? 'paused' : 'running'} state and permits retry`, async () => {
  const check = fixture(paused);
  await assert.rejects(check.room.completeRound('stopped'), /fixture-write-failed/);
  assert.equal(check.room.completed, false);
  assert.equal(check.room.completing, false);
  assert.equal(check.room.paused, paused);
  assert.equal(check.simulationPaused, paused);
  assert.equal(check.publications, 0);
  check.restoreDatabase();
  await check.room.completeRound('stopped');
  assert.equal(check.room.completed, true);
  assert.equal(check.simulationPaused, true);
  assert.equal(check.publications, 1);
});

test('read-back confirmation finalizes a committed completion despite a lost write acknowledgment', async () => {
  const check = fixture();
  check.commitBeforeFailure();
  await check.room.completeRound('stopped');
  assert.equal(check.room.completed, true);
  assert.equal(check.publications, 1);
  assert.equal(check.simulationPaused, true);
});

test('natural completion retries after a failed save without resuming or hibernating its terminal result', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: Date.now() });
  const check = fixture(false, 'ended');
  check.room.advance(16);
  await setImmediate();
  // Wait for the actual mock database read-back, not only the rejected write.
  while (check.room.completing) await setImmediate();
  assert.equal(check.room.completed, false);
  assert.equal(check.room.core.matchFlowState.phase, 'ended');
  assert.equal(check.publications, 0);
  const beforeRetry = check.writes;
  check.room.advance(16);
  assert.equal(check.writes, beforeRetry, 'no tight retry loop');
  check.restoreDatabase();
  t.mock.timers.setTime(Date.now() + 5000);
  check.room.advance(16);
  await setImmediate();
  assert.equal(check.room.completed, true);
  assert.equal(check.publications, 1);
});
