/** Server exceptions may carry provider URLs and credentials. Export machine categories only. */
export function failureDetails(error: unknown): Record<string, string> {
  const fields = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const name = error instanceof Error ? error.name : '';
  const rawCode = fields.providerCode ?? fields.code;
  const code = typeof rawCode === 'string' || typeof rawCode === 'number' ? String(rawCode) : '';
  const machineCode =
    /^(?:[0-9A-Z]{5}|PGRST[0-9]{3}|[1-5][0-9]{2})$/.test(code) ||
    [
      'UNAVAILABLE',
      'UNAUTHORIZED',
      'SESSION_ENDED',
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'Duplicate',
      'NoSuchBucket',
      'NoSuchKey',
      'ResourceAlreadyExists',
    ].includes(code);
  const category =
    error instanceof Error
      ? (
          {
            'checkpoint object integrity failure': 'checkpoint_integrity',
            'checkpoint object missing': 'checkpoint_missing',
            'invalid checkpoint manifest': 'checkpoint_invalid',
            'invalid room checkpoint': 'checkpoint_invalid',
            'room ownership lost': 'ownership_lost',
          } as Record<string, string>
        )[error.message]
      : undefined;
  return {
    ...(category ? { failureReason: category } : {}),
    ...(name === 'TimeoutError' ? { failureReason: 'provider_timeout' } : {}),
    failureType: ['Error', 'TypeError', 'RangeError', 'TimeoutError', 'AbortError'].includes(name)
      ? name
      : 'unknown',
    ...(machineCode ? { failureCode: code } : {}),
    ...([
      'provider_error',
      'provider_timeout',
      'malformed_reply',
      'read_deadline',
      'clock_invalid',
      'checkpoint_engine_incompatible',
      'checkpoint_content_incompatible',
      'checkpoint_integrity',
      'checkpoint_missing',
      'checkpoint_invalid',
      'ownership_lost',
    ].includes(String(fields.failureReason))
      ? { failureReason: String(fields.failureReason) }
      : {}),
    ...([
      'identity',
      'profile',
      'session',
      'actor_policy',
      'recess',
      'policy',
      'admission',
      'inspection',
      'authorization',
      'session_projection',
    ].includes(String(fields.policyPhase))
      ? { policyPhase: String(fields.policyPhase) }
      : {}),
  };
}
