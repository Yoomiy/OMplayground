import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlatformService } from './service.js';
import { AdmissionError, type PlatformSession } from './admission.js';
import type { PlatformGateway } from './gateway.js';
import { PAUSED_RETENTION_MS, RoomCheckpoints, type SavedRoom } from './checkpoint.js';

const secret = 'fixture-recovery-secret-more-than-32-characters';
const signer = new RoomCheckpoints(secret);
function savedSession(id: string): PlatformSession {
  const checkpoint: SavedRoom = { version: 1, sessionId: id, expiresAt: Date.now() + PAUSED_RETENTION_MS - 60_000,
    waiting: false, hostUserId: 'kid', pending: [], banned: [],
    progress: { blueScore: 2, orangeScore: 1, regulationStepsRemaining: 1234, regulationCutoffResolved: false },
    seats: Array.from({ length: 8 }, (_, index) => ({ actorId: `rocket-${index}`, bot: index === 1,
      human: index === 0 ? { userId: 'kid', name: 'חבר' } : null })) };
  return { id, host_id: 'kid', gender: 'boy', status: 'playing', is_open: false, invitation_code: 'private',
    player_ids: ['kid'], player_names: ['חבר'], connected_player_ids: ['kid'], connected_player_names: ['חבר'],
    games: { game_url: 'rocket-arena', is_active: true }, game_state: {
      rocket: true, allocationId: 'dead-owner', leaseUntil: Date.now() - 1, checkpoint: signer.sign(checkpoint) } };
}
function service(gateway: Partial<PlatformGateway>) {
  return createPlatformService({ gateway: gateway as PlatformGateway, ticketSecret: secret,
    origins: ['http://localhost:5173'], clientDir: '/unused-fixture-client' });
}

test('expired owner recovery pages through saves without extending retention or changing private membership', async () => {
  const rows = Array.from({ length: 105 }, (_, index) => savedSession(String(index).padStart(3, '0')));
  const originals = structuredClone(rows);
  const pages: (string | undefined)[] = [];
  const app = service({
    async expiredAllocations(_now, after) {
      pages.push(after);
      return rows.filter(row => row.id > (after ?? '')).slice(0, 100);
    },
    async update(row, patch) { Object.assign(row, patch); },
  });
  await app.recoverExpiredAllocations();
  assert.deepEqual(pages, [undefined, '099', '104']);
  for (const [index, row] of rows.entries()) {
    assert.equal(row.status, 'paused');
    assert.deepEqual(row.connected_player_ids, []);
    assert.deepEqual(row.connected_player_names, []);
    assert.deepEqual(row.player_ids, originals[index]!.player_ids);
    assert.equal(row.is_open, false);
    assert.equal(row.game_state!.leaseUntil, 0);
    assert.deepEqual(row.game_state!.checkpoint, originals[index]!.game_state!.checkpoint);
    const checkpoint = signer.read(row.game_state!.checkpoint, row.id)!;
    assert.equal(Date.parse(row.last_activity!), checkpoint.expiresAt - PAUSED_RETENTION_MS);
  }
  await app.drain();
});

test('recovery never clears a live lease, invalid save or a concurrent owner/moderation update', async () => {
  const live = savedSession('live'); live.game_state!.leaseUntil = Date.now() + 60_000;
  const invalid = savedSession('invalid'); invalid.game_state!.checkpoint = { signature: 'invalid' };
  const expired = savedSession('expired');
  const payload = signer.read(expired.game_state!.checkpoint, expired.id)!;
  expired.game_state!.checkpoint = signer.sign({ ...payload, expiresAt: Date.now() - 1 });
  const replaced = savedSession('replaced');
  const moderated = savedSession('moderated');
  const writes: string[] = [];
  const app = service({
    async expiredAllocations(_now, after) { return after ? [] : [live, invalid, expired, replaced, moderated]; },
    async update(row) {
      writes.push(row.id);
      if (row.id === 'replaced') row.game_state = { allocationId: 'new-owner', leaseUntil: Date.now() + 60_000 };
      else row.status = 'completed';
      throw new AdmissionError('SESSION_CHANGED', 409);
    },
  });
  await app.recoverExpiredAllocations();
  assert.deepEqual(writes, ['replaced', 'moderated']);
  assert.equal(live.status, 'playing'); assert.deepEqual(live.connected_player_ids, ['kid']);
  assert.equal(invalid.status, 'playing'); assert.equal(expired.status, 'playing');
  assert.equal(replaced.game_state!.allocationId, 'new-owner');
  assert.deepEqual(replaced.connected_player_ids, ['kid']);
  assert.equal(moderated.status, 'completed');
  await app.drain();
});

test('recovery starts immediately, repeats independently of launches, coalesces scans and stops on drain', async t => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  let scans = 0;
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const app = service({ async expiredAllocations() { scans++; await pending; return []; } });
  app.startRecovery(); app.startRecovery();
  t.mock.timers.tick(30_000);
  assert.equal(scans, 1);
  release(); await app.recoverExpiredAllocations();
  t.mock.timers.tick(15_000);
  await app.recoverExpiredAllocations();
  assert.equal(scans, 2);
  await app.drain();
  t.mock.timers.tick(30_000);
  await app.recoverExpiredAllocations();
  assert.equal(scans, 2);
});
