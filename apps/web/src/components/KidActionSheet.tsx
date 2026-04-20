import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ComposeMessage } from "@/components/ComposeMessage";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { sendChallenge } from "@/lib/challengeApi";
import { sendFriendRequest, blockKid } from "@/lib/friendsApi";
import type { PublicKidProfile } from "@/hooks/useOnlineKids";

const TICTACTOE_GAME_ID = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

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

  if (!kid || !user || !profile) return null;

  async function challenge() {
    if (!user || !profile || !kid) return;
    setBusy("challenge");
    setErr(null);
    setInfo(null);
    try {
      const { sessionId } = await sendChallenge({
        meId: user.id,
        meDisplayName: profile.full_name,
        meGender: profile.gender,
        toId: kid.id,
        gameId: TICTACTOE_GAME_ID
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
        className="fixed inset-0 z-40 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center"
        role="dialog"
      >
        <div className="w-full max-w-sm rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
          <header className="mb-3">
            <h3 className="text-lg font-medium">{kid.full_name}</h3>
            <p className="text-xs text-slate-400">@{kid.username}</p>
          </header>
          {err ? (
            <p className="mb-2 text-xs text-amber-300" role="alert">
              {err}
            </p>
          ) : null}
          {info ? (
            <p className="mb-2 text-xs text-emerald-300">{info}</p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              disabled={busy !== null}
              onClick={() => void challenge()}
            >
              {busy === "challenge" ? "שולח אתגר…" : "אתגר למשחק"}
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
            <Button
              variant="outline"
              type="button"
              disabled={busy !== null}
              onClick={() => void block()}
            >
              {busy === "block" ? "חוסם…" : "חסום"}
            </Button>
            <Button variant="ghost" type="button" onClick={onClose}>
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
