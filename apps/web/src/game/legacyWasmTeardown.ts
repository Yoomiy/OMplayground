export const LEGACY_WASM_GAME_KEYS = new Set([
  "supertux-classic",
  "ball2box",
  "get-that-bit",
  "chromavescence",
  "octogone",
  "all-colors-in-control",
  "connect-the-dots",
  "gravvity"
]);

const DEFAULT_ACK_TIMEOUT_MS = 200;
const DEFAULT_BLANK_TIMEOUT_MS = 300;

type CleanupStage = "acknowledged" | "timed-out" | "failed" | "not-requested";
type FallbackStage = "blank-loaded" | "blank-requested" | "blank-timed-out" | "blank-failed" | "not-needed";

export type LegacyWasmTeardownResult = {
  acknowledgment: CleanupStage;
  fallback: FallbackStage;
  error?: unknown;
};

export function createLegacyWasmExitGuard() {
  let started = false;
  return {
    tryStart() {
      if (started) return false;
      started = true;
      return true;
    }
  };
}

type MessageListener = (event: MessageEvent) => void;

export type LegacyWasmMessageHost = {
  addEventListener(type: "message", listener: MessageListener): void;
  removeEventListener(type: "message", listener: MessageListener): void;
};

export type LegacyWasmIframe = {
  contentWindow: Pick<Window, "postMessage"> | null;
  src: string;
  addEventListener(type: "load", listener: () => void): void;
  removeEventListener(type: "load", listener: () => void): void;
};

type TeardownOptions = {
  messageHost?: LegacyWasmMessageHost;
  origin?: string;
  acknowledgmentTimeoutMs?: number;
  blankTimeoutMs?: number;
};

function waitForAcknowledgment(
  iframe: LegacyWasmIframe,
  gameKey: string,
  messageHost: LegacyWasmMessageHost,
  origin: string,
  timeoutMs: number
): Promise<{ acknowledgment: "acknowledged" | "timed-out" | "failed"; error?: unknown }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (outcome: "acknowledged" | "timed-out" | "failed") => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      messageHost.removeEventListener("message", onMessage);
      resolve({ acknowledgment: outcome });
    };
    const onMessage: MessageListener = (event) => {
      const data = event.data as { source?: string; gameKey?: string; type?: string } | null;
      if (
        event.origin === origin &&
        event.source === iframe.contentWindow &&
        data?.source === "playground-legacy-game" &&
        data.gameKey === gameKey &&
        data.type === "teardown-complete"
      ) {
        finish("acknowledged");
      }
    };
    const timeout = setTimeout(() => finish("timed-out"), timeoutMs);
    messageHost.addEventListener("message", onMessage);
    try {
      iframe.contentWindow?.postMessage(
        { source: "playground-board", gameKey, type: "teardown" },
        origin
      );
    } catch (error) {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      messageHost.removeEventListener("message", onMessage);
      resolve({ acknowledgment: "failed", error });
    }
  });
}

function blankIframe(
  iframe: LegacyWasmIframe,
  timeoutMs: number
): Promise<{ fallback: FallbackStage; error?: unknown }> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (fallback: FallbackStage, error?: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      iframe.removeEventListener("load", onLoad);
      resolve({ fallback, error });
    };
    const onLoad = () => finish("blank-loaded");
    const timeout = setTimeout(() => finish("blank-timed-out"), timeoutMs);
    iframe.addEventListener("load", onLoad);
    try {
      iframe.src = "about:blank";
    } catch (error) {
      finish("blank-failed", error);
    }
  });
}

export async function teardownLegacyWasmIframe(
  iframe: LegacyWasmIframe | null,
  gameKey: string,
  options: TeardownOptions = {}
): Promise<LegacyWasmTeardownResult> {
  if (!iframe?.contentWindow) {
    return { acknowledgment: "not-requested", fallback: "not-needed" };
  }

  const messageHost = options.messageHost ?? window;
  const origin = options.origin ?? window.location.origin;
  const acknowledgmentResult = await waitForAcknowledgment(
    iframe,
    gameKey,
    messageHost,
    origin,
    options.acknowledgmentTimeoutMs ?? DEFAULT_ACK_TIMEOUT_MS
  );
  const blankResult = await blankIframe(
    iframe,
    options.blankTimeoutMs ?? DEFAULT_BLANK_TIMEOUT_MS
  );
  return {
    acknowledgment: acknowledgmentResult.acknowledgment,
    fallback: blankResult.fallback,
    ...(acknowledgmentResult.error || blankResult.error
      ? { error: acknowledgmentResult.error ?? blankResult.error }
      : {})
  };
}

export function teardownLegacyWasmIframeSync(
  iframe: LegacyWasmIframe | null,
  gameKey: string,
  origin = window.location.origin
): LegacyWasmTeardownResult {
  if (!iframe?.contentWindow) {
    return { acknowledgment: "not-requested", fallback: "not-needed" };
  }

  let error: unknown;
  try {
    iframe.contentWindow.postMessage(
      { source: "playground-board", gameKey, type: "teardown" },
      origin
    );
  } catch (postError) {
    error = postError;
  }
  try {
    iframe.src = "about:blank";
  } catch (blankError) {
    error ??= blankError;
    return { acknowledgment: error ? "failed" : "not-requested", fallback: "blank-failed", error };
  }
  return {
    acknowledgment: error ? "failed" : "not-requested",
    fallback: "blank-requested",
    ...(error ? { error } : {})
  };
}
