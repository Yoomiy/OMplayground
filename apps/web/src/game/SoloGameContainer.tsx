import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
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

type SoloGameComponent = (props: { save: SoloGameSaveControls }) => ReactNode;

const SOLO_LOADERS: Record<string, () => Promise<{ default: SoloGameComponent }>> = {
  drawing: () => import("@/games-solo/DrawingSolo").then((m) => ({ default: m.DrawingSolo })),
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
    import("@/games-solo/Ball2BoxSolo").then((m) => ({ default: m.Ball2BoxSolo }))
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
      <div className="flex min-h-[320px] items-center justify-center text-sm font-medium text-white/40">
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
          }
        } catch (e) {
          console.error("Failed to increment game launch stats:", e);
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
    setSave(null);
  }, [gameKey, user?.id]);

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
      saveState,
      clearSave,
      mergeBestScores
    }),
    [clearSave, mergeBestScores, resumeState, saveState, useSavedState]
  );

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
          onClick={() => navigate("/home")}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
        >
          חזרה הביתה
        </button>
      }
      contentClassName="min-h-[calc(100vh-136px)]"
    >
      {err ? (
        <p
          className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300"
          role="alert"
        >
          {err}
        </p>
      ) : null}
      {loadingSave ? (
        <p className={desktopPanelClass("px-4 py-3 text-sm font-bold text-white/50")}>
          טוען שמירה…
        </p>
      ) : save && !hasStarted ? (
        <section className="mx-auto mt-20 flex max-w-md flex-col gap-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-right shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md">
          <div className="space-y-1">
            <h1 className="text-xl font-black text-amber-300">נמצא משחק שמור</h1>
            <p className="text-sm font-semibold text-amber-200/80">
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
              className="rounded-xl border border-white/10 bg-white/5 px-5 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
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
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300" role="alert">
          משחק לא זמין: {gameKey ?? "?"}
        </p>
      )}
    </KidDesktopShell>
  );
}
