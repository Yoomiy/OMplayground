import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";

interface GameRow {
  id: string;
  name_he: string;
  is_active: boolean;
  game_url: string;
}

interface KidRow {
  id: string;
  username: string;
  full_name: string;
  role: string;
  grade: number;
  is_active: boolean;
}

interface ReportRow {
  id: string;
  status: string;
  reporter_kid_name: string;
  reported_kid_name: string;
  message_content: string;
  reporter_note: string | null;
  created_at: string;
}

/**
 * Platform admin only (`admin_profiles`). CRUD uses RLS; bulk kid import uses Edge Function + service role.
 */
export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const [games, setGames] = useState<GameRow[]>([]);
  const [kids, setKids] = useState<KidRow[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [audit, setAudit] = useState<
    { id: string; action: string; created_at: string; metadata: unknown }[]
  >([]);
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!user || !isAdmin) return;
    const [g, k, r, a] = await Promise.all([
      supabase.from("games").select("id, name_he, is_active, game_url").order("name_he"),
      supabase
        .from("kid_profiles")
        .select("id, username, full_name, role, grade, is_active")
        .order("username")
        .limit(80),
      supabase
        .from("moderation_reports")
        .select(
          "id, status, reporter_kid_name, reported_kid_name, message_content, reporter_note, created_at"
        )
        .order("created_at", { ascending: false })
        .limit(50),
      supabase
        .from("audit_log")
        .select("id, action, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(30)
    ]);
    if (!g.error) setGames((g.data ?? []) as GameRow[]);
    if (!k.error) setKids((k.data ?? []) as KidRow[]);
    if (!r.error) setReports((r.data ?? []) as ReportRow[]);
    if (!a.error) setAudit((a.data ?? []) as typeof audit);
  }, [user, isAdmin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const ch = supabase
      .channel("admin-moderation-reports")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "moderation_reports" },
        () => {
          void reload();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [user, isAdmin, reload]);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  async function toggleGameActive(game: GameRow) {
    setErr(null);
    const { error } = await supabase
      .from("games")
      .update({ is_active: !game.is_active })
      .eq("id", game.id);
    if (error) setErr(error.message);
    void reload();
  }

  async function toggleKidActive(kid: KidRow) {
    setErr(null);
    const { error } = await supabase
      .from("kid_profiles")
      .update({ is_active: !kid.is_active })
      .eq("id", kid.id);
    if (error) setErr(error.message);
    void reload();
  }

  async function updateReportStatus(id: string, status: "pending" | "reviewed") {
    setErr(null);
    const { error } = await supabase
      .from("moderation_reports")
      .update({ status })
      .eq("id", id);
    if (error) setErr(error.message);
    void reload();
  }

  async function runRpc(
    name: "admin_evict_stale_players" | "admin_expire_old_sessions" | "admin_complete_all_open_sessions",
    params?: Record<string, number>
  ) {
    setErr(null);
    setMsg(null);
    setBusy(true);
    const { data, error } = await supabase.rpc(name, params ?? {});
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg(JSON.stringify(data));
    void reload();
  }

  async function deleteKid(id: string) {
    if (!window.confirm("למחוק משתמש זה לצמיתות? פעולה בלתי הפיכה.")) return;
    setErr(null);
    const { error } = await supabase.rpc("admin_delete_kid_cascade", {
      p_kid_id: id
    });
    if (error) setErr(error.message);
    void reload();
  }

  async function importCsv() {
    setErr(null);
    setMsg(null);
    const lines = csvText.split(/\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) {
      setErr("נדרש כותרת ולפחות שורה אחת");
      return;
    }
    const header = lines[0].split(",").map((s) => s.trim().toLowerCase());
    const need = ["username", "password", "full_name", "gender", "grade"];
    const idx = Object.fromEntries(header.map((h, i) => [h, i]));
    for (const n of need) {
      if (idx[n] === undefined) {
        setErr(`חסר עמודה: ${n}`);
        return;
      }
    }
    const rows = lines.slice(1).map((line) => {
      const cells = line.split(",").map((s) => s.trim());
      const roleIdx = idx["role"];
      return {
        username: cells[idx["username"]!] ?? "",
        password: cells[idx["password"]!] ?? "",
        full_name: cells[idx["full_name"]!] ?? "",
        gender: cells[idx["gender"]!] ?? "boy",
        grade: Number(cells[idx["grade"]!] ?? "1"),
        role: roleIdx !== undefined ? cells[roleIdx] || "kid" : "kid"
      };
    });
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("import-bulk-kids", {
      body: { rows }
    });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setMsg(typeof data === "object" ? JSON.stringify(data) : String(data));
    setCsvText("");
    void reload();
  }

  if (adminLoading) {
    return <p className="p-6 text-sm text-slate-500">טוען…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-medium text-amber-900">
          אין הרשאה — חשבון מנהל נדרש.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">ניהול</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link to="/home">בית</Link>
          </Button>
          <Button variant="outline" type="button" onClick={() => void logout()}>
            התנתק
          </Button>
        </div>
      </header>

      {err ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900" role="status">
          {msg}
        </p>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-lg font-medium">דיווחי ניהול (מודרציה)</h2>
        <p className="text-xs text-slate-500">
          תוכן ההודעה המדווחת והערת המדווח; עדכון סטטוס נשמר ב-RLS.
        </p>
        <ul className="space-y-3 text-sm">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium text-slate-900">
                    {r.reporter_kid_name} מדווח על {r.reported_kid_name}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(r.created_at).toLocaleString("he-IL")} · סטטוס:{" "}
                    <span className="text-slate-700">{r.status}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.status === "pending" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={busy}
                      onClick={() => void updateReportStatus(r.id, "reviewed")}
                    >
                      סמן כנבדק
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      disabled={busy}
                      onClick={() => void updateReportStatus(r.id, "pending")}
                    >
                      החזר ל־pending
                    </Button>
                  )}
                </div>
              </div>
              <div className="mt-2 space-y-1 rounded-xl border border-slate-100 bg-slate-50 p-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">תוכן מדווח</p>
                <p className="whitespace-pre-wrap text-slate-800">
                  {r.message_content}
                </p>
                {r.reporter_note ? (
                  <>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      הערת מדווח
                    </p>
                    <p className="whitespace-pre-wrap text-slate-800">
                      {r.reporter_note}
                    </p>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {reports.length === 0 ? (
          <p className="text-sm text-slate-500">אין דיווחים.</p>
        ) : null}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">משחקים</h2>
        <ul className="space-y-1 text-sm">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
            >
              <span>
                {g.name_he}{" "}
                <span className="text-slate-500">({g.game_url})</span>
              </span>
              <Button
                size="sm"
                variant="outline"
                type="button"
                disabled={busy}
                onClick={() => void toggleGameActive(g)}
              >
                {g.is_active ? "השבת" : "הפעל"}
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">ילדים / משתמשים</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2">שם משתמש</th>
                <th className="p-2">תפקיד</th>
                <th className="p-2">כיתה</th>
                <th className="p-2">פעיל</th>
                <th className="p-2">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {kids.map((k) => (
                <tr key={k.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="p-2">{k.username}</td>
                  <td className="p-2">{k.role}</td>
                  <td className="p-2">{k.grade}</td>
                  <td className="p-2">{k.is_active ? "כן" : "לא"}</td>
                  <td className="p-2 space-x-2 space-x-reverse">
                    <button
                      type="button"
                      className="font-semibold text-indigo-600 underline decoration-2 underline-offset-2 hover:text-indigo-800"
                      onClick={() => void toggleKidActive(k)}
                    >
                      חסום/שחזר
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-rose-600 underline decoration-2 underline-offset-2 hover:text-rose-800"
                      onClick={() => void deleteKid(k.id)}
                    >
                      מחק
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">ייבוא CSV (ילדים)</h2>
        <p className="text-xs text-slate-500">
          שורת כותרת: username,password,full_name,gender,grade,role — פונקציית Edge
          import-bulk-kids (מפתח שירות בשרת בלבד).
        </p>
        <textarea
          className="min-h-[120px] w-full rounded-xl border-2 border-slate-200 bg-white p-3 font-mono text-xs text-slate-900 shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="username,password,full_name,gender,grade,role"
        />
        <Button
          type="button"
          disabled={busy}
          onClick={() => void importCsv()}
        >
          {busy ? "מייבא…" : "ייבא"}
        </Button>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">תפעול</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void runRpc("admin_evict_stale_players", { p_idle_minutes: 30 })
            }
          >
            נתק שחקנים לא פעילים (30 דק׳)
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() =>
              void runRpc("admin_expire_old_sessions", { p_hours: 24 })
            }
          >
            השלם מפגשים ישנים (24 שע׳)
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-rose-300 text-rose-700 hover:bg-rose-50"
            disabled={busy}
            onClick={() => {
              if (
                !window.confirm(
                  "להשלים את כל המפגשים הפתוחים? פעולה מסוכנת."
                )
              ) {
                return;
              }
              void runRpc("admin_complete_all_open_sessions");
            }}
          >
            השלם כל המפגשים הפתוחים
          </Button>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">יומן ביקורת (אחרונים)</h2>
        <ul className="space-y-1 font-mono text-xs text-slate-600">
          {audit.map((a) => (
            <li key={a.id}>
              {new Date(a.created_at).toLocaleString("he-IL")} — {a.action}{" "}
              {a.metadata ? JSON.stringify(a.metadata) : ""}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
