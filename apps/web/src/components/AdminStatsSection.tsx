import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchFederatedAdminStats,
  type FederatedStats
} from "@/lib/adminStats";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-[0_4px_12px_rgba(0,0,0,0.3)]">
      <p className="text-xs text-white/50">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}

export function AdminStatsSection() {
  const [stats, setStats] = useState<FederatedStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [historicalLaunches, setHistoricalLaunches] = useState<any[]>([]);
  const [historicalFps, setHistoricalFps] = useState<any[]>([]);
  const [loadingHistorical, setLoadingHistorical] = useState(false);
  const [historicalErr, setHistoricalErr] = useState<string | null>(null);
  const [gamesList, setGamesList] = useState<any[]>([]);
  const [sessionsList, setSessionsList] = useState<any[]>([]);
  const [selectedGame, setSelectedGame] = useState<any | null>(null);

  const refreshHistorical = useCallback(async () => {
    setLoadingHistorical(true);
    setHistoricalErr(null);
    try {
      const { data: launchData, error: launchErr } = await supabase
        .from("game_launch_stats")
        .select("launch_count, last_launched_at, game_url, kid_profiles ( full_name )");

      if (launchErr) throw launchErr;

      const { data: fpsData, error: fpsErr } = await supabase
        .from("minecraft_fps_stats")
        .select("session_id, loading_avg_fps, loading_sample_count, runtime_avg_fps, runtime_sample_count, recorded_at, kid_profiles ( full_name )")
        .order("recorded_at", { ascending: false })
        .limit(200);

      if (fpsErr) throw fpsErr;

      const { data: gamesData, error: gamesErr } = await supabase
        .from("games")
        .select("id, name_he, game_url, is_multiplayer, is_active")
        .order("name_he");

      if (gamesErr) throw gamesErr;

      const { data: sessionsData, error: sessionsErr } = await supabase
        .from("game_sessions")
        .select("id, created_at, player_names, status, peak_player_count, games ( game_url )")
        .order("created_at", { ascending: false })
        .limit(300);

      if (sessionsErr) throw sessionsErr;

      setHistoricalLaunches(launchData || []);
      setHistoricalFps(fpsData || []);
      setGamesList(gamesData || []);
      setSessionsList(sessionsData || []);
    } catch (e: any) {
      setHistoricalErr(e.message || "לא ניתן לטעון היסטוריה מהמסד");
    } finally {
      setLoadingHistorical(false);
    }
  }, []);

  useEffect(() => {
    void refreshHistorical();
  }, [refreshHistorical]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) {
        setErr("אין סשן פעיל");
        return;
      }
      setStats(await fetchFederatedAdminStats(token));
    } catch {
      setErr("לא ניתן לטעון סטטיסטיקות מהשרתים");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    let timer = setInterval(() => void refresh(), 15_000);

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(timer);
      } else {
        void refresh();
        timer = setInterval(() => void refresh(), 15_000);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [refresh]);

  const game = stats?.game;
  const voxel = stats?.voxel;
  const totalConnections =
    (game?.activeConnections ?? 0) + (voxel?.activeConnections ?? 0);
  const totalRooms =
    (game?.activeRoomsCount ?? 0) + (voxel?.activeRoomsCount ?? 0);
  const voiceParticipants = voxel?.voice?.totalParticipants ?? 0;

  const allRooms = [
    ...(game?.rooms ?? []).map((r) => ({ ...r, server: "game" as const })),
    ...(voxel?.rooms ?? []).map((r) => ({ ...r, server: "voxel" as const }))
  ];

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-black text-white">סטטיסטיקות חיות</h2>
        <button
          type="button"
          disabled={loading}
          onClick={() => void refresh()}
          className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
        >
          {loading ? "מרענן…" : "רענון"}
        </button>
      </div>

      {err ? <p className="text-sm text-rose-400">{err}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="חיבורי Socket פעילים" value={totalConnections} />
        <StatCard label="חדרי משחק פעילים" value={totalRooms} />
        <StatCard label="משתתפי קול (LiveKit)" value={voiceParticipants} />
        <StatCard
          label="קצב Intent — game-server"
          value={game?.intentsPerSecond ?? "—"}
        />
        <StatCard
          label="קצב Intent — voxel"
          value={voxel?.intentsPerSecond ?? "—"}
        />
        <StatCard
          label="כשלונות Intent (5 דק׳)"
          value={
            (game?.intentFailuresLast5Min ?? 0) +
            (voxel?.intentFailuresLast5Min ?? 0)
          }
        />
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {game ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            <p className="font-medium text-white">game-server</p>
            <p>Latency ממוצעת: {game.averageIntentLatencyMs} ms</p>
            <p>חיבורים: {game.activeConnections}</p>
          </div>
        ) : null}
        {voxel ? (
          <div className="rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-white/80">
            <p className="font-medium text-white">minecraft-server</p>
            <p>Latency ממוצעת: {voxel.averageIntentLatencyMs} ms</p>
            <p>חיבורים: {voxel.activeConnections}</p>
            {voxel.voice ? (
              <p>
                חדרי קול: {voxel.voice.activeRooms}, משתתפים:{" "}
                {voxel.voice.totalParticipants}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-black text-white/80">חדרים פעילים</h3>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-white/5">
          <table className="min-w-full text-left text-xs text-white/80">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="px-3 py-2">sessionId</th>
                <th className="px-3 py-2">gameType</th>
                <th className="px-3 py-2">server</th>
                <th className="px-3 py-2">players</th>
                <th className="px-3 py-2">uptime</th>
              </tr>
            </thead>
            <tbody>
              {allRooms.length === 0 ? (
                <tr>
                  <td className="px-3 py-3 text-white/40" colSpan={5}>
                    אין חדרים פעילים כרגע
                  </td>
                </tr>
              ) : (
                allRooms.map((room) => (
                  <tr key={`${room.server}-${room.sessionId}`} className="border-t border-white/10 hover:bg-white/5">
                    <td className="px-3 py-2 font-mono">{room.sessionId}</td>
                    <td className="px-3 py-2">{room.gameType}</td>
                    <td className="px-3 py-2">{room.server}</td>
                    <td className="px-3 py-2">{room.playerCount}</td>
                    <td className="px-3 py-2">{room.uptimeSeconds}s</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="text-sm font-black text-white/80">לוחות בקרה (תשתית)</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            href="https://railway.app"
            target="_blank"
            rel="noreferrer"
          >
            Railway — game-server / minecraft-server
          </a>
          <a
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            href="https://cloud.livekit.io"
            target="_blank"
            rel="noreferrer"
          >
            LiveKit dashboard
          </a>
          <a
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            href="https://vercel.com"
            target="_blank"
            rel="noreferrer"
          >
            Vercel — web
          </a>
          <a
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            Supabase — database
          </a>
        </div>
      </div>

      <hr className="my-6 border-white/10" />

      <div className="space-y-6 text-right">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-black text-white">סטטיסטיקות היסטוריות מהמסד</h2>
          <button
            type="button"
            disabled={loadingHistorical}
            onClick={() => void refreshHistorical()}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
          >
            {loadingHistorical ? "מרענן היסטוריה…" : "רענן היסטוריה"}
          </button>
        </div>

        {historicalErr ? <p className="text-sm text-rose-400">{historicalErr}</p> : null}

        {/* Game Launches Grid */}
        <div className="space-y-3">
          <h3 className="text-sm font-black text-white/80">סטטיסטיקות הפעלת משחקים</h3>
          {gamesList.length === 0 ? (
            <p className="text-sm text-white/40">אין נתוני משחקים טעונים.</p>
          ) : (
            <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {gamesList.map((game) => {
                const total = historicalLaunches
                  .filter((s) => s.game_url === game.game_url)
                  .reduce((sum, item) => sum + item.launch_count, 0);
                return (
                  <button
                    key={game.id}
                    type="button"
                    onClick={() => setSelectedGame(game)}
                    className="group relative flex flex-col justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:border-indigo-500/50 hover:bg-white/10 hover:shadow-lg transition-all duration-200 text-right w-full"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          game.is_multiplayer
                            ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                            : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        }`}>
                          {game.is_multiplayer ? "רב משתתפים" : "שחקן יחיד"}
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-400 transition-colors leading-tight">
                        {game.name_he}
                      </h4>
                      <p className="text-[10px] text-white/40 font-mono mt-1 truncate">{game.game_url}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between w-full">
                      <span className="text-[11px] text-white/55">הפעלות:</span>
                      <span className="text-base font-extrabold text-indigo-400 group-hover:text-indigo-300 transition-colors">
                        {total}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Minecraft FPS Table */}
        <div className="space-y-2 pt-4">
          <h3 className="text-sm font-black text-white/80">ביצועי FPS – מיינקראפט (200 אחרונים)</h3>
          <div className="max-h-[350px] overflow-auto rounded-xl border border-white/10 bg-white/5">
            <table className="min-w-full text-right text-xs text-white/80">
              <thead className="bg-white/10 text-white/60 sticky top-0">
                <tr className="border-b border-white/10">
                  <th className="px-3 py-2 text-right">שם הילד</th>
                  <th className="px-3 py-2 text-right">סשן (sessionId)</th>
                  <th className="px-3 py-2 text-right">FPS ממוצע (טעינה)</th>
                  <th className="px-3 py-2 text-right">FPS ממוצע (משחק)</th>
                  <th className="px-3 py-2 text-right">תאריך</th>
                </tr>
              </thead>
              <tbody>
                {historicalFps.length === 0 ? (
                  <tr>
                    <td className="px-3 py-3 text-white/40 text-center" colSpan={5}>
                      אין נתוני FPS
                    </td>
                  </tr>
                ) : (
                  historicalFps.map((row, i) => (
                    <tr key={`${row.session_id}-${i}`} className="border-t border-white/10 hover:bg-white/5">
                      <td className="px-3 py-2 font-medium">{row.kid_profiles?.full_name ?? "—"}</td>
                      <td className="px-3 py-2 font-mono truncate max-w-[120px]">{row.session_id}</td>
                      <td className="px-3 py-2">
                        {row.loading_avg_fps
                          ? `${row.loading_avg_fps.toFixed(1)} (${row.loading_sample_count})`
                          : "—"}
                      </td>
                      <td className="px-3 py-2">
                        {row.runtime_avg_fps
                          ? `${row.runtime_avg_fps.toFixed(1)} (${row.runtime_sample_count})`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 text-white/55">
                        {new Date(row.recorded_at).toLocaleString("he-IL")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail Modal Dialog */}
      {selectedGame && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-slate-900 border border-white/10 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold mb-2 ${
                  selectedGame.is_multiplayer
                    ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                }`}>
                  {selectedGame.is_multiplayer ? "רב משתתפים" : "שחקן יחיד"}
                </span>
                <h3 className="text-xl font-bold text-white">{selectedGame.name_he}</h3>
                <p className="text-xs text-white/55 mt-1">
                  סך הכל הפעלות:{" "}
                  <span className="font-bold text-indigo-400">
                    {historicalLaunches
                      .filter((s) => s.game_url === selectedGame.game_url)
                      .reduce((sum, item) => sum + item.launch_count, 0)}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedGame(null)}
                className="text-white/40 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1 text-right">
              {/* Who played list */}
              <div>
                <h4 className="text-xs font-black text-white/50 uppercase tracking-wider mb-3">שחקנים והפעלות</h4>
                {historicalLaunches.filter((s) => s.game_url === selectedGame.game_url).length === 0 ? (
                  <p className="text-sm text-white/40">אף אחד לא שיחק במשחק זה עדיין.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {historicalLaunches
                      .filter((s) => s.game_url === selectedGame.game_url)
                      .sort((a, b) => b.launch_count - a.launch_count)
                      .map((userStat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5"
                        >
                          <span className="font-semibold text-white/95 text-sm">
                            {userStat.kid_profiles?.full_name || "שחקן לא מזוהה"}
                          </span>
                          <span className="text-xs bg-white/10 px-2 py-1 rounded-md border border-white/5 font-bold text-white/80">
                            {userStat.launch_count} הפעלות
                          </span>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Multiplayer sessions list */}
              {selectedGame.is_multiplayer && (
                <div>
                  <h4 className="text-xs font-black text-white/50 uppercase tracking-wider mb-3">סשנים מרובי משתתפים אחרונים</h4>
                  {sessionsList.filter((s) => s.games?.game_url === selectedGame.game_url).length === 0 ? (
                    <p className="text-sm text-white/40">אין סשנים מוקלטים למשחק זה.</p>
                  ) : (
                    <div className="space-y-3">
                      {sessionsList
                        .filter((s) => s.games?.game_url === selectedGame.game_url)
                        .slice(0, 15)
                        .map((session, idx) => {
                          const names = Array.isArray(session.player_names) ? session.player_names : [];
                          return (
                            <div key={idx} className="p-4 bg-white/5 rounded-xl border border-white/5 flex flex-col gap-2">
                              <div className="flex items-center justify-between text-[11px] text-white/40">
                                <span>{new Date(session.created_at).toLocaleString("he-IL")}</span>
                                {session.peak_player_count > 0 && (
                                  <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold">
                                    שיא משתתפים: {session.peak_player_count}
                                  </span>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {names.length === 0 ? (
                                  <span className="text-xs text-white/30">ללא שחקנים רשומים</span>
                                ) : (
                                  names.map((name: string, nIdx: number) => (
                                    <span
                                      key={nIdx}
                                      className="text-xs bg-white/10 border border-white/5 px-2 py-1 rounded-md text-white/90 font-medium"
                                    >
                                      {name}
                                    </span>
                                  ))
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedGame(null)}
                className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white text-xs font-bold transition duration-200"
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
