import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePendingChallenge } from "@/hooks/usePendingChallenge";
import { Button } from "@/components/ui/button";

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
    <div className="sticky top-0 z-30 w-full border-b border-amber-200 bg-gradient-to-l from-amber-100 to-orange-50 shadow-md">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="mt-0.5 flex size-11 shrink-0 items-center justify-center rounded-2xl bg-amber-400 text-2xl shadow-inner"
            aria-hidden
          >
            🎮
          </span>
          <div>
            <p className="text-base font-bold text-amber-950">
              אתגר מ-{fromName ?? "חבר"}
            </p>
            <p className="text-sm text-amber-900/90">
              מישהו מזמין אותך למשחק — רוצה להצטרף?
            </p>
          </div>
        </div>
        <div className="flex w-full shrink-0 flex-col gap-2 sm:w-auto sm:flex-row">
          <Button
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => void onAccept()}
          >
            בואו נשחק!
          </Button>
          <Button
            variant="outline"
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => void onDecline()}
          >
            אולי אחר כך
          </Button>
        </div>
      </div>
    </div>
  );
}
