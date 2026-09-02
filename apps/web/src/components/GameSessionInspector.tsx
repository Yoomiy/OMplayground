import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
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
  gender: "boy" | "girl" | "all";
  game_id: string;
  host_grade: string | null;
  last_activity: string | null;
  games: { name_he: string } | null;
}

export interface GameSessionInspectorProps {
  scope: "teacher" | "admin";
  teacherGender?: "boy" | "girl";
}

export function GameSessionInspector({ scope, teacherGender }: GameSessionInspectorProps) {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<TeacherSessionStatusFilter>("playing");
  const [gameIdFilter, setGameIdFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState<"" | "boy" | "girl">("");
  const [copyNotice, setCopyNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    let query = supabase
      .from("game_sessions")
      .select("id, status, host_name, gender, last_activity, game_id, host_grade, games ( name_he )")
      .order("last_activity", { ascending: false })
      .limit(100);
    if (scope === "teacher" && teacherGender) query = query.eq("gender", teacherGender);
    const { data, error } = await query;
    if (error) {
      console.error(error);
      setRows([]);
    } else {
      setRows((data ?? []) as unknown as SessionRow[]);
    }
    setLoading(false);
  }, [scope, teacherGender]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`${scope}-sessions-live${teacherGender ? `-${teacherGender}` : ""}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "game_sessions",
          ...(scope === "teacher" && teacherGender ? { filter: `gender=eq.${teacherGender}` } : {})
        },
        () => { void load(); }
      )
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [load, scope, teacherGender]);

  const gameOptions = useMemo(() => {
    const names = new Map<string, string>();
    for (const row of rows) if (row.game_id && row.games?.name_he) names.set(row.game_id, row.games.name_he);
    return Array.from(names.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const filtered = useMemo(() => rows.filter((row) => {
    if (!matchesTeacherStatusFilter(row.status, statusFilter)) return false;
    if (gameIdFilter && row.game_id !== gameIdFilter) return false;
    if (gradeFilter && row.host_grade !== gradeFilter) return false;
    return !(scope === "admin" && genderFilter && row.gender !== genderFilter);
  }), [rows, statusFilter, gameIdFilter, gradeFilter, scope, genderFilter]);

  const copyResumeLink = useCallback(async (sessionId: string) => {
    const url = `${window.location.origin}/play/${sessionId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopyNotice("הקישור הועתק — ניתן לשלוח לילדים");
      window.setTimeout(() => setCopyNotice(null), 2500);
    } catch {
      window.prompt("העתק קישור להמשך המשחק:", url);
    }
  }, []);

  if (loading) return <p className="text-sm text-white/50">טוען…</p>;

  return (
    <div className="space-y-4">
      {copyNotice ? <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300" role="status">{copyNotice}</p> : null}
      <div className="flex flex-wrap items-end gap-3 text-sm text-white/80">
        <label className="flex flex-col gap-1">סטטוס
          <select className={cn(kidFieldInputClass, "py-1 px-3 text-sm min-h-10 w-auto bg-white/5 border-white/10 text-white rounded-xl")} value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as TeacherSessionStatusFilter)}>
            <option className="bg-slate-900 text-white" value="all">הכל</option><option className="bg-slate-900 text-white" value="waiting">ממתין</option><option className="bg-slate-900 text-white" value="playing">במשחק</option><option className="bg-slate-900 text-white" value="paused">מושהה</option><option className="bg-slate-900 text-white" value="completed">הושלם</option>
          </select>
        </label>
        {scope === "admin" ? <label className="flex flex-col gap-1">מגדר
          <select className={cn(kidFieldInputClass, "py-1 px-3 text-sm min-h-10 w-auto bg-white/5 border-white/10 text-white rounded-xl")} value={genderFilter} onChange={(event) => setGenderFilter(event.target.value as "" | "boy" | "girl")}>
            <option className="bg-slate-900 text-white" value="">הכל</option><option className="bg-slate-900 text-white" value="boy">בנים</option><option className="bg-slate-900 text-white" value="girl">בנות</option>
          </select>
        </label> : null}
        <label className="flex flex-col gap-1">משחק
          <select className={cn(kidFieldInputClass, "py-1 px-3 text-sm min-h-10 w-auto bg-white/5 border-white/10 text-white rounded-xl")} value={gameIdFilter} onChange={(event) => setGameIdFilter(event.target.value)}>
            <option className="bg-slate-900 text-white" value="">כל המשחקים</option>{gameOptions.map(([id, name]) => <option className="bg-slate-900 text-white" key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1">כיתת מארח
          <input className={cn(kidFieldInputClass, "py-1 px-3 text-sm min-h-10 w-20 bg-white/5 border-white/10 text-white rounded-xl")} value={gradeFilter} onChange={(event) => setGradeFilter(event.target.value)} />
        </label>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10 bg-white/5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <table className="w-full text-right text-sm text-white/80"><thead className="border-b border-white/10 bg-white/10 text-white/90"><tr>
          <th className="p-2">משחק</th><th className="p-2">סטטוס</th><th className="p-2">מארח</th>{scope === "admin" ? <th className="p-2">מגדר</th> : null}<th className="p-2">כיתה</th><th className="p-2">פעילות אחרונה</th><th className="p-2">צפייה</th><th className="p-2">המשך</th>
        </tr></thead><tbody>{filtered.map((row) => <tr key={row.id} className="border-b border-white/5 hover:bg-white/5">
          <td className="p-2">{row.games?.name_he ?? "—"}</td><td className="p-2">{row.status}</td><td className="p-2">{row.host_name}</td>{scope === "admin" ? <td className="p-2">{row.gender === "boy" ? "בנים" : row.gender === "girl" ? "בנות" : "מעורב"}</td> : null}<td className="p-2">{row.host_grade ?? "—"}</td><td className="p-2 font-mono text-xs text-white/55">{row.last_activity ? new Date(row.last_activity).toLocaleString("he-IL") : "—"}</td>
          <td className="p-2">{row.status === "waiting" || row.status === "playing" ? <Link className="font-semibold text-violet-400 underline decoration-2 underline-offset-2 hover:text-violet-300" to={`/play/${row.id}?observe=1`}>צפה</Link> : "—"}</td>
          <td className="p-2">{row.status === "paused" ? <button type="button" className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200" onClick={() => void copyResumeLink(row.id)}>העתק קישור לילדים</button> : "—"}</td>
        </tr>)}</tbody></table>
      </div>
      {filtered.length === 0 ? <p className="text-sm text-white/50">אין מפגשים לפי המסננים.</p> : null}
    </div>
  );
}
