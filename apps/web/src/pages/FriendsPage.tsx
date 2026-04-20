import { useState } from "react";
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
    <div className="mx-auto flex max-w-lg flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">חברים</h1>
        <Button variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </header>

      {err ? (
        <p className="text-sm text-amber-300" role="alert">
          {err}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-slate-400">טוען…</p> : null}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">בקשות חברות</h2>
        {incomingRequests.length === 0 ? (
          <p className="text-sm text-slate-400">אין בקשות נכנסות.</p>
        ) : (
          <ul className="space-y-2">
            {incomingRequests.map((f) => (
              <li
                key={f.friendship.id}
                className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              >
                <span>{f.partner.full_name}</span>
                <div className="flex gap-2">
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
              </li>
            ))}
          </ul>
        )}
      </section>

      {outgoingRequests.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">ממתינות לאישור</h2>
          <ul className="space-y-2">
            {outgoingRequests.map((f) => (
              <li
                key={f.friendship.id}
                className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              >
                <span>{f.partner.full_name}</span>
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() =>
                    void runWithRefresh(() =>
                      user ? unfriend(user.id, f.partner.id) : Promise.resolve()
                    )
                  }
                >
                  בטל
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="space-y-2">
        <h2 className="text-lg font-medium">החברים שלי</h2>
        {friends.length === 0 ? (
          <p className="text-sm text-slate-400">עדיין אין חברים.</p>
        ) : (
          <ul className="space-y-2">
            {friends.map((f) => (
              <li
                key={f.friendship.id}
                className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              >
                <span>{f.partner.full_name}</span>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => setMessageTo(f)}
                  >
                    שלח הודעה
                  </Button>
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
                    הסר חבר
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() =>
                      void runWithRefresh(() => blockKid(f.partner.id))
                    }
                  >
                    חסום
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-medium">חסומים</h2>
        {blocked.length === 0 ? (
          <p className="text-sm text-slate-400">לא חסמת אף אחד.</p>
        ) : (
          <ul className="space-y-2">
            {blocked.map((b) => (
              <li
                key={b.blocked_id}
                className="flex items-center justify-between rounded border border-slate-700 bg-slate-900/60 px-3 py-2 text-sm"
              >
                <span>{b.profile?.full_name ?? b.blocked_id.slice(0, 8)}</span>
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
