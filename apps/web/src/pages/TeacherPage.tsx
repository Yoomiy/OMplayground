import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { kidFieldInputClass } from "@/lib/fieldStyles";
import { cn } from "@/lib/cn";
import {
  matchesTeacherStatusFilter,
  type TeacherSessionStatusFilter
} from "@/lib/teacherSessionFilter";

interface SessionRow {
  id: string;
  status: string;
  host_name: string;
  gender: string;
  game_id: string;
  host_grade: number | null;
  last_activity: string | null;
  games: { name_he: string } | null;
}

export function TeacherPage() {
  const navigate = useNavigate();
  const { profile, loading } = useProfile();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const [activeTab, setActiveTab] = useState<"games" | "classrooms">("classrooms");

  useEffect(() => {
    if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, navigate]);

  if (adminLoading) {
    return <p className="p-6 text-sm text-white/50">טוען…</p>;
  }

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-white/50">
        מעביר לניהול…
      </div>
    );
  }

  if (loading) {
    return <p className="p-6 text-sm text-white/50">טוען…</p>;
  }

  if (profile && profile.role !== "teacher") {
    return (
      <div className="p-6">
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 font-medium text-amber-300">
          דף זה מיועד למורים בלבד.
        </p>
        <Link
          to="/home"
          className="mt-4 inline-flex min-h-10 items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
        >
          בית
        </Link>
      </div>
    );
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-white">מורה — אזור ניהול</h1>
        <div className="flex gap-2">
          {isAdmin ? (
            <Link
              to="/admin"
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            >
              ניהול
            </Link>
          ) : null}
          <Link
            to="/home"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
          >
            בית
          </Link>
          <button
            type="button"
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
            onClick={() => void logout()}
          >
            התנתק
          </button>
        </div>
      </header>

      {/* TAB SWITCHER */}
      <div className="flex gap-2 rounded-2xl border border-white/10 bg-white/5 p-1.5 backdrop-blur-md">
        <button
          onClick={() => setActiveTab("classrooms")}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-sm font-bold transition duration-200",
            activeTab === "classrooms"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          )}
        >
          כיתות וירטואליות 🪐
        </button>
        <button
          onClick={() => setActiveTab("games")}
          className={cn(
            "flex-1 rounded-xl py-2.5 text-sm font-bold transition duration-200",
            activeTab === "games"
              ? "bg-indigo-600 text-white shadow-md"
              : "text-white/70 hover:bg-white/5 hover:text-white"
          )}
        >
          מפגשי משחק 🎮
        </button>
      </div>

      {activeTab === "classrooms" && profile && (
        <TeacherClassroomSection teacherProfile={profile} />
      )}

      {activeTab === "games" && profile && (
        <>
          <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
            מוצגים מפגשים באותו מגדר כמו פרופיל המורה (מדיניות RLS). דירוג כיתה
            לפי כיתת המארח.
          </p>
          <TeacherSessionList teacherGender={profile.gender} />
        </>
      )}
    </div>
  );
}

