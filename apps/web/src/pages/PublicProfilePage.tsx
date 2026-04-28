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
import { blockKid, sendFriendRequest } from "@/lib/friendsApi";
import { ComposeMessage } from "@/components/ComposeMessage";
import { KidAvatar } from "@/components/KidAvatar";
import { Button } from "@/components/ui/button";

interface GameCatalogRow {
  id: string;
  name_he: string;
}

export function PublicProfilePage() {
  const { kidId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile: me } = useProfile(user);
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

  async function friend() {
    if (!profile) return;
    setBusy("friend");
    setErr(null);
    setMsg(null);
    try {
      const res = await sendFriendRequest(profile.id);
      setMsg(
        res.status === "accepted"
          ? "נוספתם כחברים"
          : res.already
            ? "בקשה כבר נשלחה"
            : "בקשת חברות נשלחה"
      );
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שליחת בקשת חברות נכשלה");
    } finally {
      setBusy(null);
    }
  }

  async function block() {
    if (!profile) return;
    if (!window.confirm(`לחסום את ${profile.full_name}?`)) return;
    setBusy("block");
    setErr(null);
    setMsg(null);
    try {
      await blockKid(profile.id);
      setMsg("המשתמש נחסם");
      setTimeout(() => navigate("/friends"), 700);
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
      <div className="mx-auto max-w-lg p-6">
        <Button asChild>
          <Link to="/profile">עבור לפרופיל שלי</Link>
        </Button>
      </div>
    );
  }

  if (loading) {
    return <p className="p-6 text-sm text-slate-500">טוען…</p>;
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {err ?? "הפרופיל לא זמין. ייתכן שהוא חסום או לא באותו מגדר."}
        </p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <header className="rounded-3xl border border-slate-200/90 bg-white/95 p-6 text-center shadow-play">
        <KidAvatar
          profile={profile}
          presets={presets}
          className="mx-auto size-28 min-h-[112px] min-w-[112px] rounded-3xl text-5xl"
        />
        <h1 className="mt-4 text-3xl font-bold text-slate-900">
          {profile.full_name}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          @{profile.username} · כיתה {profile.grade}
        </p>
      </header>

      {err ? (
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900">
          {msg}
        </p>
      ) : null}

      <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-play">
        <h2 className="text-lg font-bold text-slate-900">פעולות</h2>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
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
          <Button
            className="sm:col-span-2"
            variant="destructive"
            type="button"
            disabled={busy !== null}
            onClick={() => void block()}
          >
            {busy === "block" ? "חוסם…" : "חסום משתמש"}
          </Button>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200/90 bg-white/95 p-5 shadow-play">
        <h2 className="text-lg font-bold text-slate-900">הזמן למשחק</h2>
        {catalog.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">אין משחקים זמינים לאתגר.</p>
        ) : (
          <ul className="mt-4 space-y-2">
            {catalog.map((game) => (
              <li key={game.id}>
                <Button
                  className="w-full justify-between"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void challenge(game.id)}
                >
                  <span>{game.name_he}</span>
                  <span className="text-xs font-semibold opacity-90">
                    {busy === `challenge:${game.id}` ? "שולח…" : "אתגר"}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

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
    </div>
  );
}
