import test from 'node:test';
import assert from 'node:assert/strict';
import { PlatformGateway as RocketGateway } from '../games/rocket-arena/server/src/platform/gateway.js';
import { PlatformGateway as WobbleGateway } from '../games/wobble-rush/src/platform/gateway.ts';

for (const [name, Gateway] of [['Rocket', RocketGateway], ['Wobble', WobbleGateway]] as const) {
  test(`${name} sends secret keys only as apikey and preserves the user's bearer token`, async () => {
    const secret = 'sb_secret_test_only';
    const token = 'user-access-token-test-only';
    const requests: string[] = [];
    const request = (async (input, init) => {
      const url = String(input);
      requests.push(url);
      const headers = new Headers(init?.headers);
      assert.equal(headers.get('apikey'), secret);
      if (url.endsWith('/auth/v1/user')) {
        assert.equal(headers.get('Authorization'), `Bearer ${token}`);
        return new Response(JSON.stringify({ id: 'user-1' }));
      }
      assert.equal(headers.has('Authorization'), false);
      return new Response(JSON.stringify([{ id: 'user-1', role: 'kid', gender: 'boy', grade: '3', full_name: 'Test', is_active: true }]));
    }) as typeof fetch;
    const gateway = new Gateway('https://fixture.invalid', secret, request);
    assert.equal((await gateway.authenticate(token)).userId, 'user-1');
    assert.equal(requests.length, 2);
    assert.ok(requests.every(url => !url.includes(secret) && !url.includes(token)));
  });
}
