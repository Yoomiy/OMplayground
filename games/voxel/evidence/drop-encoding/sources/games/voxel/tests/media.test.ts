import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  readVoiceTicket,
  readMediaReceipt,
  readMediaState,
  readMediaAuthorization,
} from '../src/shared/media.ts';
const actor = '00000000-0000-4000-8000-000000000001',
  binding = '00000000-0000-4000-8000-000000000002';
test('public media tickets require opaque values and never accept reusable JWTs or hidden publication', () => {
  const value = {
    ticket: 'a'.repeat(43),
    expiresAt: 123456,
    publish: true,
    hidden: false,
    actorId: actor,
    bindingId: binding,
  };
  assert(readVoiceTicket(value));
  assert.equal(readVoiceTicket({ ...value, ticket: 'eyJheader.payload.signature' }), null);
  assert.equal(readVoiceTicket({ ...value, token: 'private-provider-token' }), null);
  assert.equal(readVoiceTicket({ ...value, expiresAt: 123456.5 }), null);
  assert.equal(readVoiceTicket({ ...value, hidden: true }), null);
  assert(readVoiceTicket({ ...value, publish: false, hidden: true }));
  assert.equal(
    readMediaAuthorization({ revision: 0, cutoff: 1, publish: true, hidden: false }),
    null,
  );
});
test('durable media receipts distinguish requested revocation from a saved world or external enforcement acknowledgement', () => {
  const value = {
    requestId: binding,
    action: 'mute',
    target: actor,
    revision: 1,
    muted: true,
    current: true,
    applied: true,
    persisted: true,
    saved: false,
    revocationRequested: true,
  };
  assert(readMediaReceipt(value));
  assert.equal(readMediaReceipt({ ...value, saved: true }), null);
  assert.equal(readMediaReceipt({ ...value, enforced: true }), null);
  assert.equal(readMediaReceipt({ ...value, action: 'unmute' }), null);
  assert.equal(readMediaReceipt({ ...value, revision: 0 }), null);
  assert(
    readMediaReceipt({
      ...value,
      action: 'unmute',
      muted: false,
      revision: 0,
      revocationRequested: false,
    }),
  );
  assert.equal(readMediaReceipt({ ...value, current: false }), null);
  assert(readMediaReceipt({ ...value, current: false, revocationRequested: false }));
});
test('teacher media views compose global and personal mute, reject duplicate targets and own their snapshots', () => {
  const target = { id: actor, name: '<b>School name</b>', muted: false, effectiveMuted: true },
    raw = { revision: 1, allMuted: true, targets: [target] },
    state = readMediaState(raw);
  assert(state);
  target.name = 'Changed';
  assert.equal(state.targets[0].name, '<b>School name</b>');
  assert.equal(readMediaState({ ...raw, targets: [{ ...target, effectiveMuted: false }] }), null);
  assert.equal(readMediaState({ ...raw, targets: [target, target] }), null);
  assert.equal(readMediaState({ ...raw, targets: [{ ...target, role: 'teacher' }] }), null);
});
