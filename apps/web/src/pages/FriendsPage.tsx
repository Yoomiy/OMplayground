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
import { Button } from "@/components/ui/button";
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
        "rounded-3xl border border-slate-200/90 bg-white/95 p-4 shadow-play",
        className
      )}
    >
      {children}
    </div>
  );
}

export function FriendsPage() {
  const { user } = useAuth();
  const { profile } = useProfile(user);
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
      <header className="flex flex-wrap items-start justify-between gap-4 rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-play">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">חברים</h1>
          <p className="mt-1 text-sm text-slate-600">
            בקשות, רשימה וחסימות — הכל במקום אחד
          </p>
        </div>
        <Button variant="outline" type="button" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>

      {err ? (
        <p
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900"
          role="alert"
        >
          {err}
        </p>
      ) : null}

      {loading ? (
        <p className="text-center text-sm text-slate-500">טוען…</p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">בקשות חברות</h2>
        {incomingRequests.length === 0 ? (
          <p className="text-sm text-slate-500">אין בקשות נכנסות.</p>
        ) : (
          <ul className="space-y-3">
            {incomingRequests.map((f) => (
              <li key={f.friendship.id}>
                <RowCard className="border-emerald-200/90 bg-emerald-50/40">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-semibold text-slate-900">
                      {f.partner.full_name}
                    </span>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        size="sm"
                        type="button"
                        onClick={() =>
                          void runWithRefresh(() =>
                            respondToFriendRequest(f.friendship.id, true)
                          )
                        }
                      >
                        אשר
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() =>
                          void runWithRefresh(() =>
                            respondToFriendRequest(f.friendship.id, false)
                          )
                        }
                      >
                        דחה
                      </Button>
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
          <h2 className="text-lg font-bold text-slate-900">ממתינות לאישור</h2>
          <ul className="space-y-3">
            {outgoingRequests.map((f) => (
              <li key={f.friendship.id}>
                <RowCard>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-slate-800">
                      {f.partner.full_name}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() =>
                        void runWithRefresh(() =>
                          user
                            ? unfriend(user.id, f.partner.id)
                            : Promise.resolve()
                        )
                      }
                    >
                      בטל
                    </Button>
                  </div>
                </RowCard>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">החברים שלי</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-slate-500">עדיין אין חברים.</p>
        ) : (
          <ul className="space-y-3">
            {friends.map((f) => (
              <li key={f.friendship.id}>
                <RowCard>
                  <div className="flex flex-col gap-4">
                    <span className="text-lg font-bold text-slate-900">
                      {f.partner.full_name}
                    </span>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        onClick={() => setMessageTo(f)}
                      >
                        שלח הודעה
                      </Button>
                      <Button
                        variant="outline"
                        type="button"
                        size="sm"
                        onClick={() =>
                          void runWithRefresh(() =>
                            user
                              ? unfriend(user.id, f.partner.id)
                              : Promise.resolve()
                          )
                        }
                      >
                        הסר חבר
                      </Button>
                      <Button
                        variant="destructive"
                        type="button"
                        size="sm"
                        onClick={() =>
                          void runWithRefresh(() => blockKid(f.partner.id))
                        }
                      >
                        חסום
                      </Button>
                    </div>
                  </div>
                </RowCard>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-bold text-slate-900">חסומים</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-slate-500">לא חסמת אף אחד.</p>
        ) : (
          <ul className="space-y-3">
            {blocked.map((b) => (
              <li key={b.blocked_id}>
                <RowCard className="border-slate-200 bg-slate-50/90">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="font-medium text-slate-800">
                      {b.profile?.full_name ?? b.blocked_id.slice(0, 8)}
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      type="button"
                      onClick={() =>
                        void runWithRefresh(() =>
                          user
                            ? unblockKid(user.id, b.blocked_id)
                            : Promise.resolve()
                        )
                      }
                    >
                      הסר חסימה
                    </Button>
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
