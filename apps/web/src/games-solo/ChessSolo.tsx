import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useSoloAutoSave } from "@/hooks/useSoloAutoSave";
import { isJsonObject, type JsonValue, type SoloGameSaveControls } from "@/lib/soloGameSaves";
import { ChessBoard } from "@/games/ChessBoard";
import { useStockfishEngine, DIFFICULTY_LEVELS } from "@/games/chess/useStockfishEngine";
import {
  initialChessState,
  applyChessIntent,
  randomLegalMove,
  type ChessState,
  type ChessIntent,
  type ChessTimeControl
} from "@playground/game-logic";

interface ChessSoloSavedState {
  chessState: ChessState;
  humanSeat: "w" | "b";
  difficulty: number;
}

function loadSavedState(saved: JsonValue | null): ChessSoloSavedState | null {
  if (!isJsonObject(saved)) return null;
  const o = saved as any;
  if (!o.chessState || typeof o.humanSeat !== "string" || typeof o.difficulty !== "number") {
    return null;
  }
  return {
    chessState: o.chessState as ChessState,
    humanSeat: o.humanSeat as "w" | "b",
    difficulty: o.difficulty
  };
}

export function ChessSolo({ save }: { save: SoloGameSaveControls }) {
  // Game active states
  const [gameState, setGameState] = useState<ChessState | null>(() => {
    const saved = loadSavedState(save.savedState);
    if (!saved) return null;
    let resumed = { ...saved.chessState };
    if (resumed.timeControl?.mode === "timed" && resumed.next === saved.humanSeat) {
      resumed.lastTickAt = Date.now();
    } else {
      resumed.lastTickAt = null;
    }
    return resumed;
  });
  const [humanSeat, setHumanSeat] = useState<"w" | "b">(
    () => loadSavedState(save.savedState)?.humanSeat ?? "w"
  );
  const [difficulty, setDifficulty] = useState<number>(
    () => loadSavedState(save.savedState)?.difficulty ?? 3
  );
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);

  // Setup form states
  const [screen, setScreen] = useState<"setup" | "board">(
    () => loadSavedState(save.savedState) ? "board" : "setup"
  );
  const [selectedSeat, setSelectedSeat] = useState<"w" | "b">("w");
  const [selectedDifficulty, setSelectedDifficulty] = useState<number>(3);
  
  // Time control setup
  const [timeMode, setTimeMode] = useState<"none" | "timed">("none");
  const [minsInput, setMinsInput] = useState<string>("10");
  const [incInput, setIncInput] = useState<string>("0");

  const { isReady: engineReady, getBestMove } = useStockfishEngine();

  // Autosave when playing
  const autosavePayload = useMemo<JsonValue>(() => {
    if (!gameState) return null as unknown as JsonValue;
    const payload: ChessSoloSavedState = {
      chessState: gameState,
      humanSeat,
      difficulty
    };
    return payload as unknown as JsonValue;
  }, [gameState, humanSeat, difficulty]);

  useSoloAutoSave(
    save,
    autosavePayload,
    gameState !== null && gameState.status === "playing" && !engineThinking
  );

  // Clear save when game is over
  useEffect(() => {
    if (gameState && gameState.status !== "playing") {
      void save.clearSave();
    }
  }, [gameState?.status, save]);

  // Engine turn logic
  const engineSeat = humanSeat === "w" ? "b" : "w";
  const isEngineTurn =
    gameState !== null &&
    gameState.status === "playing" &&
    gameState.next === engineSeat;

  useEffect(() => {
    if (!isEngineTurn || !gameState) return;

    let active = true;
    setEngineThinking(true);
    setEngineError(null);

    getBestMove(gameState.fen, difficulty)
      .then((move) => {
        if (!active) return;
        setEngineThinking(false);

        let res = applyChessIntent(gameState, engineSeat, {
          type: "move",
          from: move.from,
          to: move.to,
          promotion: move.promotion
        });

        if (res.error) {
          console.error("Engine move error:", res.error);
          const fallback = randomLegalMove(gameState.fen);
          if (!fallback) {
            setEngineError("המנוע לא מצא מהלך חוקי");
            return;
          }
          res = applyChessIntent(gameState, engineSeat, {
            type: "move",
            from: fallback.from,
            to: fallback.to,
            promotion: fallback.promotion
          });
          if (res.error) {
            setEngineError("שגיאה בהחלת מהלך המנוע");
            return;
          }
        }

        let nextState = res.state;
        if (nextState.status === "playing" && nextState.next === humanSeat) {
          nextState.lastTickAt = Date.now();
        }
        setGameState(nextState);
      })
      .catch((err) => {
        if (!active) return;
        console.error("Engine move computation failed:", err);
        setEngineThinking(false);
        setEngineError("המנוע נכשל — נסה לרענן את הדף");
      });

    return () => {
      active = false;
    };
  }, [isEngineTurn, gameState?.fen, difficulty, engineSeat, humanSeat, getBestMove]);

  // Handle user's local actions / intents
  const handleIntent = (intent: ChessIntent) => {
    if (!gameState) return;

    if (intent.type === "check_timeout") {
      const res = applyChessIntent(gameState, gameState.next, intent);
      setGameState(res.state);
      return;
    }

    if (intent.type === "resign") {
      const res = applyChessIntent(gameState, humanSeat, intent);
      setGameState(res.state);
      return;
    }

    if (intent.type === "move") {
      if (gameState.next !== humanSeat) return;
      const res = applyChessIntent(gameState, humanSeat, intent);
      if (res.error) {
        console.warn("Invalid move:", res.error);
        return;
      }
      setGameState(res.state);
    }
  };

  const restartFromSetup = () => {
    void save.clearSave();
    setGameState(null);
    setScreen("setup");
  };

  const restartSameSettings = () => {
    const tc = gameState?.timeControl ?? { mode: "none" as const };
    const nextSeat: "w" | "b" = humanSeat === "w" ? "b" : "w";
    const state = initialChessState(tc);
    if (state.timeControl?.mode === "timed" && nextSeat === "w") {
      state.lastTickAt = Date.now();
    }
    setHumanSeat(nextSeat);
    setEngineError(null);
    setGameState(state);
  };

  const startNewGame = () => {
    let tc: ChessTimeControl = { mode: "none" };
    if (timeMode === "timed") {
      const mins = Math.max(1, parseInt(minsInput) || 10);
      const inc = Math.max(0, parseInt(incInput) || 0);
      tc = {
        mode: "timed",
        initialMs: mins * 60_000,
        incrementMs: inc * 1000
      };
    }

    const state = initialChessState(tc);
    
    // Set first active tick if human starts first
    if (state.timeControl?.mode === "timed" && selectedSeat === "w") {
      state.lastTickAt = Date.now();
    }

    setHumanSeat(selectedSeat);
    setDifficulty(selectedDifficulty);
    setGameState(state);
    setScreen("board");
  };


  if (screen === "setup") {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-5 rounded-3xl border border-indigo-100 bg-white/95 p-6 shadow-play" dir="rtl">
        <div className="text-center">
          <h2 className="text-2xl font-black text-slate-950">שחמט מול המחשב</h2>
          <p className="text-sm font-semibold text-slate-500 mt-1">
            הגדר את המשחק שלך מול מנוע השחמט Stockfish
          </p>
        </div>

        {/* Color Choice */}
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-800">בחר צבע:</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`rounded-2xl border-2 p-4 text-center font-bold transition ${
                selectedSeat === "w"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              onClick={() => setSelectedSeat("w")}
            >
              <div className="text-xl">לבן ⚪</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">אתה מתחיל ראשון</div>
            </button>
            <button
              type="button"
              className={`rounded-2xl border-2 p-4 text-center font-bold transition ${
                selectedSeat === "b"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              onClick={() => setSelectedSeat("b")}
            >
              <div className="text-xl">שחור ⚫</div>
              <div className="text-xs text-slate-500 font-semibold mt-1">המחשב מתחיל ראשון</div>
            </button>
          </div>
        </div>

        {/* Difficulty Choice */}
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-800">רמת קושי המחשב:</label>
          <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={`rounded-xl border-2 py-2.5 text-center text-xs font-black transition ${
                  selectedDifficulty === lvl
                    ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                }`}
                onClick={() => setSelectedDifficulty(lvl)}
              >
                <div>{DIFFICULTY_LEVELS[lvl].label}</div>
                <div className="text-[10px] text-slate-400 font-bold mt-0.5">רמה {lvl}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Time Control */}
        <div className="space-y-2">
          <label className="text-sm font-black text-slate-800">בקרת זמן (שעון):</label>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              className={`rounded-xl border-2 py-2 text-center text-xs font-bold transition ${
                timeMode === "none"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              onClick={() => setTimeMode("none")}
            >
              ללא שעון
            </button>
            <button
              type="button"
              className={`rounded-xl border-2 py-2 text-center text-xs font-bold transition ${
                timeMode === "timed" && minsInput === "10" && incInput === "0"
                  ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              onClick={() => {
                setTimeMode("timed");
                setMinsInput("10");
                setIncInput("0");
              }}
            >
              10 דקות (מהיר)
            </button>
            <button
              type="button"
              className={`rounded-xl border-2 py-2 text-center text-xs font-bold transition ${
                timeMode === "timed" && (minsInput !== "10" || incInput !== "0")
                  ? "border-indigo-600 bg-indigo-50 text-indigo-950"
                  : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
              }`}
              onClick={() => {
                setTimeMode("timed");
                setMinsInput("15");
                setIncInput("10");
              }}
            >
              מותאם אישית
            </button>
          </div>

          {timeMode === "timed" && (
            <div className="flex flex-wrap items-center gap-4 bg-slate-50 p-3 rounded-2xl border border-slate-200 mt-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">דקות להתחלה:</span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={minsInput}
                  onChange={(e) => setMinsInput(e.target.value)}
                  className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">שניות תוספת למסע:</span>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={incInput}
                  onChange={(e) => setIncInput(e.target.value)}
                  className="w-16 rounded-xl border border-slate-200 bg-white px-2 py-1 text-center text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          )}
        </div>

        <Button
          type="button"
          disabled={!engineReady}
          onClick={startNewGame}
          className="w-full rounded-2xl py-3 text-sm font-black shadow-lg"
        >
          {engineReady ? "התחל משחק" : "טוען מנוע שחמט…"}
        </Button>
      </div>
    );
  }

  return (
    <div className="relative space-y-4">
      {/* Back button to setup */}
      <div className="flex items-center justify-between" dir="rtl">
        <Button
          variant="outline"
          className="rounded-xl px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
          onClick={() => {
            if (window.confirm("האם ברצונך לצאת? המשחק יישמר אוטומטית.")) {
              setScreen("setup");
            }
          }}
        >
          חזרה להגדרות ↩
        </Button>
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-black text-slate-500">
            רמה: {DIFFICULTY_LEVELS[difficulty].label}
          </span>
          {engineThinking && (
            <span className="inline-flex items-center gap-1.5 rounded-xl bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800 border border-amber-300 animate-pulse">
              <span>המחשב חושב...</span>
            </span>
          )}
          {engineError && (
            <span className="inline-flex items-center rounded-xl bg-rose-100 px-2.5 py-1 text-xs font-black text-rose-800 border border-rose-300">
              {engineError}
            </span>
          )}
        </div>
      </div>

      {gameState && (
        <ChessBoard
          gameState={gameState}
          mySeat={humanSeat}
          onIntent={handleIntent}
          isHost={false}
          onPlayAgain={restartSameSettings}
          onExit={restartFromSetup}
          allowDrawOffers={false}
        />
      )}
    </div>
  );
}
