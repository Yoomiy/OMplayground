import { useGameNavigation } from "@/hooks/useGameNavigation";
import { challengeEntryDecision } from "@/lib/gameNavigation";
import {
  becameAvailable,
  challengeAvailability,
  type ChallengeAvailability,
} from "@/lib/challengeNotifications";
import { createPortal } from "react-dom";
import { useInbox } from "@/hooks/useInbox";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Swords, Gamepad2, Clock3, MessageCircle, Check, X, ArrowLeft } from "lucide-react";
import {
  challengePresentation,
  challengeCountdown,
  type Invitation,
} from "@/lib/challengePresentation";
import { useAuth } from "@/hooks/useAuth";
import { respondChallenge } from "@/lib/challengeApi";

export function ChallengeDock() {
  const { user } = useAuth();
  const { select: openMessage } = useInbox();

  const location = useLocation();
  const gameNavigation = useGameNavigation();
  const activity = useRef(gameNavigation);
  activity.current = gameNavigation;
  const [switchPrompt, setSwitchPrompt] = useState<Invitation | null>(null);
  const switchDialog = useRef<HTMLDialogElement>(null);
  const prompted = useRef(new Set<string>());
  const entryFailed = useRef(new Set<string>());
  const entering = useRef(false);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const [toast, setToast] = useState<
    { kind: "sent"; recipientName?: string } | { kind: "ready"; challengeId: string } | null
  >(null);
  const previousAvailability = useRef(new Map<string, ChallengeAvailability>());
  const currentSession = location.pathname.startsWith("/play/")
    ? location.pathname.split("/")[2]
    : location.pathname.startsWith("/solo/")
      ? "__solo__"
      : undefined;
  const [rows, setRows] = useState<Invitation[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
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
  const [now, setNow] = useState(Date.now());
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const seen = useRef(new Set<string>());
  const generation = useRef(0);
  const mutationVersion = useRef(0);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const enter = useCallback(async (row: Invitation, confirmed = false, automatic = false) => {
    if (entering.current) return;
    entering.current = true;
    const entryEpoch = generation.current;
    let unavailable = false;
    try {
      const previousId = activity.current.sessionId;
      const phase = await activity.current.inspect();
      if (entryEpoch !== generation.current || activity.current.sessionId !== previousId) return;
      const decision = challengeEntryDecision(
        phase,
        previousId,
        row.session_id,
        row.session_status,
      );
      if (decision === "already-here") return;
      if (decision === "unavailable") {
        unavailable = true;
        throw new Error("המשחק הזה כבר הסתיים. ההזמנה נשארת ברשימה לעיון");
      }
      if (decision === "defer") {
        if (confirmed) {
          setSwitchPrompt(null);
          setErrors((previous) => ({
            ...previous,
            [row.id]: "המשחק הנוכחי התחיל בינתיים. ההזמנה מחכה לכם כאן",
          }));
          setOpen(true);
        } else setToast({ kind: "ready", challengeId: row.id });
        return;
      }
      if (decision === "confirm" && !confirmed) {
        const key = `${previousId}:${row.id}`;
        if (automatic && prompted.current.has(key)) return;
        prompted.current.add(key);
        setOpen(false);
        setSwitchPrompt(row);
        return;
      }
      const { data, error } = await supabase.rpc("prepare_challenge_entry", {
        p_id: row.id,
        p_leave_session: previousId ?? null,
      });
      if (error) {
        unavailable = error.message.includes("SESSION_UNAVAILABLE");
        throw new Error(
          error.message.includes("CURRENT_GAME_STARTED")
            ? "המשחק הנוכחי התחיל בינתיים. ההזמנה מחכה לכם ברשימה"
            : "לא ניתן להיכנס כרגע. ההזמנה נשארה ברשימה ואפשר לנסות שוב",
        );
      }
      if (entryEpoch !== generation.current || activity.current.sessionId !== previousId) return;
      entryFailed.current.delete(row.id);
      setOpen(false);
      setSwitchPrompt(null);
      setToast(null);
      for (const invitation of rowsRef.current.filter(
        (invitation) => invitation.status === "accepted",
      ))
        prompted.current.add(`${row.session_id}:${invitation.id}`);
      navigateRef.current(`/play/${data as string}?mode=player`);
    } catch (error) {
      if (entryEpoch !== generation.current) return;
      entryFailed.current.add(row.id);
      setFilter(unavailable ? "history" : "all");
      if (unavailable)
        setRows((previous) =>
          previous.map((invitation) =>
            invitation.id === row.id ? { ...invitation, session_status: "completed" } : invitation,
          ),
        );
      setErrors((previous) => ({ ...previous, [row.id]: (error as Error).message }));
      setOpen(true);
      setSwitchPrompt(null);
      window.dispatchEvent(new Event("challenges-changed"));
    } finally {
      entering.current = false;
    }
  }, []);
  useEffect(() => {
    const node = switchDialog.current;
    if (switchPrompt && node && !node.open) node.showModal();
    else if (!switchPrompt && node?.open) node.close();
  }, [switchPrompt]);
  useEffect(() => {
    if (!user || switchPrompt || !["waiting", "paused", "completed"].includes(gameNavigation.phase))
      return;
    const next = rows.find(
      (row) =>
        row.status === "accepted" &&
        row.session_id !== gameNavigation.sessionId &&
        row.session_status !== "completed" &&
        !entryFailed.current.has(row.id) &&
        (gameNavigation.phase !== "waiting" ||
          !prompted.current.has(`${gameNavigation.sessionId}:${row.id}`)),
    );
    if (next) void enter(next, false, true);
  }, [rows, gameNavigation.phase, gameNavigation.sessionId, user?.id, switchPrompt, enter]);
  useEffect(() => {
    const epoch = ++generation.current;
    setRows([]);
    setErrors({});
    setBusy({});
    seen.current.clear();
    previousAvailability.current.clear();
    prompted.current.clear();
    entryFailed.current.clear();
    setToast(null);
    if (!user) return;
    let fetching = false;
    const refresh = async () => {
      if (fetching || document.hidden) return;
      fetching = true;
      const version = mutationVersion.current;
      try {
        const { data, error } = await supabase.rpc("list_game_challenges");
        if (generation.current !== epoch || mutationVersion.current !== version) return;
        if (error) {
          setErrors((previous) => ({ ...previous, refresh: "לא ניתן לרענן הזמנות" }));
          return;
        }
        const next = data as Invitation[];
        const first = seen.current.has("__loaded");
        let automaticEntry: Invitation | undefined;
        for (const row of [...next].sort(
          (a, b) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id),
        )) {
          if (
            first &&
            row.status === "accepted" &&
            row.session_status !== "completed" &&
            row.from_kid_id === user.id &&
            !row.self_busy &&
            !seen.current.has(row.id + ":accepted")
          )
            automaticEntry ??= row;
          seen.current.add(row.id + ":" + row.status);
        }
        seen.current.add("__loaded");
        if (automaticEntry) void enter(automaticEntry, false, true);
        setRows(next);
        setErrors((previous) => {
          const { refresh: _, ...rest } = previous;
          return rest;
        });
      } finally {
        fetching = false;
        if (generation.current === epoch && mutationVersion.current !== version) void refresh();
      }
    };
    void refresh();
    const channel = supabase
      .channel(`invitations:${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_challenges" },
        () => void refresh(),
      )
      .subscribe();
    const timer = window.setInterval(() => void refresh(), 5000);
    const onRefresh = () => void refresh();
    window.addEventListener("challenges-changed", onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("online", onRefresh);
    return () => {
      ++generation.current;
      clearInterval(timer);
      window.removeEventListener("challenges-changed", onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("online", onRefresh);
      void supabase.removeChannel(channel);
    };
  }, [user?.id, enter]);
  async function act(row: Invitation, action: "accept" | "decline" | "cancel") {
    const epoch = generation.current;
    setBusy((previous) => ({ ...previous, [row.id]: true }));
    try {
      await respondChallenge(row.id, action);
      if (epoch !== generation.current) return;
      ++mutationVersion.current;
      setRows((previous) =>
        action === "accept"
          ? previous.map((invitation) =>
              invitation.id === row.id ? { ...invitation, status: "accepted" } : invitation,
            )
          : previous.filter((invitation) => invitation.id !== row.id),
      );
      setErrors((previous) => ({ ...previous, [row.id]: "" }));
      window.dispatchEvent(new Event("challenges-changed"));
      if (action === "accept") void enter({ ...row, status: "accepted" });
    } catch (error) {
      if (epoch === generation.current)
        setErrors((previous) => ({
          ...previous,
          [row.id]: error instanceof Error ? error.message : "הפעולה נכשלה",
        }));
    } finally {
      if (epoch === generation.current) setBusy((previous) => ({ ...previous, [row.id]: false }));
    }
  }
  useEffect(() => {
    if (!user) return;
    const next = new Map<string, ChallengeAvailability>();
    let ready: Invitation | undefined;
    for (const row of rows) {
      if (becameAvailable(row, previousAvailability.current.get(row.id), user.id, currentSession))
        ready ??= row;
      next.set(row.id, challengeAvailability(row, currentSession));
    }
    previousAvailability.current = next;
    if (ready && !open) setToast({ kind: "ready", challengeId: ready.id });
  }, [rows, user?.id, currentSession, open]);
  useEffect(() => {
    if (!user) return;
    const sent = (event: Event) => {
      const detail = (event as CustomEvent<{ recipientName?: string }>).detail;
      setOpen(false);
      dialog.current?.close();
      setToast({ kind: "sent", recipientName: detail?.recipientName });
    };
    window.addEventListener("challenge-sent", sent);
    return () => window.removeEventListener("challenge-sent", sent);
  }, [user?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), toast.kind === "ready" ? 15_000 : 6000);
    return () => window.clearTimeout(timer);
  }, [toast]);
  const invitations = rows.filter(
    (row) => row.status === "accepted" || Date.parse(row.expires_at) > now,
  );
  useEffect(() => {
    const node = dialog.current;
    if (!invitations.length) {
      setOpen(false);
      return;
    }
    if (open && node && !node.open) node.showModal();
    else if (!open && node?.open) node.close();
  }, [open, invitations.length]);
  if (!user || (!invitations.length && !errors.refresh && !toast && !switchPrompt)) return null;
  const visible = invitations.filter((row) =>
    filter === "history"
      ? row.session_status === "completed"
      : row.session_status !== "completed" &&
        (filter === "all" ||
          (filter === "incoming" ? row.to_kid_id === user.id : row.from_kid_id === user.id)),
  );
  const liveCount = invitations.filter((row) => row.session_status !== "completed").length;
  const incoming = invitations.filter(
    (row) => row.status === "pending" && row.to_kid_id === user.id,
  ).length;
  return (
    <>
      {invitations.length > 0 &&
        createPortal(
          <button
            ref={trigger}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="challenge-list"
            aria-label={`הזמנות למשחק, ${liveCount || "היסטוריה"}`}
            className="fixed bottom-4 left-20 z-40 inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white/95 px-4 font-bold text-violet-700 shadow-lg backdrop-blur-xl transition hover:bg-violet-50 dark:border-violet-400/25 dark:bg-slate-900/95 dark:text-violet-300 dark:hover:bg-slate-800"
          >
            <Swords size={19} />
            <span className="hidden sm:inline text-sm">הזמנות</span>
            {liveCount > 0 && (
              <span className="absolute -left-1.5 -top-1.5 flex min-w-5 items-center justify-center rounded-full border-2 border-white bg-violet-600 px-1.5 py-0.5 text-[10px] font-black text-white dark:border-slate-900">
                {liveCount > 99 ? "99+" : liveCount}
              </span>
            )}
          </button>,
          fullscreenHost ?? document.body,
        )}
      {toast &&
        (toast.kind === "sent" ||
          invitations.some(
            (row) =>
              row.id === toast.challengeId &&
              row.session_id !== currentSession &&
              !challengeAvailability(row, currentSession).busy &&
              !row.self_in_session,
          )) &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 left-4 z-50 w-[calc(100vw-32px)] max-w-sm rounded-2xl border border-violet-200 bg-white p-4 text-slate-900 shadow-xl dark:border-violet-400/25 dark:bg-slate-900 dark:text-white"
            dir="rtl"
          >
            <div className="flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300">
                <Check size={18} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black">
                  {toast.kind === "sent"
                    ? toast.recipientName
                      ? `ההזמנה ל${toast.recipientName} נשלחה`
                      : "ההזמנה נשלחה"
                    : "התפניתם? ההזמנה עדיין מחכה לכם"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
                  {toast.kind === "sent"
                    ? "אפשר להמשיך באפליקציה. נעדכן כשנקבל תשובה."
                    : (() => {
                        const row = rows.find((row) => row.id === toast.challengeId);
                        return row
                          ? `${row.partner_name} ${row.partner_in_session ? "בחדר ומחכה לכם" : "אישר את ההזמנה"} · ${row.game_name}`
                          : "";
                      })()}
                </p>
              </div>
              <button
                onClick={() => setToast(null)}
                aria-label="סגירת הודעת הזמנה"
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
            {toast.kind === "ready" && (
              <button
                className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500"
                onClick={() => {
                  const row = rows.find((row) => row.id === toast.challengeId);
                  if (row) void enter(row);
                }}
              >
                כניסה לחדר
                <ArrowLeft size={14} />
              </button>
            )}
          </div>,
          fullscreenHost ?? document.body,
        )}
      <dialog
        ref={switchDialog}
        onCancel={() => setSwitchPrompt(null)}
        onClose={() => setSwitchPrompt(null)}
        aria-label="מעבר להזמנה מאושרת"
        className="m-auto w-[calc(100vw-32px)] max-w-md rounded-3xl border border-violet-200 bg-white p-6 text-slate-900 shadow-2xl backdrop:bg-slate-950/40 dark:border-white/15 dark:bg-slate-900 dark:text-white"
        dir="rtl"
      >
        <h2 className="text-lg font-black">לעבור לחדר של {switchPrompt?.partner_name}?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
          המשחק בחדר הנוכחי עדיין לא התחיל. ההזמנה הקודמת תישאר זמינה ותוכלו לחזור אליה.
        </p>
        <div className="mt-5 flex gap-3">
          <button
            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white"
            onClick={() => {
              if (switchPrompt) void enter(switchPrompt, true);
            }}
          >
            כן, לעבור לחדר
          </button>
          <button
            className="rounded-xl border px-4 py-3 text-sm font-bold"
            onClick={() => setSwitchPrompt(null)}
          >
            להישאר כאן
          </button>
        </div>
      </dialog>
      <dialog
        ref={dialog}
        onCancel={() => setOpen(false)}
        onClose={() => {
          setOpen(false);
          trigger.current?.focus();
        }}
        onClick={(event) => {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            setOpen(false);
        }}
        id="challenge-list"
        aria-label="הזמנות למשחק"
        className="fixed inset-auto bottom-20 left-4 m-0 h-[min(560px,calc(100dvh-112px))] w-[calc(100vw-32px)] max-w-xl overflow-hidden rounded-3xl border border-violet-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/20 dark:border-violet-400/20 dark:bg-slate-950 dark:text-white"
        dir="rtl"
      >
        <div className="flex h-full min-h-0 flex-col">
          <header className="flex shrink-0 items-center gap-3 px-4 py-4 sm:px-5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white">
              <Swords size={20} />
            </span>
            <div className="flex-1">
              <h2 className="text-sm font-black">מי משחק איתכם?</h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {incoming ? `${incoming} הזמנות חדשות מחכות לתשובה` : "ההזמנות שלכם, במקום אחד"}
              </p>
            </div>
          </header>
          {errors.refresh && (
            <p role="alert" className="px-5 pb-3 text-sm text-amber-700 dark:text-amber-300">
              {errors.refresh}
            </p>
          )}
          <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100 dark:border-white/10">
            <div className="flex shrink-0 gap-2 px-4 py-3" aria-label="סינון הזמנות">
              {[
                ["all", "הכל"],
                ["incoming", "אליי"],
                ["sent", "שלחתי"],
                ["history", "הסתיימו"],
              ].map(([value, label]) => (
                <button
                  key={value}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                  className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${filter === value ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-violet-50 dark:bg-white/5 dark:text-slate-300"}`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="grid min-h-0 flex-1 content-start gap-3 overflow-y-auto px-4 pb-4 sm:grid-cols-2">
              {visible.map((row) => {
                const state = challengePresentation(row, user.id, currentSession);
                const button =
                  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-colors disabled:cursor-wait disabled:opacity-50";
                const showCountdown = row.status === "pending";
                return (
                  <article
                    key={row.id}
                    className="flex flex-col rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 dark:border-white/10 dark:from-white/5 dark:to-transparent"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Gamepad2 size={17} className="text-violet-500" />
                      <span className="min-w-0 flex-1 truncate text-xs font-bold text-slate-500 dark:text-slate-400">
                        {row.game_name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-bold ${state.selfBusy ? "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300"}`}
                      >
                        {state.badge}
                      </span>
                    </div>
                    <h3 className="text-sm font-black text-slate-900 dark:text-white">
                      {state.title}
                    </h3>
                    <p className="mt-1 flex-1 text-xs leading-6 text-slate-600 dark:text-slate-300">
                      {state.detail}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {row.status === "pending" && row.to_kid_id === user.id && (
                        <>
                          <button
                            className={`${button} bg-violet-600 text-white hover:bg-violet-500`}
                            disabled={busy[row.id]}
                            onClick={() => void act(row, "accept")}
                          >
                            <Check size={14} />
                            {state.selfBusy ? "קבלת ההזמנה להמשך" : "קבלה וכניסה"}
                          </button>
                          <button
                            className={`${button} bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/10 dark:text-slate-300`}
                            disabled={busy[row.id]}
                            onClick={() => void act(row, "decline")}
                          >
                            <X size={14} />
                            לא הפעם
                          </button>
                        </>
                      )}
                      {row.status === "accepted" &&
                        row.session_status !== "completed" &&
                        row.session_id !== currentSession && (
                          <button
                            className={`${button} bg-violet-600 text-white hover:bg-violet-500`}
                            disabled={
                              gameNavigation.phase === "playing" ||
                              gameNavigation.phase === "unknown"
                            }
                            title={
                              gameNavigation.phase === "playing"
                                ? "ההזמנה מחכה לסיום המשחק הנוכחי"
                                : gameNavigation.phase === "unknown"
                                  ? "בודקים את מצב החדר הנוכחי"
                                  : undefined
                            }
                            onClick={() => void enter(row)}
                          >
                            כניסה לחדר
                            <ArrowLeft size={14} />
                          </button>
                        )}
                      {row.from_kid_id === user.id && row.can_cancel && (
                        <button
                          className={`${button} text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10`}
                          disabled={busy[row.id]}
                          onClick={() => void act(row, "cancel")}
                        >
                          ביטול הזמנה
                        </button>
                      )}
                      <button
                        className={`${button} mr-auto text-violet-600 hover:bg-violet-50 dark:text-violet-300 dark:hover:bg-violet-400/10`}
                        onClick={() => {
                          setOpen(false);
                          openMessage(
                            row.from_kid_id === user.id ? row.to_kid_id : row.from_kid_id,
                          );
                        }}
                        aria-label={`הודעה ל${row.partner_name}`}
                      >
                        <MessageCircle size={16} />
                      </button>
                    </div>
                    {showCountdown && (
                      <p className="mt-3 flex items-center gap-1.5 border-t border-slate-100 pt-2 text-[11px] text-slate-400 dark:border-white/5">
                        <Clock3 size={12} />
                        <span>ההזמנה זמינה לעוד</span>
                        <time className="font-mono tabular-nums" dateTime={row.expires_at}>
                          {challengeCountdown(row.expires_at, now)}
                        </time>
                      </p>
                    )}
                    {errors[row.id] && (
                      <p role="alert" className="mt-2 text-xs text-rose-600 dark:text-rose-300">
                        {errors[row.id]}
                      </p>
                    )}
                  </article>
                );
              })}
              {!visible.length && (
                <p className="col-span-full py-6 text-center text-sm text-slate-500">
                  אין הזמנות בקטגוריה הזאת כרגע
                </p>
              )}
            </div>
          </div>
        </div>
      </dialog>
    </>
  );
}
