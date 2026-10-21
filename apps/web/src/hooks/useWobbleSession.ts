import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { getCorrelationId } from '@/utils/correlation';
import { isWobbleConfig, isWobbleView, wobbleError, wobbleServiceUrl, type WobbleConfig, type WobbleControl, type WobbleView } from '@/lib/wobbleProtocol';

const terminalCodes = new Set(['SESSION_COMPLETED', 'REMOVED_FROM_ROOM', 'RECESS_DENIED', 'PROFILE_DISABLED', 'GENDER_MISMATCH', 'REPLACEMENT_TAB', 'NOT_IN_ROSTER']);

export function useWobbleSession(sessionId: string, backHref: string) {
  const frame = useRef<HTMLIFrameElement>(null);
  const readyBridge = useRef<string | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invitationCode = params.get('invite') ?? undefined;
  const participation = params.get('mode') === 'player' ? 'player' : 'observer';
  const [config, setConfig] = useState<WobbleConfig | null>(null);
  const [view, setView] = useState<WobbleView | null>(null);
  const [ended, setEnded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState('טוען משחק…');
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const service = useMemo(() => {
    try { return { url: wobbleServiceUrl(import.meta.env.VITE_WOBBLE_SERVICE_URL, import.meta.env.DEV), error: null }; }
    catch (err) { return { url: null, error: err instanceof Error ? err.message : 'כתובת שרת המשחק אינה תקינה' }; }
  }, []);
  const bridgeId = useMemo(() => crypto.randomUUID(), [sessionId, retry]);
  const src = useMemo(() => {
    if (!service.url) return undefined;
    const url = new URL('/', service.url);
    url.search = new URLSearchParams({ parentOrigin: window.location.origin, bridgeId, sessionId }).toString();
    return url.href;
  }, [service.url, bridgeId, sessionId]);

  useEffect(() => {
    if (!service.url) return;
    const frameWindow = frame.current?.contentWindow;
    const abort = new AbortController();
    let cancelled = false;
    let inFlight = false;
    let started = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectBegan = 0;
    let terminal = false;
    setView(null); setEnded(false); setError(null); setStatus('טוען משחק…');
    const finish = (code: string) => {
      terminal = true;
      reconnectBegan = 0;
      clearTimeout(retryTimer);
      abort.abort();
      setView(previous => previous ? { ...previous, ended: true, paused: false, pending: false, canControl: false, canManageSession: false, canRemovePlayers: false } : null);
      setStatus('');
      if (code === 'SESSION_COMPLETED') { setEnded(true); setError(null); }
      else setError(wobbleError(code));
    };
    const post = (message: Record<string, unknown>) => {
      // React StrictMode can clean up while the iframe is still about:blank.
      if (started) frameWindow?.postMessage({
        source: 'playground-app', version: 1, bridgeId, sessionId, ...message,
      }, service.url!);
    };

    const launch = async () => {
      if (cancelled || inFlight || terminal) return;
      inFlight = true;
      try {
        const config = await fetch(`${service.url}/api/wobble/config`, { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]), cache: 'no-store' });
        if (!config.ok) throw new Error('SERVICE_UNAVAILABLE');
        const settings = await config.json();
        if (!isWobbleConfig(settings)) throw new Error('SERVICE_OUTDATED');
        if (cancelled || terminal) return;
        setConfig(settings);
        const { data } = await supabase.auth.getSession();
        if (cancelled || terminal) return;
        if (!data.session?.access_token) throw new Error('UNAUTHORIZED');
        const response = await fetch(`${service.url}/api/wobble/launch`, {
          method: 'POST', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]),
          headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', 'X-Correlation-ID': getCorrelationId() },
          body: JSON.stringify({ sessionId, invitationCode, participation }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(typeof result.code === 'string' ? result.code : 'CONNECTION_FAILED');
        if (cancelled || terminal) return;
        if (result.version !== 1 || result.sessionId !== sessionId || typeof result.ticket !== 'string' || result.ticket.length > 2048) throw new Error('BAD_LAUNCH');
        setStatus(reconnectBegan ? 'מתחבר מחדש…' : 'מצטרף לחדר…');
        post({ kind: 'launch', sessionId, ticket: result.ticket });
      } catch (err) {
        if (cancelled || terminal) return;
        const code = err instanceof Error && err.name === 'TimeoutError' ? 'SERVICE_UNAVAILABLE' : err instanceof Error ? err.message : 'CONNECTION_FAILED';
        if (terminalCodes.has(code)) { finish(code); return; }
        if (reconnectBegan && Date.now() - reconnectBegan < 90_000
          && ['CONNECTION_FAILED', 'SESSION_RECOVERING', 'PLATFORM_UNAVAILABLE', 'SERVICE_UNAVAILABLE', 'Failed to fetch', 'fetch failed'].includes(code)) {
          retryTimer = setTimeout(() => void launch(), 1500);
        } else setError(wobbleError(code));
      } finally { inFlight = false; }
    };
    const receive = (event: MessageEvent) => {
      if (terminal || event.source !== frameWindow || event.origin !== service.url) return;
      const message = event.data;
      if (!message || message.source !== 'wobble-frame' || message.version !== 1 || message.bridgeId !== bridgeId || message.sessionId !== sessionId) return;
      if (message.kind === 'ready' && !started) { started = true; readyBridge.current = bridgeId; void launch(); }
      if (message.kind === 'state' && isWobbleView(message.state, sessionId)) {
        reconnectBegan = 0; setError(null); setView(message.state); setStatus('');
        if (message.state.ended) finish('SESSION_COMPLETED');
      }
      if (message.kind === 'exit') navigate(backHref);
      if (message.kind === 'error' && typeof message.code === 'string') {
        if (terminalCodes.has(message.code)) { finish(message.code); return; }
        if (message.code === 'SESSION_SAVED') { setStatus(wobbleError(message.code)); setError(null); }
        else setError(wobbleError(message.code));
      }
      if (message.kind === 'disconnected' && !terminal) {
        reconnectBegan ||= Date.now(); setStatus('החיבור נקטע. מתחבר מחדש…');
        retryTimer = setTimeout(() => void launch(), 1000);
      }
    };
    window.addEventListener('message', receive);
    const loadTimeout = setTimeout(() => { if (!started && !cancelled && !terminal) setError('טעינת המשחק ארכה יותר מדי. אפשר לנסות שוב.'); }, 60_000);
    return () => {
      cancelled = true; abort.abort(); clearTimeout(retryTimer); clearTimeout(loadTimeout);
      post({ kind: 'dispose' }); window.removeEventListener('message', receive);
      if (readyBridge.current === bridgeId) readyBridge.current = null;
    };
  }, [sessionId, invitationCode, participation, service.url, bridgeId, navigate, backHref]);

  const post = useCallback((message: Record<string, unknown>) => {
    if (service.url && readyBridge.current === bridgeId) frame.current?.contentWindow?.postMessage({ source: 'playground-app', version: 1, bridgeId, sessionId, ...message }, service.url);
  }, [service.url, bridgeId, sessionId]);
  const control = (control: WobbleControl) => post({ kind: 'control', control });
  const copyInvite = async () => {
    const { data } = await supabase.from('game_sessions').select('invitation_code').eq('id', sessionId).maybeSingle();
    if (data?.invitation_code) {
      try { await navigator.clipboard.writeText(`${window.location.origin}/join/${data.invitation_code}`); setCopied(true); }
      catch { setError('לא ניתן להעתיק את ההזמנה. אפשר לשתף אותה מדף הבית.'); }
    }
  };

  const requestSocial = useCallback(async (kind: 'chat' | 'voice', message?: string) => {
    if (!service.url) throw new Error('כתובת שרת המשחק עדיין לא הוגדרה');
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error('יש להתחבר מחדש');
    const response = await fetch(`${service.url}/api/wobble/${kind}`, {
      method: 'POST', signal: AbortSignal.timeout(10_000),
      headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', 'X-Correlation-ID': getCorrelationId() },
      body: JSON.stringify({ sessionId, ...(message !== undefined ? { message } : {}) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(wobbleError(result.code));
    return result as { token?: string; serverUrl?: string };
  }, [sessionId, service.url]);
  const voiceRequest = useMemo<{ pending: Promise<{ token: string; serverUrl: string }> | null }>(() => ({ pending: null }), [requestSocial]);
  const requestVoiceToken = useCallback(() => {
    if (voiceRequest.pending) return voiceRequest.pending;
    const pending = requestSocial('voice').then(result => {
      if (typeof result.token !== 'string' || typeof result.serverUrl !== 'string') throw new Error('לא ניתן להתחבר לצ׳אט הקולי');
      return { token: result.token, serverUrl: result.serverUrl };
    });
    voiceRequest.pending = pending;
    void pending.finally(() => { if (voiceRequest.pending === pending) voiceRequest.pending = null; }).catch(() => {});
    return pending;
  }, [requestSocial, voiceRequest]);
  const sendChat = useCallback(async (message: string) => { await requestSocial('chat', message); }, [requestSocial]);
  return { frame, bridgeId, src, view, ended, config, post, error: error ?? service.error, status, copied, control, copyInvite,
    retry: () => setRetry(value => value + 1), requestVoiceToken, sendChat };
}
