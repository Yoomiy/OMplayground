import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GameSessionContainer } from "@/game/GameSessionContainer";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";

function PlayPage() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { isAdmin } = useIsAdmin(user);
  const [gameName, setGameName] = useState<string>("");

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

  const { backHref, backLabel } = useMemo(() => {
    if (isAdmin) {
      return { backHref: "/admin", backLabel: "ניהול" };
    }
    if (profile?.role === "teacher") {
      return { backHref: "/teacher", backLabel: "לוח מורה" };
    }
    return { backHref: "/home", backLabel: "בית" };
  }, [isAdmin, profile?.role]);

  if (!sessionId) {
    return <p className="p-6 text-sm text-amber-300">חסר מזהה מפגש</p>;
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{gameName || "משחק"}</h1>
        <Button variant="outline" asChild>
          <Link to={backHref}>{backLabel}</Link>
        </Button>
      </header>
      <GameSessionContainer sessionId={sessionId} />
    </div>
  );
}

export default PlayPage;
export { PlayPage };
