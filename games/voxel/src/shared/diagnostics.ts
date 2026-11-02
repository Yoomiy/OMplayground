/** Only fixed categories cross the telemetry boundary; raw exceptions stay local. */
export const DIAGNOSTIC_REASONS = [
  'unknown',
  'input_acknowledgement_stalled',
  'incompatible_client_build',
  'invalid_server_control_message',
  'invalid_world_frame',
  'connection_failed',
  'invalid_owned_stack',
  'invalid_drop_stack',
  'invalid_public_appearance',
  'unknown_explosive_state',
  'browser_not_allowed',
  'browser_aborted',
  'browser_unsupported',
  'security_restriction',
  'invalid_state',
  'api_unavailable',
  'api_unauthorized',
  'api_protocol',
  'session_ended',
] as const;
export type DiagnosticReason = (typeof DIAGNOSTIC_REASONS)[number];
export type DiagnosticDetail = Readonly<{ reason: DiagnosticReason; fatal: boolean }>;
export function runtimeDiagnostic(error: unknown, fatal = false) {
  let reason: DiagnosticReason = 'unknown';
  let code = 'RUNTIME_FAILURE';
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  const messages: Readonly<Record<string, DiagnosticReason>> = {
    'input acknowledgement stalled': 'input_acknowledgement_stalled',
    'incompatible client build': 'incompatible_client_build',
    'invalid server control message': 'invalid_server_control_message',
    'invalid world frame': 'invalid_world_frame',
    'connection failed': 'connection_failed',
    'invalid owned stack': 'invalid_owned_stack',
    'invalid drop stack': 'invalid_drop_stack',
    'invalid public appearance': 'invalid_public_appearance',
    'unknown explosive state': 'unknown_explosive_state',
  };
  if (Object.hasOwn(messages, message)) reason = messages[message]!;
  if (error instanceof Error) {
    const names: Readonly<Record<string, DiagnosticReason>> = {
      NotAllowedError: 'browser_not_allowed',
      AbortError: 'browser_aborted',
      NotSupportedError: 'browser_unsupported',
      SecurityError: 'security_restriction',
      InvalidStateError: 'invalid_state',
    };
    if (Object.hasOwn(names, error.name)) reason = names[error.name]!;
    const apiCode = (error as Error & { code?: unknown }).code;
    if (apiCode === 'UNAVAILABLE') {
      code = 'UNAVAILABLE';
      reason = 'api_unavailable';
    }
    if (apiCode === 'UNAUTHORIZED') {
      code = 'UNAUTHORIZED';
      reason = 'api_unauthorized';
    }
    if (apiCode === 'PROTOCOL') {
      code = 'PROTOCOL';
      reason = 'api_protocol';
    }
    if (apiCode === 'SESSION_ENDED') {
      code = 'SESSION_ENDED';
      reason = 'session_ended';
    }
  }
  if (reason === 'browser_not_allowed') code = 'BROWSER_NOT_ALLOWED';
  if (reason === 'browser_aborted') code = 'BROWSER_ABORTED';
  return { code, reason, fatal };
}
