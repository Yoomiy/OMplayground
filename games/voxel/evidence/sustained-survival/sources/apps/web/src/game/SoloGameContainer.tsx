import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { KidDesktopShell, desktopPanelClass } from "@/components/KidDesktopShell";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import {
  deleteSoloGameSave,
  getSoloGameSave,
  mergeBestScores as mergeStoredBestScores,
  upsertSoloGameSave,
  type JsonValue,
  type SoloGameSave,
  type SoloGameSaveControls
} from "@/lib/soloGameSaves";
import { IndexedDbSoloDrawingDraftStore } from "@/lib/soloDrawingDraftStore";
import {
  LEGACY_WASM_GAME_KEYS,
  createLegacyWasmExitGuard,
  teardownLegacyWasmIframe,
  teardownLegacyWasmIframeSync,
  type LegacyWasmTeardownResult
} from "@/game/legacyWasmTeardown";
import { reportCaughtError, reportTelemetry } from "@/utils/telemetry";

type SoloGameComponent = (props: { save: SoloGameSaveControls }) => ReactNode;

const SOLO_LOADERS: Record<string, () => Promise<{ default: SoloGameComponent }>> = {
  drawing: () => import("@/games-solo/DrawingSolo").then((m) => ({ default: m.DrawingSolo })),
  "drawing-solo": () => import("@/games-solo/DrawingSolo").then((m) => ({ default: m.DrawingSolo })),
  snake: () => import("@/games-solo/SnakeSolo").then((m) => ({ default: m.SnakeSolo })),
  simon: () => import("@/games-solo/SimonSolo").then((m) => ({ default: m.SimonSolo })),
  whackamole: () =>
    import("@/games-solo/WhackAMoleSolo").then((m) => ({ default: m.WhackAMoleSolo })),
  balloonpop: () =>
    import("@/games-solo/BalloonPopSolo").then((m) => ({ default: m.BalloonPopSolo })),
  "alges-escapade": () =>
    import("@/games-solo/AlgesEscapadeSolo").then((m) => ({ default: m.AlgesEscapadeSolo })),
  hexgl: () => import("@/games-solo/HexGLSolo").then((m) => ({ default: m.HexGLSolo })),
  "chess-solo": () => import("@/games-solo/ChessSolo").then((m) => ({ default: m.ChessSolo })),
  breakout: () => import("@/games-solo/BreakoutSolo").then((m) => ({ default: m.BreakoutSolo })),
  "breakout-solo": () =>
    import("@/games-solo/BreakoutSolo").then((m) => ({ default: m.BreakoutSolo })),
  "2048": () =>
    import("@/games-solo/Game2048Solo").then((m) => ({ default: m.Game2048Solo })),
  "supertux-classic": () =>
    import("@/games-solo/SuperTuxClassicSolo").then((m) => ({ default: m.SuperTuxClassicSolo })),
  "ball2box": () =>
    import("@/games-solo/Ball2BoxSolo").then((m) => ({ default: m.Ball2BoxSolo })),
  "get-that-bit": () =>
    import("@/games-solo/GetThatBitSolo").then((m) => ({ default: m.GetThatBitSolo })),
  "chromavescence": () =>
    import("@/games-solo/ChromavescenceSolo").then((m) => ({ default: m.ChromavescenceSolo })),
  "octogone": () =>
    import("@/games-solo/OctogoneSolo").then((m) => ({ default: m.OctogoneSolo })),
  "all-colors-in-control": () =>
    import("@/games-solo/AllColorsInControlSolo").then((m) => ({ default: m.AllColorsInControlSolo })),
  "connect-the-dots": () =>
    import("@/games-solo/ConnectTheDotsSolo").then((m) => ({ default: m.ConnectTheDotsSolo })),
  "gravvity": () =>
    import("@/games-solo/GravvitySolo").then((m) => ({ default: m.GravvitySolo })),
  "pacman-canvas": () =>
    import("@/games-solo/PacmanCanvasSolo").then((m) => ({ default: m.PacmanCanvasSolo }))
};

