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
import { cn } from "@/lib/cn";

interface GameCatalogRow {
  id: string;
  name_he: string;
  game_url: string;
  is_multiplayer: boolean;
}

function panelClass(className?: string) {
  return cn(
    "rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-play backdrop-blur-sm",
    className
  );
}

const SOLO_GRADIENTS = [
  "from-sky-100 to-cyan-50 border-sky-200/80",
  "from-violet-100 to-fuchsia-50 border-violet-200/80",
  "from-amber-100 to-orange-50 border-amber-200/80",
  "from-emerald-100 to-teal-50 border-emerald-200/80",
  "from-rose-100 to-pink-50 border-rose-200/80"
];

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
  const [pendingGame, setPendingGame] = useState<GameCatalogRow | null>(null);

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
      <div className="mx-auto max-w-2xl p-6 text-sm text-slate-500">טוען…</div>
    );
  }

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-slate-500">
        מעביר לניהול…
      </div>
    );
  }

  if (profile?.role === "teacher") {
    return (
      <div className="mx-auto max-w-2xl p-6 text-sm text-slate-500">
        מעביר ללוח המורה…
      </div>
    );
  }

  async function createSession(gameId: string, isOpen: boolean) {
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
        is_open: isOpen,
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
    if (!isOpen) {
      const inviteUrl = `${window.location.origin}/join/${code}`;
      try {
        await navigator.clipboard.writeText(inviteUrl);
      } catch {
        setErr(`לא הצלחנו להעתיק. קישור הזמנה: ${inviteUrl}`);
      }
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

  const soloGames = catalog.filter((g) => !g.is_multiplayer);
  const mpGames = catalog.filter((g) => g.is_multiplayer);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 pb-10 pt-4 sm:px-6">
      <header
        className={panelClass(
          "flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
        )}
      >
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600/90">
            היי!
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            שלום, {profile?.full_name}
          </h1>
          <p className="text-sm text-slate-600">
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
              <span
                className="inline-block size-2 rounded-full bg-emerald-500"
                aria-hidden
              />
              מחובר
            </span>
            <span className="mx-2 text-slate-400">·</span>
            <span>{onlineUserIds.size} מחוברים עכשיו</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" type="button" asChild>
            <Link to="/profile">הפרופיל שלי</Link>
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link to="/friends">חברים</Link>
          </Button>
          <Button variant="outline" type="button" asChild>
            <Link to="/inbox">
              הודעות
              {unreadTotal > 0 ? (
                <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-[11px] text-white">
                  {unreadTotal}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button variant="muted" type="button" onClick={() => void logout()}>
            התנתק
          </Button>
        </div>
      </header>

      {err ? (
        <p
          className="rounded-2xl border border-amber-300/80 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      <section className={panelClass("space-y-5")}>
        <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900">ספריית משחקים</h2>
            <p className="mt-1 text-sm text-slate-600">
              בחר משחק יחיד או צור חדר לחברים
            </p>
          </div>
        </div>

        {catalog.length === 0 ? (
          <p className="text-center text-sm text-slate-500">אין משחקים זמינים</p>
        ) : (
          <>
            {soloGames.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">
                  משחקים לבד
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {soloGames.map((g, i) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        onClick={() => navigate(`/solo/${g.game_url}`)}
                        className={cn(
                          "flex w-full flex-col gap-2 rounded-2xl border-2 bg-gradient-to-br p-4 text-right shadow-sm transition hover:brightness-[1.02] active:scale-[0.99]",
                          SOLO_GRADIENTS[i % SOLO_GRADIENTS.length]
                        )}
                      >
                        <span className="text-lg font-bold text-slate-900">
                          {g.name_he}
                        </span>
                        <span className="text-xs font-medium text-slate-600">
                          שחק עכשיו
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {mpGames.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-800">
                  משחק עם חברים
                </h3>
                <ul className="grid gap-3 sm:grid-cols-2">
                  {mpGames.map((g, i) => (
                    <li key={g.id}>
                      <button
                        type="button"
                        disabled={busyGameId !== null}
                        onClick={() => setPendingGame(g)}
                        className={cn(
                          "flex w-full flex-col gap-2 rounded-2xl border-2 bg-gradient-to-br p-4 text-right shadow-sm transition hover:brightness-[1.02] active:scale-[0.99] disabled:opacity-60",
                          SOLO_GRADIENTS[i % SOLO_GRADIENTS.length]
                        )}
                      >
                        <span className="text-lg font-bold text-slate-900">
                          {g.name_he}
                        </span>
                        <span className="text-xs font-medium text-slate-600">
                          {busyGameId === g.id ? "יוצר חדר…" : "צור חדר"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        )}
      </section>

      {!pausedLoading && myPausedGames.length > 0 ? (
        <section className={panelClass("space-y-3 border-amber-200/90 bg-amber-50/80")}>
          <h2 className="text-lg font-bold text-amber-950">המשך משחק</h2>
          <p className="text-sm text-amber-900/80">
            המשחקים האלה מחכים שתחזור
          </p>
          <ul className="space-y-3">
            {myPausedGames.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-white/90 px-4 py-3 text-sm text-slate-800 shadow-sm"
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-semibold">
                    {g.games?.name_he ?? "משחק"} · מארח: {g.host_name}
                  </span>
                  <span className="text-xs text-slate-600">
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
        </section>
      ) : null}

      {openGames.length > 0 ? (
        <section className={panelClass("space-y-3")}>
          <h2 className="text-lg font-bold text-slate-900">הצטרף למשחק</h2>
          <p className="text-sm text-slate-600">
            חדרים פתוחים שאפשר להצטרף אליהם עכשיו
          </p>
          <ul className="space-y-3">
            {openGames.map((g) => (
              <li
                key={g.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm"
              >
                <span className="font-medium text-slate-800">
                  {g.host_name}
                  <span className="text-slate-500">
                    {" "}
                    · {g.status === "waiting" ? "ממתין" : "פעיל"}
                  </span>
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
        </section>
      ) : null}

      {pendingGame ? (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-label="בחירת סוג חדר"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPendingGame(null);
          }}
        >
          <div
            className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-slate-900">{pendingGame.name_he}</h3>
            <p className="mt-1 text-sm text-slate-600">איך ליצור את החדר?</p>
            <div className="mt-4 flex flex-col gap-2">
              <Button
                type="button"
                disabled={busyGameId !== null}
                onClick={() => {
                  void createSession(pendingGame.id, true);
                  setPendingGame(null);
                }}
              >
                חדר פתוח
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyGameId !== null}
                onClick={() => {
                  void createSession(pendingGame.id, false);
                  setPendingGame(null);
                }}
              >
                חדר פרטי
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPendingGame(null)}
              >
                ביטול
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <OnlineKids />
    </div>
  );
}
