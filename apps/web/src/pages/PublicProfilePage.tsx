import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  fetchAvatarPresets,
  fetchPublicProfile,
  type AvatarPreset,
  type PublicProfile
} from "@/lib/profileApi";
import { sendChallenge } from "@/lib/challengeApi";
import { blockKid } from "@/lib/friendsApi";
import { ComposeMessage } from "@/components/ComposeMessage";
import { KidAvatar } from "@/components/KidAvatar";
import { KidDesktopShell, desktopPanelClass } from "@/components/KidDesktopShell";

interface GameCatalogRow {
  id: string;
  name_he: string;
}

export function PublicProfilePage() {
  const { kidId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile: me } = useProfile();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [presets, setPresets] = useState<AvatarPreset[]>([]);
  const [catalog, setCatalog] = useState<GameCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    if (!kidId) return;
    let cancelled = false;
    setLoading(true);
    setErr(null);
    void (async () => {
      try {
        const [publicProfile, avatarPresets] = await Promise.all([
          fetchPublicProfile(kidId),
          fetchAvatarPresets()
        ]);
        if (cancelled) return;
        setProfile(publicProfile);
        setPresets(avatarPresets);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "טעינת הפרופיל נכשלה");
          setProfile(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kidId]);

  useEffect(() => {
    if (!me || !profile) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("games")
        .select("id, name_he")
        .eq("is_active", true)
        .eq("is_multiplayer", true)
        .in("for_gender", ["both", me.gender])
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
  }, [me, profile]);

  async function block() {
    if (!profile) return;
    if (!window.confirm(`לחסום את ${profile.full_name}?`)) return;
    setBusy("block");
    setErr(null);
    setMsg(null);
    try {
      await blockKid(profile.id);
      setMsg("המשתמש נחסם");
      setTimeout(() => navigate("/home"), 700);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "חסימה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  async function challenge(gameId: string) {
    if (!user || !me || !profile) return;
    setBusy(`challenge:${gameId}`);
    setErr(null);
    setMsg(null);
    try {
      const { sessionId } = await sendChallenge({
        meId: user.id,
        meDisplayName: me.full_name,
        meGender: me.gender,
        toId: profile.id,
        gameId
      });
      navigate(`/play/${sessionId}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שליחת אתגר נכשלה");
    } finally {
      setBusy(null);
    }
  }

  if (kidId && user?.id === kidId) {
    return (
      <KidDesktopShell title="הפרופיל שלי" subtitle="צפייה בפרופיל האישי">
        <div className="mx-auto max-w-lg p-6">
          <Link
            to="/profile"
            className="w-full flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 transition-all duration-200"
          >
            עבור לפרופיל שלי 👤
          </Link>
        </div>
      </KidDesktopShell>
    );
  }

  if (loading) {
    return (
      <KidDesktopShell title="טוען..." subtitle="טוען פרטי פרופיל">
        <p className="p-6 text-sm font-bold text-white/50 text-center">טוען את פרטי הפרופיל…</p>
      </KidDesktopShell>
    );
  }

  if (!profile) {
    return (
      <KidDesktopShell title="פרופיל לא זמין" subtitle="שגיאה בטעינת הפרופיל">
        <div className="mx-auto max-w-lg p-6 flex flex-col gap-4">
          <p className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300">
            {err ?? "הפרופיל לא זמין. ייתכן שהוא חסום או לא באותו מגדר."}
          </p>
          <Link
            to="/home"
            className="w-full flex items-center justify-center rounded-2xl bg-white/10 border border-white/20 py-3 text-xs font-black text-white hover:bg-white/15 hover:-translate-y-0.5 transition-all duration-200"
          >
            חזרה ללוח המשחקים 🎮
          </Link>
        </div>
      </KidDesktopShell>
    );
  }

  return (
    <KidDesktopShell
      title={`הפרופיל של ${profile.full_name}`}
      subtitle={`צפייה בפרטים ואתגר למשחק של ${profile.full_name}`}
      contentClassName="relative grid min-h-[calc(100vh-136px)] gap-5 lg:grid-cols-[1fr_320px] grid-cols-1 items-start max-w-4xl mx-auto"
    >
      <div className="flex flex-col gap-5">
        <header className={desktopPanelClass("p-6 text-center flex flex-col items-center")}>
          <KidAvatar
            profile={profile}
            presets={presets}
            className="mx-auto size-28 min-h-[112px] min-w-[112px] rounded-3xl text-5xl border-4 border-white/20 shadow-lg"
          />
          <h1 className="mt-4 text-2xl font-black text-white leading-tight">
            {profile.full_name}
          </h1>
          <p className="mt-1 text-xs font-bold text-white/50">
            @{profile.username} · כיתה {profile.grade}
          </p>
        </header>

        {err && (
          <p className="rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-300 shadow-sm" role="alert">
            ⚠️ {err}
          </p>
        )}
        {msg && (
          <p className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-400 shadow-sm" role="alert">
            ✅ {msg}
          </p>
        )}

        <section className={desktopPanelClass("p-5")}>
          <h2 className="text-base font-black text-white">הזמן למשחק</h2>
          {catalog.length === 0 ? (
            <p className="mt-3 text-xs font-bold text-white/50">אין משחקים זמינים לאתגר.</p>
          ) : (
            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
              {catalog.map((game) => (
                <li key={game.id}>
                  <button
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void challenge(game.id)}
                    className="w-full flex items-center justify-between rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3 px-4 text-xs font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 transition-all duration-200 disabled:opacity-50"
                  >
                    <span>{game.name_he}</span>
                    <span className="rounded-lg bg-white/20 px-2 py-0.5 text-[10px] font-black">
                      {busy === `challenge:${game.id}` ? "שולח…" : "אתגר ⚔️"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <aside className="space-y-4 w-full">
        <section className={desktopPanelClass("p-5")}>
          <h2 className="text-base font-black text-white">פעולות</h2>
          <div className="mt-4 flex flex-col gap-2.5">
            <button
              type="button"
              className="w-full rounded-2xl bg-white/10 border border-white/20 hover:bg-white/15 py-3 text-xs font-black text-white hover:-translate-y-0.5 transition-all duration-200"
              disabled={busy !== null}
              onClick={() => setComposing(true)}
            >
              ✉️ שלח הודעה מהירה
            </button>
            <Link
              to={`/inbox?kidId=${profile.id}`}
              className="w-full flex items-center justify-center rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 py-3 text-xs font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 transition-all duration-200 text-center"
            >
              💬 פתח שיחה מלאה
            </Link>
            <button
              type="button"
              className="w-full rounded-2xl bg-rose-500/10 border border-rose-400/30 hover:bg-rose-500 hover:text-white py-3 text-xs font-black text-rose-400 hover:-translate-y-0.5 transition-all duration-200"
              disabled={busy !== null}
              onClick={() => void block()}
            >
              {busy === "block" ? "חוסם…" : "⛔ חסום משתמש"}
            </button>
          </div>
        </section>
      </aside>

      {user && me ? (
        <ComposeMessage
          open={composing}
          onClose={() => setComposing(false)}
          fromId={user.id}
          fromDisplayName={me.full_name}
          senderGender={me.gender}
          toId={profile.id}
          toDisplayName={profile.full_name}
        />
      ) : null}
    </KidDesktopShell>
  );
}
