import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GameSessionContainer } from "@/game/GameSessionContainer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";

export function PlayPage() {
  const { sessionId } = useParams();
  const [gameName, setGameName] = useState<string>("");

  /**
   * Fetch the Hebrew game name once per session so the header stops
   * hardcoding a single game's title. `games!inner` is keyed off the
   * FK `game_sessions.game_id -> games.id` already defined in schema.
   */
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("game_sessions")
        .select("games ( name_he )")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      const name =
        (data as { games?: { name_he?: string } | null } | null)?.games
          ?.name_he ?? "";
      setGameName(name);
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!sessionId) {
    return <p className="p-6 text-sm text-amber-300">חסר מזהה מפגש</p>;
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{gameName || "משחק"}</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>
      <GameSessionContainer sessionId={sessionId} />
    </div>
  );
}
