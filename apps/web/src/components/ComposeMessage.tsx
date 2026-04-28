import { useState } from "react";
import { Button } from "@/components/ui/button";
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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-4 backdrop-blur-[2px] sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="compose-msg-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 bg-gradient-to-l from-violet-50 to-white px-5 py-4">
          <h3
            id="compose-msg-title"
            className="text-lg font-bold text-slate-900"
          >
            הודעה ל־{props.toDisplayName}
          </h3>
          <p className="mt-1 text-sm text-slate-600">עד 300 תווים</p>
        </div>
        <div className="p-5">
          <textarea
            className={cn(
              "min-h-[7.5rem] w-full resize-none rounded-2xl border-2 border-slate-200 bg-slate-50/80 px-4 py-3 text-base text-slate-900",
              "placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-200"
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
          <div className="mt-2 flex items-center justify-between text-xs font-medium text-slate-500">
            <span>{text.length} / 300</span>
            <span>Enter לשליחה</span>
          </div>
          {err ? (
            <p
              className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"
              role="alert"
            >
              {err}
            </p>
          ) : null}
          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" type="button" onClick={props.onClose}>
              ביטול
            </Button>
            <Button
              type="button"
              size="lg"
              disabled={busy || !text.trim()}
              onClick={() => void send()}
            >
              {busy ? "שולח…" : "שלח הודעה"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
