import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ComposeMessage } from "@/components/ComposeMessage";
import { KidAvatar } from "@/components/KidAvatar";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { sendChallenge } from "@/lib/challengeApi";
import { blockKid } from "@/lib/friendsApi";
import { supabase } from "@/lib/supabase";
import type { PublicKidProfile } from "@/hooks/useOnlineKids";

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
  const { profile } = useProfile();
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
        className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-md sm:items-center animate-slide-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="kid-action-title"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          className="max-h-[90vh] w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#150d32]/95 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
          onClick={(e) => e.stopPropagation()}
        >
          <header className="flex items-start gap-4 border-b border-white/10 bg-white/5 p-5">
            <KidAvatar
              profile={kid}
              className="size-14 min-h-[56px] min-w-[56px] shrink-0 text-xl"
            />
            <div className="min-w-0 flex-1 pt-0.5">
              <h3
                id="kid-action-title"
                className="text-xl font-black text-white"
              >
                {kid.full_name}
              </h3>
              <p className="truncate text-sm font-bold text-white/50">@{kid.username}</p>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-xl px-3 py-2 text-sm font-bold text-white/60 hover:bg-white/10"
              onClick={onClose}
            >
              ✕
            </button>
          </header>

          <div className="max-h-[min(60vh,420px)] space-y-5 overflow-y-auto p-5 custom-scrollbar">
            {err ? (
              <p
                className="rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-300"
                role="alert"
              >
                ⚠️ {err}
              </p>
            ) : null}
            {info ? (
              <p
                className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm font-bold text-emerald-300"
                role="status"
              >
                ✅ {info}
              </p>
            ) : null}

            <section className="space-y-2">
              <h4 className="text-xs font-bold uppercase tracking-wide text-white/40">
                נשחק ביחד
              </h4>
              {catalog.length === 0 ? (
                <p className="text-sm font-bold text-white/50">
                  אין משחקים זמינים לאתגר
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {catalog.map((g) => (
                    <li key={g.id}>
                      <button
                        className="w-full flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-4 py-3 text-sm font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
                        type="button"
                        disabled={busy !== null}
                        onClick={() => void challenge(g.id)}
                      >
                        <span>{g.name_he}</span>
                        <span className="text-xs font-black opacity-90">
                          {busy === `challenge:${g.id}` ? "שולח…" : "אתגר 🎮"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="space-y-2 border-t border-white/10 pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wide text-white/40">
                פעולות
              </h4>
              <div className="flex flex-col gap-2">
                <button
                  className="w-full text-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => {
                    onClose();
                    navigate(`/profile/${kid.id}`);
                  }}
                >
                  צפה בפרופיל 👀
                </button>
                <button
                  className="w-full text-center rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200 disabled:opacity-50"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => setComposing(true)}
                >
                  שלח הודעה ✉️
                </button>
              </div>
            </section>

            <section className="space-y-2 border-t border-rose-500/25 pt-4 rounded-2xl bg-rose-500/5 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-rose-400">
                בטיחות
              </h4>
              <p className="text-xs font-bold text-rose-300/80">
                חסימה מסתירה את המשתמש ממך.
              </p>
              <button
                className="w-full text-center rounded-2xl bg-rose-600 border border-rose-500/50 py-3 text-sm font-black text-white hover:bg-rose-700 transition duration-200 disabled:opacity-50"
                type="button"
                disabled={busy !== null}
                onClick={() => void block()}
              >
                {busy === "block" ? "חוסם…" : "חסום משתמש 🚫"}
              </button>
            </section>
          </div>

          <div className="border-t border-white/10 bg-white/5 p-4">
            <button
              className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
              type="button"
              onClick={onClose}
            >
              סגור
            </button>
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
