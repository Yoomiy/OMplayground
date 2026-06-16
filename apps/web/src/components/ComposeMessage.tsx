import { useState } from "react";
import { sendMessage } from "@/lib/messagesApi";
import { cn } from "@/lib/cn";

export interface ComposeMessageProps {
  open: boolean;
  onClose: () => void;
  fromId: string;
  fromDisplayName: string;
  senderGender: "boy" | "girl";
  toId: string;
  toDisplayName: string;
}

export function ComposeMessage(props: ComposeMessageProps) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!props.open) return null;

  async function send() {
    if (!text.trim()) return;
    setErr(null);
    setBusy(true);
    try {
      await sendMessage({
        fromId: props.fromId,
        fromDisplayName: props.fromDisplayName,
        senderGender: props.senderGender,
        toId: props.toId,
        toDisplayName: props.toDisplayName,
        content: text
      });
      setText("");
      props.onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "שליחה נכשלה");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-4 backdrop-blur-md sm:items-center animate-slide-up"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-msg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#150d32]/95 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-white/10 bg-white/5 px-5 py-4">
          <h3
            id="compose-msg-title"
            className="text-lg font-black text-white"
          >
            הודעה ל־{props.toDisplayName}
          </h3>
          <p className="mt-1 text-xs font-bold text-white/50">עד 300 תווים</p>
        </div>
        <div className="p-5">
          <textarea
            className={cn(
              "min-h-[7.5rem] w-full resize-none rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-base font-bold text-white outline-none transition placeholder:text-white/40",
              "focus:border-violet-400 focus:ring-4 focus:ring-violet-500/20"
            )}
            maxLength={300}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="כתוב משהו נחמד…"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!busy && text.trim()) void send();
              }
            }}
          />
          <div className="mt-2 flex items-center justify-between text-xs font-bold text-white/40">
            <span>{text.length} / 300</span>
            <span>Enter לשליחה</span>
          </div>
          {err ? (
            <p
              className="mt-3 rounded-2xl border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-sm font-bold text-amber-300"
              role="alert"
            >
              ⚠️ {err}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-black text-white/70 hover:bg-white/10 hover:text-white transition duration-200"
              type="button"
              onClick={props.onClose}
            >
              ביטול
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-500 to-indigo-500 border border-violet-400/50 px-5 py-2.5 text-sm font-black text-white shadow-[0_4px_12px_rgba(139,92,246,0.3)] hover:shadow-[0_4px_16px_rgba(139,92,246,0.5)] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-200 disabled:opacity-50"
              disabled={busy || !text.trim()}
              onClick={() => void send()}
            >
              {busy ? "שולח…" : "שלח הודעה"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
