import { Link, useParams } from "react-router-dom";
import { GameSessionContainer } from "@/game/GameSessionContainer";
import { Button } from "@/components/ui/button";

export function PlayPage() {
  const { sessionId } = useParams();

  if (!sessionId) {
    return <p className="p-6 text-sm text-amber-300">חסר מזהה מפגש</p>;
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">איקס עיגול</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>
      <GameSessionContainer sessionId={sessionId} />
    </div>
  );
}
