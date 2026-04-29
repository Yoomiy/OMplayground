import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  adminUpdateKidProfile,
  fetchAvatarPresets,
  type AdminProfileUpdates,
  type AvatarPreset
} from "@/lib/profileApi";
import { KidAvatar } from "@/components/KidAvatar";
import { Button } from "@/components/ui/button";
import { fieldInputClass, fieldLabelClass } from "@/lib/fieldStyles";

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
  gender: "boy" | "girl";
  role: "kid" | "teacher";
  grade: number;
  is_active: boolean;
  avatar_color: string;
  avatar_preset_id: string | null;
  avatar_url: string | null;
  best_scores: Record<string, number>;
  unread_message_count: number;
  last_seen: string | null;
  created_at: string;
  updated_at: string;
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

type AdminSection = "moderation" | "users" | "import" | "games" | "operations" | "audit";

const adminSections: { id: AdminSection; label: string }[] = [
  { id: "moderation", label: "מודרציה" },
  { id: "users", label: "משתמשים" },
  { id: "import", label: "ייבוא" },
  { id: "games", label: "משחקים" },
  { id: "operations", label: "תפעול" },
  { id: "audit", label: "יומן" }
];

/**
 * Platform admin only (`admin_profiles`). CRUD uses RLS; bulk kid import uses Edge Function + service role.
 */
