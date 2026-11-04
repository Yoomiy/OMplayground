import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readVoiceToken } from '../src/shared/media.ts';

test('direct voice credentials accept LiveKit URLs and validate microphone/observer grants', () => {
  const value = {
    token: 'header.payload.signature',
    serverUrl: 'wss://media.example',
    publish: true,
    hidden: false,
  };
  assert(readVoiceToken(value));
  assert(readVoiceToken({ ...value, publish: false, hidden: true }));
  assert.equal(readVoiceToken({ ...value, hidden: true }), null);
  assert.equal(readVoiceToken({ ...value, token: 'opaque-ticket' }), null);
  assert.equal(readVoiceToken({ ...value, token: 'x'.repeat(17000) }), null);
  for (const serverUrl of [
    'invalid',
    'https://user:password@media.example',
    'http://media.example',
    'wss://media.example?token=secret',
    'javascript:alert(1)',
  ])
    assert.equal(readVoiceToken({ ...value, serverUrl }), null);
  assert(readVoiceToken({ ...value, serverUrl: 'ws://127.0.0.1:7880' }));
  assert.equal(readVoiceToken({ ...value, ticket: 'legacy' }), null);
});
