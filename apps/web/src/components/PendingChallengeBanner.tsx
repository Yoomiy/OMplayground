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
    <div className="sticky top-0 z-30 w-full border-b border-amber-500/40 bg-amber-500/15 backdrop-blur">
      <div className="mx-auto flex max-w-lg flex-wrap items-center justify-between gap-3 p-3 text-sm">
        <p className="font-medium text-amber-100">
          {fromName ?? "מישהו"} שלח/ה לך אתגר משחק
        </p>
        <div className="flex gap-2">
          <Button
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => void onAccept()}
          >
            קבל
          </Button>
          <Button
            size="sm"
            variant="outline"
            type="button"
            disabled={busy}
            onClick={() => void onDecline()}
          >
            דחה
          </Button>
        </div>
      </div>
    </div>
  );
}
