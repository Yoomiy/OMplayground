import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useInbox } from "@/hooks/useInbox";
import { InboxPanel } from "./InboxPanel";
import { claimMessageAlert, clearMessageAlerts } from "@/lib/messageNotifications";
import { roleLabel, type Message } from "@/lib/directMessages";
export function GlobalMessages() {
  const { user } = useAuth(),
    inbox = useInbox(),
    location = useLocation();
  const [fullscreenHost, setFullscreenHost] = useState<HTMLElement | null>(null);
  useEffect(() => {
    const changed = () =>
      setFullscreenHost(
        document.fullscreenElement instanceof HTMLElement &&
          document.fullscreenElement.tagName !== "IFRAME"
          ? document.fullscreenElement
          : null,
      );
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const dialog = useRef<HTMLDialogElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [alerts, setAlerts] = useState<Message[]>([]),
    [permission, setPermission] = useState(
      typeof Notification === "undefined" ? "unsupported" : Notification.permission,
    );
  const [enabled, setEnabled] = useState(() => {
    try {
      return localStorage.getItem(`dm-alerts:${user?.id}`) === "on";
    } catch {
      return false;
    }
  });
  const [notice, setNotice] = useState("");
  const processed = useRef(new Set<string>()),
    tab = useRef(crypto.randomUUID());
  const mounted = useRef(true);
  const notifications = useRef<Notification[]>([]);
  const channelRef = useRef<BroadcastChannel | null>(null);
  const peers = useRef(new Map<string, { visible: boolean; active: string | null; at: number }>());
  const current = useRef({ active: inbox.active, open: inbox.open, path: location.pathname });
  current.current = { active: inbox.active, open: inbox.open, path: location.pathname };
  useEffect(() => {
    if (!user) return;
    mounted.current = true;
    const channel =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(`dm-presence:${user.id}`);
    channelRef.current = channel;
    const announce = () =>
      channel?.postMessage({
        id: tab.current,
        visible: !document.hidden,
        active:
          current.current.open || current.current.path === "/inbox" ? current.current.active : null,
      });
    if (channel)
      channel.onmessage = (e) => {
        if (e.data?.type === "probe") {
          announce();
          return;
        }
        if (e.data?.id && e.data.id !== tab.current)
          peers.current.set(e.data.id, {
            visible: !!e.data.visible,
            active: e.data.active,
            at: Date.now(),
          });
      };
    announce();
    const timer = setInterval(announce, 1000);
    document.addEventListener("visibilitychange", announce);
    const refreshPermission = () => {
      if (typeof Notification !== "undefined") setPermission(Notification.permission);
    };
    window.addEventListener("focus", refreshPermission);
    return () => {
      mounted.current = false;
      notifications.current.forEach((n) => n.close());
      clearInterval(timer);
      document.removeEventListener("visibilitychange", announce);
      window.removeEventListener("focus", refreshPermission);
      channel?.postMessage({ id: tab.current, visible: false, active: null });
      channel?.close();
      void clearMessageAlerts(user.id);
    };
  }, [user?.id]);
  useEffect(() => {
    const node = dialog.current;
    if (!node) return;
    if (inbox.open) {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      if (document.pointerLockElement) document.exitPointerLock();
      window.dispatchEvent(new Event("blur"));
      if (!node.open) node.showModal();
    } else if (node.open) node.close();
  }, [inbox.open, location.pathname]);
  useEffect(() => {
    if (!user) return;
    channelRef.current?.postMessage({ type: "probe" });
    for (const message of inbox.arrivals) {
      if (processed.current.has(message.id)) continue;
      processed.current.add(message.id);
      void (async () => {
        await new Promise((resolve) => setTimeout(resolve, 150));
        if (!mounted.current) return;
        const partner = message.from_kid_id ?? "__admin__";
        const visiblePeers = [...peers.current.values()].filter(
          (p) => p.visible && Date.now() - p.at < 3000,
        );
        if (
          (!document.hidden &&
            (current.current.open || current.current.path === "/inbox") &&
            current.current.active === partner) ||
          visiblePeers.some((p) => p.active === partner)
        )
          return;
        if (document.hidden && visiblePeers.length) return;
        if (
          document.hidden &&
          (!enabled || typeof Notification === "undefined" || Notification.permission !== "granted")
        )
          return;
        if (!(await claimMessageAlert(user.id, message.id)) || !mounted.current) return;
        if (!document.hidden)
          setAlerts((previous) =>
            [message, ...previous.filter((m) => m.from_kid_id !== message.from_kid_id)].slice(0, 3),
          );
        else {
          try {
            const notification = new Notification(
              `${message.from_display_name} ${roleLabel(message.sender_role)}`,
              {
                body: message.content.slice(0, 100),
                tag: `dm:${user.id}:${partner}`,
                silent: true,
              },
            );
            notifications.current.push(notification);
            if (notifications.current.length > 100) notifications.current.shift()?.close();
            notification.onclick = () => {
              window.focus();
              inbox.select(partner);
              notification.close();
            };
          } catch {
            /* Unsupported browser notifications must not affect messaging. */
          }
        }
      })();
    }
  }, [inbox.arrivals, user?.id, enabled]);
  useEffect(() => {
    if (!alerts.length) return;
    const timer = setTimeout(() => setAlerts([]), 8000);
    return () => clearTimeout(timer);
  }, [alerts]);
  async function toggleNotifications() {
    if (typeof Notification === "undefined") return;
    try {
      const granted = await Notification.requestPermission();
      setPermission(granted);
      const next = !enabled && granted === "granted";
      setEnabled(next);
      localStorage.setItem(`dm-alerts:${user?.id}`, next ? "on" : "off");
      setNotice(granted === "denied" ? "אפשר לשנות את ההרשאה בהגדרות הדפדפן" : "");
    } catch {
      setNotice("התראות דפדפן אינן זמינות כאן");
    }
  }
  if (!user) return null;
  return (
    <>
      {createPortal(
        <>
          <button
            ref={trigger}
            onClick={() => {
              inbox.setOpen(true);
            }}
            aria-label={`הודעות${inbox.unreadTotal ? `, ${inbox.unreadTotal} לא נקראו` : ""}`}
            className="fixed bottom-4 left-4 z-40 rounded-full bg-violet-700 px-4 py-3 font-bold text-white shadow-lg"
          >
            💬 הודעות {inbox.unreadTotal > 0 && <span>({inbox.unreadTotal})</span>}
          </button>
          <div className="fixed left-4 top-4 z-50 flex max-w-xs flex-col gap-2" aria-live="polite">
            {alerts.map((message) => (
              <div
                key={message.id}
                className="rounded-xl border bg-white p-3 text-slate-900 shadow-xl"
              >
                <button
                  onClick={() => {
                    inbox.select(message.from_kid_id ?? "__admin__");
                    setAlerts([]);
                  }}
                >
                  <b>
                    {message.from_display_name} {roleLabel(message.sender_role)}
                  </b>
                  <p className="truncate">{message.content.slice(0, 100)}</p>
                </button>
                <button
                  aria-label="סגירת התראה"
                  className="mr-3"
                  onClick={() => setAlerts((p) => p.filter((m) => m.id !== message.id))}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </>,
        fullscreenHost ?? document.body,
      )}
      <dialog
        ref={dialog}
        onCancel={() => inbox.setOpen(false)}
        onClose={() => {
          inbox.setOpen(false);
          trigger.current?.focus();
        }}
        onKeyDown={(event) => event.stopPropagation()}
        className="fixed inset-0 m-0 h-dvh max-h-dvh w-screen max-w-none bg-white p-0 text-slate-900 backdrop:bg-black/40 dark:bg-slate-950 dark:text-white sm:inset-auto sm:left-4 sm:top-4 sm:h-[85dvh] sm:max-h-[85dvh] sm:w-[720px] sm:max-w-[95vw] sm:rounded-2xl"
        dir="rtl"
        aria-label="הודעות פרטיות"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b p-3">
            <h2>הודעות</h2>
            <button
              disabled={permission === "unsupported" || permission === "denied"}
              onClick={() => void toggleNotifications()}
            >
              {permission === "unsupported"
                ? "התראות אינן נתמכות"
                : permission === "denied"
                  ? "התראות חסומות בדפדפן"
                  : enabled
                    ? "כיבוי התראות דפדפן"
                    : "הפעלת התראות דפדפן"}
            </button>
            <button aria-label="סגירת הודעות" onClick={() => inbox.setOpen(false)}>
              ✕
            </button>
          </header>
          {notice && <p role="status">{notice}</p>}
          <InboxPanel />
        </div>
      </dialog>
    </>
  );
}
