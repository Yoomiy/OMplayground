import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  adminUpdateKidProfile,
  fetchAvatarPresets,
  type AdminProfileUpdates,
  type AvatarPreset,
  adminCreateNewKidProfile,
  type AdminNewProfile
} from "@/lib/profileApi";
import { KidAvatar } from "@/components/KidAvatar";
import { kidFieldInputClass, kidFieldLabelClass } from "@/lib/fieldStyles";
import { cn } from "@/lib/cn";
import { AdminStatsSection } from "@/components/AdminStatsSection";
import { AdminFeedbackSection } from "@/components/AdminFeedbackSection";

function parseGradeInput(raw: string): string {
  const clean = raw.trim().replace(/['"]+/g, "");
  const validLetters = ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"];
  const numMap: Record<string, string> = {
    "1": "א", "2": "ב", "3": "ג", "4": "ד", "5": "ה", "6": "ו", "7": "ז", "8": "ח"
  };
  if (validLetters.includes(clean)) return clean;
  return numMap[clean] ?? "א";
}

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
  grade: string;
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

interface RecessScheduleRow {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  name_he: string;
  is_active: boolean;
}

type ScheduleDraft = Omit<RecessScheduleRow, "id"> & { id: string | null };

const RECESS_DAY_LABELS_HE = [
  "יום ראשון",
  "יום שני",
  "יום שלישי",
  "יום רביעי",
  "יום חמישי",
  "יום שישי",
  "שבת"
] as const;

function normalizeRecessTime(t: string): string {
  const s = t.trim();
  if (s.length >= 5 && s[4] === ":") return s.slice(0, 5);
  return s;
}

function recessDurationMinutes(start: string, end: string): number | null {
  const a = normalizeRecessTime(start).split(":").map(Number);
  const b = normalizeRecessTime(end).split(":").map(Number);
  if (a.length < 2 || b.length < 2) return null;
  const [sh, sm, eh, em] = [...a, ...b] as [number, number, number, number];
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  let startM = sh * 60 + sm;
  let endM = eh * 60 + em;
  if (endM <= startM) endM += 24 * 60;
  return endM - startM;
}

type AdminSection =
  | "classrooms"
  | "moderation"
  | "users"
  | "import"
  | "games"
  | "schedule"
  | "stats"
  | "operations"
  | "audit"
  | "feedback";

const adminSections: { id: AdminSection; label: string }[] = [
  { id: "classrooms", label: "כיתות וירטואליות 🪐" },
  { id: "moderation", label: "מודרציה" },
  { id: "users", label: "משתמשים" },
  { id: "import", label: "ייבוא" },
  { id: "games", label: "משחקים" },
  { id: "schedule", label: "לוח הפסקות" },
  { id: "stats", label: "סטטיסטיקות" },
  { id: "feedback", label: "משובי בטא 🐛" },
  { id: "operations", label: "תפעול" },
  { id: "audit", label: "יומן" }
];

/**
 * Platform admin only (`admin_profiles`). CRUD uses RLS; bulk kid import uses Edge Function + service role.
 */
export function AdminPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [games, setGames] = useState<GameRow[]>([]);
  const [kids, setKids] = useState<KidRow[]>([]);
  const [recessSchedules, setRecessSchedules] = useState<RecessScheduleRow[]>(
    []
  );
  const [scheduleDraft, setScheduleDraft] = useState<ScheduleDraft | null>(
    null
  );
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
  const [reportStatusFilter, setReportStatusFilter] = useState<"all" | "pending" | "reviewed">("all");
  const [reportReporterSearch, setReportReporterSearch] = useState("");
  const [reportReportedSearch, setReportReportedSearch] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "kid" | "teacher">("all");
  const [userGenderFilter, setUserGenderFilter] = useState<"all" | "boy" | "girl">("all");
  const [userGradeFilter, setUserGradeFilter] = useState<"all" | string>("all");
  const [gameSearch, setGameSearch] = useState("");
  const [addingNewUser, setAddingNewUser] = useState(false);
  const [editForm, setEditForm] = useState({
    username: "",
    full_name: "",
    gender: "boy" as "boy" | "girl",
    role: "kid" as "kid" | "teacher",
    grade: "א",
    is_active: true,
    avatar_color: "#3B82F6",
    avatar_preset_id: "",
    avatar_url: "",
    best_scores: "{}",
    unread_message_count: 0
  });

  const [newKidForm, setNewKidForm] = useState({
    username: "",
    password: "",
    full_name: "",
    gender: "boy" as "boy" | "girl",
    role: "kid" as "kid" | "teacher" | "admin",
    grade: "א",
    avatar_color: "#3B82F6",
    avatar_preset_id: ""
  });

    const reload = useCallback(async () => {
    if (!user || !isAdmin) return;
    const [g, k, rs, r, a] = await Promise.all([
      (async () => {
        let query = supabase
          .from("games")
          .select("id, name_he, is_active, game_url")
          .order("name_he");
        if (gameSearch) {
          query = query.ilike("name_he", `%${gameSearch}%`);
        }
        return await query;
      })(),
      (async () => {
        let query = supabase
          .from("kid_profiles")
          .select(
            "id, username, full_name, gender, role, grade, is_active, avatar_color, avatar_preset_id, avatar_url, best_scores, unread_message_count, last_seen, created_at, updated_at"
          )
          .order("username")
          .limit(80);
        if (userRoleFilter !== "all") {
          query = query.eq("role", userRoleFilter);
        }
        if (userGenderFilter !== "all") {
          query = query.eq("gender", userGenderFilter);
        }
        if (userGradeFilter !== "all") {
          query = query.eq("grade", userGradeFilter);
        }
        if (userSearch) {
          query = query.or(
            `username.ilike.%${userSearch}%,full_name.ilike.%${userSearch}%`
          );
        }
        return await query;
      })(),
      supabase
        .from("recess_schedules")
        .select("id, day_of_week, start_time, end_time, name_he, is_active")
        .order("day_of_week", { ascending: true })
        .order("start_time", { ascending: true }),
      (async () => {
        let query = supabase
          .from("moderation_reports")
          .select(
            "id, status, reporter_kid_name, reported_kid_name, message_content, reporter_note, created_at"
          )
          .order("created_at", { ascending: false })
          .limit(50);
        if (reportStatusFilter !== "all") {
          query = query.eq("status", reportStatusFilter);
        }
        if (reportReporterSearch) {
          query = query.ilike("reporter_kid_name", `%${reportReporterSearch}%`);
        }
        if (reportReportedSearch) {
          query = query.ilike("reported_kid_name", `%${reportReportedSearch}%`);
        }
        return await query;
      })(),
      supabase
        .from("audit_log")
        .select("id, action, created_at, metadata")
        .order("created_at", { ascending: false })
        .limit(30)
    ]);
    if (!g.error) setGames((g.data ?? []) as GameRow[]);
    if (!k.error) setKids((k.data ?? []) as KidRow[]);
    if (!rs.error) setRecessSchedules((rs.data ?? []) as RecessScheduleRow[]);
    if (!r.error) setReports((r.data ?? []) as ReportRow[]);
    if (!a.error) setAudit((a.data ?? []) as typeof audit);
  }, [user, isAdmin, reportStatusFilter, reportReporterSearch, reportReportedSearch, userSearch, userRoleFilter, userGenderFilter, userGradeFilter, gameSearch]);

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

  const recessByDay = useMemo(() => {
    const m: RecessScheduleRow[][] = Array.from({ length: 7 }, () => []);
    for (const row of recessSchedules) {
      const d = row.day_of_week;
      if (d >= 0 && d <= 6) m[d]!.push(row);
    }
    return m;
  }, [recessSchedules]);

  function openNewScheduleDraft() {
    setScheduleDraft({
      id: null,
      day_of_week: 0,
      start_time: "08:00",
      end_time: "08:15",
      name_he: "",
      is_active: true
    });
  }

  function openEditScheduleRow(row: RecessScheduleRow) {
    setScheduleDraft({
      id: row.id,
      day_of_week: row.day_of_week,
      start_time: normalizeRecessTime(row.start_time),
      end_time: normalizeRecessTime(row.end_time),
      name_he: row.name_he,
      is_active: row.is_active
    });
  }

  async function saveRecessSchedule() {
    if (!scheduleDraft) return;
    setErr(null);
    setMsg(null);
    if (!scheduleDraft.name_he.trim()) {
      setErr("נא למלא שם לחלון ההפסקה");
      return;
    }
    const start = normalizeRecessTime(scheduleDraft.start_time);
    const end = normalizeRecessTime(scheduleDraft.end_time);
    const dur = recessDurationMinutes(start, end);
    if (dur === null || dur <= 0) {
      setErr("שעות התחלה וסיום לא תקינות");
      return;
    }
    const payload = {
      day_of_week: scheduleDraft.day_of_week,
      start_time: start,
      end_time: end,
      name_he: scheduleDraft.name_he.trim(),
      is_active: scheduleDraft.is_active
    };
    setBusy(true);
    try {
      if (scheduleDraft.id) {
        const { error } = await supabase
          .from("recess_schedules")
          .update(payload)
          .eq("id", scheduleDraft.id);
        if (error) {
          setErr(error.message);
          return;
        }
        setMsg("חלון ההפסקה עודכן");
      } else {
        const { error } = await supabase.from("recess_schedules").insert(payload);
        if (error) {
          setErr(error.message);
          return;
        }
        setMsg("חלון הפסקה נוסף");
      }
      setScheduleDraft(null);
      void reload();
    } finally {
      setBusy(false);
    }
  }

  async function deleteRecessSchedule(id: string) {
    if (!window.confirm("למחוק חלון הפסקה?")) return;
    setErr(null);
    setMsg(null);
    setBusy(true);
    try {
      const { error } = await supabase.from("recess_schedules").delete().eq("id", id);
      if (error) setErr(error.message);
      else {
        setMsg("חלון ההפסקה נמחק");
        setScheduleDraft((d) => (d?.id === id ? null : d));
      }
      void reload();
    } finally {
      setBusy(false);
    }
  }

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

  async function createNewUser() {
    setErr(null);
    setMsg(null);

    if (!newKidForm.username || !newKidForm.full_name) {
      setErr("שם משתמש ושם מלא הם שדות חובה");
      return;
    }

    const profile: AdminNewProfile = {
      ...newKidForm,
      avatar_preset_id: newKidForm.avatar_preset_id || null
    };
    setBusy(true);
    try {
      await adminCreateNewKidProfile(profile);
      setMsg(`המשתמש ${profile.username} נוצר בהצלחה`);
      setAddingNewUser(false);
      setNewKidForm({
        username: "",
        password: "",
        full_name: "",
        gender: "boy",
        role: "kid",
        grade: "א",
        avatar_color: "#3B82F6",
        avatar_preset_id: ""
      });
      await reload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "יצירת משתמש נכשלה");
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
        grade: parseGradeInput(cells[idx["grade"]!] ?? "1"),
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
    return <p className="p-6 text-sm text-white/50">טוען…</p>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-medium text-amber-300">
          אין הרשאה — חשבון מנהל נדרש.
        </p>
        <Link
          to="/home"
          className="mt-4 inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
        >
          בית
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8 p-6">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-white">ניהול</h1>
        <div className="flex gap-2">
          <Link
            to="/home"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
          >
            בית
          </Link>
          <button
            type="button"
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            onClick={() => void logout()}
          >
            התנתק
          </button>
        </div>
      </header>

      {err ? (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300" role="alert">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-300" role="status">
          {msg}
        </p>
      ) : null}

      <nav
        className="flex gap-2 overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md p-2"
        aria-label="מדורי ניהול"
      >
        {adminSections.map((section) => {
          const isActive = activeSection === section.id;
          return (
            <button
              key={section.id}
              type="button"
              aria-current={isActive ? "page" : undefined}
              className={`min-h-[40px] whitespace-nowrap rounded-xl px-4 text-sm font-semibold transition-all duration-200 ${
                isActive
                  ? "bg-gradient-to-r from-violet-500 to-indigo-500 text-white shadow-sm"
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              }`}
              onClick={() => setActiveSection(section.id)}
            >
              {section.label}
            </button>
          );
        })}
      </nav>

      {activeSection === "classrooms" ? (
        <AdminClassroomSection />
      ) : null}

      {activeSection === "moderation" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-medium text-white">דיווחי ניהול (מודרציה)</h2>
          <p className="text-xs text-white/50">
            תוכן ההודעה המדווחת והערת המדווח; עדכון סטטוס נשמר ב-RLS.
          </p>
          <div className="flex gap-2">
            <select
              className={kidFieldInputClass}
              value={reportStatusFilter}
              onChange={(e) =>
                setReportStatusFilter(
                  e.target.value as "all" | "pending" | "reviewed"
                )
              }
            >
              <option value="all">כל הסטטוסים</option>
              <option value="pending">ממתינים לטיפול</option>
              <option value="reviewed">טופלו</option>
            </select>
            <input
              className={kidFieldInputClass}
              type="search"
              placeholder="חיפוש לפי מדווח..."
              value={reportReporterSearch}
              onChange={(e) => setReportReporterSearch(e.target.value)}
            />
            <input
              className={kidFieldInputClass}
              type="search"
              placeholder="חיפוש לפי מדווח..."
              value={reportReportedSearch}
              onChange={(e) => setReportReportedSearch(e.target.value)}
            />
          </div>
          <ul className="space-y-3 text-sm">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md px-4 py-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <p className="font-medium text-white">
                    {r.reporter_kid_name} מדווח על {r.reported_kid_name}
                  </p>
                  <p className="text-xs text-white/50">
                    {new Date(r.created_at).toLocaleString("he-IL")} · סטטוס:{" "}
                    <span className="text-white/80">{r.status}</span>
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {r.status === "pending" ? (
                    <button
                      type="button"
                      disabled={busy}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
                      onClick={() => void updateReportStatus(r.id, "reviewed")}
                    >
                      סמן כנבדק
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
                      onClick={() => void updateReportStatus(r.id, "pending")}
                    >
                      החזר ל־pending
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-2 space-y-1 rounded-xl border border-white/5 bg-black/20 p-3 text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/50">תוכן מדווח</p>
                <p className="whitespace-pre-wrap text-white/80">
                  {r.message_content}
                </p>
                {r.reporter_note ? (
                  <>
                    <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-white/50">
                      הערת מדווח
                    </p>
                    <p className="whitespace-pre-wrap text-white/80">
                      {r.reporter_note}
                    </p>
                  </>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        {reports.length === 0 ? (
          <p className="text-sm text-white/50">אין דיווחים.</p>
        ) : null}
      </section>
      ) : null}

      {activeSection === "games" ? (
      <section className="space-y-2">
        <h2 className="text-lg font-medium text-white">משחקים</h2>
        <input
          className={kidFieldInputClass}
          type="search"
          placeholder="חיפוש לפי שם משחק..."
          value={gameSearch}
          onChange={(e) => setGameSearch(e.target.value)}
        />
        <ul className="space-y-1 text-sm">
          {games.map((g) => (
            <li
              key={g.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md px-3 py-2"
            >
              <span className="text-white/80">
                {g.name_he}{" "}
                <span className="text-white/50">({g.game_url})</span>
              </span>
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
                onClick={() => void toggleGameActive(g)}
              >
                {g.is_active ? "השבת" : "הפעל"}
              </button>
            </li>
          ))}
        </ul>
      </section>
      ) : null}

      {activeSection === "schedule" ? (
      <section className="space-y-4">
        <h2 className="text-lg font-medium text-white">לוח הפסקות</h2>
        <p className="text-xs text-white/50">
          זמנים ביחס ל־Asia/Jerusalem; יום ראשון = 0. חלונות לא פעילים אינם נכללים בבדיקת שרת.
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
            onClick={() => openNewScheduleDraft()}
          >
            הוסף חלון
          </button>
          {scheduleDraft ? (
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-transparent bg-transparent px-4 py-2 text-sm font-semibold text-white/50 hover:bg-white/5 hover:text-white/80 transition duration-200 disabled:opacity-50"
              onClick={() => setScheduleDraft(null)}
            >
              בטל עריכה
            </button>
          ) : null}
        </div>
        {scheduleDraft ? (
          <div className="space-y-3 rounded-2xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md p-4">
            <h3 className="text-sm font-semibold text-white">
              {scheduleDraft.id ? "עריכת חלון" : "חלון חדש"}
            </h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                יום בשבוע
                <select
                  className={kidFieldInputClass}
                  value={scheduleDraft.day_of_week}
                  onChange={(e) =>
                    setScheduleDraft((d) =>
                      d ? { ...d, day_of_week: Number(e.target.value) } : d
                    )
                  }
                >
                  {RECESS_DAY_LABELS_HE.map((label, idx) => (
                    <option key={label} value={idx}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                שם (עברית)
                <input
                  className={kidFieldInputClass}
                  value={scheduleDraft.name_he}
                  onChange={(e) =>
                    setScheduleDraft((d) =>
                      d ? { ...d, name_he: e.target.value } : d
                    )
                  }
                  placeholder="למשל: הפסקה ראשונה"
                />
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                התחלה
                <input
                  className={kidFieldInputClass}
                  type="time"
                  value={scheduleDraft.start_time}
                  onChange={(e) =>
                    setScheduleDraft((d) =>
                      d ? { ...d, start_time: e.target.value } : d
                    )
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                סיום
                <input
                  className={kidFieldInputClass}
                  type="time"
                  value={scheduleDraft.end_time}
                  onChange={(e) =>
                    setScheduleDraft((d) =>
                      d ? { ...d, end_time: e.target.value } : d
                    )
                  }
                />
              </label>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm font-medium text-white/80">
              <input
                type="checkbox"
                checked={scheduleDraft.is_active}
                onChange={(e) =>
                  setScheduleDraft((d) =>
                    d ? { ...d, is_active: e.target.checked } : d
                  )
                }
              />
              פעיל
            </label>
            <p className="text-xs text-white/50">
              משך משוער:{" "}
              {recessDurationMinutes(
                scheduleDraft.start_time,
                scheduleDraft.end_time
              ) ?? "—"}{" "}
              דקות
            </p>
            <button
              type="button"
              disabled={busy}
              className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200 disabled:opacity-50 disabled:transform-none"
              onClick={() => void saveRecessSchedule()}
            >
              {busy ? "שומר…" : "שמור"}
            </button>
          </div>
        ) : null}
        <div className="space-y-6">
          {recessByDay.map((rows, day) => (
            <div key={RECESS_DAY_LABELS_HE[day]}>
              <h3 className="mb-2 border-b border-white/10 pb-1 text-sm font-semibold text-white/90">
                {RECESS_DAY_LABELS_HE[day]} ({day})
              </h3>
              {rows.length === 0 ? (
                <p className="text-xs text-white/50">אין חלונות</p>
              ) : (
                <ul className="space-y-2">
                  {rows.map((row) => {
                    const mins = recessDurationMinutes(
                      row.start_time,
                      row.end_time
                    );
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md px-3 py-2 text-sm"
                      >
                        <div>
                          <span className="font-medium text-white">
                            {row.name_he}
                          </span>{" "}
                          <span className="text-white/70">
                            {normalizeRecessTime(row.start_time)} –{" "}
                            {normalizeRecessTime(row.end_time)}
                            {mins != null ? ` · ${mins} דק׳` : ""}
                          </span>
                          <span
                            className={
                              row.is_active
                                ? " me-2 text-emerald-400"
                                : " me-2 text-white/40"
                            }
                          >
                            {row.is_active ? "פעיל" : "כבוי"}
                          </span>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            className="inline-flex h-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
                            onClick={() => openEditScheduleRow(row)}
                          >
                            ערוך
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            className="inline-flex h-8 items-center justify-center rounded-lg bg-rose-600 border border-rose-500 px-3 text-xs font-semibold text-white hover:bg-rose-700 transition duration-200 disabled:opacity-50"
                            onClick={() => void deleteRecessSchedule(row.id)}
                          >
                            מחק
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          ))}
        </div>
      </section>
      ) : null}

      {activeSection === "users" ? (
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-medium text-white">ילדים / משתמשים</h2>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200"
              onClick={() => setAddingNewUser(true)}
            >
              הוסף משתמש חדש
            </button>
          </div>
          <div className="flex items-center gap-2">
            <select
              className={kidFieldInputClass}
              value={userRoleFilter}
              onChange={(e) =>
                setUserRoleFilter(e.target.value as "all" | "kid" | "teacher")
              }
            >
              <option value="all">כל התפקידים</option>
              <option value="kid">ילדים</option>
              <option value="teacher">מורים</option>
            </select>
            <select
              className={kidFieldInputClass}
              value={userGenderFilter}
              onChange={(e) =>
                setUserGenderFilter(e.target.value as "all" | "boy" | "girl")
              }
            >
              <option value="all">כל המגדרים</option>
              <option value="boy">בנים</option>
              <option value="girl">בנות</option>
            </select>
            <select
              className={kidFieldInputClass}
              value={userGradeFilter}
              onChange={(e) => setUserGradeFilter(e.target.value)}
            >
              <option value="all">כל הכיתות</option>
              {["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"].map(g => <option key={g} value={g}>כיתה {g}</option>)}
            </select>
            <input
              className={kidFieldInputClass}
              type="search"
              placeholder="חיפוש לפי שם משתמש או שם מלא..."
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
            />
          </div>
          {addingNewUser ? (
            <div className="mb-4 rounded-3xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h3 className="text-xl font-bold text-white">הוספת משתמש חדש</h3>
                <button
                  type="button"
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-transparent bg-transparent px-4 py-2 text-sm font-semibold text-white/50 hover:bg-white/5 hover:text-white/80 transition duration-200"
                  onClick={() => setAddingNewUser(false)}
                >
                  סגור
                </button>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                  שם משתמש
                  <input
                    className={kidFieldInputClass}
                    value={newKidForm.username}
                    onChange={(e) =>
                      setNewKidForm((f) => ({ ...f, username: e.target.value }))
                    }
                  />
                </label>
                <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                  סיסמה (אם ריק, תיווצר סיסמה אקראית)
                  <input
                    className={kidFieldInputClass}
                    value={newKidForm.password}
                    onChange={(e) =>
                      setNewKidForm((f) => ({ ...f, password: e.target.value }))
                    }
                  />
                </label>
                <label
                  className={`flex flex-col gap-2 sm:col-span-2 ${kidFieldLabelClass}`}
                >
                  שם מלא
                  <input
                    className={kidFieldInputClass}
                    value={newKidForm.full_name}
                    onChange={(e) =>
                      setNewKidForm((f) => ({
                        ...f,
                        full_name: e.target.value,
                      }))
                    }
                  />
                </label>
                <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                  תפקיד
                  <select
                    className={kidFieldInputClass}
                    value={newKidForm.role}
                    onChange={(e) =>
                      setNewKidForm((f) => ({
                        ...f,
                        role: e.target.value as "kid" | "teacher" | "admin",
                      }))
                    }
                  >
                    <option value="kid">ילד</option>
                    <option value="teacher">מורה</option>
                    <option value="admin">מנהל</option>
                  </select>
                </label>
                {newKidForm.role !== "admin" && (
                  <>
                    <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                      מגדר
                      <select
                        className={kidFieldInputClass}
                        value={newKidForm.gender}
                        onChange={(e) =>
                          setNewKidForm((f) => ({
                            ...f,
                            gender: e.target.value as "boy" | "girl",
                          }))
                        }
                      >
                        <option value="boy">בן</option>
                        <option value="girl">בת</option>
                      </select>
                    </label>
                    <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                      כיתה
                      <select
                        className={kidFieldInputClass}
                        value={newKidForm.grade}
                        onChange={(e) =>
                          setNewKidForm((f) => ({
                            ...f,
                            grade: e.target.value,
                          }))
                        }
                      >
                        {["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"].map((g) => (
                          <option key={g} value={g}>
                            כיתה {g}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label
                      className={`flex flex-col gap-2 ${kidFieldLabelClass}`}
                    >
                      צבע אווטאר
                      <input
                        className={kidFieldInputClass}
                        value={newKidForm.avatar_color}
                        onChange={(e) =>
                          setNewKidForm((f) => ({
                            ...f,
                            avatar_color: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label
                      className={`flex flex-col gap-2 ${kidFieldLabelClass}`}
                    >
                      אווטאר מוכן
                      <select
                        className={kidFieldInputClass}
                        value={newKidForm.avatar_preset_id}
                        onChange={(e) =>
                          setNewKidForm((f) => ({
                            ...f,
                            avatar_preset_id: e.target.value,
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
                  </>
                )}
              </div>
              <div className="mt-5">
                <button
                  type="button"
                  disabled={busy}
                  className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200 disabled:opacity-50 disabled:transform-none"
                  onClick={() => void createNewUser()}
                >
                  {busy ? "יוצר..." : "צור משתמש"}
                </button>
              </div>
            </div>
          ) : null}
        {editingKid ? (
          <div className="mb-4 rounded-3xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md p-5">
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
                  <h3 className="text-xl font-bold text-white">
                    עריכת {editingKid.full_name}
                  </h3>
                  <p className="text-xs text-white/50">
                    נוצר: {new Date(editingKid.created_at).toLocaleString("he-IL")} · עודכן:{" "}
                    {new Date(editingKid.updated_at).toLocaleString("he-IL")}
                  </p>
                  <p className="text-xs text-white/50">
                    נראה לאחרונה:{" "}
                    {editingKid.last_seen
                      ? new Date(editingKid.last_seen).toLocaleString("he-IL")
                      : "לא ידוע"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-transparent bg-transparent px-4 py-2 text-sm font-semibold text-white/50 hover:bg-white/5 hover:text-white/80 transition duration-200"
                onClick={() => setEditingKid(null)}
              >
                סגור
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                שם משתמש
                <input
                  className={kidFieldInputClass}
                  value={editForm.username}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, username: e.target.value }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                שם מלא
                <input
                  className={kidFieldInputClass}
                  value={editForm.full_name}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, full_name: e.target.value }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                מגדר
                <select
                  className={kidFieldInputClass}
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
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                תפקיד
                <select
                  className={kidFieldInputClass}
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
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                כיתה
                <select
                  className={kidFieldInputClass}
                  value={editForm.grade}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, grade: e.target.value }))
                  }
                >
                  {["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח"].map((g) => (
                    <option key={g} value={g}>
                      כיתה {g}
                    </option>
                  ))}
                </select>
              </label>
              <label className={`flex items-center gap-3 ${kidFieldLabelClass}`}>
                <input
                  type="checkbox"
                  checked={editForm.is_active}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, is_active: e.target.checked }))
                  }
                />
                משתמש פעיל
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                צבע אווטאר
                <input
                  className={kidFieldInputClass}
                  value={editForm.avatar_color}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      avatar_color: e.target.value
                    }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                אווטאר מוכן
                <select
                  className={kidFieldInputClass}
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
              <label className={`flex flex-col gap-2 sm:col-span-2 ${kidFieldLabelClass}`}>
                כתובת תמונת אווטאר
                <input
                  className={kidFieldInputClass}
                  value={editForm.avatar_url}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, avatar_url: e.target.value }))
                  }
                />
              </label>
              <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
                הודעות שלא נקראו
                <input
                  className={kidFieldInputClass}
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
              <label className={`flex flex-col gap-2 sm:col-span-2 ${kidFieldLabelClass}`}>
                best_scores JSON
                <textarea
                  className={`${kidFieldInputClass} min-h-[120px] font-mono text-xs`}
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
              <button
                type="button"
                disabled={busy}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200 disabled:opacity-50 disabled:transform-none"
                onClick={() => void saveKidProfile()}
              >
                {busy ? "שומר…" : "שמור פרופיל"}
              </button>
              <Link
                to={`/profile/${editingKid.id}`}
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
              >
                פתח פרופיל ציבורי
              </Link>
            </div>
            <p className="mt-3 text-xs text-white/50">
              איפוס סיסמה נשאר פעולה נפרדת דרך Supabase Auth Admin / Edge Function מאובטחת.
            </p>
          </div>
        ) : null}
        <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
          <table className="w-full text-right text-sm">
            <thead className="bg-white/10 text-white">
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
            <tbody className="text-white/80">
              {kids.map((k) => (
                <tr key={k.id} className="border-t border-white/10 hover:bg-white/5">
                  <td className="p-2">{k.username}</td>
                  <td className="p-2">{k.full_name}</td>
                  <td className="p-2">{k.role}</td>
                  <td className="p-2">{k.gender === "boy" ? "בן" : "בת"}</td>
                  <td className="p-2">{k.grade}</td>
                  <td className="p-2">{k.is_active ? "כן" : "לא"}</td>
                  <td className="p-2 space-x-2 space-x-reverse">
                    <button
                      type="button"
                      className="font-semibold text-indigo-400 underline decoration-2 underline-offset-2 hover:text-indigo-300"
                      onClick={() => startEditKid(k)}
                    >
                      ערוך
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-indigo-400 underline decoration-2 underline-offset-2 hover:text-indigo-300"
                      onClick={() => void toggleKidActive(k)}
                    >
                      חסום/שחזר
                    </button>
                    <button
                      type="button"
                      className="font-semibold text-rose-400 underline decoration-2 underline-offset-2 hover:text-rose-300"
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
        <h2 className="text-lg font-medium text-white">ייבוא CSV (ילדים)</h2>
        <p className="text-xs text-white/50">
          שורת כותרת: username,password,full_name,gender,grade,role — פונקציית Edge
          import-bulk-kids (מפתח שירות בשרת בלבד).
        </p>
        <textarea
          className={`${kidFieldInputClass} min-h-[120px] font-mono text-xs`}
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="username,password,full_name,gender,grade,role"
        />
        <button
          type="button"
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-2 text-sm font-semibold text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:-translate-y-0.5 transition duration-200 disabled:opacity-50 disabled:transform-none"
          onClick={() => void importCsv()}
        >
          {busy ? "מייבא…" : "ייבא"}
        </button>
      </section>
      ) : null}

      {activeSection === "stats" ? <AdminStatsSection /> : null}

      {activeSection === "operations" ? (
      <section className="space-y-2">
        <h2 className="text-lg font-medium text-white">תפעול</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
            onClick={() =>
              void runRpc("admin_evict_stale_players", { p_idle_minutes: 30 })
            }
          >
            נתק שחקנים לא פעילים (30 דק׳)
          </button>
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
            onClick={() =>
              void runRpc("admin_expire_old_sessions", { p_hours: 24 })
            }
          >
            השלם מפגשים ישנים (24 שע׳)
          </button>
          <button
            type="button"
            disabled={busy}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-rose-600 border border-rose-500 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition duration-200 disabled:opacity-50"
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
          </button>
        </div>
      </section>
      ) : null}

      {activeSection === "audit" ? (
      <section className="space-y-2">
        <h2 className="text-lg font-medium text-white">יומן ביקורת (אחרונים)</h2>
        <ul className="space-y-1 font-mono text-xs text-white/50">
          {audit.map((a) => (
            <li key={a.id}>
              {new Date(a.created_at).toLocaleString("he-IL")} — {a.action}{" "}
              {a.metadata ? JSON.stringify(a.metadata) : ""}
            </li>
          ))}
        </ul>
      </section>
      ) : null}

      {activeSection === "feedback" && <AdminFeedbackSection />}
    </div>
  );
}

interface AdminClassroomRow {
  id: string;
  title: string;
  subject: string | null;
  teacher_name: string;
  room_code: string;
  status: string;
  created_at: string;
  last_activity: string;
}

function AdminClassroomSection() {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<AdminClassroomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"active" | "ended" | "all">("active");
  const [searchQuery, setSearchQuery] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const loadClassrooms = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from("classroom_sessions")
      .select("id, title, subject, teacher_name, room_code, status, created_at, last_activity")
      .order("created_at", { ascending: false })
      .limit(100);

    if (statusFilter !== "all") {
      query = query.eq("status", statusFilter);
    }
    if (searchQuery.trim()) {
      query = query.or(`title.ilike.%${searchQuery}%,teacher_name.ilike.%${searchQuery}%,room_code.ilike.%${searchQuery}%`);
    }

    const { data } = await query;
    setClassrooms((data ?? []) as AdminClassroomRow[]);
    setLoading(false);
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    void loadClassrooms();
  }, [loadClassrooms]);

  useEffect(() => {
    const ch = supabase
      .channel("admin-classrooms-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "classroom_sessions" },
        () => void loadClassrooms()
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [loadClassrooms]);

  const endClassroom = async (roomCode: string) => {
    if (!window.confirm("להפסיק/לסגור כיתה וירטואלית זו באופן מיידי?")) return;
    await supabase.rpc("end_classroom_session", { p_room_code: roomCode });
    setNotice("השיעור הופסק והנתונים נוקו.");
    setTimeout(() => setNotice(null), 3000);
    void loadClassrooms();
  };

  const activeCount = classrooms.filter((c) => c.status === "active").length;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">ניטור כיתות וירטואליות בזמן אמת</h2>
          <p className="text-xs text-white/50">צפייה וניהול כיתות וירטואליות פעילות, עם אפשרות לצפייה בסתר (Stealth) או גלויה (Admin Badge)</p>
        </div>

        <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-4 py-2 text-xs font-bold text-indigo-300 flex items-center gap-2">
          <span>כיתות פעילות בלייב:</span>
          <span className="rounded-full bg-indigo-600 px-2 py-0.5 text-white font-black">{activeCount}</span>
        </div>
      </div>

      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
          {notice}
        </div>
      )}

      {/* FILTERS BAR */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className={cn(kidFieldInputClass, "py-1.5 px-3 text-sm min-h-10 w-auto bg-white/5 border-white/10 text-white rounded-xl")}
        >
          <option className="bg-slate-900 text-white" value="active">כיתות פעילות בלבד</option>
          <option className="bg-slate-900 text-white" value="ended">שיעורים שהסתיימו</option>
          <option className="bg-slate-900 text-white" value="all">כל ההיסטוריה</option>
        </select>

        <input
          type="search"
          placeholder="חיפוש לפי שם שיעור / מורה / קוד..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className={cn(kidFieldInputClass, "py-1.5 px-3 text-sm min-h-10 flex-1 bg-white/5 border-white/10 text-white rounded-xl")}
        />
      </div>

      {/* CLASSROOMS MONITOR TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md">
        <table className="w-full text-right text-sm text-white/80">
          <thead className="border-b border-white/10 bg-white/10 text-white/90">
            <tr>
              <th className="p-3">שם השיעור</th>
              <th className="p-3">מורה / מארח</th>
              <th className="p-3">מקצוע</th>
              <th className="p-3">קוד חדר</th>
              <th className="p-3">נוצר בתאריך</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">אפשרויות צפייה וניהול</th>
            </tr>
          </thead>
          <tbody>
            {classrooms.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-bold text-white">{c.title}</td>
                <td className="p-3 text-white/80 font-semibold">{c.teacher_name}</td>
                <td className="p-3 text-white/70">{c.subject || "כללי"}</td>
                <td className="p-3 font-mono text-xs text-indigo-300 font-bold">{c.room_code}</td>
                <td className="p-3 font-mono text-xs text-white/50">
                  {new Date(c.created_at).toLocaleString("he-IL")}
                </td>
                <td className="p-3">
                  <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-bold", c.status === "active" ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800 text-slate-400")}>
                    {c.status === "active" ? "פעיל בלייב" : "הסתיים"}
                  </span>
                </td>
                <td className="p-3 flex items-center gap-1.5 flex-wrap">
                  {c.status === "active" ? (
                    <>
                      <button
                        onClick={() => navigate(`/classroom/${c.room_code}?spectate=invisible`)}
                        title="הצטרפות כצופה סמוי בלתי נראה"
                        className="rounded-lg bg-indigo-600/80 hover:bg-indigo-500 px-2.5 py-1 text-xs font-bold text-white flex items-center gap-1"
                      >
                        🕵️ צפה בסתר
                      </button>

                      <button
                        onClick={() => navigate(`/classroom/${c.room_code}?spectate=visible`)}
                        title="הצטרפות כגורם מפקח עם תג אדמין"
                        className="rounded-lg bg-amber-600/80 hover:bg-amber-500 px-2.5 py-1 text-xs font-bold text-white flex items-center gap-1"
                      >
                        👁️ צפה בגלוי
                      </button>

                      <button
                        onClick={() => void endClassroom(c.room_code)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2.5 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                      >
                        סגור כיתה
                      </button>
                    </>
                  ) : (
                    <span className="text-xs text-white/40">השיעור הסתיים</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {classrooms.length === 0 && !loading && (
        <p className="text-sm text-white/50 text-center py-4">אין כיתות לפי המסננים שנגדרו.</p>
      )}
    </section>
  );
}

