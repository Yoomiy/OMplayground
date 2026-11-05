import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { connectProbe } from '../fixtures/socket-probe.ts';
import { developmentAdmission } from '../../tools/development-admission.ts';
const { createGateway }: typeof import('../../src/server/gateway.ts') = process.env.VOXEL_TEST_BUNDLE
  ? await import(new URL('../../dist-server/gateway.js', import.meta.url).href)
  : await import('../../src/server/gateway.ts');
const build = JSON.parse(
  readFileSync(new URL('../../artifacts/build.json', import.meta.url), 'utf8'),
);
const content = JSON.parse(
  readFileSync(new URL('../../artifacts/content.json', import.meta.url), 'utf8'),
);

test('chat invalidation reaches connected room peers without message contents or cross-room delivery', async () => {
  const gateway = await createGateway({
    build,
    content,
    admit: async (req) =>
      developmentAdmission({
        id: String(req.headers['x-test-actor']),
        role: 'participant',
        capabilities: { build: true, fly: true, observe: false, combat: true, explosives: true },
      }),
    api: {
      '/api/voxel/test-chat-commit': async (_req, _body, _res, context) => {
        context!.chatChanged('chat-room');
        return { ok: true };
      },
    },
  });
  assert.ok(gateway.address && typeof gateway.address === 'object');
  const origin = `http://127.0.0.1:${gateway.address.port}`;
  const probes = [];
  try {
    for (const [room, actor] of [
      ['chat-room', 'a'],
      ['chat-room', 'b'],
      ['other-room', 'c'],
    ])
      probes.push(await connectProbe(origin, room, content.blocks.length, actor));
    const response = await fetch(origin + '/api/voxel/test-chat-commit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    assert.equal(response.status, 200);
    for (const probe of probes.slice(0, 2))
      assert.deepEqual(await probe.event('chat_changed'), { type: 'chat_changed' });
    // Wait for a later worker snapshot on the other room, beyond the notification turn.
    await probes[2].ready();
    assert.equal(
      probes[2].events.some((e) => 'type' in e && e.type === 'chat_changed'),
      false,
    );
  } finally {
    for (const probe of probes) probe.socket.terminate();
    await gateway.close();
  }
});
