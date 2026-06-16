import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  useFriendships,
  type FriendWithProfile
} from "@/hooks/useFriendships";
import {
  respondToFriendRequest,
  unfriend,
  blockKid,
  unblockKid
} from "@/lib/friendsApi";
import { ComposeMessage } from "@/components/ComposeMessage";
import { cn } from "@/lib/cn";

function RowCard({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/10 bg-white/5 p-4 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FriendsPage() {
  const { user } = useAuth();
  const { profile } = useProfile();
  const {
    friends,
    incomingRequests,
    outgoingRequests,
    blocked,
    loading,
    refetch
  } = useFriendships(user?.id);
  const [err, setErr] = useState<string | null>(null);
  const [messageTo, setMessageTo] = useState<FriendWithProfile | null>(null);

  async function runWithRefresh(op: () => Promise<void>) {
    setErr(null);
    try {
      await op();
      await refetch();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "פעולה נכשלה");
    }
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_4px_24px_rgba(0,0,0,0.4)] backdrop-blur-md">
        <div>
          <h1 className="text-2xl font-bold text-white">חברים</h1>
          <p className="mt-1 text-sm text-white/60">
            בקשות, רשימה וחסימות — הכל במקום אחד
          </p>
        </div>
        <Link
          to="/home"
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
        >
          בית
        </Link>
      </header>

      {err ? (
        <p
          className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-medium text-amber-300"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-white/50">טוען…</p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">בקשות חברות</h2>
        {incomingRequests.length === 0 ? (
          <p className="text-sm text-white/40">אין בקשות נכנסות.</p>
        ) : (
          <ul className="space-y-3">
            {incomingRequests.map((f) => (
              <li key={f.friendship.id}>
                <RowCard className="border-emerald-500/30 bg-emerald-500/10">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold text-white">
                      {f.partner.full_name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          void runWithRefresh(() =>
                            respondToFriendRequest(f.friendship.id, true)
                          )
                        }
                        className="rounded-xl bg-emerald-600 border border-emerald-500/50 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-500 hover:shadow-[0_0_12px_rgba(16,185,129,0.3)] transition duration-200"
                      >
                        אשר
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runWithRefresh(() =>
                            respondToFriendRequest(f.friendship.id, false)
                          )
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                      >
                        דחה
                      </button>
                    </div>
                  </div>
                </RowCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoingRequests.length > 0 ? (
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-white">ממתינות לאישור</h2>
          <ul className="space-y-3">
            {outgoingRequests.map((f) => (
              <li key={f.friendship.id}>
                <RowCard>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-white/80">
                      {f.partner.full_name}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void runWithRefresh(() =>
                          user
                            ? unfriend(user.id, f.partner.id)
                            : Promise.resolve()
                        )
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                    >
                      בטל
                    </button>
                  </div>
                </RowCard>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">החברים שלי</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-white/40">עדיין אין חברים.</p>
        ) : (
          <ul className="space-y-3">
            {friends.map((f) => (
              <li key={f.friendship.id}>
                <RowCard>
                  <div className="flex flex-col gap-4">
                    <span className="text-lg font-bold text-white">
                      {f.partner.full_name}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <button
                        type="button"
                        onClick={() => setMessageTo(f)}
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                      >
                        שלח הודעה
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runWithRefresh(() =>
                            user
                              ? unfriend(user.id, f.partner.id)
                              : Promise.resolve()
                          )
                        }
                        className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                      >
                        הסר חבר
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void runWithRefresh(() => blockKid(f.partner.id))
                        }
                        className="rounded-xl bg-rose-600 border border-rose-500/50 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition duration-200"
                      >
                        חסום
                      </button>
                    </div>
                  </div>
                </RowCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-white">חסומים</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-white/40">לא חסמת אף אחד.</p>
        ) : (
          <ul className="space-y-3">
            {blocked.map((b) => (
              <li key={b.blocked_id}>
                <RowCard>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-white/80">
                      {b.profile?.full_name ?? b.blocked_id.slice(0, 8)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        void runWithRefresh(() =>
                          user
                            ? unblockKid(user.id, b.blocked_id)
                            : Promise.resolve()
                        )
                      }
                      className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
                    >
                      הסר חסימה
                    </button>
                  </div>
                </RowCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      {user && profile && messageTo ? (
        <ComposeMessage
          open={true}
          onClose={() => setMessageTo(null)}
          fromId={user.id}
          fromDisplayName={profile.full_name}
          senderGender={profile.gender}
          toId={messageTo.partner.id}
          toDisplayName={messageTo.partner.full_name}
        />
      ) : null}
    </div>
  );
}
