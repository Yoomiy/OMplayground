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
    <div className="fixed inset-x-0 bottom-4 z-40 mx-auto w-full max-w-lg px-4">
      <div className="rounded-lg border border-sky-500/40 bg-slate-900/95 p-4 shadow-lg backdrop-blur">
        <p className="text-sm font-medium text-sky-100">
          {fromName ?? "מישהו"} שלח/ה לך בקשת חברות
        </p>
        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            type="button"
            disabled={busy}
            onClick={() => void onAccept()}
          >
            אשר
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
