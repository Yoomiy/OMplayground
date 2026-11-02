import { useEffect, useRef, useState } from "react";
import type { VoxelApi } from "./session-api";

export function VoxelRoomControls({
  api,
  onInteract,
}: {
  api: VoxelApi;
  onInteract: () => void;
}) {
  const [settings, setSettings] = useState<{
    isOpen: boolean;
    invitationCode: string;
  } | null>(null);
  const [busy, setBusy] = useState(false),
    [notice, setNotice] = useState(""),
    [link, setLink] = useState("");
  const scope = useRef<AbortController>();
  const pending = useRef(false);
  const revision = useRef(0);
  useEffect(() => {
    const abort = new AbortController();
    scope.current = abort;
    setSettings(null);
    setNotice("");
    setLink("");
    setBusy(false);
    pending.current = false;
    let loading = false;
    const refresh = async () => {
      if (loading || pending.current) return;
      loading = true;
      const started = revision.current;
      try {
        const value = await api.roomSettings(undefined, abort.signal);
        if (!abort.signal.aborted && started === revision.current)
          setSettings(value);
      } catch {
        if (!abort.signal.aborted)
          setNotice("לא ניתן לטעון את פרטיות החדר כרגע.");
      } finally {
        loading = false;
      }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      abort.abort();
      clearInterval(timer);
    };
  }, [api]);
  const toggle = async () => {
    if (!settings || pending.current) return;
    onInteract();
    pending.current = true;
    revision.current++;
    setBusy(true);
    setNotice("");
    const abort = scope.current!;
    try {
      const value = await api.roomSettings(!settings.isOpen, abort.signal);
      if (!abort.signal.aborted) {
        setSettings(value);
        setNotice(value.isOpen ? "החדר פתוח להצטרפות" : "החדר פרטי עכשיו");
      }
    } catch {
      if (!abort.signal.aborted)
        setNotice("עדכון הפרטיות נכשל. אפשר לנסות שוב.");
    } finally {
      if (!abort.signal.aborted) {
        pending.current = false;
        setBusy(false);
      }
    }
  };
  const copy = async () => {
    if (!settings) return;
    onInteract();
    const abort = scope.current!;
    const url = `${window.location.origin}/join/${encodeURIComponent(settings.invitationCode)}`;
    try {
      await navigator.clipboard.writeText(url);
      if (!abort.signal.aborted) {
        setLink("");
        setNotice("קישור ההזמנה הועתק");
      }
    } catch {
      if (!abort.signal.aborted) {
        setLink(url);
        setNotice("אפשר להעתיק את הקישור כאן");
      }
    }
  };
  return (
    <section
      className="voxel-session__room-controls"
      aria-label="ניהול חדר"
      dir="rtl"
    >
      <p>
        {!settings ? "טוען פרטיות…" : settings.isOpen ? "חדר פתוח" : "חדר פרטי"}
      </p>
      <nav>
        <button
          type="button"
          disabled={!settings || busy}
          onClick={() => void toggle()}
        >
          {busy ? "מעדכן…" : settings?.isOpen ? "הפוך לפרטי" : "הפוך לפתוח"}
        </button>
        <button
          type="button"
          disabled={!settings?.invitationCode}
          onClick={() => void copy()}
        >
          העתק הזמנה
        </button>
      </nav>
      {notice && <p role="status">{notice}</p>}
      {link && (
        <input
          aria-label="קישור הזמנה"
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
        />
      )}
    </section>
  );
}
