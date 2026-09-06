import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";

export function JoinByCodePage() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!code) {
      setErr("חסר קוד הזמנה");
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("game_sessions")
        .select("id, status")
        .eq("invitation_code", code)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data?.id) {
        setErr("קוד הזמנה לא נמצא");
        return;
      }
      navigate(`/play/${data.id}?invite=${encodeURIComponent(code)}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 px-4 py-20 sm:px-6">
      <div className="rounded-3xl border border-slate-200 dark:border-white/10 bg-white/95 dark:bg-white/5 p-6 shadow-2xl backdrop-blur-md sm:p-8">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">מצטרפים…</h1>
        {err ? (
          <div className="mt-4 space-y-4">
            <p className="rounded-2xl border border-amber-300 dark:border-amber-400/30 bg-amber-50 dark:bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-800 dark:text-amber-300" role="alert">
              ⚠️ {err}
            </p>
            <Link
              to="/home"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-100 dark:bg-white/5 px-5 py-2.5 text-sm font-black text-slate-700 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white hover:-translate-y-0.5 transition-all duration-200"
            >
              בית 🏠
            </Link>
          </div>
        ) : (
          <p className="mt-2 text-sm font-bold text-slate-500 dark:text-white/50">טוען מפגש…</p>
        )}
      </div>
    </div>
  );
}
