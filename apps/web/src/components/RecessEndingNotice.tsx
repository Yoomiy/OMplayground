import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const WARNING_LEAD_MS = 60_000;

export function RecessEndingNotice({ expiresAt, userId }: { expiresAt: number; userId: string }) {
  const storageKey = `recess-warning-dismissed:${userId}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(storageKey) === String(expiresAt);
    } catch {
      return false;
    }
  });
  const [warningFor, setWarningFor] = useState<number | null>(null);
  const [fullscreenHost, setFullscreenHost] = useState<Element | null>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const visible = !dismissed && warningFor === expiresAt;
  const supportsPopover = typeof HTMLElement.prototype.showPopover === "function";

  useEffect(() => {
    const warnAt = expiresAt - WARNING_LEAD_MS;
    const update = () => {
      const now = Date.now();
      setWarningFor(now >= warnAt && now < expiresAt ? expiresAt : null);
    };
    update();
    const timer = window.setTimeout(update, Math.max(0, warnAt - Date.now()));
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", update);
    };
  }, [expiresAt]);

  useEffect(() => {
    const update = () => {
      const host = document.fullscreenElement;
      if (host instanceof HTMLIFrameElement) {
        // A fullscreen iframe can intercept clicks on the notice in the parent document.
        if (visible) void document.exitFullscreen().catch(() => {});
        setFullscreenHost(null);
      } else {
        setFullscreenHost(host);
      }
    };
    update();
    document.addEventListener("fullscreenchange", update);
    return () => document.removeEventListener("fullscreenchange", update);
  }, [visible]);

  useEffect(() => {
    if (!visible || !supportsPopover) return;
    const notice = noticeRef.current;
    if (!notice) return;
    notice.setAttribute("popover", "manual");
    if (!notice.matches(":popover-open")) notice.showPopover();
  }, [visible, supportsPopover, fullscreenHost]);

  if (!visible) return null;

  return createPortal(
    <div
      ref={noticeRef}
      dir="rtl"
      className="pointer-events-none fixed inset-x-4 bottom-auto top-4 z-[100] mx-auto flex w-fit max-w-[calc(100%-2rem)] items-center gap-3 rounded-2xl border border-amber-400 bg-amber-100 py-2 pe-2 ps-4 text-amber-950 shadow-lg"
    >
      <div role="alert">
        <p className="font-bold">ההפסקה כמעט נגמרה!</p>
        <p className="text-sm">נותרה עד דקה למשחק. זה הזמן להתכונן לשיעור.</p>
      </div>
      <button
        type="button"
        aria-label="סגירת התראת הפסקה"
        className="pointer-events-auto grid size-11 shrink-0 place-items-center rounded-xl hover:bg-amber-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-800"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem(storageKey, String(expiresAt));
          } catch {
            // In-memory dismissal still applies when storage is unavailable.
          }
        }}
      >
        <X size={20} aria-hidden="true" />
      </button>
    </div>,
    fullscreenHost ?? document.body,
  );
}
