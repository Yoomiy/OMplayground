import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOnlinePresence } from "@/hooks/usePresence";
import { useOpenGames } from "@/hooks/useOpenGames";
import { useMyPausedGames } from "@/hooks/useMyPausedGames";
import {
  discardMySoloWaitingSessions,
  leavePausedGameSession
} from "@/lib/pausedSessionActions";
import { useInbox } from "@/hooks/useInbox";
import { OnlineKids } from "@/components/OnlineKids";
import { Button } from "@/components/ui/button";

interface GameCatalogRow {
  id: string;
  name_he: string;
  game_url: string;
  is_multiplayer: boolean;
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const { onlineUserIds } = useOnlinePresence();
  const { rows: openGames } = useOpenGames(user?.id);
  const { rows: myPausedGames, loading: pausedLoading, refetch: refetchPaused } =
    useMyPausedGames(user?.id);
  const { unreadTotal } = useInbox(user?.id);
  const [catalog, setCatalog] = useState<GameCatalogRow[]>([]);
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [dismissingPausedId, setDismissingPausedId] = useState<string | null>(
    null
  );
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, name_he, game_url, is_multiplayer")
        .eq("is_active", true)
        .in("for_gender", ["both", profile.gender])
        .order("name_he", { ascending: true });
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        return;
      }
      setCatalog((data ?? []) as GameCatalogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile]);

  useEffect(() => {
    if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (profile?.role === "teacher") {
      navigate("/teacher", { replace: true });
    }
  }, [profile?.role, navigate]);

  if (adminLoading) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-slate-400">טוען…</div>
    );
  }

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-slate-400">
        מעביר לניהול…
      </div>
    );
  }

  if (profile?.role === "teacher") {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-slate-400">
        מעביר ללוח המורה…
      </div>
    );
  }

  async function createOpenSession(gameId: string) {
    if (!user || !profile) return;
    setBusyGameId(gameId);
    setErr(null);
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        game_id: gameId,
        host_id: user.id,
        host_name: profile.full_name,
        player_ids: [user.id],
        player_names: [profile.full_name],
        status: "waiting",
        is_open: true,
        invitation_code: code,
        gender: profile.gender,
        host_grade: profile.grade
      })
      .select("id")
      .maybeSingle();
    if (error || !data?.id) {
      setErr(error?.message ?? "יצירת מפגש נכשלה");
      setBusyGameId(null);
      return;
    }
    setBusyGameId(null);
    navigate(`/play/${data.id}`);
  }

  async function logout() {
    const { error: discardErr } = await discardMySoloWaitingSessions();
    if (discardErr) {
      console.error(discardErr);
    }
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  async function dismissPausedSession(sessionId: string) {
    setDismissingPausedId(sessionId);
    setErr(null);
    const { error } = await leavePausedGameSession(sessionId);
    setDismissingPausedId(null);
    if (error) {
      setErr(error.message);
      return;
    }
    await refetchPaused();
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">שלום, {profile?.full_name}</h1>
          <p className="text-sm text-slate-400">
            <span className="text-emerald-400">מחובר</span>
            <span className="mr-2 text-slate-500">
              · נוכחות: {onlineUserIds.size}
            </span>
          </p>
        </div>
        <Button variant="outline" type="button" onClick={() => void logout()}>
          התנתק
        </Button>
      </header>

      {err ? (
        <p className="text-sm text-amber-300" role="alert">
          {err}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">משחקים</h2>
        {catalog.length === 0 ? (
          <p className="text-sm text-slate-400">אין משחקים זמינים</p>
        ) : (
          <>
            {catalog.some((g) => g.is_multiplayer) ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-slate-300">
                  משחקים משותפים
                </h3>
                {catalog
                  .filter((g) => g.is_multiplayer)
                  .map((g) => (
                    <Button
                      key={g.id}
                      type="button"
                      disabled={busyGameId !== null}
                      onClick={() => void createOpenSession(g.id)}
                    >
                      {busyGameId === g.id
                        ? "יוצר…"
                        : `צור מפגש פתוח (${g.name_he})`}
                    </Button>
                  ))}
              </div>
            ) : null}

            {catalog.some((g) => !g.is_multiplayer) ? (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-medium text-slate-300">
                  משחקי יחיד
                </h3>
                {catalog
                  .filter((g) => !g.is_multiplayer)
                  .map((g) => (
                    <Button
                      key={g.id}
                      type="button"
                      variant="outline"
                      onClick={() => navigate(`/solo/${g.game_url}`)}
                    >
                      שחק · {g.name_he}
                    </Button>
                  ))}
              </div>
            ) : null}
          </>
        )}

        {openGames.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">
              משחקים פתוחים להצטרפות
            </h3>
            <ul className="space-y-2">
              {openGames.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
                >
                  <span>
                    {g.host_name} · {g.status === "waiting" ? "ממתין" : "פעיל"}
                  </span>
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => navigate(`/play/${g.id}`)}
                  >
                    הצטרף
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {!pausedLoading && myPausedGames.length > 0 ? (
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-slate-300">
              משחקים מושהים — המשך
            </h3>
            <ul className="space-y-2">
              {myPausedGames.map((g) => (
                <li
                  key={g.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-sm"
                >
                  <span className="flex flex-col gap-1">
                    <span>
                      {g.games?.name_he ?? "משחק"} · מארח: {g.host_name}
                    </span>
                    <span className="text-xs text-amber-100/80">
                      {g.connected_player_names.length > 0
                        ? `מחכים בפנים: ${g.connected_player_names.join(", ")}`
                        : "אף שחקן לא מחכה בפנים כרגע"}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      type="button"
                      onClick={() => navigate(`/play/${g.id}`)}
                    >
                      המשך
                    </Button>
                    <Button
                      size="sm"
                      type="button"
                      variant="outline"
                      disabled={dismissingPausedId !== null}
                      onClick={() => void dismissPausedSession(g.id)}
                    >
                      {dismissingPausedId === g.id ? "מסיר…" : "הסר מהרשימה"}
                    </Button>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <OnlineKids />

      <nav className="flex flex-wrap gap-4 text-sm text-indigo-400">
        <Link className="underline" to="/friends">
          חברים
        </Link>
        <Link className="underline" to="/inbox">
          הודעות{unreadTotal > 0 ? ` (${unreadTotal})` : ""}
        </Link>
        {isAdmin ? (
          <Link className="underline" to="/admin">
            ניהול
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
