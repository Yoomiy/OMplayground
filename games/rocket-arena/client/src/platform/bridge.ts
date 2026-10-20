import { mountRocketClient, type RocketClient } from '../client.js';
import { getRoom } from '../networking/client.js';
import type { PlatformReservation } from './protocol.js';

/** Only a configured app origin and the embedding parent may launch/control. */
export async function startEmbeddedClient(app: HTMLElement): Promise<void> {
  const params = new URLSearchParams(window.location.search);
  const parentOrigin = params.get('parentOrigin');
  const bridgeId = params.get('bridgeId');
  const sessionId = params.get('sessionId');
  if (window.parent === window || !parentOrigin || !bridgeId || bridgeId.length > 80
    || !sessionId || !/^[0-9a-f-]{36}$/i.test(sessionId)) throw new Error('Invalid app frame');
  const response = await fetch('/api/rocket/config', { cache: 'no-store' });
  const config = await response.json() as { protocol?: number; appOrigins?: unknown[] };
  if (!response.ok || config.protocol !== 1 || !config.appOrigins?.includes(parentOrigin)) throw new Error('App origin is not allowed');
  let client: RocketClient | null = null;
  let closed = false;
  let launching = false;
  let readyTimer: ReturnType<typeof setInterval> | undefined;
  let warmFrame: number | null = null;
  const post = (kind: string, extra: Record<string, unknown> = {}) => {
    if (!closed) window.parent.postMessage({ source: 'rocket-frame', version: 1, bridgeId, kind, ...extra }, parentOrigin);
  };
  const events = new AbortController();
  const dispose = () => {
    closed = true; clearInterval(readyTimer); events.abort(); client?.dispose(); client = null;
    if (warmFrame !== null) cancelAnimationFrame(warmFrame);
  };
  window.addEventListener('pagehide', event => { if (!event.persisted) dispose(); }, { signal: events.signal });
  window.addEventListener('message', event => {
    if (closed || event.source !== window.parent || event.origin !== parentOrigin) return;
    const message = event.data;
    if (!message || message.source !== 'playground-app' || message.version !== 1 || message.bridgeId !== bridgeId) return;
    if (message.kind === 'dispose') { dispose(); return; }
    if (message.kind === 'control') {
      if (['start', 'pause', 'resume', 'end', 'remove', 'bots', 'team', 'assign-pending', 'rematch', 'rematch-response'].includes(message.action)) {
        getRoom()?.send('platform-control', { action: message.action,
          ...(typeof message.accept === 'boolean' ? { accept: message.accept } : {}),
          ...(typeof message.userId === 'string' ? { userId: message.userId } : {}),
          ...(Number.isInteger(message.count) ? { count: message.count } : {}),
          ...(typeof message.actorId === 'string' || message.actorId === null ? { actorId: message.actorId } : {}),
          ...(['blue', 'orange'].includes(message.team) ? { team: message.team } : {}) });
      }
      return;
    }
    if (message.kind !== 'launch' || launching || message.sessionId !== sessionId
      || !message.reservation || typeof message.reservation.room?.roomId !== 'string'
      || typeof message.reservation.sessionId !== 'string') return;
    clearInterval(readyTimer);
    launching = true;
    client?.connectPlatform(message.reservation as PlatformReservation);
  }, { signal: events.signal });
  try {
    // Finish the expensive initialization BEFORE asking for a short-lived seat.
    client = mountRocketClient(app, {
      sessionId,
      onState: state => { launching = false; post('state', { state }); },
      onRematch: join => post('rematch', { join }),
      onExit: () => post('exit'),
      onError: code => { launching = false; post('error', { code }); },
      onDisconnect: () => { launching = false; post('disconnected'); },
    });
    await new Promise<void>(resolve => {
      warmFrame = requestAnimationFrame(() => {
        warmFrame = requestAnimationFrame(() => { warmFrame = null; resolve(); });
      });
    });
    if (closed) return;
    readyTimer = setInterval(() => post('ready'), 500);
    post('ready');
  } catch {
    post('error', { code: 'CLIENT_START_FAILED' });
    dispose();
  }
}
