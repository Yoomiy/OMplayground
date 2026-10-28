import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readStaffCommand } from '../src/shared/staff.ts';
import { parseClientMessage, parseServerMessage } from '../src/shared/protocol.ts';
test('trusted staff commands reject supplied coordinates/actors and remain outside the gameplay protocol', () => {
  assert.deepEqual(readStaffCommand({ kind: 'mode', mode: 'survival' }), {
    kind: 'mode',
    mode: 'survival',
  });
  assert.deepEqual(readStaffCommand({ kind: 'teleport', target: 'spawn' }), {
    kind: 'teleport',
    target: 'spawn',
  });
  for (const value of [
    { kind: 'teleport', target: 'a', position: [1, 2, 3] },
    { kind: 'mode', mode: 'survival', actor: 'teacher' },
    { kind: 'mode', mode: 'admin' },
    { kind: 'teleport', target: '' },
  ])
    assert.equal(readStaffCommand(value), null);
  for (const type of ['staff', 'mode', 'teleport', 'rules'])
    assert.equal(
      parseClientMessage(JSON.stringify({ type, command: { kind: 'mode', mode: 'creative' } })),
      null,
    );
});
test('mode rule updates carry a strict new epoch and never accept extra authority fields', () => {
  const value = { type: 'rules', epoch: 4, mode: 'survival', combat: true, explosives: true };
  assert.deepEqual(parseServerMessage(JSON.stringify(value)), value);
  for (const extra of [{ epoch: 0 }, { mode: 'admin' }, { combat: 1 }, { actor: 'forged' }])
    assert.equal(parseServerMessage(JSON.stringify({ ...value, ...extra })), null);
});