function TeacherSessionList({
  teacherGender
}: {
  teacherGender: "boy" | "girl";
}) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] =
    useState<TeacherSessionStatusFilter>("playing");
  const [gameIdFilter, setGameIdFilter] = useState<string>("");
  const [gradeFilter, setGradeFilter] = useState<string>("");
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  async function copyResumeLink(sessionId: string) {
    const url = `${window.location.origin}/play/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyNotice("הקישור הועתק — ניתן לשלוח לילדים");
      window.setTimeout(() => setCopyNotice(null), 2500);
    } catch {
      window.prompt("העתק קישור להמשך המשחק:", url);
    }
  }

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("game_sessions")
      .select(
        `
        id,
        status,
        host_name,
        gender,
        last_activity,
        game_id,
        host_grade,
        games ( name_he )
      `
      )
      .eq("gender", teacherGender)
      .order("last_activity", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as unknown as SessionRow[]);
    setLoading(false);
  }, [teacherGender]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel("teacher-sessions-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          filter: `gender=eq.${teacherGender}`
        },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load, teacherGender]);

  const gameOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of rows) {
      const id = r.game_id;
      const name = r.games?.name_he;
      if (id && name) m.set(id, name);
    }
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (!matchesTeacherStatusFilter(r.status, statusFilter)) {
        return false;
      }
      const gid = r.game_id;
      if (gameIdFilter && gid !== gameIdFilter) return false;
      const hg = r.host_grade;
      if (gradeFilter && String(hg) !== gradeFilter) return false;
      return true;
    });
  }, [rows, statusFilter, gameIdFilter, gradeFilter]);

  if (loading) {
    return <p className="text-sm text-white/50">טוען…</p>;
  }

  return (
    <div className="space-y-4">
      {copyNotice ? (
        <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300" role="status">
          {copyNotice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3 text-sm text-white/80">
        <label className="flex flex-col gap-1">
          סטטוס
          <select
            className={cn(kidFieldInputClass, "py-1 px-3 text-sm min-h-10 w-auto bg-white/5 border-white/10 text-white rounded-xl")}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TeacherSessionStatusFilter)
            }
          >
            <option className="bg-slate-900 text-white" value="all">הכל</option>
            <option className="bg-slate-900 text-white" value="waiting">ממתין (waiting)</option>
            <option className="bg-slate-900 text-white" value="playing">במשחק (playing)</option>
            <option className="bg-slate-900 text-white" value="paused">מושהה (paused)</option>
            <option className="bg-slate-900 text-white" value="completed">הושלם (completed)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          משחק
          <select
            className={cn(kidFieldInputClass, "py-1 px-3 text-sm min-h-10 w-auto bg-white/5 border-white/10 text-white rounded-xl")}
            value={gameIdFilter}
            onChange={(e) => setGameIdFilter(e.target.value)}
          >
            <option className="bg-slate-900 text-white" value="">כל המשחקים</option>
            {gameOptions.map(([id, name]) => (
              <option className="bg-slate-900 text-white" key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          כיתת מארח
          <select
            className={cn(kidFieldInputClass, "py-1 px-3 text-sm min-h-10 w-auto bg-white/5 border-white/10 text-white rounded-xl")}
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option className="bg-slate-900 text-white" value="">הכל</option>
            {[1, 2, 3, 4, 5, 6, 7].map((g) => (
              <option className="bg-slate-900 text-white" key={g} value={String(g)}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <table className="w-full text-right text-sm text-white/80">
          <thead className="border-b border-white/10 bg-white/10 text-white/90">
            <tr>
              <th className="p-2">משחק</th>
              <th className="p-2">סטטוס</th>
              <th className="p-2">מארח</th>
              <th className="p-2">כיתה</th>
              <th className="p-2">פעילות אחרונה</th>
              <th className="p-2">צפייה</th>
              <th className="p-2">המשך</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-2">{r.games?.name_he ?? "—"}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.host_name}</td>
                <td className="p-2">{r.host_grade ?? "—"}</td>
                <td className="p-2 font-mono text-xs text-white/55">
                  {r.last_activity
                    ? new Date(r.last_activity).toLocaleString("he-IL")
                    : "—"}
                </td>
                <td className="p-2">
                  <Link
                    className="font-semibold text-violet-400 underline decoration-2 underline-offset-2 hover:text-violet-300"
                    to={`/play/${r.id}?observe=1`}
                  >
                    צפה
                  </Link>
                </td>
                <td className="p-2">
                  {r.status === "paused" ? (
                    <button
                      type="button"
                      className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                      onClick={() => void copyResumeLink(r.id)}
                    >
                      העתק קישור לילדים
                    </button>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-white/50">אין מפגשים לפי המסננים.</p>
      ) : null}
    </div>
  );
}

interface ClassroomRow {
  id: string;
  title: string;
  subject: string | null;
  teacher_name: string;
  room_code: string;
  status: string;
  created_at: string;
}

function TeacherClassroomSection({ teacherProfile }: { teacherProfile: any }) {
  const navigate = useNavigate();
  const [classrooms, setClassrooms] = useState<ClassroomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const [form, setForm] = useState({
    title: ""
  });

  const loadClassrooms = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("classroom_sessions")
      .select("id, title, subject, teacher_name, room_code, status, created_at")
      .order("created_at", { ascending: false })
      .limit(50);

    setClassrooms((data ?? []) as ClassroomRow[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadClassrooms();
  }, [loadClassrooms]);

  const createClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    setCreating(true);

    const roomCode = `class-${Math.random().toString(36).substring(2, 8)}`;
    const { error } = await supabase
      .from("classroom_sessions")
      .insert({
        title: form.title.trim(),
        teacher_id: teacherProfile.id,
        teacher_name: teacherProfile.full_name || "מורה",
        room_code: roomCode,
        status: "active"
      })
      .select()
      .single();

    setCreating(false);
    if (error) {
      alert(`שגיאה ביצירת הכיתה: ${error.message}`);
      return;
    }

    setShowCreateModal(false);
    setForm({ title: "" });
    navigate(`/classroom/${roomCode}`);
  };

  const copyInviteLink = async (roomCode: string) => {
    const url = `${window.location.origin}/classroom/${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setNotice("הקישור הועתק — ניתן לשלוח לכל תלמיד!");
      setTimeout(() => setNotice(null), 3000);
    } catch {
      window.prompt("העתק קישור לשיעור:", url);
    }
  };

  const endClassroom = async (roomCode: string) => {
    if (!window.confirm("להקפיא/לסגור את השיעור בכיתה זו?")) return;
    await supabase.rpc("end_classroom_session", { p_room_code: roomCode });
    void loadClassrooms();
  };

  return (
    <div className="space-y-4">
      {notice && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-300">
          {notice}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">כיתות וירטואליות פעילות</h2>
          <p className="text-xs text-white/50">תלמידים ומורים מחליפים יכולים להצטרף מיידית דרך קישור החדר (ללא צורך בהתחברות)</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black px-4 py-2.5 shadow-md transition duration-200"
        >
          + צור כיתה וירטואלית חדשה
        </button>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-2xl space-y-4 text-right">
            <h3 className="text-lg font-black text-white">צור כיתה וירטואלית חדשה</h3>
            <form onSubmit={createClassroom} className="space-y-4 text-sm">
              <label className="flex flex-col gap-1 font-bold text-white/80">
                שם השיעור:
                <input
                  type="text"
                  required
                  placeholder="למשל: שיעור חשבון - כיתה ד'"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  className={cn(kidFieldInputClass, "py-2 bg-white/5 text-white border-white/10 rounded-xl")}
                />
              </label>

              <div className="flex gap-2 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="rounded-xl bg-indigo-600 hover:bg-indigo-500 px-4 py-2 text-xs font-black text-white"
                >
                  {creating ? "יוצר כיתה..." : "צור והכנס כעת 🚀"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CLASSROOMS LIST TABLE */}
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-lg backdrop-blur-md">
        <table className="w-full text-right text-sm text-white/80">
          <thead className="border-b border-white/10 bg-white/10 text-white/90">
            <tr>
              <th className="p-3">שם השיעור</th>
              <th className="p-3">קוד חדר</th>
              <th className="p-3">סטטוס</th>
              <th className="p-3">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {classrooms.map((c) => (
              <tr key={c.id} className="border-b border-white/5 hover:bg-white/5">
                <td className="p-3 font-bold text-white">{c.title}</td>
                <td className="p-3 font-mono text-xs text-indigo-300 font-bold">{c.room_code}</td>
                <td className="p-3">
                  <span className={cn("px-2 py-0.5 rounded-full text-xs font-bold", c.status === "active" ? "bg-emerald-500/20 text-emerald-300" : "bg-slate-700 text-slate-400")}>
                    {c.status === "active" ? "פעיל בלייב" : "הסתיים"}
                  </span>
                </td>
                <td className="p-3 flex items-center gap-2">
                  {c.status === "active" ? (
                    <>
                      <Link
                        to={`/classroom/${c.room_code}`}
                        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 px-3 py-1 text-xs font-bold text-white"
                      >
                        הכנס לכיתה
                      </Link>

                      <button
                        onClick={() => void copyInviteLink(c.room_code)}
                        className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs font-bold text-white/70 hover:bg-white/10"
                      >
                        העתק קישור
                      </button>

                      <button
                        onClick={() => void endClassroom(c.room_code)}
                        className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs font-bold text-rose-300 hover:bg-rose-500/20"
                      >
                        סגור שיעור
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
        <p className="text-sm text-white/50 text-center py-4">אין כיתות וירטואליות קיימות. לחץ "+ צור כיתה וירטואלית חדשה" כדי להתחיל.</p>
      )}
    </div>
  );
}

