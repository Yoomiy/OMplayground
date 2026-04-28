import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePendingFriendRequest } from "@/hooks/usePendingFriendRequest";
import { Button } from "@/components/ui/button";

/**
 * Global incoming friend-request popup.
 */
export function FriendRequestPopup() {
  const { user } = useAuth();
  const { request, accept, decline } = usePendingFriendRequest(user?.id);
  const [fromName, setFromName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!request) {
      setFromName(null);
      return;
    }
    void (async () => {
      const { data } = await supabase
        .from("public_kid_profiles")
        .select("full_name")
        .eq("id", request.requester_id)
        .maybeSingle();
      if (!cancelled) {
        setFromName((data?.full_name as string | undefined) ?? null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [request?.id, request?.requester_id]);

  if (!request) return null;

  async function onAccept() {
    setBusy(true);
    try {
      await accept();
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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
      <div
        className="pointer-events-auto w-full max-w-md rounded-3xl border-2 border-sky-200 bg-white p-5 shadow-2xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-req-title"
      >
        <div className="mb-1 text-2xl" aria-hidden>
          🤝
        </div>
        <p
          id="friend-req-title"
          className="text-base font-bold leading-snug text-slate-900"
        >
          {fromName ?? "מישהו"} רוצה להיות חבר/ה שלך
        </p>
        <p className="mt-2 text-sm text-slate-600">
          רוצה לאשר את הבקשה?
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse sm:justify-stretch">
          <Button
            className="flex-1"
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => void onAccept()}
          >
            כן, בואו נהיה חברים
          </Button>
          <Button
            className="flex-1"
            variant="outline"
            type="button"
            size="lg"
            disabled={busy}
            onClick={() => void onDecline()}
          >
            לא עכשיו
          </Button>
        </div>
      </div>
    </div>
  );
}
