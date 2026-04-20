import { useState } from "react";
import { Button } from "@/components/ui/button";
import { sendMessage } from "@/lib/messagesApi";

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
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-4 sm:items-center"
      role="dialog"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-4 shadow-xl">
        <h3 className="mb-2 text-lg font-medium">
          הודעה אל {props.toDisplayName}
        </h3>
        <textarea
          className="h-28 w-full resize-none rounded border border-slate-600 bg-slate-950 px-2 py-1 text-sm"
          maxLength={300}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="כתוב הודעה…"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              if (!busy && text.trim()) void send();
            }
          }}
        />
        <p className="mt-1 text-xs text-slate-500">{text.length}/300</p>
        {err ? (
          <p className="mt-2 text-xs text-amber-300" role="alert">
            {err}
          </p>
        ) : null}
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="outline" type="button" onClick={props.onClose}>
            סגור
          </Button>
          <Button
            type="button"
            disabled={busy || !text.trim()}
            onClick={() => void send()}
          >
            {busy ? "שולח…" : "שלח"}
          </Button>
        </div>
      </div>
    </div>
  );
}
