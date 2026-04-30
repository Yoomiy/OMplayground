import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gamepad2, Play, RotateCcw, Search, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOpenGames } from "@/hooks/useOpenGames";
import { useMyPausedGames } from "@/hooks/useMyPausedGames";
import { leavePausedGameSession } from "@/lib/pausedSessionActions";
import { listSoloGameSaves } from "@/lib/soloGameSaves";
import { OnlineKids } from "@/components/OnlineKids";
import { Button } from "@/components/ui/button";
import { KidDesktopShell, desktopPanelClass } from "@/components/KidDesktopShell";
import { cn } from "@/lib/cn";
import { fieldInputClass } from "@/lib/fieldStyles";

interface GameCatalogRow {
  id: string;
  name_he: string;
  game_url: string;
  is_multiplayer: boolean;
}

type GameTab = "solo" | "multi";
type OpenGameScopeFilter = "class" | "all";

const GAME_COLORS = [
  "border-sky-200 bg-sky-50",
  "border-violet-200 bg-violet-50",
  "border-amber-200 bg-amber-50",
  "border-emerald-200 bg-emerald-50",
  "border-rose-200 bg-rose-50"
];

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const { rows: openGames } = useOpenGames(user?.id);
  const { rows: myPausedGames, loading: pausedLoading, refetch: refetchPaused } =
    useMyPausedGames(user?.id);
  const [catalog, setCatalog] = useState<GameCatalogRow[]>([]);
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [dismissingPausedId, setDismissingPausedId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pendingGame, setPendingGame] = useState<GameCatalogRow | null>(null);
  const [gameTab, setGameTab] = useState<GameTab>("solo");
  const [openGameScope, setOpenGameScope] = useState<OpenGameScopeFilter>("class");
  const [openGameIdFilter, setOpenGameIdFilter] = useState("");
  const [gameSearch, setGameSearch] = useState("");
  const [soloSaveKeys, setSoloSaveKeys] = useState<Set<string>>(new Set());

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
    if (isAdmin) navigate("/admin", { replace: true });
  }, [isAdmin, navigate]);

  useEffect(() => {
    if (profile?.role === "teacher") navigate("/teacher", { replace: true });
  }, [profile?.role, navigate]);

  useEffect(() => {
    let cancelled = false;
    void listSoloGameSaves(user?.id)
      .then((rows) => {
        if (!cancelled) setSoloSaveKeys(new Set(rows.map((row) => row.game_key)));
      })
      .catch((error: Error) => {
        console.error(error);
        if (!cancelled) setSoloSaveKeys(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  const soloGames = catalog.filter((game) => !game.is_multiplayer);
  const mpGames = catalog.filter((game) => game.is_multiplayer);
  const activeGames = (gameTab === "solo" ? soloGames : mpGames).filter((game) =>
    game.name_he.toLowerCase().includes(gameSearch.trim().toLowerCase())
  );

  const openGameOptions = useMemo(() => {
    const options = new Map<string, string>();
    for (const game of openGames) {
      options.set(game.game_id, game.games?.name_he ?? "משחק");
    }
    return Array.from(options.entries()).sort((a, b) =>
      a[1].localeCompare(b[1], "he")
    );
  }, [openGames]);

  const filteredOpenGames = useMemo(() => {
    return openGames.filter((game) => {
      if (openGameIdFilter && game.game_id !== openGameIdFilter) return false;
      if (openGameScope === "class" && game.host_grade !== profile?.grade) return false;
      return true;
    });
  }, [openGameIdFilter, openGameScope, openGames, profile?.grade]);

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

  if (adminLoading || isAdmin || profile?.role === "teacher") {
    return <div className="p-6 text-sm font-medium text-slate-500">טוען…</div>;
  }

  return (
    <KidDesktopShell
      title="לוח המשחקים"
      subtitle="משחקים, חדרים פתוחים וילדים מחוברים במקום אחד"
      contentClassName="grid min-h-[calc(100vh-136px)] gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)_360px]"
    >
      <section className={desktopPanelClass("flex min-h-[620px] flex-col p-4")}>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-lg font-black text-slate-950">ספריית משחקים</h2>
            <p className="text-xs font-semibold text-slate-500">
              {catalog.length} משחקים זמינים
            </p>
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-black",
                gameTab === "solo" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
              )}
              onClick={() => setGameTab("solo")}
            >
              לבד ({soloGames.length})
            </button>
            <button
              type="button"
              className={cn(
                "rounded-lg px-3 py-2 text-sm font-black",
                gameTab === "multi" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-600"
              )}
              onClick={() => setGameTab("multi")}
            >
              ביחד ({mpGames.length})
            </button>
          </div>
        </div>

        <label className="relative mb-3 block">
          <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
          <input
            className="min-h-10 w-full rounded-xl border-2 border-slate-200 bg-white py-2 pl-3 pr-9 text-sm font-semibold outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
            value={gameSearch}
            onChange={(event) => setGameSearch(event.target.value)}
            placeholder="חיפוש משחק…"
          />
        </label>

        {err ? (
          <p className="mb-3 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-bold text-amber-900" role="alert">
            {err}
          </p>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          {activeGames.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
              אין משחקים מתאימים.
            </p>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {activeGames.map((game, index) => (
                <li key={game.id}>
                  <button
                    type="button"
                    disabled={busyGameId !== null}
                    onClick={() =>
                      game.is_multiplayer
                        ? setPendingGame(game)
                        : navigate(`/solo/${game.game_url}`)
                    }
                    className={cn(
                      "flex min-h-28 w-full flex-col justify-between rounded-2xl border-2 p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md disabled:opacity-60",
                      GAME_COLORS[index % GAME_COLORS.length]
                    )}
                  >
                    <span className="flex items-center justify-between gap-3">
                      <span className="text-lg font-black text-slate-950">
                        {game.name_he}
                      </span>
                      {game.is_multiplayer ? (
                        <Users className="size-5 text-slate-500" aria-hidden />
                      ) : (
                        <Gamepad2 className="size-5 text-slate-500" aria-hidden />
                      )}
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs font-black text-slate-600">
                      <Play className="size-3.5" aria-hidden />
                      {game.is_multiplayer
                        ? busyGameId === game.id
                          ? "יוצר חדר…"
                          : "צור חדר"
                        : soloSaveKeys.has(game.game_url)
                          ? "המשך משחק שמור"
                          : "שחק עכשיו"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="flex min-h-[620px] flex-col gap-4">
        {!pausedLoading && myPausedGames.length > 0 ? (
          <section className={desktopPanelClass("border-amber-200 bg-amber-50/90 p-4")}>
            <div className="mb-3 flex items-center gap-2">
              <RotateCcw className="size-5 text-amber-700" aria-hidden />
              <h2 className="text-base font-black text-amber-950">המשך משחק</h2>
            </div>
            <ul className="max-h-52 space-y-2 overflow-y-auto">
              {myPausedGames.map((game) => (
                <li key={game.id} className="rounded-xl border border-amber-200 bg-white px-3 py-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-black text-slate-900">
                        {game.games?.name_he ?? "משחק"} · {game.host_name}
                      </p>
                      <p className="truncate text-xs font-semibold text-slate-500">
                        {game.connected_player_names.length > 0
                          ? `בפנים: ${game.connected_player_names.join(", ")}`
                          : "אף שחקן לא מחכה כרגע"}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button size="sm" type="button" onClick={() => navigate(`/play/${game.id}`)}>
                        המשך
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        disabled={dismissingPausedId !== null}
                        onClick={() => void dismissPausedSession(game.id)}
                      >
                        {dismissingPausedId === game.id ? "מסיר…" : "הסר"}
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={desktopPanelClass("flex min-h-0 flex-1 flex-col p-4")}>
          <div className="mb-3 border-b border-slate-100 pb-3">
            <h2 className="text-base font-black text-slate-950">חדרים פתוחים</h2>
            <p className="text-xs font-semibold text-slate-500">
              {openGames.length} חדרים שאפשר להצטרף אליהם
            </p>
          </div>
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <select
              className={cn(fieldInputClass, "py-2 text-sm")}
              value={openGameScope}
              onChange={(event) => setOpenGameScope(event.target.value as OpenGameScopeFilter)}
            >
              <option value="class">הכיתה שלי</option>
              <option value="all">כולם</option>
            </select>
            <select
              className={cn(fieldInputClass, "py-2 text-sm")}
              value={openGameIdFilter}
              onChange={(event) => setOpenGameIdFilter(event.target.value)}
            >
              <option value="">כל המשחקים</option>
              {openGameOptions.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto pr-1">
            {filteredOpenGames.length === 0 ? (
              <p className="rounded-xl bg-slate-50 px-4 py-6 text-center text-sm font-semibold text-slate-500">
                אין חדרים פתוחים לפי המסננים.
              </p>
            ) : (
              <ul className="space-y-2">
                {filteredOpenGames.map((game) => (
                  <li key={game.id} className="rounded-xl border border-slate-200 bg-white px-3 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-slate-900">
                          {game.games?.name_he ?? "משחק"} · {game.host_name}
                        </p>
                        <p className="truncate text-xs font-semibold text-slate-500">
                          כיתה {game.host_grade ?? "?"} · {game.status === "waiting" ? "ממתין" : "פעיל"}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {game.connected_player_names.length > 0
                            ? game.connected_player_names.join(", ")
                            : "אין שחקנים בחדר כרגע"}
                        </p>
                      </div>
                      <Button size="sm" type="button" onClick={() => navigate(`/play/${game.id}`)}>
                        הצטרף
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <OnlineKids className="min-h-[620px]" />

      {pendingGame ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/45 p-4 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-label="בחירת סוג חדר"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPendingGame(null);
          }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-black text-slate-950">{pendingGame.name_he}</h3>
            <p className="mt-1 text-sm font-semibold text-slate-500">איך ליצור את החדר?</p>
            <div className="mt-4 grid gap-2">
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
              <Button type="button" variant="ghost" onClick={() => setPendingGame(null)}>
                ביטול
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </KidDesktopShell>
  );
}
