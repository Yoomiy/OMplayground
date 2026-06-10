import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { GameSessionContainer } from "@/game/GameSessionContainer";
import { MinecraftSessionContainer } from "@/game/MinecraftSessionContainer";
import { Button } from "@/components/ui/button";
import { KidDesktopShell } from "@/components/KidDesktopShell";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";

function PlayPage() {
  const { sessionId } = useParams();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useIsAdmin();
  const [gameName, setGameName] = useState<string>("");
  const [gameUrl, setGameUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("game_sessions")
        .select("games ( name_he, game_url )")
        .eq("id", sessionId)
        .maybeSingle();
      if (cancelled) return;
      const games =
        (data as { games?: { name_he?: string; game_url?: string } | null } | null)?.games;
      setGameName(games?.name_he ?? "");
      setGameUrl(games?.game_url ?? null);
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
    return <p className="p-6 text-sm font-medium text-amber-900">חסר מזהה מפגש</p>;
  }

  // Voxel game bypasses the desktop chrome — `MinecraftSessionContainer` is
  // fullscreen by construction and renders its own back button.
  if (gameUrl === "minecraft") {
    return <MinecraftSessionContainer sessionId={sessionId} />;
  }

  return (
    <KidDesktopShell
      title={gameName || "משחק"}
      subtitle="חדר משחק"
      actions={
        <Button variant="outline" asChild>
          <Link to={backHref}>{backLabel}</Link>
        </Button>
      }
      contentClassName="min-h-[calc(100vh-136px)]"
    >
      <GameSessionContainer sessionId={sessionId} />
    </KidDesktopShell>
  );
}

export default PlayPage;
export { PlayPage };
