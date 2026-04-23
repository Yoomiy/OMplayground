import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { BalloonPopSolo } from "@/games-solo/BalloonPopSolo";
import { AlgesEscapadeSolo } from "@/games-solo/AlgesEscapadeSolo";
import { DrawingSolo } from "@/games-solo/DrawingSolo";
import { HexGLSolo } from "@/games-solo/HexGLSolo";
import { SimonSolo } from "@/games-solo/SimonSolo";
import { SnakeSolo } from "@/games-solo/SnakeSolo";
import { WhackAMoleSolo } from "@/games-solo/WhackAMoleSolo";

/**
 * Solo games are pure client-side React components. They do NOT go through
 * the multiplayer socket server, do NOT create a `game_sessions` row, and do
 * NOT implement `GameModule`. Each entry renders standalone; the container
 * only provides a back-to-home chrome and routes by `:gameKey`.
 *
 * New solo games: add a `<gameKey>: () => <Component />` entry below.
 */
const SOLO_REGISTRY: Record<string, () => ReactNode> = {
  drawing: () => <DrawingSolo />,
  snake: () => <SnakeSolo />,
  simon: () => <SimonSolo />,
  whackamole: () => <WhackAMoleSolo />,
  balloonpop: () => <BalloonPopSolo />,
  "alges-escapade": () => <AlgesEscapadeSolo />,
  hexgl: () => <HexGLSolo />
};

export default function SoloGameContainer() {
  const { gameKey } = useParams<{ gameKey: string }>();
  const navigate = useNavigate();
  const entry = gameKey ? SOLO_REGISTRY[gameKey] : undefined;

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
      {entry ? (
        entry()
      ) : (
        <p className="text-sm text-amber-300" role="alert">
          משחק לא זמין: {gameKey ?? "?"}
        </p>
      )}
    </div>
  );
}
