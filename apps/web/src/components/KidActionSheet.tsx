import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ComposeMessage } from "@/components/ComposeMessage";
import { KidAvatar } from "@/components/KidAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { sendChallenge } from "@/lib/challengeApi";
import { sendFriendRequest, blockKid } from "@/lib/friendsApi";
import { supabase } from "@/lib/supabase";
import type { PublicKidProfile } from "@/hooks/useOnlineKids";
import { cn } from "@/lib/cn";

interface GameCatalogRow {
  id: string;
  name_he: string;
}

export interface KidActionSheetProps {
  kid: PublicKidProfile | null;
  onClose: () => void;
}

export function KidActionSheet({ kid, onClose }: KidActionSheetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile(user);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);
  const [catalog, setCatalog] = useState<GameCatalogRow[]>([]);

  useEffect(() => {
    if (!profile || !kid) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, name_he")
        .eq("is_active", true)
        .eq("is_multiplayer", true)
        .in("for_gender", ["both", profile.gender])
        .order("name_he", { ascending: true });
      if (cancelled) return;
      if (error) {
        setErr(error.message);
        return;
      }
      setCatalog((data ?? []) as GameCatalogRow[]);
    })();
    return () => {
      cancelled = true;
    };
  }, [profile, kid]);

  if (!kid || !user || !profile) return null;

  async function challenge(gameId: string) {
    if (!user || !profile || !kid) return;
    setBusy(`challenge:${gameId}`);
    setErr(null);
    setInfo(null);
    try {
      const { sessionId } = await sendChallenge({
        meId: user.id,
        meDisplayName: profile.full_name,
        meGender: profile.gender,
        toId: kid.id,
        gameId
      });
      onClose();
      navigate(`/play/${sessionId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "אתגר נכשל");
    } finally {
      setBusy(null);
    }
  }

  async function friend() {
    if (!kid) return;
    setBusy("friend");
    setErr(null);
    setInfo(null);
    try {
      const res = await sendFriendRequest(kid.id);
      setInfo(
        res.status === "accepted"
          ? "נוספתם כחברים"
          : res.already
            ? "בקשה כבר נשלחה"
            : "בקשת חברות נשלחה"
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שליחה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  async function block() {
    if (!kid) return;
    setBusy("block");
    setErr(null);
    setInfo(null);
    try {
      await blockKid(kid.id);
      setInfo("המשתמש נחסם");
      setTimeout(onClose, 600);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "חסימה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kid-action-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start gap-4 border-b border-slate-100 bg-gradient-to-l from-indigo-50/80 to-white p-5">
            <KidAvatar
              profile={kid}
              className="size-14 min-h-[56px] min-w-[56px] shrink-0 text-xl"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <h3
                id="kid-action-title"
                className="text-xl font-bold text-slate-900"
              >
                {kid.full_name}
              </h3>
              <p className="truncate text-sm text-slate-500">@{kid.username}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              onClick={onClose}
            >
              ✕
            </button>
          </header>

          <div className="max-h-[min(60vh,420px)] space-y-5 overflow-y-auto p-5">
            {err ? (
              <p
                className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
                role="alert"
              >
                {err}
              </p>
            ) : null}
            {info ? (
              <p
                className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-900"
                role="status"
              >
                {info}
              </p>
            ) : null}

            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                נשחק ביחד
              </h4>
              {catalog.length === 0 ? (
                <p className="text-sm text-slate-500">
                  אין משחקים זמינים לאתגר
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {catalog.map((g) => (
                    <li key={g.id}>
                      <Button
                        className="w-full justify-between"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void challenge(g.id)}
                      >
                        <span>{g.name_he}</span>
                        <span className="text-xs font-semibold opacity-90">
                          {busy === `challenge:${g.id}` ? "שולח…" : "אתגר"}
                        </span>
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2 border-t border-slate-100 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500">
                הודעה וחברות
              </h4>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    onClose();
                    navigate(`/profile/${kid.id}`);
                  }}
                >
                  צפה בפרופיל
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setComposing(true)}
                >
                  שלח הודעה
                </Button>
                <Button
                  variant="outline"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void friend()}
                >
                  {busy === "friend" ? "שולח…" : "בקשת חברות"}
                </Button>
              </div>
            </section>

            <section
              className={cn(
                "space-y-2 border-t border-rose-100 pt-4",
                "rounded-2xl bg-rose-50/50 p-3"
              )}
            >
              <h4 className="text-xs font-bold uppercase tracking-wide text-rose-700">
                בטיחות
              </h4>
              <p className="text-xs text-rose-800/90">
                חסימה מסתירה את המשתמש ממך. אפשר להסיר חסימה בדף חברים.
              </p>
              <Button
                variant="destructive"
                type="button"
                disabled={busy !== null}
                onClick={() => void block()}
              >
                {busy === "block" ? "חוסם…" : "חסום משתמש"}
              </Button>
            </section>
          </div>

          <div className="border-t border-slate-100 bg-slate-50/80 p-4">
            <Button
              className="w-full"
              variant="ghost"
              type="button"
              onClick={onClose}
            >
              סגור
            </Button>
          </div>
        </div>
      </div>
      <ComposeMessage
        open={composing}
        onClose={() => setComposing(false)}
        fromId={user.id}
        fromDisplayName={profile.full_name}
        senderGender={profile.gender}
        toId={kid.id}
        toDisplayName={kid.full_name}
      />
    </>
  );
}
