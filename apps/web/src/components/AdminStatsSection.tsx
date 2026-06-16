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

  const refreshHistorical = useCallback(async () => {
    setLoadingHistorical(true);
    setHistoricalErr(null);
    try {
      const { data: launchData, error: launchErr } = await supabase
        .from("game_launch_stats")
        .select("launch_count, last_launched_at, game_url, kid_profiles ( full_name )")
        .order("launch_count", { ascending: false })
        .limit(200);

      if (launchErr) throw launchErr;

      const { data: fpsData, error: fpsErr } = await supabase
        .from("minecraft_fps_stats")
        .select("session_id, loading_avg_fps, loading_sample_count, runtime_avg_fps, runtime_sample_count, recorded_at, kid_profiles ( full_name )")
        .order("recorded_at", { ascending: false })
        .limit(200);

      if (fpsErr) throw fpsErr;

      setHistoricalLaunches(launchData || []);
      setHistoricalFps(fpsData || []);
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

      <div className="space-y-4 text-right">
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

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Game Launch Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-black text-white/80">סטטיסטיקות הפעלת משחקים (200 הכי פעילים)</h3>
            <div className="max-h-[350px] overflow-auto rounded-xl border border-white/10 bg-white/5">
              <table className="min-w-full text-right text-xs text-white/80">
                <thead className="bg-white/10 text-white/60 sticky top-0">
                  <tr className="border-b border-white/10">
                    <th className="px-3 py-2 text-right">שם הילד</th>
                    <th className="px-3 py-2 text-right">משחק (gameKey)</th>
                    <th className="px-3 py-2 text-center">מספר הפעלות</th>
                    <th className="px-3 py-2 text-right">פעם אחרונה</th>
                  </tr>
                </thead>
                <tbody>
                  {historicalLaunches.length === 0 ? (
                    <tr>
                      <td className="px-3 py-3 text-white/40 text-center" colSpan={4}>
                        אין נתוני הפעלות
                      </td>
                    </tr>
                  ) : (
                    historicalLaunches.map((row, i) => (
                      <tr key={`${row.game_url}-${i}`} className="border-t border-white/10 hover:bg-white/5">
                        <td className="px-3 py-2 font-medium">{row.kid_profiles?.full_name ?? "—"}</td>
                        <td className="px-3 py-2 font-mono">{row.game_url}</td>
                        <td className="px-3 py-2 text-center font-bold text-white">{row.launch_count}</td>
                        <td className="px-3 py-2 text-white/55">
                          {new Date(row.last_launched_at).toLocaleString("he-IL")}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Minecraft FPS Table */}
          <div className="space-y-2">
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
      </div>
    </section>
  );
}