export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);
  const [games, setGames] = useState<GameRow[]>([]);
  const [kids, setKids] = useState<KidRow[]>([]);
  const [avatarPresets, setAvatarPresets] = useState<AvatarPreset[]>([]);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [audit, setAudit] = useState<
    { id: string; action: string; created_at: string; metadata: unknown }[]
  >([]);
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<AdminSection>("moderation");
  const [editingKid, setEditingKid] = useState<KidRow | null>(null);
  const [editForm, setEditForm] = useState({
    username: "",
    full_name: "",
    gender: "boy" as "boy" | "girl",
    role: "kid" as "kid" | "teacher",
    grade: 1,
    is_active: true,
    avatar_color: "#3B82F6",
    avatar_preset_id: "",
    avatar_url: "",
    best_scores: "{}",
    unread_message_count: 0
  });

  const reload = useCallback(async () => {
    if (!user || !isAdmin) return;
    const [g, k, r, a] = await Promise.all([
      supabase.from("games").select("id, name_he, is_active, game_url").order("name_he"),
      supabase
        .from("kid_profiles")
        .select(
          "id, username, full_name, gender, role, grade, is_active, avatar_color, avatar_preset_id, avatar_url, best_scores, unread_message_count, last_seen, created_at, updated_at"
        )
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
    if (!isAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchAvatarPresets(true);
        if (!cancelled) setAvatarPresets(rows);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "טעינת אווטארים נכשלה");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

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
    try {
      await adminUpdateKidProfile(kid.id, { is_active: !kid.is_active });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "עדכון משתמש נכשל");
    }
    void reload();
  }

  function startEditKid(kid: KidRow) {
    setActiveSection("users");
    setEditingKid(kid);
    setEditForm({
      username: kid.username,
      full_name: kid.full_name,
      gender: kid.gender,
      role: kid.role,
      grade: kid.grade,
      is_active: kid.is_active,
      avatar_color: kid.avatar_color,
      avatar_preset_id: kid.avatar_preset_id ?? "",
      avatar_url: kid.avatar_url ?? "",
      best_scores: JSON.stringify(kid.best_scores ?? {}, null, 2),
      unread_message_count: kid.unread_message_count
    });
  }

  async function saveKidProfile() {
    if (!editingKid) return;
    setErr(null);
    setMsg(null);
    let bestScores: Record<string, number>;
    try {
      bestScores = JSON.parse(editForm.best_scores) as Record<string, number>;
    } catch {
      setErr("שדה best_scores חייב להיות JSON תקין");
      return;
    }
    const updates: AdminProfileUpdates = {
      username: editForm.username,
      full_name: editForm.full_name,
      gender: editForm.gender,
      role: editForm.role,
      grade: editForm.grade,
      is_active: editForm.is_active,
      avatar_color: editForm.avatar_color,
      avatar_preset_id: editForm.avatar_preset_id || null,
      avatar_url: editForm.avatar_url || null,
      best_scores: bestScores,
      unread_message_count: editForm.unread_message_count
    };
    setBusy(true);
    try {
      const updated = await adminUpdateKidProfile(editingKid.id, updates);
      setMsg("פרופיל המשתמש עודכן");
      setEditingKid(updated as KidRow);
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "עדכון פרופיל נכשל");
    } finally {
      setBusy(false);
    }
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

      <nav
        className="flex gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm"
        aria-label="מדורי ניהול"
      >
        {adminSections.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              className={`min-h-[40px] whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-colors ${
                isActive
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-700 hover:bg-slate-100"
              }`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      {activeSection === "moderation" ? (
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
      ) : null}

      {activeSection === "games" ? (
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
      ) : null}

      {activeSection === "users" ? (
      <section className="space-y-2">
        <h2 className="text-lg font-medium">ילדים / משתמשים</h2>
        {editingKid ? (
          <div className="mb-4 rounded-3xl border border-indigo-200 bg-white p-5 shadow-play">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <KidAvatar
                  profile={{
                    full_name: editForm.full_name,
                    avatar_color: editForm.avatar_color,
                    avatar_preset_id: editForm.avatar_preset_id || null,
                    avatar_url: editForm.avatar_url || null
                  }}
                  presets={avatarPresets}
                  className="size-16 min-h-[64px] min-w-[64px] text-2xl"
                />
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    עריכת {editingKid.full_name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    נוצר: {new Date(editingKid.created_at).toLocaleString("he-IL")} · עודכן:{" "}
                    {new Date(editingKid.updated_at).toLocaleString("he-IL")}
                  </p>
                  <p className="text-xs text-slate-500">
                    נראה לאחרונה:{" "}
                    {editingKid.last_seen
                      ? new Date(editingKid.last_seen).toLocaleString("he-IL")
                      : "לא ידוע"}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                type="button"
                onClick={() => setEditingKid(null)}
              >
                סגור
              </Button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                שם משתמש
                <input
                  className={fieldInputClass}
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                שם מלא
                <input
                  className={fieldInputClass}
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                מגדר
                <select
                  className={fieldInputClass}
                  value={editForm.gender}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      gender: e.target.value as "boy" | "girl"
                    }))
                  }
                >
                  <option value="boy">בן</option>
                  <option value="girl">בת</option>
                </select>
              </label>
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                תפקיד
                <select
                  className={fieldInputClass}
                  value={editForm.role}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      role: e.target.value as "kid" | "teacher"
                    }))
                  }
                >
                  <option value="kid">ילד</option>
                  <option value="teacher">מורה</option>
                </select>
              </label>
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                כיתה
                <input
                  className={fieldInputClass}
                  type="number"
                  min={1}
                  max={7}
                  value={editForm.grade}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, grade: Number(e.target.value) }))
                  }
                />
              </label>
              <label className={`flex items-center gap-3 ${fieldLabelClass}`}>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                />
                משתמש פעיל
              </label>
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                צבע אווטאר
                <input
                  className={fieldInputClass}
                  value={editForm.avatar_color}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      avatar_color: e.target.value
                    }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                אווטאר מוכן
                <select
                  className={fieldInputClass}
                  value={editForm.avatar_preset_id}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      avatar_preset_id: e.target.value
                    }))
                  }
                >
                  <option value="">ללא</option>
                  {avatarPresets.map((preset) => (
                    <option key={preset.id} value={preset.key}>
                      {preset.label_he}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex flex-col gap-2 sm:col-span-2 ${fieldLabelClass}`}>
                כתובת תמונת אווטאר
                <input
                  className={fieldInputClass}
                  value={editForm.avatar_url}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, avatar_url: e.target.value }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
                הודעות שלא נקראו
                <input
                  className={fieldInputClass}
                  type="number"
                  min={0}
                  value={editForm.unread_message_count}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      unread_message_count: Number(e.target.value)
                    }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 sm:col-span-2 ${fieldLabelClass}`}>
                best_scores JSON
                <textarea
                  className={`${fieldInputClass} min-h-[120px] font-mono text-xs`}
                  value={editForm.best_scores}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      best_scores: e.target.value
                    }))
                  }
                />
              </label>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busy}
                onClick={() => void saveKidProfile()}
              >
                {busy ? "שומר…" : "שמור פרופיל"}
              </Button>
              <Button
                variant="outline"
                type="button"
                asChild
              >
                <Link to={`/profile/${editingKid.id}`}>פתח פרופיל ציבורי</Link>
              </Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              איפוס סיסמה נשאר פעולה נפרדת דרך Supabase Auth Admin / Edge Function מאובטחת.
            </p>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-right text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="p-2">שם משתמש</th>
                <th className="p-2">שם</th>
                <th className="p-2">תפקיד</th>
                <th className="p-2">מגדר</th>
                <th className="p-2">כיתה</th>
                <th className="p-2">פעיל</th>
                <th className="p-2">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {kids.map((k) => (
                <tr key={k.id} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="p-2">{k.username}</td>
                  <td className="p-2">{k.full_name}</td>
                  <td className="p-2">{k.role}</td>
                  <td className="p-2">{k.gender === "boy" ? "בן" : "בת"}</td>
                  <td className="p-2">{k.grade}</td>
                  <td className="p-2">{k.is_active ? "כן" : "לא"}</td>
                  <td className="p-2 space-x-2 space-x-reverse">
                    <button
                      type="button"
                      className="font-semibold text-indigo-600 underline decoration-2 underline-offset-2 hover:text-indigo-800"
                      onClick={() => startEditKid(k)}
                    >
                      ערוך
                    </button>
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
      ) : null}

      {activeSection === "import" ? (
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
      ) : null}

      {activeSection === "operations" ? (
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
      ) : null}

      {activeSection === "audit" ? (
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
      ) : null}
    </div>
  );
}
