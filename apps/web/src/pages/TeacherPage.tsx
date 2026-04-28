import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { Button } from "@/components/ui/button";
import { fieldInputClass } from "@/lib/fieldStyles";
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
  const { user } = useAuth();
  const { profile, loading } = useProfile(user);
  const { isAdmin, loading: adminLoading } = useIsAdmin(user);

  useEffect(() => {
    if (isAdmin) {
      navigate("/admin", { replace: true });
    }
  }, [isAdmin, navigate]);

  if (adminLoading) {
    return <p className="p-6 text-sm text-slate-500">טוען…</p>;
  }

  if (isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-sm text-slate-500">
        מעביר לניהול…
      </div>
    );
  }

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">טוען…</p>;
  }

  if (profile && profile.role !== "teacher") {
    return (
      <div className="p-6">
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 font-medium text-amber-900">
          דף זה מיועד למורים בלבד.
        </p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/home">בית</Link>
        </Button>
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
        <h1 className="text-2xl font-semibold">מורה — מפגשים</h1>
        <div className="flex gap-2">
          {isAdmin ? (
            <Button variant="outline" asChild>
              <Link to="/admin">ניהול</Link>
            </Button>
          ) : null}
          <Button variant="outline" asChild>
            <Link to="/home">בית</Link>
          </Button>
          <Button variant="outline" type="button" onClick={() => void logout()}>
            התנתק
          </Button>
        </div>
      </header>
      <p className="rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-sm text-slate-600 shadow-sm">
        מוצגים מפגשים באותו מגדר כמו פרופיל המורה (מדיניות RLS). דירוג כיתה
        לפי כיתת המארח.
      </p>
      {profile ? (
        <TeacherSessionList teacherGender={profile.gender} />
      ) : null}
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
        { event: "*", schema: "public", table: "game_sessions" },
        () => {
          void load();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(ch);
    };
  }, [load]);

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
    return <p className="text-sm text-slate-500">טוען…</p>;
  }

  return (
    <div className="space-y-4">
      {copyNotice ? (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900" role="status">
          {copyNotice}
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          סטטוס
          <select
            className={cn(fieldInputClass, "py-2 text-sm")}
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as TeacherSessionStatusFilter)
            }
          >
            <option value="all">הכל</option>
            <option value="waiting">ממתין (waiting)</option>
            <option value="playing">במשחק (playing)</option>
            <option value="paused">מושהה (paused)</option>
            <option value="completed">הושלם (completed)</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          משחק
          <select
            className={cn(fieldInputClass, "py-2 text-sm")}
            value={gameIdFilter}
            onChange={(e) => setGameIdFilter(e.target.value)}
          >
            <option value="">כל המשחקים</option>
            {gameOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          כיתת מארח
          <select
            className={cn(fieldInputClass, "py-2 text-sm")}
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value)}
          >
            <option value="">הכל</option>
            {[1, 2, 3, 4, 5, 6, 7].map((g) => (
              <option key={g} value={String(g)}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-right text-sm">
          <thead className="border-b border-slate-200 bg-slate-100">
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
              <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50/80">
                <td className="p-2">{r.games?.name_he ?? "—"}</td>
                <td className="p-2">{r.status}</td>
                <td className="p-2">{r.host_name}</td>
                <td className="p-2">{r.host_grade ?? "—"}</td>
                <td className="p-2 font-mono text-xs text-slate-500">
                  {r.last_activity
                    ? new Date(r.last_activity).toLocaleString("he-IL")
                    : "—"}
                </td>
                <td className="p-2">
                  <Link
                    className="font-semibold text-indigo-600 underline decoration-2 underline-offset-2 hover:text-indigo-800"
                    to={`/play/${r.id}?observe=1`}
                  >
                    צפה
                  </Link>
                </td>
                <td className="p-2">
                  {r.status === "paused" ? (
                    <Button
                      variant="outline"
                      size="sm"
                      type="button"
                      className="text-xs"
                      onClick={() => void copyResumeLink(r.id)}
                    >
                      העתק קישור לילדים
                    </Button>
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
        <p className="text-sm text-slate-500">אין מפגשים לפי המסננים.</p>
      ) : null}
    </div>
  );
}
