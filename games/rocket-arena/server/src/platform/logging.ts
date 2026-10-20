export interface PlatformLogger {
  debug(fields: Record<string, unknown>): void;
  info(fields: Record<string, unknown>): void;
  warn(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
  isLevelEnabled?(level: PlatformLogLevel): boolean;
}
type PlatformLogLevel = 'debug' | 'info' | 'warn' | 'error';
let logger: PlatformLogger | undefined;
export function configurePlatformLogger(value: PlatformLogger): void { logger = value; }
export function isPlatformLogEnabled(level: PlatformLogLevel): boolean {
  return !!logger && (logger.isLevelEnabled?.(level) ?? true);
}
export function platformLog(level: PlatformLogLevel, event: string, fields: Record<string, unknown>): void {
  if (!isPlatformLogEnabled(level)) return;
  logger?.[level]({ ...fields, message: event.toLowerCase().replaceAll('_', ' '),
    ...(process.env.NODE_ENV !== 'production' ? { msg: [event, fields.action, fields.code].filter(value => typeof value === 'string').join(' ') } : {}),
    context: { event, status: level === 'debug' || level === 'info' ? 'success' : 'failed' } });
}
