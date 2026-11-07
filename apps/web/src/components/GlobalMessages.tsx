import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, Expand, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useInbox } from "@/hooks/useInbox";
import { InboxPanel } from "./InboxPanel";
import { claimMessageAlert, clearMessageAlerts } from "@/lib/messageNotifications";
import { roleLabel, type Message } from "@/lib/directMessages";

// Cross-tab notification coordination is optional and may outlive a widget cleanup.
function publish(channel: BroadcastChannel | null, message: unknown) {
  try {
    channel?.postMessage(message);
  } catch {
    /* Closed/unavailable channels cannot disable messages. */
  }
}

export function GlobalMessages() {
  const { user } = useAuth(),
    inbox = useInbox(),
    location = useLocation();
  const navigate = useNavigate();
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
    let channel: BroadcastChannel | null = null;
    try {
      if (typeof BroadcastChannel !== "undefined")
        channel = new BroadcastChannel(`dm-presence:${user.id}`);
    } catch {
      /* Messaging still works when the browser blocks cross-tab coordination. */
    }
    let disposed = false;
    channelRef.current = channel;
    const announce = () => {
      if (disposed) return;
      publish(channel, {
        id: tab.current,
        visible: !document.hidden,
        active:
          current.current.open || current.current.path === "/inbox" ? current.current.active : null,
      });
    };
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
      disposed = true;
      if (channelRef.current === channel) channelRef.current = null;
      notifications.current.forEach((n) => n.close());
      clearInterval(timer);
      document.removeEventListener("visibilitychange", announce);
      window.removeEventListener("focus", refreshPermission);
      publish(channel, { id: tab.current, visible: false, active: null });
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
    publish(channelRef.current, { type: "probe" });
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
            aria-haspopup="dialog"
            aria-expanded={inbox.open}
            title="הודעות"
            aria-label={`הודעות${inbox.unreadTotal ? `, ${inbox.unreadTotal} לא נקראו` : ""}`}
            className="fixed bottom-4 left-4 z-40 flex size-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700 shadow-lg shadow-slate-900/10 transition hover:-translate-y-0.5 hover:border-violet-300 hover:text-violet-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-violet-500 dark:border-white/15 dark:bg-slate-900 dark:text-slate-200"
          >
            <MessageSquare size={23} strokeWidth={1.8} aria-hidden="true" />
            {inbox.unreadTotal > 0 && (
              <span className="absolute -left-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full border-2 border-white bg-violet-600 px-1.5 py-0.5 text-[10px] font-black text-white dark:border-slate-900">
                {inbox.unreadTotal > 99 ? "99+" : inbox.unreadTotal}
              </span>
            )}
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
            <h2 className="font-black">הודעות</h2>
            <button
              aria-label="פתיחת תיבת ההודעות בעמוד מלא"
              title="פתיחת תיבת ההודעות בעמוד מלא"
              className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10"
              onClick={() => {
                inbox.setOpen(false);
                navigate(
                  inbox.active ? `/inbox?kidId=${encodeURIComponent(inbox.active)}` : "/inbox",
                );
              }}
            >
              <Expand size={17} />
            </button>
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
              <X size={17} />
            </button>
          </header>
          {notice && <p role="status">{notice}</p>}
          <InboxPanel />
        </div>
      </dialog>
    </>
  );
}
