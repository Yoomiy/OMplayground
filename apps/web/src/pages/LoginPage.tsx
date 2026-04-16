import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usernameToSyntheticEmail } from "@/lib/username";
import { isWithinRecess, type RecessWindowRow } from "@/lib/recess";
import { Button } from "@/components/ui/button";

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
      if (
        rows.length > 0 &&
        !isWithinRecess(new Date(), rows)
      ) {
        await supabase.auth.signOut();
        setError(
          "כרגע אין הפסקה פעילה — לא ניתן להתחבר (מורים יכולים להתחבר בכל עת)."
        );
        setLoading(false);
        return;
      }
    }
    setLoading(false);
    navigate("/home", { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">התחברות</h1>
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        <label className="flex flex-col gap-1 text-sm">
          שם משתמש
          <input
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          סיסמה
          <input
            type="password"
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error ? (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "מתחבר…" : "התחבר"}
        </Button>
      </form>
      <p className="text-sm text-slate-400">
        אין חשבון?{" "}
        <Link className="text-indigo-400 underline" to="/register">
          הרשמה
        </Link>
      </p>
    </div>
  );
}
