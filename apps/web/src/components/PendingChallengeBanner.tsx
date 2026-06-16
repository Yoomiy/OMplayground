import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePendingChallenge } from "@/hooks/usePendingChallenge";


/**
 * Global incoming-challenge banner — appears on any page when another kid
 * challenges the current user. Accepting navigates both players into the
 * shared session.
 */
export function PendingChallengeBanner() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { challenge, accept, decline } = usePendingChallenge(user?.id);
  const [fromName, setFromName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!challenge) {
      setFromName(null);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("public_kid_profiles")
        .select("full_name")
        .eq("id", challenge.from_kid_id)
        .maybeSingle();
      if (!cancelled) {
        setFromName((data?.full_name as string | undefined) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [challenge?.id]);

  if (!challenge) return null;

  async function onAccept() {
    setBusy(true);
    try {
      const sessionId = await accept();
      if (sessionId) navigate(`/play/${sessionId}`);
    } finally {
      setBusy(false);
    }
  }

  async function onDecline() {
    setBusy(true);
    try {
      await decline();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sticky top-0 z-30 w-full border-b border-amber-400/30 bg-gradient-to-l from-amber-500/20 to-orange-500/10 shadow-[0_4px_24px_rgba(245,158,11,0.3)] backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500 text-2xl shadow-[0_4px_12px_rgba(245,158,11,0.4)] animate-kid-pop"
            aria-hidden
          >
            🎮
          </span>
          <div>
            <p className="text-base font-black text-amber-300">
              אתגר מ-{fromName ?? "חבר"}!
            </p>
            <p className="text-sm text-white/70">
              מישהו מזמין אותך למשחק — רוצה להצטרף? 🚀
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => void onAccept()}
            className="rounded-2xl bg-gradient-to-r from-amber-400 to-orange-500 border border-amber-300/50 px-6 py-2.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(245,158,11,0.5)] hover:shadow-[0_4px_16px_rgba(245,158,11,0.7)] hover:-translate-y-0.5 transition-all disabled:opacity-50"
          >
            בואו נשחק! 🎉
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onDecline()}
            className="rounded-2xl bg-white/10 border border-white/20 px-6 py-2.5 text-sm font-black text-white/70 hover:bg-white/20 hover:text-white transition-all disabled:opacity-50"
          >
            אולי אחר כך
          </button>
        </div>
      </div>
    </div>
  );
}
