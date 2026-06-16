import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePendingFriendRequest } from "@/hooks/usePendingFriendRequest";

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
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center p-4 pb-[max(1rem,env(safe-area-inset-bottom))] animate-slide-up">
      <div
        className="pointer-events-auto w-full max-w-md rounded-3xl border border-white/10 bg-[#150d32]/95 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md"
        role="dialog"
        aria-modal="true"
        aria-labelledby="friend-req-title"
      >
        <div className="mb-1 text-2xl" aria-hidden>
          🤝
        </div>
        <p
          id="friend-req-title"
          className="text-base font-black leading-snug text-white"
        >
          {fromName ?? "מישהו"} רוצה להיות חבר/ה שלך
        </p>
        <p className="mt-2 text-xs font-bold text-white/50">
          רוצה לאשר את הבקשה?
        </p>
        <div className="mt-5 flex flex-col gap-3 sm:flex-row-reverse sm:justify-stretch">
          <button
            className="flex-1 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3 text-sm font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => void onAccept()}
          >
            כן, בואו נהיה חברים
          </button>
          <button
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
            type="button"
            disabled={busy}
            onClick={() => void onDecline()}
          >
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}
