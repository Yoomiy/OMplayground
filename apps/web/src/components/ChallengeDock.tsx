import { useGameNavigation } from "@/hooks/useGameNavigation";
import { challengeEntryDecision } from "@/lib/gameNavigation";
import {
  becameAvailable,
  challengeUpdateMessage,
  challengeAvailability,
  type ChallengeAvailability,
} from "@/lib/challengeNotifications";
import { createPortal } from "react-dom";
import { useInbox } from "@/hooks/useInbox";
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { Swords, Gamepad2, Clock3, MessageCircle, Check, X, ArrowLeft, Trash2 } from "lucide-react";
import {
  challengePresentation,
  challengeCountdown,
  type Invitation,
} from "@/lib/challengePresentation";
import { useAuth } from "@/hooks/useAuth";
import { respondChallenge, resolveChallenges } from "@/lib/challengeApi";
import { parseInvitations } from "@/lib/challengePayload";
import { backendUnavailable, FeatureRequestError, FeatureRetryGate } from "@/lib/featureRecovery";
import { reportCaughtError } from "@/utils/telemetry";

export function ChallengeDock() {
  const { user } = useAuth();
  const { select: openMessage } = useInbox();

  const location = useLocation();
  const gameNavigation = useGameNavigation();
  const activity = useRef(gameNavigation);
  activity.current = gameNavigation;
  const [switchPrompt, setSwitchPrompt] = useState<Invitation | null>(null);
  const switchFrom = useRef<string | null>(null);
  const switchDialog = useRef<HTMLDialogElement>(null);
  const prompted = useRef(new Set<string>());
  const entryFailed = useRef(new Set<string>());
  const entering = useRef(false);
  const entryAbort = useRef<AbortController | null>(null);
  const entryBlocked = useRef(new Set<string>());
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  type Toast =
    | { kind: "sent"; recipientName?: string }
    | { kind: "ready"; challengeId: string }
    | { kind: "update"; message: string; challengeId?: string };
  const [toast, setToast] = useState<Toast | null>(null);
  const currentToast = useRef<Toast | null>(null);
  const toastQueue = useRef<Toast[]>([]);
  const updateSeen = useRef(new Set<string>());
  const showToast = useCallback((next: Toast) => {
    if (currentToast.current) toastQueue.current = [...toastQueue.current, next].slice(-5);
    else {
      currentToast.current = next;
      setToast(next);
    }
  }, []);
  const dismissToast = useCallback(() => {
    const next = toastQueue.current.shift() ?? null;
    currentToast.current = next;
    setToast(next);
  }, []);
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
  const [clearing, setClearing] = useState(false);
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
    if (entering.current || entryBlocked.current.has(row.id)) return;
    if (confirmed && switchFrom.current !== activity.current.key) {
      setSwitchPrompt(null);
      return;
    }
    entering.current = true;
    const controller = new AbortController();
    entryAbort.current = controller;
    const entryEpoch = generation.current;
    const previousKey = activity.current.key;
    setBusy((previous) => ({ ...previous, [row.id]: true }));
    setErrors((previous) => ({ ...previous, [row.id]: "" }));
    let unavailable = false;
    try {
      const previousId = activity.current.sessionId;
      const phase = await activity.current.inspect();
      if (
        entryEpoch !== generation.current ||
        controller.signal.aborted ||
        activity.current.key !== previousKey ||
        entryBlocked.current.has(row.id)
      )
        return;
      const decision = challengeEntryDecision(
        phase,
        previousId,
        row.session_id,
        row.session_status,
        row.status === "pending" ? "accept" : "enter",
      );
      if (decision === "already-here" && row.status !== "pending") return;
      if (decision === "unavailable") {
        unavailable = true;
        throw new Error("המשחק הזה כבר הסתיים. הרשימה תתעדכן");
      }
      if (decision === "retry")
        throw new Error("לא ניתן לבדוק את מצב החדר הנוכחי. ההזמנה נשמרה; לחצו שוב כדי לנסות מחדש");
      if (decision === "defer") {
        if (confirmed || !automatic) {
          setSwitchPrompt(null);
          setErrors((previous) => ({
            ...previous,
            [row.id]: phase === "classroom"
              ? "כדי להיכנס להזמנה, צאו קודם מהכיתה. ההזמנה מחכה לכם כאן"
              : "המשחק הנוכחי עדיין פעיל. ההזמנה מחכה לכם כאן",
          }));
          setOpen(true);
        } else showToast({ kind: "ready", challengeId: row.id });
        return;
      }
      if (decision === "confirm" && !confirmed) {
        const key = `${activity.current.pathname}:${row.id}`;
        if (automatic && prompted.current.has(key)) return;
        prompted.current.add(key);
        switchFrom.current = previousKey;
        setOpen(false);
        setSwitchPrompt(row);
        return;
      }
      const accepting = row.status === "pending";
      const { data, error } = await supabase.rpc(accepting ? "accept_game_challenge" : "prepare_challenge_entry", {
        p_id: row.id,
        p_leave_session: previousId ?? null,
      }).abortSignal(AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
      if (error) {
        if (!controller.signal.aborted)
          reportCaughtError("Challenge room entry failed", error, {
            appArea: "challenges", operation: accepting ? "accept-and-enter" : "prepare-entry", challengeId: row.id,
            sessionId: row.session_id, code: error.code,
          }, "game-server");
        unavailable = error.message.includes("SESSION_UNAVAILABLE");
        throw new Error(
          error.message.includes("CURRENT_GAME_STARTED")
            ? "המשחק הנוכחי התחיל בינתיים. ההזמנה מחכה לכם ברשימה"
            : "לא ניתן להיכנס כרגע. ההזמנה נשארה ברשימה ואפשר לנסות שוב",
        );
      }
      if (typeof data !== "string" || !data)
        throw new Error("לא ניתן להיכנס כרגע. ההזמנה נשארה ברשימה ואפשר לנסות שוב");
      if (
        entryEpoch !== generation.current ||
        controller.signal.aborted ||
        activity.current.key !== previousKey ||
        entryBlocked.current.has(row.id)
      )
        return;
      entryFailed.current.delete(row.id);
      if (accepting) {
        ++mutationVersion.current;
        setRows((previous) => previous.map((invitation) =>
          invitation.id === row.id ? { ...invitation, status: "accepted" } : invitation,
        ));
        window.dispatchEvent(new Event("challenges-changed"));
      }
      setOpen(false);
      setSwitchPrompt(null);
      if (currentToast.current?.kind === "ready" && currentToast.current.challengeId === row.id)
        dismissToast();
      for (const invitation of rowsRef.current.filter(
        (invitation) => invitation.status === "accepted",
      ))
        prompted.current.add(`/play/${data}:${invitation.id}`);
      navigateRef.current(`/play/${data}?mode=player`);
    } catch (error) {
      if (entryEpoch !== generation.current || controller.signal.aborted || activity.current.key !== previousKey) return;
      entryFailed.current.add(row.id);
      setFilter("all");
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
      if (entryAbort.current === controller) entryAbort.current = null;
      if (entryEpoch === generation.current)
        setBusy((previous) => ({ ...previous, [row.id]: false }));
    }
  }, []);
  useEffect(() => {
    setSwitchPrompt(null);
    switchFrom.current = null;
    return () => entryAbort.current?.abort();
  }, [gameNavigation.key]);
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
          !prompted.current.has(`${gameNavigation.pathname}:${row.id}`)),
    );
    if (next) void enter(next, false, true);
  }, [rows, gameNavigation.phase, gameNavigation.sessionId, gameNavigation.pathname, user?.id, switchPrompt, enter]);
  useEffect(() => {
    const epoch = ++generation.current;
    setRows([]);
    setErrors({});
    setBusy({});
    setClearing(false);
    seen.current.clear();
    previousAvailability.current.clear();
    prompted.current.clear();
    entryFailed.current.clear();
    entryBlocked.current.clear();
    toastQueue.current = [];
    currentToast.current = null;
    updateSeen.current.clear();
    setToast(null);
    if (!user) return;
    const notify = (row: Invitation, previous?: Invitation) => {
      const message = challengeUpdateMessage(row, previous, user.id);
      const key = `${row.id}:${row.status}`;
      if (!message || updateSeen.current.has(key) || entryBlocked.current.has(row.id)) return;
      updateSeen.current.add(key);
      showToast({
        kind: "update", message,
        challengeId: row.status === "pending" || row.status === "accepted" ? row.id : undefined,
      });
    };
    let fetching = false;
    const retryGate = new FeatureRetryGate();
    const refresh = async (manual = false) => {
      if (fetching || document.hidden || !retryGate.allows(manual)) return;
      fetching = true;
      const version = mutationVersion.current;
      try {
        const { data, error } = await supabase.rpc("list_game_challenges");
        if (generation.current !== epoch || mutationVersion.current !== version) return;
        if (error)
          throw new FeatureRequestError(
            "לא ניתן לרענן הזמנות כרגע. ההזמנות הקיימות נשמרו",
            backendUnavailable(error),
          );
        const next = parseInvitations(data);
        retryGate.success();
        const priorRows = rowsRef.current;
        for (const row of next)
          notify(
            row,
            priorRows.find((prior) => prior.id === row.id),
          );
        // Missing cards may be declined/expired or simply fulfilled. Resolve that distinction
        // using participant-visible rows, without adding history back to the UI.
        const missing = priorRows.filter((prior) => !next.some((row) => row.id === prior.id));
        if (missing.length)
          void (async () => {
            try {
              const result = await supabase
                .from("game_challenges")
                .select("id,status,withdrawn_by,fulfilled_at")
                .in(
                  "id",
                  missing.map((row) => row.id),
                );
              if (result.error || !Array.isArray(result.data) || generation.current !== epoch)
                return;
              for (const row of result.data) {
                const prior = missing.find((item) => item.id === row.id);
                if (prior) notify({ ...prior, ...row }, prior);
              }
            } catch {
              /* A notification lookup cannot interfere with the invitation list. */
            }
          })();
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
      } catch (error) {
        if (generation.current !== epoch) return;
        retryGate.fail(error);
        setErrors((previous) => ({
          ...previous,
          refresh:
            error instanceof FeatureRequestError
              ? error.message
              : "לא ניתן לרענן הזמנות כרגע. אפשר לנסות שוב",
        }));
        reportCaughtError(
          "Challenge list query failed",
          error,
          { appArea: "game-challenge", operation: "list" },
          "shell",
          "warn",
        );
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
        (payload) => {
          const row = payload.new as Partial<Invitation>;
          const prior = rowsRef.current.find((item) => item.id === row.id);
          if (prior) notify({ ...prior, ...row }, prior);
          void refresh();
        },
      )
      .subscribe();
    const timer = window.setInterval(() => void refresh(), 5000);
    const onRefresh = () => void refresh();
    const onRetry = () => void refresh(true);
    window.addEventListener("challenges-retry", onRetry);
    window.addEventListener("challenges-changed", onRefresh);
    window.addEventListener("focus", onRefresh);
    window.addEventListener("online", onRefresh);
    return () => {
      ++generation.current;
      clearInterval(timer);
      window.removeEventListener("challenges-changed", onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.removeEventListener("online", onRefresh);
      window.removeEventListener("challenges-retry", onRetry);
      void supabase.removeChannel(channel).catch(() => {});
    };
  }, [user?.id, enter, showToast]);
  async function remove(ids: string[]) {
    const epoch = generation.current;
    const resolving = rowsRef.current.filter((row) => ids.includes(row.id));
    setClearing(true);
    for (const id of ids) entryBlocked.current.add(id);
    try {
      await resolveChallenges(ids);
      if (epoch !== generation.current) return;
      ++mutationVersion.current;
      setRows((previous) => previous.filter((row) => !ids.includes(row.id)));
      setErrors((previous) => ({ ...previous, clear: "" }));
      if (switchPrompt && ids.includes(switchPrompt.id)) setSwitchPrompt(null);
      if (toast?.kind === "ready" && ids.includes(toast.challengeId)) dismissToast();
      for (const row of resolving)
        window.dispatchEvent(
          new CustomEvent("challenge-withdrawn", {
            detail: {
              sessionId: row.session_id,
              actor: user?.id,
              closedRoom: row.session_status === "waiting",
            },
          }),
        );
      window.dispatchEvent(new Event("challenges-changed"));
    } catch (error) {
      for (const id of ids) entryBlocked.current.delete(id);
      if (epoch === generation.current)
        setErrors((previous) => ({ ...previous, clear: (error as Error).message }));
    } finally {
      if (epoch === generation.current) setClearing(false);
    }
  }
  async function act(row: Invitation, action: "decline" | "cancel") {
    const epoch = generation.current;
    ++mutationVersion.current;
    entryBlocked.current.add(row.id);
    setBusy((previous) => ({ ...previous, [row.id]: true }));
    try {
      await respondChallenge(row.id, action);
      if (epoch !== generation.current) return;
      ++mutationVersion.current;
      setRows((previous) => previous.filter((invitation) => invitation.id !== row.id));
      setErrors((previous) => ({ ...previous, [row.id]: "" }));
      window.dispatchEvent(new Event("challenges-changed"));
      if (switchPrompt?.id === row.id) setSwitchPrompt(null);
      window.dispatchEvent(
        new CustomEvent("challenge-withdrawn", {
          detail: {
            sessionId: row.session_id,
            actor: user?.id,
            closedRoom: row.session_status === "waiting",
          },
        }),
      );
    } catch (error) {
      if (epoch === generation.current) entryBlocked.current.delete(row.id);
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
    if (ready && !open) showToast({ kind: "ready", challengeId: ready.id });
  }, [rows, user?.id, currentSession, open]);
  useEffect(() => {
    if (!user) return;
    const sent = (event: Event) => {
      const detail = (event as CustomEvent<{ recipientName?: string }>).detail;
      setOpen(false);
      dialog.current?.close();
      showToast({ kind: "sent", recipientName: detail?.recipientName });
    };
    window.addEventListener("challenge-sent", sent);
    return () => window.removeEventListener("challenge-sent", sent);
  }, [user?.id]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(dismissToast, toast.kind === "ready" ? 15_000 : 6000);
    return () => window.clearTimeout(timer);
  }, [toast, dismissToast]);
  const invitations = rows.filter(
    (row) =>
      (row.status === "accepted" ||
        (row.status === "pending" && Date.parse(row.expires_at) > now)) &&
      row.session_status !== "completed" &&
      !row.withdrawn,
  );
  useEffect(() => {
    const node = dialog.current;
    if (!invitations.length && !errors.refresh) {
      setOpen(false);
      return;
    }
    if (open && node && !node.open) node.showModal();
    else if (!open && node?.open) node.close();
  }, [open, invitations.length, errors.refresh]);
  if (!user || (!invitations.length && !errors.refresh && !toast && !switchPrompt)) return null;
  const visible = invitations.filter(
    (row) =>
      filter === "all" ||
      (filter === "incoming" ? row.to_kid_id === user.id : row.from_kid_id === user.id),
  );
  const liveCount = invitations.length;
  const incoming = invitations.filter(
    (row) => row.status === "pending" && row.to_kid_id === user.id,
  ).length;
  const toastInvitation = toast && toast.kind !== "sent"
    ? invitations.find((row) => row.id === toast.challengeId && row.session_id !== currentSession)
    : undefined;
  const toastContent = toast && (
    <>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-400/15 dark:text-violet-300">
        {toastInvitation?.status === "pending" ? <Swords size={18} /> : <Check size={18} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-black">
          {toast.kind === "update"
            ? toast.message
            : toast.kind === "sent"
              ? toast.recipientName ? `ההזמנה ל${toast.recipientName} נשלחה` : "ההזמנה נשלחה"
              : "התפניתם? ההזמנה עדיין מחכה לכם"}
        </span>
        {toast.kind === "ready" && toastInvitation && (
          <span className="mt-1 block text-xs leading-5 text-slate-500 dark:text-slate-400">
            {toastInvitation.partner_name} {toastInvitation.partner_in_session ? "בחדר ומחכה לכם" : "אישר את ההזמנה"} · {toastInvitation.game_name}
          </span>
        )}
      </span>
    </>
  );
  return (
    <>
      {(invitations.length > 0 || errors.refresh) &&
        createPortal(
          <button
            ref={trigger}
            type="button"
            onClick={() => setOpen(true)}
            aria-expanded={open}
            aria-controls="challenge-list"
            aria-label={
              errors.refresh && !invitations.length
                ? "הזמנות למשחק, לא זמין כרגע"
                : `הזמנות למשחק, ${liveCount}`
            }
            className="fixed bottom-4 left-20 z-40 inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-2xl border border-violet-200 bg-white/95 px-4 font-bold text-violet-700 shadow-lg backdrop-blur-xl transition hover:bg-violet-50 dark:border-violet-400/25 dark:bg-slate-900/95 dark:text-violet-300 dark:hover:bg-slate-800"
          >
            <Swords size={19} />
            {errors.refresh && (
              <span aria-label="שגיאה ברענון הזמנות" className="text-amber-600">
                !
              </span>
            )}
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
          toast.kind === "update" ||
          invitations.some(
            (row) =>
              row.id === toast.challengeId &&
              row.session_id !== currentSession &&
              !challengeAvailability(row, currentSession).busy,
          )) &&
        createPortal(
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-20 left-4 z-50 w-[calc(100vw-32px)] max-w-sm rounded-2xl border border-violet-200 bg-white p-2 text-slate-900 shadow-xl dark:border-violet-400/25 dark:bg-slate-900 dark:text-white"
            dir="rtl"
          >
            <div className="flex items-start gap-1">
              {toastInvitation ? (
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 text-start transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:hover:bg-violet-400/10"
                  aria-label={`${toastInvitation.status === "pending" ? "קבלה וכניסה" : "כניסה"} לחדר של ${toastInvitation.partner_name}`}
                  onClick={() => {
                    dismissToast();
                    void enter(toastInvitation);
                  }}
                >
                  {toastContent}
                  <ArrowLeft size={16} className="shrink-0 text-violet-500" />
                </button>
              ) : <div className="flex min-w-0 flex-1 items-start gap-3 p-2">{toastContent}</div>}
              <button
                onClick={dismissToast}
                aria-label="סגירת הודעת הזמנה"
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10"
              >
                <X size={16} />
              </button>
            </div>
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
        <h2 className="text-lg font-black">{switchPrompt?.status === "pending" ? "לקבל ולעבור לחדר של" : "לעבור לחדר של"} {switchPrompt?.partner_name}?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-500 dark:text-slate-300">
          {gameNavigation.phase === "playing" && switchPrompt?.status === "accepted"
            ? "המשחק בחדר הנוכחי התחיל. אפשר להצטרף להזמנה אחרי שתצאו ממנו."
            : gameNavigation.phase === "playing"
            ? "קבלת ההזמנה תוציא אתכם מהמשחק הפעיל ותעביר אתכם לחדר החדש."
            : gameNavigation.phase === "solo"
              ? "אתם באמצע משחק יחיד. מעבר לחדר יעזוב את המשחק הנוכחי."
              : "המשחק בחדר הנוכחי עדיין לא התחיל. ההזמנה הקודמת תישאר זמינה ותוכלו לחזור אליה."}
        </p>
        <div className="mt-5 flex gap-3">
          <button
            className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-bold text-white"
            onClick={() => {
              if (switchPrompt) void enter(switchPrompt, true);
            }}
          >
            {switchPrompt?.status === "pending" ? "קבלה וכניסה לחדר" : "כן, לעבור לחדר"}
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
          {errors.clear && (
            <p role="alert" className="px-5 pb-3 text-sm text-rose-600">
              {errors.clear}
            </p>
          )}
          {errors.refresh && (
            <div role="alert" className="px-5 pb-3 text-sm text-amber-700 dark:text-amber-300">
              <p>{errors.refresh}</p>
              <button
                type="button"
                className="mt-2 rounded-lg border border-current/20 px-3 py-2 font-bold"
                onClick={() => window.dispatchEvent(new Event("challenges-retry"))}
              >
                נסו שוב
              </button>
            </div>
          )}
          <div className="flex min-h-0 flex-1 flex-col border-t border-slate-100 dark:border-white/10">
            <div className="flex shrink-0 gap-2 px-4 py-3" aria-label="סינון הזמנות">
              {[
                ["all", "הכל"],
                ["incoming", "אליי"],
                ["sent", "שלחתי"],
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
            <div className="flex shrink-0 justify-end border-t border-slate-100 px-4 py-2 dark:border-white/10">
              {" "}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-white/10"
                disabled={clearing || !visible.length || Object.values(busy).some(Boolean)}
                onClick={() => void remove(visible.map((row) => row.id))}
                title="מבטל ומסיר את ההזמנות בקטגוריה הנוכחית. אם אתם בחדר שלהן, תצאו ממנו"
              >
                <Trash2 size={14} />
                {clearing ? "מנקים…" : "ניקוי הכל"}
              </button>
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
                            disabled={busy[row.id] || clearing || gameNavigation.phase === "classroom"}
                            title={gameNavigation.phase === "classroom" ? "צאו מהכיתה לפני קבלת הזמנה למשחק" : undefined}
                            onClick={() => void enter(row)}
                          >
                            <Check size={14} />
                            {busy[row.id] ? "בודקים את מצב החדר…" : "קבלה וכניסה"}
                          </button>
                        </>
                      )}
                      {row.status === "pending" && row.to_kid_id === user.id && gameNavigation.phase === "classroom" && (
                        <p className="w-full text-xs leading-5 text-slate-500 dark:text-slate-400">
                          צאו מהכיתה כדי לקבל את ההזמנה ולהיכנס למשחק.
                        </p>
                      )}
                      {row.status === "accepted" &&
                        row.session_status !== "completed" &&
                        row.session_id !== currentSession && (
                          <button
                            className={`${button} bg-violet-600 text-white hover:bg-violet-500`}
                            disabled={
                              busy[row.id] ||
                              clearing ||
                              gameNavigation.phase === "playing" ||
                              gameNavigation.phase === "classroom"
                            }
                            title={
                              gameNavigation.phase === "playing"
                                ? "ההזמנה מחכה לסיום המשחק הנוכחי"
                                : gameNavigation.phase === "classroom"
                                  ? "צאו מהכיתה לפני מעבר לחדר משחק"
                                  : gameNavigation.phase === "unknown"
                                    ? "לחצו כדי לבדוק שוב את מצב החדר ולהיכנס"
                                    : undefined
                            }
                            onClick={() => void enter(row)}
                          >
                            {busy[row.id] ? "בודקים את מצב החדר…" : gameNavigation.phase === "unknown" ? "בדיקה וכניסה לחדר" : "כניסה לחדר"}
                            <ArrowLeft size={14} />
                          </button>
                        )}
                      <button
                        className={`${button} text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/10`}
                        disabled={busy[row.id] || clearing}
                        onClick={() =>
                          void act(row, row.from_kid_id === user.id ? "cancel" : "decline")
                        }
                        title={
                          row.status === "accepted" ? "ביטול ההזמנה ויציאה מהמשחק שלה" : undefined
                        }
                      >
                        <X size={14} />
                        {row.session_id === currentSession
                          ? "ביטול ויציאה"
                          : row.status === "accepted"
                            ? "ביטול והסרה"
                            : row.from_kid_id === user.id
                              ? "ביטול הזמנה"
                              : "לא הפעם"}
                      </button>
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
