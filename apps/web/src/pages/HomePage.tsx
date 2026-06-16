import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Play, RotateCcw, Search } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useOpenGames } from "@/hooks/useOpenGames";
import { useMyPausedGames } from "@/hooks/useMyPausedGames";
import { leavePausedGameSession } from "@/lib/pausedSessionActions";
import { hasSoloSaveForGame, listSoloGameSaveKeys } from "@/lib/soloGameSaves";
import { OnlineKids } from "@/components/OnlineKids";
import { KidDesktopShell } from "@/components/KidDesktopShell";
import { cn } from "@/lib/cn";
import { useOnlinePresence } from "@/hooks/usePresence";
import { useInbox } from "@/hooks/useInbox";
import { KidAvatar } from "@/components/KidAvatar";

interface GameCatalogRow {
  id: string;
  name_he: string;
  description_he?: string;
  game_url: string;
  thumbnail_url?: string;
  is_multiplayer: boolean;
}

type GameTab = "solo" | "multi";
type OpenGameScopeFilter = "class" | "all";

const GAME_METADATA: Record<
  string,
  { emoji: string; gradient: string; glowColor: string; badgeGradient: string; thumbnailUrl?: string }
> = {
  tictactoe: { emoji: "❌", gradient: "from-sky-400 to-blue-600", glowColor: "shadow-sky-500/40", badgeGradient: "from-sky-400 to-blue-500" },
  connectfour: { emoji: "🔴", gradient: "from-red-400 to-rose-600", glowColor: "shadow-rose-500/40", badgeGradient: "from-red-400 to-rose-500" },
  memory: { emoji: "🃏", gradient: "from-amber-400 to-orange-600", glowColor: "shadow-amber-500/40", badgeGradient: "from-amber-400 to-orange-500" },
  drawing: { emoji: "🎨", gradient: "from-emerald-400 to-teal-600", glowColor: "shadow-emerald-500/40", badgeGradient: "from-emerald-400 to-teal-500" },
  snake: { emoji: "🐍", gradient: "from-green-400 to-emerald-600", glowColor: "shadow-green-500/40", badgeGradient: "from-green-400 to-emerald-500" },
  simon: { emoji: "🔴", gradient: "from-blue-400 to-indigo-600", glowColor: "shadow-indigo-500/40", badgeGradient: "from-blue-400 to-indigo-500" },
  whackamole: { emoji: "🔨", gradient: "from-yellow-400 to-amber-600", glowColor: "shadow-yellow-500/40", badgeGradient: "from-yellow-400 to-amber-500" },
  balloonpop: { emoji: "🎈", gradient: "from-pink-400 to-rose-600", glowColor: "shadow-pink-500/40", badgeGradient: "from-pink-400 to-rose-500" },
  chess: { emoji: "♟️", gradient: "from-slate-400 to-slate-700", glowColor: "shadow-slate-500/40", badgeGradient: "from-slate-400 to-slate-600" },
  "chess-solo": { emoji: "♟️", gradient: "from-slate-400 to-slate-700", glowColor: "shadow-slate-500/40", badgeGradient: "from-slate-400 to-slate-600" },
  "breakout-solo": { emoji: "👾", gradient: "from-purple-400 to-fuchsia-600", glowColor: "shadow-purple-500/40", badgeGradient: "from-purple-400 to-fuchsia-500", thumbnailUrl: "/legacy/breakout/thumbnail.png" },
  hexgl: { emoji: "🏎️", gradient: "from-orange-400 to-rose-600", glowColor: "shadow-rose-500/40", badgeGradient: "from-orange-400 to-rose-500" },
  "alges-escapade": { emoji: "🔢", gradient: "from-teal-400 to-cyan-600", glowColor: "shadow-teal-500/40", badgeGradient: "from-teal-400 to-cyan-500" },
  minecraft: { emoji: "🧱", gradient: "from-green-600 to-amber-800", glowColor: "shadow-green-700/40", badgeGradient: "from-green-600 to-amber-700", thumbnailUrl: "/legacy/minecraft/thumbnail.png" }
};

