import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usernameToSyntheticEmail } from "@/lib/username";
import { isWithinRecess, type RecessWindowRow } from "@/lib/recess";
import { Button } from "@/components/ui/button";
import { fieldInputClass, fieldLabelClass } from "@/lib/fieldStyles";

export function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = usernameToSyntheticEmail(username);
    const { data, error: signErr } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    if (signErr) {
      setError(signErr.message);
      setLoading(false);
      return;
    }
    const uid = data.user?.id;
    if (!uid) {
      setError("אין משתמש אחרי התחברות");
      setLoading(false);
      return;
    }
    const { data: adminRow } = await supabase
      .from("admin_profiles")
      .select("id")
      .eq("id", uid)
      .maybeSingle();
    if (adminRow) {
      setLoading(false);
      navigate("/admin", { replace: true });
      return;
    }

    const { data: profile } = await supabase
      .from("kid_profiles")
      .select("role")
      .eq("id", uid)
      .maybeSingle();
    const role = profile?.role as string | undefined;
    if (role === "kid") {
      const { data: schedules } = await supabase
        .from("recess_schedules")
        .select("day_of_week, start_time, end_time, is_active")
        .eq("is_active", true);
      const rows = (schedules ?? []) as RecessWindowRow[];
      if (rows.length > 0 && !isWithinRecess(new Date(), rows)) {
        await supabase.auth.signOut();
        setError(
          "כרגע אין הפסקה פעילה — לא ניתן להתחבר (מורים יכולים להתחבר בכל עת)."
        );
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    if (role === "teacher") {
      navigate("/teacher", { replace: true });
      return;
    }
    navigate("/home", { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-play sm:p-8">
        <div className="mb-8 text-center">
          <span className="text-5xl leading-none" aria-hidden>
            🛝
          </span>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">ברוכים הבאים</h1>
          <p className="mt-2 text-sm text-slate-600">
            התחברו כדי להמשיך למשחק
          </p>
        </div>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => void onSubmit(e)}
        >
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            שם משתמש
            <input
              className={fieldInputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            סיסמה
            <input
              type="password"
              className={fieldInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? (
            <p
              className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          <Button className="w-full" type="submit" size="lg" disabled={loading}>
            {loading ? "מתחבר…" : "התחבר"}
          </Button>
        </form>
      </div>
    </div>
  );
}
