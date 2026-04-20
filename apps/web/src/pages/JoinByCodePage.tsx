import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

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
      navigate(`/play/${data.id}`, { replace: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [code, navigate]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 p-6">
      <h1 className="text-xl font-semibold">מצטרפים…</h1>
      {err ? (
        <>
          <p className="text-sm text-amber-300" role="alert">
            {err}
          </p>
          <Button variant="outline" asChild>
            <Link to="/home">בית</Link>
          </Button>
        </>
      ) : (
        <p className="text-sm text-slate-400">טוען מפגש…</p>
      )}
    </div>
  );
}