function LazySoloGame({
  gameKey,
  save
}: {
  gameKey: string;
  save: SoloGameSaveControls;
}) {
  const [Game, setGame] = useState<SoloGameComponent | null>(null);

  useEffect(() => {
    let cancelled = false;
    setGame(null);
    const loader = SOLO_LOADERS[gameKey];
    if (!loader) return;
    void loader().then((mod) => {
      if (!cancelled) setGame(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, [gameKey]);

  if (!Game) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm font-medium text-slate-500 dark:text-white/40">
        טוען משחק…
      </div>
    );
  }
  return <Game save={save} />;
}

export default function SoloGameContainer() {
  const { gameKey } = useParams<{ gameKey: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasEntry = gameKey ? Boolean(SOLO_LOADERS[gameKey]) : false;
  const [save, setSave] = useState<SoloGameSave | null>(null);
  const [loadingSave, setLoadingSave] = useState(true);
  const [useSavedState, setUseSavedState] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [resumeState, setResumeState] = useState<JsonValue | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [isLeaving, setIsLeaving] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const exitGuardRef = useRef(createLegacyWasmExitGuard());
  const drawingDraftStore = useMemo(
    () => user?.id && (gameKey === "drawing" || gameKey === "drawing-solo")
      ? new IndexedDbSoloDrawingDraftStore(`${user.id}:${gameKey}`)
      : undefined,
    [gameKey, user?.id]
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingSave(true);
    setUseSavedState(false);
    setHasStarted(false);
    setResumeState(null);
    setErr(null);
    void getSoloGameSave(user?.id, gameKey)
      .then((row) => {
        if (!cancelled) {
          setSave(row);
          setHasStarted(!row);
        }
      })
      .catch((error: Error) => {
        if (!cancelled) {
          setErr(error.message);
          setSave(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSave(false);
      });
    return () => {
      cancelled = true;
    };
  }, [gameKey, user?.id]);

  useEffect(() => {
    if (hasStarted && gameKey) {
      void (async () => {
        try {
          const { error } = await supabase.rpc("increment_game_launch", { p_game_url: gameKey });
          if (error) {
            console.error("Failed to increment game launch stats:", error);
            reportCaughtError("Solo game launch statistic failed", error, { appArea: "solo-game", operation: "launch-stat" });
          }
        } catch (e) {
          console.error("Failed to increment game launch stats:", e);
          reportCaughtError("Solo game launch statistic failed", e, { appArea: "solo-game", operation: "launch-stat" });
        }
      })();
    }
  }, [hasStarted, gameKey]);

  const saveState = useCallback(
    async (
      state: JsonValue,
      options?: { stateVersion?: number; saveKind?: "snapshot" | "checkpoint" }
    ) => {
      if (!user?.id || !gameKey) return;
      const next = await upsertSoloGameSave({
        kidId: user.id,
        gameKey,
        state,
        stateVersion: options?.stateVersion,
        saveKind: options?.saveKind
      });
      if (next) setSave(next);
    },
    [gameKey, user?.id]
  );

  const clearSave = useCallback(async () => {
    await deleteSoloGameSave(user?.id, gameKey);
    await drawingDraftStore?.clear();
    setSave(null);
  }, [drawingDraftStore, gameKey, user?.id]);

  const mergeBestScores = useCallback(
    async (updates: Record<string, number>, preferLowerKeys?: string[]) => {
      if (!user?.id) return;
      await mergeStoredBestScores(user.id, updates, preferLowerKeys);
    },
    [user?.id]
  );

  const saveControls = useMemo<SoloGameSaveControls>(
    () => ({
      savedState: useSavedState ? resumeState : null,
      drawingDraftStore,
      saveState,
      clearSave,
      mergeBestScores
    }),
    [clearSave, drawingDraftStore, mergeBestScores, resumeState, saveState, useSavedState]
  );

  const findLegacyWasmIframe = useCallback(() => {
    if (!gameKey || !LEGACY_WASM_GAME_KEYS.has(gameKey)) return null;
    const iframe = contentRef.current?.querySelector<HTMLIFrameElement>(
      "iframe[data-playground-wasm-game]"
    );
    return iframe?.dataset.playgroundWasmGame === gameKey ? iframe : null;
  }, [gameKey]);

  const reportCleanupOutcome = useCallback((result: LegacyWasmTeardownResult) => {
    if (!gameKey) return;
    const context = {
      appArea: "solo-game",
      operation: "wasm-teardown",
      gameKey,
      acknowledgment: result.acknowledgment,
      fallbackOutcome: result.fallback
    };
    if (result.error) {
      reportCaughtError("WASM solo game cleanup failed", result.error, context, "game-server", "warn");
    } else if (
      result.acknowledgment === "timed-out" ||
      result.fallback === "blank-timed-out"
    ) {
      reportTelemetry(
        { level: "warn", message: "WASM solo game cleanup timed out", context },
        "game-server"
      );
    }
  }, [gameKey]);

  const exitFullscreenBestEffort = useCallback(() => {
    if (!document.fullscreenElement) return;
    try {
      void document.exitFullscreen().catch((error) => {
        reportCaughtError("WASM solo game fullscreen exit failed", error, {
          appArea: "solo-game",
          operation: "wasm-teardown",
          gameKey,
          fallbackOutcome: "navigation-continues"
        }, "game-server", "warn");
      });
    } catch (error) {
      reportCaughtError("WASM solo game fullscreen exit failed", error, {
        appArea: "solo-game",
        operation: "wasm-teardown",
        gameKey,
        fallbackOutcome: "navigation-continues"
      }, "game-server", "warn");
    }
  }, [gameKey]);

  const handleHome = useCallback(() => {
    if (!exitGuardRef.current.tryStart()) return;
    setIsLeaving(true);
    exitFullscreenBestEffort();
    const iframe = findLegacyWasmIframe();
    void (async () => {
      try {
        reportCleanupOutcome(await teardownLegacyWasmIframe(iframe, gameKey ?? ""));
      } catch (error) {
        reportCaughtError("WASM solo game cleanup failed", error, {
          appArea: "solo-game",
          operation: "wasm-teardown",
          gameKey,
          fallbackOutcome: "navigation-continues"
        }, "game-server", "warn");
      } finally {
        navigate("/home");
      }
    })();
  }, [exitFullscreenBestEffort, findLegacyWasmIframe, gameKey, navigate, reportCleanupOutcome]);

  useEffect(() => {
    exitGuardRef.current = createLegacyWasmExitGuard();
    setIsLeaving(false);
  }, [gameKey]);

  useEffect(() => {
    const mountedContent = contentRef.current;
    const teardownFallback = () => {
      if (!gameKey || !LEGACY_WASM_GAME_KEYS.has(gameKey) || !exitGuardRef.current.tryStart()) return;
      const iframe = mountedContent?.querySelector<HTMLIFrameElement>(
        "iframe[data-playground-wasm-game]"
      );
      const matchingIframe = iframe?.dataset.playgroundWasmGame === gameKey ? iframe : null;
      const result = teardownLegacyWasmIframeSync(matchingIframe, gameKey);
      if (result.error) reportCleanupOutcome(result);
    };
    const onPageHide = () => teardownFallback();
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      // StrictMode replays effects without detaching the DOM. Only a detached
      // content root represents an actual route/component unmount.
      if (!mountedContent?.isConnected) teardownFallback();
    };
  }, [gameKey, reportCleanupOutcome]);

  async function startNewGame() {
    setErr(null);
    try {
      await clearSave();
      setResumeState(null);
      setUseSavedState(false);
      setHasStarted(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : "מחיקת השמירה נכשלה");
    }
  }

  return (
    <KidDesktopShell
      title="משחק לבד"
      subtitle={gameKey ?? "משחק"}
      actions={
        <button
          type="button"
          onClick={handleHome}
          disabled={isLeaving}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-4 py-2 text-xs font-black text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition duration-200"
        >
          חזרה הביתה
        </button>
      }
      contentClassName="min-h-[calc(100vh-136px)]"
    >
      <div ref={contentRef}>
      {err ? (
        <p
          className="mb-4 rounded-xl border border-amber-400/40 dark:border-amber-500/30 bg-amber-500/15 dark:bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300"
          role="alert"
        >
          {err}
        </p>
      ) : null}
      {loadingSave ? (
        <p className={desktopPanelClass("px-4 py-3 text-sm font-bold text-slate-600 dark:text-white/50")}>
          טוען שמירה…
        </p>
      ) : save && !hasStarted ? (
        <section className="mx-auto mt-20 flex max-w-md flex-col gap-4 rounded-2xl border border-amber-300 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 p-5 text-right shadow-xl dark:shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-amber-900 dark:text-amber-300">נמצא משחק שמור</h1>
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-200/80">
              אפשר להמשיך מהמקום שבו עצרת או להתחיל משחק חדש.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setResumeState(save.state);
                setUseSavedState(true);
                setHasStarted(true);
              }}
              className="rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-5 py-2 text-sm font-black text-white hover:shadow-[0_0_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200"
            >
              המשך
            </button>
            <button
              type="button"
              onClick={() => void startNewGame()}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-5 py-2 text-sm font-bold text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition duration-200"
            >
              משחק חדש
            </button>
          </div>
        </section>
      ) : hasEntry && gameKey ? (
        <section className={desktopPanelClass("min-h-[620px] p-4")}>
          <div className="mx-auto max-w-6xl">
            <LazySoloGame gameKey={gameKey} save={saveControls} />
          </div>
        </section>
      ) : (
        <p className="rounded-xl border border-amber-400/40 dark:border-amber-500/30 bg-amber-500/15 dark:bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300" role="alert">
          משחק לא זמין: {gameKey ?? "?"}
        </p>
      )}
      </div>
    </KidDesktopShell>
  );
}
