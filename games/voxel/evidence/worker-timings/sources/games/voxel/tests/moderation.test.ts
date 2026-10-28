import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readModerationReceipt } from '../src/shared/moderation.ts';
test('moderation receipts distinguish committed access policy from world saving and historical revocation', () => {
  const value = {
    requestId: 'id',
    target: 'kid',
    action: 'ban',
    revision: 1,
    banned: true,
    current: true,
    applied: true,
    saved: false,
    revocationRequested: true,
  };
  assert.ok(readModerationReceipt(value));
  assert.ok(
    readModerationReceipt({
      ...value,
      action: 'unban',
      banned: false,
      revision: 0,
      revocationRequested: false,
    }),
  );
  assert.ok(readModerationReceipt({ ...value, current: false, revocationRequested: false }));
  assert.ok(
    readModerationReceipt({ ...value, action: 'unban', banned: false, revocationRequested: false }),
  );
  for (const bad of [
    { ...value, saved: true },
    { ...value, applied: false },
    { ...value, revision: 0 },
    { ...value, banned: false },
    { ...value, current: false },
    { ...value, position: [1, 2, 3] },
  ])
    assert.equal(readModerationReceipt(bad), null);
});
