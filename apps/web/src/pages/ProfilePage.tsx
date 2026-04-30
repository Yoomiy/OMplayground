import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import {
  AVATAR_MAX_BYTES,
  fetchAvatarPresets,
  updateMyProfile,
  uploadAvatar,
  type AvatarPreset
} from "@/lib/profileApi";
import { KidAvatar } from "@/components/KidAvatar";
import { Button } from "@/components/ui/button";
import { KidDesktopShell, desktopPanelClass } from "@/components/KidDesktopShell";
import { fieldInputClass, fieldLabelClass } from "@/lib/fieldStyles";
import { cn } from "@/lib/cn";

const COLORS = [
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#F59E0B",
  "#10B981",
  "#EF4444",
  "#06B6D4",
  "#6366F1"
];

export function ProfilePage() {
  const { user } = useAuth();
  const { profile, loading, error, refetch } = useProfile(user);
  const [presets, setPresets] = useState<AvatarPreset[]>([]);
  const [fullName, setFullName] = useState("");
  const [avatarColor, setAvatarColor] = useState(COLORS[0]);
  const [avatarPresetId, setAvatarPresetId] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const rows = await fetchAvatarPresets();
        if (!cancelled) setPresets(rows);
      } catch (e) {
        if (!cancelled) {
          setErr(e instanceof Error ? e.message : "טעינת אווטארים נכשלה");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name);
    setAvatarColor(profile.avatar_color);
    setAvatarPresetId(profile.avatar_preset_id);
    setAvatarUrl(profile.avatar_url);
  }, [profile]);

  const draftProfile = useMemo(
    () =>
      profile
        ? {
            ...profile,
            full_name: fullName || profile.full_name,
            avatar_color: avatarColor,
            avatar_preset_id: avatarPresetId,
            avatar_url: avatarUrl
          }
        : null,
    [avatarColor, avatarPresetId, avatarUrl, fullName, profile]
  );

  async function saveProfile() {
    if (!profile) return;
    setErr(null);
    setMsg(null);
    setBusy("profile");
    try {
      await updateMyProfile({
        full_name: fullName,
        avatar_color: avatarColor,
        avatar_preset_id: avatarPresetId,
        avatar_url: avatarUrl
      });
      await refetch();
      setMsg("הפרופיל נשמר");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שמירת הפרופיל נכשלה");
    } finally {
      setBusy(null);
    }
  }

  async function changePassword() {
    setErr(null);
    setMsg(null);
    if (password.length < 6) {
      setErr("הסיסמה צריכה להכיל לפחות 6 תווים");
      return;
    }
    if (password !== confirmPassword) {
      setErr("אימות הסיסמה לא תואם");
      return;
    }
    setBusy("password");
    const { error: passErr } = await supabase.auth.updateUser({ password });
    setBusy(null);
    if (passErr) {
      setErr(passErr.message);
      return;
    }
    setPassword("");
    setConfirmPassword("");
    setMsg("הסיסמה עודכנה");
  }

  async function handleFile(file: File | undefined) {
    if (!file || !user) return;
    setErr(null);
    setMsg(null);
    setBusy("avatar");
    try {
      const url = await uploadAvatar(user.id, file);
      setAvatarUrl(url);
      setAvatarPresetId(null);
      setMsg(`התמונה הועלתה ונשמרה עד ${Math.round(AVATAR_MAX_BYTES / 1024)}KB`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "העלאת התמונה נכשלה");
    } finally {
      setBusy(null);
    }
  }

  if (loading && !profile) {
    return <p className="p-6 text-sm text-slate-500">טוען…</p>;
  }

  if (!profile || !draftProfile) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <p className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
          {error ?? "לא נמצא פרופיל"}
        </p>
        <Button className="mt-4" variant="outline" asChild>
          <Link to="/home">בית</Link>
        </Button>
      </div>
    );
  }

  return (
    <KidDesktopShell
      title="הפרופיל שלי"
      subtitle={`${profile.full_name} · @${profile.username} · כיתה ${profile.grade}`}
      contentClassName="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_320px]"
    >
      <aside className={desktopPanelClass("p-5")}>
        <div className="flex flex-col items-center text-center">
          <KidAvatar
            profile={draftProfile}
            presets={presets}
            className="size-32 min-h-32 min-w-32 rounded-2xl text-5xl"
          />
          <h2 className="mt-4 text-2xl font-black text-slate-950">
            {fullName || profile.full_name}
          </h2>
          <p className="text-sm font-semibold text-slate-500">
            @{profile.username}
          </p>
          <p className="mt-1 rounded-full bg-indigo-50 px-3 py-1 text-sm font-black text-indigo-700">
            כיתה {profile.grade}
          </p>
        </div>
      </aside>

      {err ? (
        <p className="xl:col-span-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          {err}
        </p>
      ) : null}
      {msg ? (
        <p className="xl:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
          {msg}
        </p>
      ) : null}

      <section className={desktopPanelClass("p-5")}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
          <KidAvatar
            profile={draftProfile}
            presets={presets}
            className="size-24 min-h-24 min-w-24 rounded-2xl text-4xl"
          />
          <div className="min-w-0 flex-1 space-y-4">
            <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
              שם תצוגה
              <input
                className={fieldInputClass}
                value={fullName}
                maxLength={80}
                onChange={(e) => setFullName(e.target.value)}
              />
            </label>

            <div className="space-y-2">
              <p className={fieldLabelClass}>צבע רקע</p>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={cn(
                      "size-9 rounded-full border-2 shadow-sm",
                      avatarColor === color
                        ? "border-slate-900"
                        : "border-white ring-1 ring-slate-200"
                    )}
                    style={{ backgroundColor: color }}
                    aria-label={`בחר צבע ${color}`}
                    onClick={() => setAvatarColor(color)}
                  />
                ))}
              </div>
            </div>

            <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
              העלאת תמונה
              <input
                className={fieldInputClass}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                disabled={busy !== null}
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
              <span className="text-xs font-normal text-slate-500">
                התמונה תידחס אוטומטית עד 512KB
              </span>
            </label>

            {avatarUrl ? (
              <Button
                variant="outline"
                type="button"
                disabled={busy !== null}
                onClick={() => setAvatarUrl(null)}
              >
                הסר תמונה
              </Button>
            ) : null}
          </div>
        </div>

        <div className="mt-5 space-y-3 border-t border-slate-100 pt-5">
          <h2 className="text-lg font-black text-slate-900">אווטארים מוכנים</h2>
          {presets.length === 0 ? (
            <p className="text-sm text-slate-500">אין אווטארים מוגדרים כרגע.</p>
          ) : (
            <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3 lg:grid-cols-4">
              {presets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={cn(
                    "rounded-2xl border-2 bg-slate-50 px-3 py-2 text-sm font-semibold transition",
                    avatarPresetId === preset.key
                      ? "border-indigo-500 text-indigo-800"
                      : "border-slate-200 text-slate-700 hover:border-indigo-200"
                  )}
                  onClick={() => {
                    setAvatarPresetId(preset.key);
                    setAvatarUrl(null);
                  }}
                >
                  <span className="text-xl" aria-hidden>
                    {preset.emoji}
                  </span>{" "}
                  {preset.label_he}
                </button>
              ))}
            </div>
          )}
        </div>

        <Button
          className="mt-5 w-full"
          type="button"
          disabled={busy !== null || !fullName.trim()}
          onClick={() => void saveProfile()}
        >
          {busy === "profile" ? "שומר…" : busy === "avatar" ? "מעלה תמונה…" : "שמור פרופיל"}
        </Button>
      </section>

      <aside className="space-y-4">
        <section className={desktopPanelClass("p-5")}>
          <h2 className="text-lg font-black text-slate-900">קיצורים</h2>
          <Button className="mt-4 w-full" size="lg" asChild>
            <Link to="/inbox">תיבת הדואר שלי</Link>
          </Button>
        </section>

        <section className={desktopPanelClass("p-5")}>
          <h2 className="text-lg font-black text-slate-900">סטטיסטיקות</h2>
          {Object.keys(profile.best_scores).length === 0 ? (
            <p className="mt-2 text-sm font-semibold text-slate-500">
              עדיין אין שיאים שמורים.
            </p>
          ) : (
            <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1 text-sm">
              {Object.entries(profile.best_scores).map(([game, score]) => (
                <li
                  key={game}
                  className="flex justify-between rounded-xl bg-slate-50 px-4 py-2"
                >
                  <span className="font-semibold text-slate-600">{game}</span>
                  <span className="font-black text-slate-950">{score}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </aside>

      <section className={desktopPanelClass("p-5 xl:col-start-2")}>
        <h2 className="text-lg font-black text-slate-900">שינוי סיסמה</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            סיסמה חדשה
            <input
              className={fieldInputClass}
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          <label className={`flex flex-col gap-2 ${fieldLabelClass}`}>
            אימות סיסמה
            <input
              className={fieldInputClass}
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
          </label>
        </div>
        <Button
          className="mt-4"
          variant="outline"
          type="button"
          disabled={busy !== null || !password || !confirmPassword}
          onClick={() => void changePassword()}
        >
          {busy === "password" ? "מעדכן…" : "עדכן סיסמה"}
        </Button>
      </section>
    </KidDesktopShell>
  );
}
