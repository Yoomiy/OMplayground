import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomUUID } from 'node:crypto';
import { readChatPage, readChatReceipt, validChatText } from '../src/shared/chat.ts';
test('persisted chat codecs reject cross-action receipts, invalid text, unsorted pages and forged cursors', () => {
  const id = randomUUID(),
    senderId = randomUUID(),
    m = {
      id,
      senderId,
      senderName: 'תלמיד',
      message: 'שלום <b>עולם</b>',
      sequence: 2,
      at: new Date().toISOString(),
    };
  assert.deepEqual(readChatPage({ messages: [m], before: 2 }), { messages: [m], before: 2 });
  for (const page of [
    { messages: [m, m], before: null },
    { messages: [m], before: 1 },
    { messages: [m], before: 0 },
    { messages: [{ ...m, message: '\u0000' }], before: null },
    { messages: [{ ...m, sequence: 2 ** 53 }], before: null },
    { messages: [{ ...m, at: 'invalid' }], before: null },
    { messages: [], before: 1 },
  ])
    assert.equal(readChatPage(page), null);
  const receipt = { requestId: id, action: 'send', messageId: id, applied: true, persisted: true };
  assert.deepEqual(readChatReceipt(receipt), receipt);
  for (const v of [
    { ...receipt, messageId: senderId },
    { ...receipt, persisted: false },
    { ...receipt, saved: true },
    { ...receipt, action: 'clear' },
    { ...receipt, action: 'delete', messageId: null },
  ])
    assert.equal(readChatReceipt(v), null);
  assert(validChatText('עברית\nEnglish 🙂'));
  assert(validChatText('🙂'.repeat(500)));
  assert(!validChatText('\ud800'));
  assert(!validChatText('🙂'.repeat(501)));
  assert(!validChatText(' '.repeat(3)));
  assert(!validChatText('a'.repeat(501)));
  assert(!validChatText('bad\u0001'));
});
