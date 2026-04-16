import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { usePendingChallenge } from "@/hooks/usePendingChallenge";
import { usePresence } from "@/hooks/usePresence";
import { Button } from "@/components/ui/button";

const TICTACTOE_GAME_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const { challenge } = usePendingChallenge(user?.id);
  const { onlineCount } = usePresence(user?.id);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function createSession() {
    if (!user || !profile) return;
    setBusy(true);
    setErr(null);
    const code = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
    const { data, error } = await supabase
      .from("game_sessions")
      .insert({
        game_id: TICTACTOE_GAME_ID,
        host_id: user.id,
        host_name: profile.full_name,
        player_ids: [user.id],
        player_names: [profile.full_name],
        status: "waiting",
        is_open: true,
        invitation_code: code,
        gender: profile.gender
      })
      .select("id")
      .maybeSingle();
    if (error || !data?.id) {
      setErr(error?.message ?? "יצירת מפגש נכשלה");
      setBusy(false);
      return;
    }
    setBusy(false);
    navigate(`/play/${data.id}`);
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">שלום, {profile?.full_name}</h1>
          <p className="text-sm text-slate-400">
            סשן פעיל —{" "}
            <span className="text-emerald-400">מחובר</span>
            {onlineCount > 0 ? (
              <span className="mr-2 text-slate-500">
                · נוכחות (Realtime): {onlineCount}
              </span>
            ) : null}
          </p>
        </div>
        <Button variant="outline" type="button" onClick={() => void logout()}>
          התנתק
        </Button>
      </header>

      {challenge ? (
        <section className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm">
          <p className="font-medium text-amber-200">אתגר משחק ממתין</p>
          <pre className="mt-2 overflow-x-auto text-xs text-slate-300">
            {JSON.stringify(challenge, null, 2)}
          </pre>
        </section>
      ) : null}

      {err ? (
        <p className="text-sm text-amber-300" role="alert">
          {err}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">משחקים</h2>
        <Button type="button" disabled={busy} onClick={() => void createSession()}>
          {busy ? "יוצר…" : "צור מפגש איקס-עיגול"}
        </Button>
      </section>

      <nav className="flex flex-wrap gap-4 text-sm text-indigo-400">
        <Link className="underline" to="/friends">
          חברים
        </Link>
        <Link className="underline" to="/inbox">
          הודעות
        </Link>
        {profile?.role === "teacher" ? (
          <Link className="underline" to="/teacher">
            מורה
          </Link>
        ) : null}
        <Link className="underline" to="/admin">
          ניהול (שלד)
        </Link>
      </nav>
    </div>
  );
}
