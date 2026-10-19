export interface PlatformLogger {
  info(fields: Record<string, unknown>): void;
  warn(fields: Record<string, unknown>): void;
  error(fields: Record<string, unknown>): void;
}
let logger: PlatformLogger | undefined;
export function configurePlatformLogger(value: PlatformLogger): void { logger = value; }
export function platformLog(level: keyof PlatformLogger, event: string, fields: Record<string, unknown>): void {
  logger?.[level]({ ...fields, message: event.toLowerCase().replaceAll('_', ' '),
    ...(process.env.NODE_ENV !== 'production' ? { msg: [event, fields.action, fields.code].filter(value => typeof value === 'string').join(' ') } : {}),
    context: { event, status: level === 'info' ? 'success' : 'failed' } });
}
