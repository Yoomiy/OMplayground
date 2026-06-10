import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import {
  fetchFederatedAdminStats,
  type FederatedStats,
  type ServiceStats
} from "@/lib/adminStats";
import { Button } from "@/components/ui/button";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function AdminStatsSection() {
  const [stats, setStats] = useState<FederatedStats | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const timer = setInterval(() => void refresh(), 15_000);
    return () => clearInterval(timer);
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
        <h2 className="text-lg font-medium">סטטיסטיקות חיות</h2>
        <Button type="button" variant="outline" disabled={loading} onClick={() => void refresh()}>
          {loading ? "מרענן…" : "רענון"}
        </Button>
      </div>

      {err ? <p className="text-sm text-rose-600">{err}</p> : null}

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
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium">game-server</p>
            <p>Latency ממוצעת: {game.averageIntentLatencyMs} ms</p>
            <p>חיבורים: {game.activeConnections}</p>
          </div>
        ) : null}
        {voxel ? (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium">minecraft-server</p>
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
        <h3 className="text-sm font-medium text-slate-700">חדרים פעילים</h3>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600">
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
                  <td className="px-3 py-3 text-slate-500" colSpan={5}>
                    אין חדרים פעילים כרגע
                  </td>
                </tr>
              ) : (
                allRooms.map((room) => (
                  <tr key={`${room.server}-${room.sessionId}`} className="border-t">
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
        <h3 className="text-sm font-medium text-slate-700">לוחות בקרה (תשתית)</h3>
        <div className="flex flex-wrap gap-2 text-sm">
          <a
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
            href="https://railway.app"
            target="_blank"
            rel="noreferrer"
          >
            Railway — game-server / minecraft-server
          </a>
          <a
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
            href="https://cloud.livekit.io"
            target="_blank"
            rel="noreferrer"
          >
            LiveKit dashboard
          </a>
          <a
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
            href="https://vercel.com"
            target="_blank"
            rel="noreferrer"
          >
            Vercel — web
          </a>
          <a
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50"
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
          >
            Supabase — database
          </a>
        </div>
      </div>
    </section>
  );
}
