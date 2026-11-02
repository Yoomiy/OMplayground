import assert from 'node:assert/strict';
import { test } from 'node:test';
import { runtimeDiagnostic } from '../src/shared/diagnostics.ts';

test('runtime diagnostics preserve known causes and fatality without exporting arbitrary exception text', () => {
  assert.deepEqual(runtimeDiagnostic('input acknowledgement stalled', true), {
    code: 'RUNTIME_FAILURE',
    reason: 'input_acknowledgement_stalled',
    fatal: true,
  });
  assert.equal(
    runtimeDiagnostic(new DOMException('private browser message', 'NotAllowedError')).code,
    'BROWSER_NOT_ALLOWED',
  );
  assert.equal(
    runtimeDiagnostic(new DOMException('private browser message', 'AbortError')).reason,
    'browser_aborted',
  );
  assert.deepEqual(
    runtimeDiagnostic(Object.assign(new Error('provider secret'), { code: 'UNAVAILABLE' })),
    {
      code: 'UNAVAILABLE',
      reason: 'api_unavailable',
      fatal: false,
    },
  );
  for (const error of [
    new Error('https://secret.invalid?token=credential'),
    'private text',
    { name: 'secret', code: 'secret' },
    '__proto__',
  ]) {
    assert.deepEqual(runtimeDiagnostic(error), {
      code: 'RUNTIME_FAILURE',
      reason: 'unknown',
      fatal: false,
    });
  }
});

test('server failure summaries expose machine codes without provider exception messages or stacks', async () => {
  const { failureDetails } = await import('../src/server/failure.ts');
  assert.deepEqual(
    failureDetails(Object.assign(new Error('token=private'), { providerCode: 'PGRST202' })),
    { failureType: 'Error', failureCode: 'PGRST202' },
  );
  assert.deepEqual(failureDetails(Object.assign(new Error('private'), { code: 'ETIMEDOUT' })), {
    failureType: 'Error',
    failureCode: 'ETIMEDOUT',
  });
  assert.deepEqual(failureDetails(Object.assign(new Error('private'), { code: 'private-token' })), {
    failureType: 'Error',
  });
  assert.deepEqual(failureDetails({ name: 'private', code: 'private' }), {
    failureType: 'unknown',
  });
});