function panelClass(className?: string) {
  return cn(
    "rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md",
    className
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const { rows: openGames } = useOpenGames(user?.id, profile?.gender);
  const { rows: myPausedGames, loading: pausedLoading, refetch: refetchPaused } =
    useMyPausedGames(user?.id, profile?.gender);
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
  const [sidebarTab, setSidebarTab] = useState<"kids" | "rooms">("kids");

  const { onlineUserIds } = useOnlinePresence();
  const { unreadTotal } = useInbox();

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, name_he, description_he, game_url, thumbnail_url, is_multiplayer")
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
    void listSoloGameSaveKeys(user?.id)
      .then((keys) => {
        if (!cancelled) setSoloSaveKeys(new Set(keys));
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

  return (
    <KidDesktopShell
      title="לוח המשחקים 🎮"
      subtitle="בחרו משחק ותתחילו לשחק!"
      contentClassName="relative flex flex-col gap-5"
    >
      {/* Loading overlay */}
      {adminLoading || !profile ? (
        <div className="absolute inset-0 z-50 flex items-center justify-center rounded-2xl bg-black/50 backdrop-blur-sm">
          <div className="rounded-3xl border border-white/20 bg-white/10 px-8 py-5 shadow-xl backdrop-blur-md text-white font-black text-lg flex items-center gap-3">
            <span className="animate-spin text-2xl">⭐</span>
            טוען את המשחקים…
          </div>
        </div>
      ) : null}

      {/* ── Welcome Hero Banner ── */}
      {profile && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 p-6 text-white shadow-[0_8px_32px_rgba(139,92,246,0.5)] border border-white/20 animate-slide-up">
          {/* Decorative orbs */}
          <div className="pointer-events-none absolute -right-16 -top-16 size-52 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-16 -bottom-16 size-52 rounded-full bg-pink-400/20 blur-3xl" />
          {/* Sparkle decorations */}
          <span className="pointer-events-none absolute top-4 left-12 text-2xl animate-star-twinkle">✨</span>
          <span className="pointer-events-none absolute top-8 left-36 text-xl animate-star-twinkle" style={{ animationDelay: "0.5s" }}>⭐</span>
          <span className="pointer-events-none absolute bottom-4 right-24 text-2xl animate-star-twinkle" style={{ animationDelay: "1s" }}>🌟</span>

          <div className="flex flex-col sm:flex-row items-center gap-5 relative z-10">
            <div className="shrink-0 animate-kid-float">
              <KidAvatar
                profile={profile}
                className="size-20 min-h-[80px] min-w-[80px] rounded-3xl border-4 border-white/40 text-3xl shadow-[0_8px_24px_rgba(0,0,0,0.3)]"
              />
            </div>
            <div className="text-center sm:text-right flex-1">
              <h2 className="text-2xl sm:text-3xl font-black tracking-wide drop-shadow-sm">
                היי, {profile.full_name}! 👋
              </h2>
              <p className="mt-1 text-sm sm:text-base font-bold text-white/85">
                מוכן להרפתקה? יש {catalog.length} משחקים מדהימים שמחכים לך! 🚀
              </p>
              <div className="mt-4 flex flex-wrap gap-2 justify-center sm:justify-start">
                <span className="rounded-full bg-white/20 px-4 py-1.5 text-xs font-black backdrop-blur-sm border border-white/20 shadow-sm">
                  🏫 כיתה {profile.grade}
                </span>
                <span className="rounded-full bg-white/20 px-4 py-1.5 text-xs font-black backdrop-blur-sm border border-white/20 shadow-sm">
                  🟢 {onlineUserIds.size} מחוברים
                </span>
                {unreadTotal > 0 && (
                  <span className="rounded-full bg-rose-500 px-4 py-1.5 text-xs font-black border border-rose-400 shadow-[0_0_12px_rgba(239,68,68,0.5)] animate-pulse">
                    ✉️ {unreadTotal} הודעות חדשות!
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Main 2-column grid ── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_360px] grid-cols-1 items-start">

        {/* ── Game Catalog Panel ── */}
        <section className={panelClass("flex min-h-[640px] flex-col")}>
          {/* Tab header */}
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white flex items-center gap-2">
                <span className="text-2xl">🎮</span>
                במה נשחק היום?
              </h2>
              <p className="text-xs font-bold text-white/50 mt-0.5">
                {catalog.length} משחקים מדהימים מחכים לכם
              </p>
            </div>

            {/* Solo / Multi tab switcher */}
            <div className="flex gap-2 p-1 rounded-2xl bg-black/30 border border-white/10">
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-sm font-black transition-all duration-200 min-w-28",
                  gameTab === "solo"
                    ? "bg-gradient-to-r from-sky-400 to-blue-500 text-white shadow-[0_4px_12px_rgba(56,189,248,0.4)]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
                onClick={() => setGameTab("solo")}
              >
                <span className="text-base">👤</span>
                לבד ({soloGames.length})
              </button>
              <button
                type="button"
                className={cn(
                  "flex items-center justify-center gap-2 rounded-xl py-2.5 px-5 text-sm font-black transition-all duration-200 min-w-28",
                  gameTab === "multi"
                    ? "bg-gradient-to-r from-violet-400 to-fuchsia-500 text-white shadow-[0_4px_12px_rgba(167,139,250,0.4)]"
                    : "text-white/60 hover:text-white hover:bg-white/10"
                )}
                onClick={() => setGameTab("multi")}
              >
                <span className="text-base">👥</span>
                ביחד ({mpGames.length})
              </button>
            </div>
          </div>

          {/* Search */}
          <label className="relative mb-5 block">
            <Search className="pointer-events-none absolute right-4 top-1/2 size-5 -translate-y-1/2 text-white/40" aria-hidden />
            <input
              className="min-h-12 w-full rounded-2xl border border-white/10 bg-white/10 py-3 pl-4 pr-12 text-base font-bold text-white outline-none transition placeholder:text-white/40 focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20 focus:bg-white/10"
              value={gameSearch}
              onChange={(event) => setGameSearch(event.target.value)}
              placeholder="איזה משחק בא לכם לשחק עכשיו?"
            />
          </label>

          {err ? (
            <p className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300 shadow-sm" role="alert">
              ⚠️ {err}
            </p>
          ) : null}

          {/* Game grid */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {activeGames.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/20 bg-white/5 px-6 py-12 text-center">
                <span className="text-5xl block mb-3">🔍</span>
                <p className="text-sm font-bold text-white/60">
                  לא מצאנו משחקים שמתאימים לחיפוש שלכם.
                </p>
                <button
                  type="button"
                  onClick={() => setGameSearch("")}
                  className="mt-3 text-xs font-black text-violet-400 underline hover:text-violet-300"
                >
                  הצג את כל המשחקים
                </button>
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {activeGames.map((game, index) => {
                  const meta = GAME_METADATA[game.game_url] || {
                    emoji: "🎮",
                    gradient: "from-indigo-400 to-violet-600",
                    glowColor: "shadow-violet-500/40",
                    badgeGradient: "from-indigo-400 to-violet-500",
                  };
                  const hasSave = hasSoloSaveForGame(soloSaveKeys, game.game_url);
                  return (
                    <li
                      key={game.id}
                      className="group animate-slide-up"
                      style={{ animationDelay: `${index * 40}ms` }}
                    >
                      <button
                        type="button"
                        disabled={busyGameId !== null}
                        onClick={() =>
                          game.is_multiplayer
                            ? setPendingGame(game)
                            : navigate(`/solo/${game.game_url}`)
                        }
                        className={cn(
                          "relative flex w-full flex-col overflow-hidden rounded-3xl border border-white/15 bg-white/5 text-right transition-all duration-200",
                          "hover:scale-[1.04] hover:border-white/30 hover:bg-white/10",
                          "hover:shadow-[0_12px_32px_rgba(0,0,0,0.5)]",
                          "active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed"
                        )}
                      >
                        {/* Card header with gradient */}
                        <div className={cn(
                          "relative flex h-32 w-full items-center justify-center overflow-hidden bg-gradient-to-br",
                          meta.gradient
                        )}>
                          {/* Shine overlay */}
                          <div className="absolute inset-0 bg-gradient-to-b from-white/20 to-transparent" />

                          {game.thumbnail_url || meta.thumbnailUrl ? (
                            <img
                              src={game.thumbnail_url || meta.thumbnailUrl}
                              alt={game.name_he}
                              className="size-full object-cover"
                            />
                          ) : (
                            <span className="text-6xl drop-shadow-lg select-none transform transition-transform duration-300 group-hover:scale-110 group-hover:animate-kid-wiggle">
                              {meta.emoji}
                            </span>
                          )}

                          {/* Save badge */}
                          {hasSave && (
                            <span className="absolute top-2.5 right-2.5 rounded-full bg-emerald-500 px-2.5 py-0.5 text-[9px] font-black text-white shadow-lg flex items-center gap-1 border border-emerald-400/50">
                              💾 שמור
                            </span>
                          )}

                          {/* Mode badge */}
                          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-black/40 px-2.5 py-1 text-[9px] font-black text-white backdrop-blur-sm border border-white/10">
                            {game.is_multiplayer ? "👥 ביחד" : "👤 לבד"}
                          </span>
                        </div>

                        {/* Card body */}
                        <div className="flex flex-col flex-1 p-4 gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-black text-white leading-snug group-hover:text-violet-300 transition-colors">
                              {game.name_he}
                            </h3>
                            <p className="mt-1 text-xs font-semibold text-white/50 line-clamp-2 min-h-8">
                              {game.description_he || "משחק מהנה ומאתגר!"}
                            </p>
                          </div>

                          {/* Play button */}
                          <div className={cn(
                            "w-full rounded-xl py-2.5 px-3 text-center text-sm font-black flex items-center justify-center gap-2 transition-all duration-200 border",
                            game.is_multiplayer
                              ? "bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border-violet-400/30 text-violet-300 group-hover:from-violet-500 group-hover:to-fuchsia-500 group-hover:border-violet-400 group-hover:text-white group-hover:shadow-[0_4px_12px_rgba(167,139,250,0.4)]"
                              : "bg-gradient-to-r from-sky-500/20 to-blue-500/20 border-sky-400/30 text-sky-300 group-hover:from-sky-400 group-hover:to-blue-500 group-hover:border-sky-400 group-hover:text-white group-hover:shadow-[0_4px_12px_rgba(56,189,248,0.4)]"
                          )}>
                            <Play className="size-4 fill-current" aria-hidden />
                            {game.is_multiplayer
                              ? busyGameId === game.id
                                ? "יוצר חדר…"
                                : "צור חדר משחק"
                              : hasSave
                                ? "המשך משחק 🔥"
                                : "שחק עכשיו!"}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        {/* ── Sidebar: Social & Rooms Hub ── */}
        <div className="flex flex-col gap-5 w-full min-h-[640px]">

          {/* Paused games section (grows naturally, no scrollbar) */}
          {!pausedLoading && myPausedGames.length > 0 ? (
            <section className="rounded-3xl border border-amber-400/30 bg-amber-500/10 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md animate-slide-up">
              <div className="mb-4 flex items-center gap-2 border-b border-amber-400/20 pb-3">
                <RotateCcw className="size-5 text-amber-400" aria-hidden />
                <h2 className="text-base font-black text-amber-300 flex items-center gap-2">
                  ⏱️ לחזור למשחק?
                </h2>
              </div>
              <ul className="space-y-3">
                {myPausedGames.map((game) => (
                  <li key={game.id} className="rounded-2xl border border-amber-400/25 bg-amber-500/10 p-3 transition hover:-translate-y-0.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white flex items-center gap-1.5">
                          <span>🎮</span>
                          {game.games?.name_he ?? "משחק"}
                        </p>
                        <p className="truncate text-xs font-bold text-white/50 mt-0.5">
                          מארח: {game.host_name}
                        </p>
                        <p className="truncate text-[10px] font-black text-amber-400 mt-1.5 bg-amber-500/10 px-2 py-0.5 rounded-lg inline-block">
                          {game.connected_player_names.length > 0
                            ? `👥 בפנים: ${game.connected_player_names.join(", ")}`
                            : "⏳ ממתין לשחקנים"}
                        </p>
                      </div>
                      <div className="flex shrink-0 gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/play/${game.id}`)}
                          className="rounded-xl bg-amber-500 border border-amber-400/50 px-3 py-1.5 text-xs font-black text-white shadow-[0_4px_12px_rgba(245,158,11,0.4)] hover:bg-amber-400 hover:-translate-y-0.5 transition-all"
                        >
                          המשך
                        </button>
                        <button
                          type="button"
                          disabled={dismissingPausedId !== null}
                          onClick={() => void dismissPausedSession(game.id)}
                          className="rounded-xl bg-rose-500/10 border border-rose-400/30 px-3 py-1.5 text-xs font-black text-rose-400 hover:bg-rose-500 hover:text-white hover:-translate-y-0.5 transition-all disabled:opacity-50"
                        >
                          {dismissingPausedId === game.id ? "מסיר…" : "הסר"}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Tab Switcher for Sidebar Hub */}
          <div className="flex gap-2 p-1 rounded-2xl bg-black/30 border border-white/10 shrink-0">
            <button
              type="button"
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-black transition-all duration-200",
                sidebarTab === "kids"
                  ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_4px_12px_rgba(52,211,153,0.3)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
              onClick={() => setSidebarTab("kids")}
            >
              <span>🟢</span>
              חברים מחוברים
            </button>
            <button
              type="button"
              className={cn(
                "flex-1 flex items-center justify-center gap-2 rounded-xl py-2 px-3 text-xs font-black transition-all duration-200",
                sidebarTab === "rooms"
                  ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              )}
              onClick={() => setSidebarTab("rooms")}
            >
              <span>🚪</span>
              חדרים פתוחים ({openGames.length})
            </button>
          </div>

          {/* Tab Content Panel */}
          {sidebarTab === "kids" ? (
            <OnlineKids className="flex-1 scrollbar-hide" />
          ) : (
            <section className={panelClass("border-violet-400/25 bg-violet-500/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] flex min-h-0 flex-1 flex-col")}>
              <div className="mb-4 border-b border-white/10 pb-3">
                <h2 className="text-base font-black text-white flex items-center gap-2">
                  <span className="text-xl">🚪</span>
                  חדרים פתוחים
                </h2>
                <p className="text-xs font-bold text-white/50 mt-0.5">
                  {openGames.length} חדרים שאתם יכולים להצטרף אליהם
                </p>
              </div>

              {/* Filters */}
              <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
                <select
                  className="rounded-xl border border-white/10 bg-white/10 py-2 px-3 text-xs font-bold text-white min-h-10 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
                  value={openGameScope}
                  onChange={(event) => setOpenGameScope(event.target.value as OpenGameScopeFilter)}
                >
                  <option value="class">🏫 הכיתה שלי</option>
                  <option value="all">🌍 כולם</option>
                </select>
                <select
                  className="rounded-xl border border-white/10 bg-white/10 py-2 px-3 text-xs font-bold text-white min-h-10 outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-500/20"
                  value={openGameIdFilter}
                  onChange={(event) => setOpenGameIdFilter(event.target.value)}
                >
                  <option value="">🎯 כל המשחקים</option>
                  {openGameOptions.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto pr-1 scrollbar-hide">
                {filteredOpenGames.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-4 py-8 text-center">
                    <span className="text-3xl block mb-2">🕹️</span>
                    <p className="text-xs font-bold text-white/40">
                      אין כרגע חדרים פתוחים לפי הסינון.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-3">
                    {filteredOpenGames.map((game) => (
                      <li key={game.id} className="rounded-2xl border border-violet-400/20 bg-violet-500/10 p-3.5 transition hover:-translate-y-0.5 hover:border-violet-400/40">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-white flex items-center gap-1.5">
                              <span>🚪</span>
                              {game.games?.name_he ?? "משחק"}
                            </p>
                            <p className="truncate text-xs font-bold text-white/50 mt-1">
                              מארח: {game.host_name} (כיתה {game.host_grade ?? "?"})
                            </p>
                            <p className="truncate text-[11px] font-semibold text-white/40 mt-1">
                              {game.connected_player_names.length > 0
                                ? `👥 בפנים: ${game.connected_player_names.join(", ")}`
                                : "אין שחקנים בחדר כרגע"}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className={cn(
                              "rounded-full px-2 py-0.5 text-[9px] font-black text-white shrink-0",
                              game.status === "waiting" ? "bg-emerald-500 shadow-[0_0_8px_rgba(52,211,153,0.5)]" : "bg-indigo-500"
                            )}>
                              {game.status === "waiting" ? "ממתין" : "פעיל"}
                            </span>
                            <button
                              type="button"
                              onClick={() => navigate(`/play/${game.id}`)}
                              className="rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 border border-violet-400/50 px-4 py-1.5 text-xs font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.4)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.6)] hover:-translate-y-0.5 transition-all shrink-0"
                            >
                              הצטרף! 🚀
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {pendingGame ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label="בחירת סוג חדר"
          onClick={(event) => {
            if (event.target === event.currentTarget) setPendingGame(null);
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-white/15 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-xl text-right animate-scale-up">
            <h3 className="text-xl font-black text-white flex items-center gap-2">
              <span>🎮</span>
              {pendingGame.name_he}
            </h3>
            <p className="mt-2 text-sm font-bold text-white/60">איך בא לכם ליצור את החדר?</p>
            <div className="mt-6 grid gap-3">
              <button
                type="button"
                className="w-full rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 border border-emerald-400/50 py-3.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(16,185,129,0.3)] hover:shadow-[0_4px_16px_rgba(16,185,129,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                disabled={busyGameId !== null}
                onClick={() => {
                  void createSession(pendingGame.id, true);
                  setPendingGame(null);
                }}
              >
                🚪 חדר פתוח (כולם יכולים להצטרף!)
              </button>
              <button
                type="button"
                className="w-full rounded-2xl bg-white/10 border border-white/20 py-3.5 text-sm font-black text-white hover:bg-white/15 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200"
                disabled={busyGameId !== null}
                onClick={() => {
                  void createSession(pendingGame.id, false);
                  setPendingGame(null);
                }}
              >
                🔒 חדר פרטי (עם קישור הזמנה בלבד)
              </button>
              <button
                type="button"
                className="w-full rounded-2xl bg-transparent py-2.5 text-sm font-black text-white/50 hover:text-white hover:bg-white/5 transition-all duration-200"
                onClick={() => setPendingGame(null)}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </KidDesktopShell>
  );
}
