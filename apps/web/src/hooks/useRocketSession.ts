import {
  createEmbeddedRecovery,
  EmbeddedGameError,
  type EmbeddedStage,
} from "@/lib/embeddedGameRecovery";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { ChatDeliveryError } from "./useChatOutbox";
import {
  isRocketServiceCompatible,
  isRocketView,
  rocketError,
  rocketServiceUrl,
  type RocketView,
} from "@/lib/rocketProtocol";

export function useRocketSession(sessionId: string, backHref: string) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [mountedAttempt, setMountedAttempt] = useState<string | null>(null);
  const [startupState, setStartupState] = useState<{
    attempt: string;
    stage: EmbeddedStage;
  } | null>(null);
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const invitationCode = params.get("invite") ?? undefined;
  const participation = params.get("mode") === "player" ? "player" : "observer";
  const [view, setView] = useState<RocketView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("טוען משחק…");
  const [retry, setRetry] = useState(0);
  const [copied, setCopied] = useState(false);
  const service = useMemo(() => {
    try {
      return {
        url: rocketServiceUrl(import.meta.env.VITE_ROCKET_SERVICE_URL, import.meta.env.DEV),
        error: null,
      };
    } catch (err) {
      return {
        url: null,
        error: err instanceof Error ? err.message : "כתובת שרת המשחק אינה תקינה",
      };
    }
  }, []);
  const bridgeId = useMemo(() => crypto.randomUUID(), [sessionId, retry]);
  const src = useMemo(() => {
    if (!service.url || mountedAttempt !== bridgeId) return undefined;
    const url = new URL("/", service.url);
    url.search = new URLSearchParams({
      embed: "1",
      lang: "he",
      parentOrigin: window.location.origin,
      bridgeId,
      sessionId,
    }).toString();
    return url.href;
  }, [service.url, bridgeId, sessionId, mountedAttempt]);

  useEffect(() => {
    if (!service.url) return;
    let frameWindow: Window | null = null;
    const abort = new AbortController();
    let cancelled = false;
    let inFlight = false;
    let started = false;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let reconnectBegan = 0;
    let terminal = false;
    let connected = false;
    setView(null);
    setError(null);
    setStatus("טוען משחק…");
    const startup = createEmbeddedRecovery({
      game: "rocket",
      origin: service.url,
      sessionId,
      attemptId: bridgeId,
      signal: abort.signal,
      onStage: (stage) => setStartupState({ attempt: bridgeId, stage }),
      onFailure: (code) => {
        terminal = true;
        clearTimeout(retryTimer);
        setMountedAttempt(null);
        setError(rocketError(code));
        setStatus("");
        abort.abort();
      },
    });
    const post = (message: Record<string, unknown>) => {
      // React StrictMode can clean up while the iframe is still about:blank.
      if (started)
        frameWindow?.postMessage(
          {
            source: "playground-app",
            version: 1,
            bridgeId,
            ...message,
          },
          service.url!,
        );
    };

    const transient = (code: string) =>
      [
        "CONNECTION_FAILED",
        "ALREADY_CONNECTED",
        "PLATFORM_UNAVAILABLE",
        "SERVICE_UNAVAILABLE",
        "SESSION_RECOVERING",
        "ROOM_UNAVAILABLE",
        "SESSION_CHANGED",
        "Failed to fetch",
        "fetch failed",
      ].includes(code);
    const scheduleReconnect = () => {
      reconnectBegan ||= Date.now();
      if (Date.now() - reconnectBegan >= 30_000) return false;
      clearTimeout(retryTimer);
      startup.joining();
      setError(null);
      setStatus("מתחבר מחדש…");
      retryTimer = setTimeout(() => void launch(), 1500);
      return true;
    };
    const launch = async () => {
      if (cancelled || inFlight || terminal) return;
      inFlight = true;
      try {
        if (reconnectBegan) {
          const config = await startup.request("/api/rocket/config", { cache: "no-store" });
          if (!config.ok) throw new EmbeddedGameError("SERVICE_UNAVAILABLE", config.status);
          if (!isRocketServiceCompatible(await config.json()))
            throw new EmbeddedGameError("SERVICE_OUTDATED");
        }
        const { data } = await supabase.auth.getSession();
        if (!data.session?.access_token) throw new Error("UNAUTHORIZED");
        const response = await startup.request("/api/rocket/launch", {
          method: "POST",
          signal: abort.signal,
          headers: {
            Authorization: `Bearer ${data.session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sessionId, invitationCode, participation }),
        });
        const result = await response.json().catch(() => {
          throw new EmbeddedGameError("INVALID_SERVICE_RESPONSE", response.status);
        });
        if (!response.ok)
          throw new EmbeddedGameError(
            typeof result.code === "string" ? result.code : "CONNECTION_FAILED",
            response.status,
          );
        if (cancelled) return;
        if (
          result.version !== 1 ||
          result.sessionId !== sessionId ||
          typeof result.reservation?.room?.roomId !== "string" ||
          typeof result.reservation?.sessionId !== "string"
        )
          throw new Error("BAD_LAUNCH");
        setStatus(reconnectBegan ? "מתחבר מחדש…" : "מצטרף לחדר…");
        post({ kind: "launch", sessionId, reservation: result.reservation });
      } catch (err) {
        if (cancelled) return;
        const code = err instanceof Error ? err.message : "CONNECTION_FAILED";
        if (!(reconnectBegan && transient(code) && scheduleReconnect())) startup.fail(err);
      } finally {
        inFlight = false;
      }
    };
    const receive = (event: MessageEvent) => {
      if (
        cancelled ||
        startup.failed ||
        event.source !== frame.current?.contentWindow ||
        event.origin !== service.url
      )
        return;
      const message = event.data;
      if (
        !message ||
        message.source !== "rocket-frame" ||
        message.version !== 1 ||
        message.bridgeId !== bridgeId
      )
        return;
      if (message.kind === "ready" && !started) {
        frameWindow = frame.current?.contentWindow ?? null;
        started = true;
        startup.joining();
        void launch();
      }
      if (message.kind === "state" && isRocketView(message.state, sessionId)) {
        if (
          message.state.rematchClosed?.reason === "declined" &&
          message.state.rematchClosed.userId === message.state.selfUserId
        ) {
          navigate(backHref, { replace: true });
          return;
        }
        startup.live();
        connected = true;
        reconnectBegan = 0;
        clearTimeout(retryTimer);
        terminal = message.state.phase === "ended";
        setError(null);
        setView(message.state);
        setStatus("");
      }
      if (message.kind === "rematch" && typeof message.join === "boolean") {
        terminal = true;
        clearTimeout(retryTimer);
        if (message.join) setRetry((value) => value + 1);
        else {
          setView((previous) =>
            previous ? { ...previous, canRematch: false, rematch: null } : null,
          );
          setStatus("בחרת לא להצטרף למשחק החוזר.");
        }
      }
      if (message.kind === "exit") navigate(backHref);
      if (message.kind === "error" && typeof message.code === "string") {
        if (!connected && reconnectBegan && transient(message.code) && scheduleReconnect()) return;
        if (!connected) {
          startup.fail(new EmbeddedGameError(message.code));
          return;
        }
        if (["CLIENT_START_FAILED", "GRAPHICS_LOST"].includes(message.code)) {
          startup.fail(new EmbeddedGameError(message.code));
          return;
        }
        startup.report(message.code);
        if (
          [
            "SESSION_SAVED",
            "SAVE_UNCONFIRMED",
            "SESSION_COMPLETED",
            "REMOVED_FROM_ROOM",
            "RECESS_DENIED",
            "PROFILE_DISABLED",
            "GENDER_MISMATCH",
          ].includes(message.code)
        ) {
          terminal = true;
          setView((previous) =>
            previous
              ? {
                  ...previous,
                  phase: "ended",
                  paused: false,
                  pending: false,
                  canControl: false,
                  canRematch: false,
                  rematch: null,
                }
              : null,
          );
          setStatus("");
        }
        if (message.code === "SESSION_SAVED") {
          setStatus(rocketError(message.code));
          setError(null);
        } else setError(rocketError(message.code));
      }
      if (message.kind === "disconnected") {
        connected = false;
        if (terminal) setView((previous) => (previous ? { ...previous, canRematch: false } : null));
        else if (!scheduleReconnect()) startup.fail(new EmbeddedGameError("CONNECTION_FAILED"));
      }
    };
    window.addEventListener("message", receive);
    void startup.prepare(isRocketServiceCompatible).then((settings) => {
      if (settings && !cancelled && !terminal) {
        setMountedAttempt(bridgeId);
      }
    });
    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(retryTimer);
      startup.stop();
      post({ kind: "dispose" });
      window.removeEventListener("message", receive);
    };
  }, [sessionId, invitationCode, participation, service.url, bridgeId, navigate, backHref]);

  const control = (action: string, fields: Record<string, unknown> = {}) => {
    if (service.url)
      frame.current?.contentWindow?.postMessage(
        {
          source: "playground-app",
          version: 1,
          bridgeId,
          kind: "control",
          action,
          requestId: view?.rematch?.id,
          ...fields,
        },
        service.url,
      );
  };
  const copyInvite = async () => {
    const { data } = await supabase
      .from("game_sessions")
      .select("invitation_code")
      .eq("id", sessionId)
      .maybeSingle();
    if (data?.invitation_code) {
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}/join/${data.invitation_code}`,
        );
        setCopied(true);
      } catch {
        setError("לא ניתן להעתיק את ההזמנה. אפשר לשתף אותה מדף הבית.");
      }
    }
  };

  const requestSocial = useCallback(
    async (kind: "chat" | "voice", message?: string, messageId?: string, signal?: AbortSignal) => {
      if (!service.url) throw new Error("כתובת שרת המשחק עדיין לא הוגדרה");
      const { data } = await supabase.auth.getSession();
      if (!data.session?.access_token) throw new Error("יש להתחבר מחדש");
      const response = await fetch(`${service.url}/api/rocket/${kind}`, {
        method: "POST",
        signal: signal
          ? AbortSignal.any([signal, AbortSignal.timeout(10_000)])
          : AbortSignal.timeout(10_000),
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId,
          ...(message !== undefined ? { message, messageId } : {}),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new ChatDeliveryError(
          rocketError(result.code),
          response.status >= 500 || response.status === 429,
        );
      return result as { token?: string; serverUrl?: string };
    },
    [sessionId, service.url],
  );
  const voiceRequest = useMemo<{ pending: Promise<{ token: string; serverUrl: string }> | null }>(
    () => ({ pending: null }),
    [requestSocial],
  );
  const requestVoiceToken = useCallback(() => {
    if (voiceRequest.pending) return voiceRequest.pending;
    const pending = requestSocial("voice").then((result) => {
      if (typeof result.token !== "string" || typeof result.serverUrl !== "string")
        throw new Error("לא ניתן להתחבר לצ׳אט הקולי");
      return { token: result.token, serverUrl: result.serverUrl };
    });
    voiceRequest.pending = pending;
    void pending
      .finally(() => {
        if (voiceRequest.pending === pending) voiceRequest.pending = null;
      })
      .catch(() => {});
    return pending;
  }, [requestSocial, voiceRequest]);
  const sendChat = useCallback(
    async (message: string, messageId?: string, signal?: AbortSignal) => {
      await requestSocial("chat", message, messageId, signal);
    },
    [requestSocial],
  );
  const startupStage = startupState?.attempt === bridgeId ? startupState.stage : "service";
  return {
    frame,
    bridgeId,
    src,
    startupStage,
    frameReady: startupStage === "live",
    view: mountedAttempt === bridgeId ? view : null,
    error: (startupState?.attempt === bridgeId ? error : null) ?? service.error,
    status,
    copied,
    control,
    copyInvite,
    retry: () => setRetry((value) => value + 1),
    requestVoiceToken,
    sendChat,
  };
}
