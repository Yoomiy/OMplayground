import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usernameToSyntheticEmail } from "@/lib/username";
import { getPlaygroundAccessForUser } from "@/lib/recessAccess";
import { kidFieldInputClass, kidFieldLabelClass } from "@/lib/fieldStyles";

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
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-20 sm:px-6">
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md sm:p-8">
        <div className="mb-8 text-center">
          <span className="text-5xl leading-none" aria-hidden>
            🛝
          </span>
          <h1 className="mt-4 text-3xl font-black text-white">ברוכים הבאים</h1>
          <p className="mt-2 text-sm font-bold text-white/60">
            התחברו כדי להמשיך למשחק
          </p>
        </div>
        <form
          className="flex flex-col gap-5"
          onSubmit={(e) => void onSubmit(e)}
        >
          <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
            שם משתמש
            <input
              className={kidFieldInputClass}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
            />
          </label>
          <label className={`flex flex-col gap-2 ${kidFieldLabelClass}`}>
            סיסמה
            <input
              type="password"
              className={kidFieldInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </label>
          {error ? (
            <p
              className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300"
              role="alert"
            >
              ⚠️ {error}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "מתחבר…" : "התחבר"}
          </button>
        </form>
      </div>
    </div>
  );
}
