import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usernameToSyntheticEmail } from "@/lib/username";
import { getPlaygroundAccessForUser } from "@/lib/recessAccess";
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
    const access = await getPlaygroundAccessForUser(uid);
    if (!access.allowed) {
      await supabase.auth.signOut();
      setError(access.message);
      setLoading(false);
      return;
    }

    if (access.role === "admin") {
      setLoading(false);
      navigate("/admin", { replace: true });
      return;
    }

    setLoading(false);
    if (access.role === "teacher") {
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
