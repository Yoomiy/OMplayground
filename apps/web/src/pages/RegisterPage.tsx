import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usernameToSyntheticEmail } from "@/lib/username";
import { Button } from "@/components/ui/button";

export function RegisterPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [gender, setGender] = useState<"boy" | "girl">("boy");
  const [grade, setGrade] = useState(3);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const email = usernameToSyntheticEmail(username);
    const { data, error: signErr } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username, full_name: fullName }
      }
    });
    if (signErr) {
      setError(signErr.message);
      setLoading(false);
      return;
    }
    const user = data.session?.user ?? data.user;
    if (!user) {
      setError(
        "נדרש אישור אימייל בפרויקט Supabase — כבה אימות אימייל לפיתוח או אשר את החשבון."
      );
      setLoading(false);
      return;
    }
    const { error: insErr } = await supabase.from("kid_profiles").insert({
      id: user.id,
      username: username.trim().toLowerCase(),
      full_name: fullName,
      gender,
      grade,
      role: "kid"
    });
    if (insErr) {
      setError(insErr.message);
      setLoading(false);
      return;
    }
    setLoading(false);
    navigate("/home", { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6 p-6">
      <h1 className="text-2xl font-semibold">הרשמה</h1>
      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        <label className="flex flex-col gap-1 text-sm">
          שם משתמש (ללא דוא״ל מדומה בממשק)
          <input
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          שם תצוגה
          <input
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          מגדר
          <select
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            value={gender}
            onChange={(e) => setGender(e.target.value as "boy" | "girl")}
          >
            <option value="boy">בן</option>
            <option value="girl">בת</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          כיתה
          <input
            type="number"
            min={1}
            max={7}
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            value={grade}
            onChange={(e) => setGrade(Number(e.target.value))}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          סיסמה
          <input
            type="password"
            className="rounded border border-slate-600 bg-slate-900 px-3 py-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error ? (
          <p className="text-sm text-amber-300" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" disabled={loading}>
          {loading ? "נרשם…" : "הרשם"}
        </Button>
      </form>
      <p className="text-sm text-slate-400">
        כבר רשום?{" "}
        <Link className="text-indigo-400 underline" to="/login">
          התחברות
        </Link>
      </p>
    </div>
  );
}
