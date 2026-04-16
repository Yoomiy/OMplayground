import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { Button } from "@/components/ui/button";

interface SessionRow {
  id: string;
  status: string;
  host_name: string;
  gender: string;
}

export function TeacherPage() {
  const { user } = useAuth();
  const { profile, loading } = useProfile(user);

  if (loading) {
    return <p className="p-6 text-sm text-slate-400">טוען…</p>;
  }

  if (profile && profile.role !== "teacher") {
    return (
      <div className="p-6">
        <p className="text-amber-300">דף זה מיועד למורים בלבד.</p>
        <Button variant="outline" className="mt-4" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">מורה — מפגשים פעילים</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>
      <p className="text-sm text-slate-400">
        רשימת מפגשים נקראת מ־<code className="text-slate-300">game_sessions</code>{" "}
        (מטא־דאטה ב־Supabase, עדכון בגבולות משחק).
      </p>
      <TeacherSessionList />
    </div>
  );
}

function TeacherSessionList() {
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase
        .from("game_sessions")
        .select("id, status, host_name, gender")
        .in("status", ["waiting", "playing", "paused"])
        .order("last_activity", { ascending: false })
        .limit(50);
      if (!cancelled) {
        setRows((data ?? []) as SessionRow[]);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return <p className="text-sm text-slate-400">טוען…</p>;
  }

  return (
    <div className="overflow-x-auto rounded border border-slate-700">
      <table className="w-full text-right text-sm">
        <thead className="border-b border-slate-700 bg-slate-900/80">
          <tr>
            <th className="p-2">מזהה</th>
            <th className="p-2">סטטוס</th>
            <th className="p-2">מארח</th>
            <th className="p-2">מגדר</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b border-slate-800">
              <td className="p-2 font-mono text-xs">{r.id.slice(0, 8)}…</td>
              <td className="p-2">{r.status}</td>
              <td className="p-2">{r.host_name}</td>
              <td className="p-2">{r.gender}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
