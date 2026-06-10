import { useEffect, useState, type ReactNode } from "react";
import type {
  BreakoutMpState,
  ChessState,
  ConnectFourState,
  DrawingState,
  MemoryState,
  TicTacToeState
} from "@playground/game-logic";

export interface BoardProps {
  gameState: unknown;
  mySymbol: string | null;
  myUserId: string;
  onIntent: (intent: unknown) => void;
  onLiveDelta?: (delta: unknown) => void;
  subscribeLiveDeltas?: (cb: (payload: unknown) => void) => () => void;
  isHost?: boolean;
  endOverlay?: { kind: "won" | "draw" | "stopped"; winner?: string } | null;
  rematch?: { requestedBy: string; accepted: string[]; refused: string[] } | null;
  canVoteRematch?: boolean;
  acceptedRematch?: boolean;
  refusedRematch?: boolean;
  onRequestRematch?: () => void;
  onRespondRematch?: (accept: boolean) => void;
  onGoHome?: () => void;
  paused?: boolean;
  players?: Array<{ userId: string; displayName: string }>;
  connectedPlayers?: Array<{ userId: string; displayName: string }>;
}

export interface BoardRegistryEntry {
  component: (props: BoardProps) => JSX.Element;
  fullscreen?: boolean;
}

const BOARD_LOADERS: Record<
  string,
  () => Promise<BoardRegistryEntry>
> = {
  chess: async () => {
    const { ChessBoard } = await import("@/games/ChessBoard");
    return {
      component: ({
        gameState,
        mySymbol,
        onIntent,
        isHost,
        endOverlay,
        rematch,
        canVoteRematch,
        acceptedRematch,
        refusedRematch,
        onRequestRematch,
        onRespondRematch,
        onGoHome
      }) => (
        <ChessBoard
          gameState={gameState as ChessState}
          mySeat={mySymbol === "w" || mySymbol === "b" ? mySymbol : null}
          onIntent={(intent) => onIntent(intent)}
          isHost={isHost}
          sessionEnd={
            endOverlay
              ? {
                  kind: endOverlay.kind,
                  winner: endOverlay.kind === "won" ? endOverlay.winner : undefined
                }
              : null
          }
          rematch={rematch}
          canRequestRematch={
            !!isHost && !!endOverlay && endOverlay.kind !== "stopped" && !rematch
          }
          canVoteRematch={canVoteRematch}
          acceptedRematch={acceptedRematch}
          refusedRematch={refusedRematch}
          onRequestRematch={onRequestRematch}
          onRespondRematch={onRespondRematch}
          onGoHome={onGoHome}
        />
      )
    };
  },
  tictactoe: async () => {
    const { TicTacToeBoard } = await import("@/games/TicTacToeBoard");
    return {
      component: ({ gameState, mySymbol, onIntent }) => (
        <TicTacToeBoard
          gameState={gameState as TicTacToeState}
          mySymbol={mySymbol === "X" || mySymbol === "O" ? mySymbol : null}
          onCellPress={(i) => onIntent({ cellIndex: i })}
        />
      )
    };
  },
  connectfour: async () => {
    const { ConnectFourBoard } = await import("@/games/ConnectFourBoard");
    return {
      component: ({ gameState, mySymbol, onIntent }) => (
        <ConnectFourBoard
          gameState={gameState as ConnectFourState}
          mySeat={mySymbol === "R" || mySymbol === "Y" ? mySymbol : null}
          onIntent={(intent) => onIntent(intent)}
        />
      )
    };
  },
  memory: async () => {
    const { MemoryBoard } = await import("@/games/MemoryBoard");
    return {
      component: ({ gameState, myUserId, onIntent }) => (
        <MemoryBoard
          gameState={gameState as MemoryState}
          myUserId={myUserId}
          onIntent={(intent) => onIntent(intent)}
        />
      )
    };
  },
  drawing: async () => {
    const { DrawingBoard } = await import("@/games/DrawingBoard");
    return {
      component: ({
        gameState,
        mySymbol,
        myUserId,
        onIntent,
        onLiveDelta,
        subscribeLiveDeltas,
        isHost,
        players
      }) => (
        <DrawingBoard
          gameState={gameState as DrawingState}
          mySeat={mySymbol}
          myUserId={myUserId}
          onIntent={(intent) => onIntent(intent)}
          onLiveDelta={onLiveDelta}
          subscribeLiveDeltas={subscribeLiveDeltas}
          isHost={isHost}
          players={players}
        />
      )
    };
  },
  breakout: async () => {
    const { BreakoutMpBoard } = await import("@/games/BreakoutMpBoard");
    return {
      component: ({
        gameState,
        mySymbol,
        myUserId,
        onIntent,
        onLiveDelta,
        subscribeLiveDeltas,
        paused,
        players,
        connectedPlayers,
        endOverlay
      }) => (
        <BreakoutMpBoard
          gameState={gameState as BreakoutMpState}
          mySymbol={mySymbol as "A" | "B" | null}
          myUserId={myUserId}
          onIntent={(intent) => onIntent(intent)}
          onLiveDelta={onLiveDelta}
          subscribeLiveDeltas={subscribeLiveDeltas}
          paused={paused}
          players={players}
          connectedPlayers={connectedPlayers}
          endOverlay={endOverlay}
        />
      )
    };
  }
};

export function LazyGameBoard({
  gameKey,
  boardProps
}: {
  gameKey: string;
  boardProps: BoardProps;
}) {
  const [entry, setEntry] = useState<BoardRegistryEntry | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEntry(null);
    setLoadError(null);
    const loader = BOARD_LOADERS[gameKey];
    if (!loader) {
      setLoadError(`unsupported:${gameKey}`);
      return;
    }
    void loader()
      .then((loaded) => {
        if (!cancelled) setEntry(loaded);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : "load failed");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gameKey]);

  if (loadError) {
    return (
      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
        משחק לא נתמך בלקוח: {gameKey}
      </p>
    );
  }
  if (!entry) {
    return (
      <div className="flex min-h-[320px] items-center justify-center text-sm font-medium text-slate-500">
        טוען משחק…
      </div>
    );
  }
  return entry.component(boardProps);
}

export function isFullscreenBoard(gameKey: string): boolean {
  return gameKey === "drawing" || gameKey === "breakout";
}