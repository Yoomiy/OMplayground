import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BalloonPopSolo } from "@/games-solo/BalloonPopSolo";
import { AlgesEscapadeSolo } from "@/games-solo/AlgesEscapadeSolo";
import { DrawingSolo } from "@/games-solo/DrawingSolo";
import { HexGLSolo } from "@/games-solo/HexGLSolo";
import { SimonSolo } from "@/games-solo/SimonSolo";
import { SnakeSolo } from "@/games-solo/SnakeSolo";
import { WhackAMoleSolo } from "@/games-solo/WhackAMoleSolo";
import { useAuth } from "@/hooks/useAuth";
import {
  deleteSoloGameSave,
  getSoloGameSave,
  mergeBestScores as mergeStoredBestScores,
  upsertSoloGameSave,
  type JsonValue,
  type SoloGameSave,
  type SoloGameSaveControls
} from "@/lib/soloGameSaves";

/**
 * Solo games are pure client-side React components. They do NOT go through
 * the multiplayer socket server, do NOT create a `game_sessions` row, and do
 * NOT implement `GameModule`. Each entry renders standalone; the container
 * only provides a back-to-home chrome and routes by `:gameKey`.
 *
 * New solo games: add a `<gameKey>: () => <Component />` entry below.
 */
const SOLO_REGISTRY: Record<string, (save: SoloGameSaveControls) => ReactNode> = {
  drawing: (save) => <DrawingSolo save={save} />,
  snake: (save) => <SnakeSolo save={save} />,
  simon: (save) => <SimonSolo save={save} />,
  whackamole: (save) => <WhackAMoleSolo save={save} />,
  balloonpop: (save) => <BalloonPopSolo save={save} />,
  "alges-escapade": (save) => <AlgesEscapadeSolo save={save} />,
  hexgl: (save) => <HexGLSolo save={save} />
};

export default function SoloGameContainer() {
  const { gameKey } = useParams<{ gameKey: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const entry = gameKey ? SOLO_REGISTRY[gameKey] : undefined;
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
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => navigate("/home")}
        >
          חזרה הביתה
        </Button>
      </header>
      {err ? (
        <p
          className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          role="alert"
        >
          {err}
        </p>
      ) : null}
      {loadingSave ? (
        <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600">
          טוען שמירה…
        </p>
      ) : save && !hasStarted ? (
        <section className="mx-auto flex max-w-md flex-col gap-4 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-right shadow-play">
          <div className="space-y-1">
            <h1 className="text-xl font-bold text-amber-950">נמצא משחק שמור</h1>
            <p className="text-sm font-medium text-amber-900/80">
              אפשר להמשיך מהמקום שבו עצרת או להתחיל משחק חדש.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              onClick={() => {
                setResumeState(save.state);
                setUseSavedState(true);
                setHasStarted(true);
              }}
            >
              המשך
            </Button>
            <Button type="button" variant="outline" onClick={() => void startNewGame()}>
              משחק חדש
            </Button>
          </div>
        </section>
      ) : entry ? (
        entry(saveControls)
      ) : (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="alert">
          משחק לא זמין: {gameKey ?? "?"}
        </p>
      )}
    </div>
  );
}
