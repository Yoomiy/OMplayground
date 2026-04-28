import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { usernameToSyntheticEmail } from "@/lib/username";
import { Button } from "@/components/ui/button";
import { fieldInputClass, fieldLabelClass } from "@/lib/fieldStyles";

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
    <div className="mx-auto flex max-w-md flex-col gap-6 px-4 py-10 sm:px-6">
      <div className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 shadow-play sm:p-8">
        <div className="mb-8 text-center">
          <span className="text-5xl leading-none" aria-hidden>
            ✨
          </span>
          <h1 className="mt-4 text-3xl font-bold text-slate-900">
            הצטרפו למגרש
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            כמה פרטים ואפשר להתחיל לשחק
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
              required
            />
            <span className="text-xs font-normal text-slate-500">
              ללא דוא״ל מדומה בממשק
            </span>
          </label>
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            שם תצוגה
            <input
              className={fieldInputClass}
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </label>
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            מגדר
            <select
              className={fieldInputClass}
              value={gender}
              onChange={(e) => setGender(e.target.value as "boy" | "girl")}
            >
              <option value="boy">בן</option>
              <option value="girl">בת</option>
            </select>
          </label>
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            כיתה
            <input
              type="number"
              min={1}
              max={7}
              className={fieldInputClass}
              value={grade}
              onChange={(e) => setGrade(Number(e.target.value))}
            />
          </label>
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            סיסמה
            <input
              type="password"
              className={fieldInputClass}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
            {loading ? "נרשם…" : "הרשם"}
          </Button>
        </form>
      </div>
      <p className="text-center text-sm text-slate-600">
        כבר רשום?{" "}
        <Link
          className="font-bold text-indigo-600 underline decoration-2 underline-offset-2 hover:text-indigo-700"
          to="/login"
        >
          התחברות
        </Link>
      </p>
    </div>
  );
}
