import { useEffect, useRef, useState, useCallback } from "react";

export interface DifficultyConfig {
  label: string;
  skillLevel: number;
  depth: number;
}

export const DIFFICULTY_LEVELS: Record<number, DifficultyConfig> = {
  1: { label: "מתחיל", skillLevel: 0, depth: 1 },
  2: { label: "קל", skillLevel: 5, depth: 3 },
  3: { label: "בינוני", skillLevel: 10, depth: 6 },
  4: { label: "מתקדם", skillLevel: 15, depth: 10 },
  5: { label: "מומחה", skillLevel: 20, depth: 12 }
};

export function useStockfishEngine() {
  const workerRef = useRef<Worker | null>(null);
  const [isReady, setIsReady] = useState(false);
  const pendingResolveRef = useRef<((move: { from: string; to: string; promotion?: "q" | "r" | "b" | "n" }) => void) | null>(null);
  const pendingRejectRef = useRef<((err: Error) => void) | null>(null);

  const initEngine = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.terminate();
    }

    try {
      // Loader must not be named *.wasm.js — Emscripten appends ".wasm" to the script path.
      const worker = new Worker("/stockfish/stockfish.js");
      workerRef.current = worker;

      worker.onmessage = (e: MessageEvent) => {
        const line = e.data;

        if (line === "readyok") {
          setIsReady(true);
        } else if (line.startsWith("bestmove")) {
          const parts = line.split(" ");
          const moveStr = parts[1];
          if (moveStr && moveStr !== "(none)") {
            const from = moveStr.substring(0, 2);
            const to = moveStr.substring(2, 4);
            const rawPromo = moveStr.length > 4 ? moveStr.substring(4, 5) : undefined;
            
            let promotion: "q" | "r" | "b" | "n" | undefined = undefined;
            if (rawPromo === "q" || rawPromo === "r" || rawPromo === "b" || rawPromo === "n") {
              promotion = rawPromo;
            }

            if (pendingResolveRef.current) {
              pendingResolveRef.current({ from, to, promotion });
              pendingResolveRef.current = null;
              pendingRejectRef.current = null;
            }
          } else {
            if (pendingRejectRef.current) {
              pendingRejectRef.current(new Error("No moves returned by Stockfish"));
              pendingResolveRef.current = null;
              pendingRejectRef.current = null;
            }
          }
        }
      };

      worker.postMessage("uci");
      worker.postMessage("isready");
    } catch (err) {
      console.error("Failed to initialize Stockfish worker:", err);
    }
  }, []);

  useEffect(() => {
    initEngine();
    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
      }
    };
  }, [initEngine]);

  const getBestMove = useCallback(
    (fen: string, difficulty: number): Promise<{ from: string; to: string; promotion?: "q" | "r" | "b" | "n" }> => {
      return new Promise((resolve, reject) => {
        if (!workerRef.current) {
          reject(new Error("Engine worker not initialized"));
          return;
        }

        if (pendingRejectRef.current) {
          pendingRejectRef.current(new Error("Search interrupted"));
        }
        pendingResolveRef.current = resolve;
        pendingRejectRef.current = reject;

        const config = DIFFICULTY_LEVELS[difficulty] || DIFFICULTY_LEVELS[1];
        
        workerRef.current.postMessage("stop");
        workerRef.current.postMessage(`setoption name Skill Level value ${config.skillLevel}`);
        workerRef.current.postMessage(`position fen ${fen}`);
        workerRef.current.postMessage(`go depth ${config.depth}`);
      });
    },
    []
  );

  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage("stop");
    }
    if (pendingRejectRef.current) {
      pendingRejectRef.current(new Error("Search stopped"));
      pendingResolveRef.current = null;
      pendingRejectRef.current = null;
    }
  }, []);

  return {
    isReady,
    getBestMove,
    stop
  };
}
