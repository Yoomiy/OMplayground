import type { DiagnosticDetail } from "@playground/voxel-runtime";
import { useCallback, useEffect, useRef, useState } from "react";
import type { HudState, VoxelRuntime } from "@playground/voxel-runtime";
import type { LifecycleAction, VoxelApi, StaffCommand } from "./session-api";
import { admissionMessage, VoxelApiError } from "./session-api";
import { currentPresence } from "./session-projection";
import type { SessionProjection } from "./session-projection";
import "./voxel-session.css";
import { VoxelModeration } from "./VoxelModeration";
import { VoxelChat } from "./VoxelChat";
import { VoxelVoice } from "./VoxelVoice";
import { VoxelRoomControls } from "./VoxelRoomControls";
import { VoxelHelp } from "./VoxelHelp";

type BrowserModule = typeof import("@playground/voxel-runtime");
type ControlState = {
  action: LifecycleAction;
  id: string;
  state: "pending" | "unconfirmed" | "done";
  text: string;
};
export type VoxelSurfaceProps = {
  api: VoxelApi;
  session: SessionProjection | null;
  userId: string;
  isStaff: boolean;
  canChoosePlayer: boolean;
  manualVoiceJoin?: boolean;
  onParticipation?: (mode: "player" | "observer") => void;
  onExit: () => void;
  onDiagnostic?: (
    operation: string,
    code: string,
    buildId: string | null,
    detail?: DiagnosticDetail,
  ) => void;
  onRuntime?: (runtime: VoxelRuntime) => void | (() => void);
};
/** React owns low-frequency HUD state. The runtime owns frames, input and all world resources. */
export function VoxelSurface(props: VoxelSurfaceProps) {
  const {
    api,
    session,
    userId,
    isStaff,
    canChoosePlayer,
    onParticipation,
    onExit,
  } = props;
  const header = useRef<HTMLElement>(null);
  const root = useRef<HTMLElement>(null),
    world = useRef<HTMLDivElement>(null),
    inventoryHost = useRef<HTMLDivElement>(null);
  const identity = useRef<string | null>(null);
  const runtime = useRef<VoxelRuntime | null>(null),
    callbacks = useRef(props);
  callbacks.current = props;
  const [browser, setBrowser] = useState<BrowserModule | null>(null),
    [hud, setHud] = useState<HudState | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null),
    [mountError, setMountError] = useState<string | null>(null);
  const [control, setControl] = useState<ControlState | null>(null),
    [help, setHelp] = useState(false),
    [now, setNow] = useState(Date.now);
  const [endConfirmed, setEndConfirmed] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const changed = () =>
      setFullscreen(document.fullscreenElement === root.current);
    changed();
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);
  const endDialog = useRef<HTMLDialogElement>(null),
    controlAbort = useRef<AbortController | null>(null);
  const controlPending = useRef(false),
    staffPending = useRef(false);
  const moderationLock = useRef<object | null>(null);
  const [moderationBusy, setModerationBusy] = useState(false);
  const acquireModeration = useCallback(() => {
    if (
      controlPending.current ||
      staffPending.current ||
      moderationLock.current
    )
      return null;
    const owner = {};
    moderationLock.current = owner;
    setModerationBusy(true);
    runtime.current?.command({ type: "pause" });
    return () => {
      if (moderationLock.current === owner) {
        moderationLock.current = null;
        setModerationBusy(false);
      }
    };
  }, []);
  const staffAbort = useRef<AbortController | null>(null),
    staffDialog = useRef<HTMLDialogElement>(null);
  const [staffDraft, setStaffDraft] = useState<StaffCommand | null>(null),
    [staffTarget, setStaffTarget] = useState("spawn"),
    [staffState, setStaffState] = useState<{
      id: string;
      command: StaffCommand;
      state: "pending" | "unconfirmed" | "done";
      text: string;
    } | null>(null);
  const releaseRuntime = useRef<(() => void) | null>(null);
  const command = useCallback(
    (value: Parameters<VoxelRuntime["command"]>[0]) =>
      runtime.current?.command(value),
    [],
  );
  const closeHelp = useCallback(() => {
    setHelp(false);
    command({ type: "resume" });
  }, [command]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        !runtime.current ||
        event.repeat ||
        event.code !== "KeyH" ||
        (event.target instanceof HTMLElement &&
          event.target.closest(
            'input, textarea, select, [contenteditable="true"]',
          )) ||
        root.current?.querySelector("dialog[open]")
      )
        return;
      event.preventDefault();
      if (help) closeHelp();
      else {
        command({ type: "pause" });
        setHelp(true);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [help, command, closeHelp]);
  useEffect(() => {
    const abort = new AbortController();
    let owned: VoxelRuntime | null = null,
      touch: { dispose(): void } | null = null,
      inventory: { dispose(): void } | null = null;
    let unsubscribe: (() => void) | undefined,
      detachRuntime: (() => void) | undefined;
    let pending: HudState | null = null,
      delivered: HudState | null = null,
      timer: ReturnType<typeof setTimeout> | null = null;
    setHud(null);
    moderationLock.current = null;
    setModerationBusy(false);
    setBrowser(null);
    identity.current = null;
    setErrorCode(null);
    setMountError(null);
    setControl(null);
    setStaffState(null);
    setStaffDraft(null);
    setStaffTarget("spawn");
    setEndConfirmed(false);
    const deliver = () => {
      timer = null;
      if (pending && !abort.signal.aborted) {
        delivered = pending;
        setHud(pending);
      }
    };
    void (async () => {
      const module = await import("@playground/voxel-runtime");
      if (
        abort.signal.aborted ||
        !world.current ||
        !root.current ||
        !inventoryHost.current
      )
        return;
      const instance = await module.mountVoxel(world.current, {
        socketUrl: api.socketUrl,
        signal: abort.signal,
        fullscreenElement: root.current,
        renderScale: matchMedia("(pointer: coarse)").matches ? 0.75 : 1,
        renderHz: matchMedia("(pointer: coarse)").matches ? 30 : 60,
        autoEnter: true,
        admit: async () => {
          try {
            const result = await api.admit(abort.signal);
            if (!abort.signal.aborted) setErrorCode(null);
            return result;
          } catch (error) {
            if (!abort.signal.aborted)
              setErrorCode(
                error instanceof VoxelApiError ? error.code : "UNAVAILABLE",
              );
            throw error;
          }
        },
        onDiagnostic: (operation, _reason, detail) =>
          callbacks.current.onDiagnostic?.(
            operation,
            detail?.code ?? "RUNTIME_FAILURE",
            module.identity.buildId,
            detail,
          ),
      });
      if (abort.signal.aborted) {
        instance.dispose();
        return;
      }
      owned = instance;
      runtime.current = instance;
      touch = module.mountTouchControls(world.current, instance);
      inventory = module.mountInventoryControls(
        inventoryHost.current,
        instance,
        module.content,
        module.ITEM_LABELS,
        root.current,
      );
      unsubscribe = instance.subscribe((state) => {
        pending = state;
        if (
          !delivered ||
          delivered.status !== state.status ||
          delivered.lifecycle !== state.lifecycle ||
          delivered.role !== state.role ||
          delivered.mode !== state.mode ||
          delivered.inventoryOpen !== state.inventoryOpen
        ) {
          if (timer) clearTimeout(timer);
          deliver();
        } else if (!timer) timer = setTimeout(deliver, 100);
      });
      setBrowser(module);
      identity.current = module.identity.buildId;
      const dispose = callbacks.current.onRuntime?.(instance);
      if (dispose) detachRuntime = dispose;
    })().catch((error) => {
      if (abort.signal.aborted) return;
      setMountError(
        "לא ניתן להפעיל את העולם בדפדפן הזה. אפשר לנסות שוב או לחזור למגרש המשחקים.",
      );
      callbacks.current.onDiagnostic?.(
        "mount",
        error instanceof DOMException && error.name === "AbortError"
          ? "CANCELLED"
          : "MOUNT_FAILURE",
        identity.current,
      );
    });
    const release = () => {
      if (abort.signal.aborted) return;
      unsubscribe?.();
      detachRuntime?.();
      if (timer) clearTimeout(timer);
      touch?.dispose();
      inventory?.dispose();
      abort.abort();
      owned?.dispose();
      if (runtime.current === owned) runtime.current = null;
    };
    releaseRuntime.current = release;
    return () => {
      release();
      if (releaseRuntime.current === release) releaseRuntime.current = null;
      controlAbort.current?.abort();
      staffAbort.current?.abort();
      moderationLock.current = null;
      staffPending.current = false;
      controlPending.current = false;
    };
  }, [api]);
  useEffect(() => {
    const panel = header.current,
      owner = root.current;
    if (!panel || !owner) return;
    const measure = () =>
      owner.style.setProperty(
        "--voxel-header-bottom",
        `${panel.getBoundingClientRect().bottom - owner.getBoundingClientRect().top}px`,
      );
    const observer = new ResizeObserver(measure);
    observer.observe(panel);
    measure();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const terminal =
    endConfirmed ||
    hud?.lifecycle === "ended" ||
    errorCode === "SESSION_ENDED" ||
    session?.status === "completed";
  useEffect(() => {
    if (terminal) {
      setHelp(false);
      releaseRuntime.current?.();
    }
  }, [terminal, api]);
  const canControl = !!session && (isStaff || session.hostId === userId);
  const connected = currentPresence(session, now);
  const executeControl = useCallback(
    async (action: LifecycleAction, retryId?: string) => {
      if (
        controlPending.current ||
        staffPending.current ||
        moderationLock.current
      )
        return;
      controlPending.current = true;
      command({ type: "pause" });
      const id = retryId ?? crypto.randomUUID(),
        abort = new AbortController();
      controlAbort.current?.abort();
      controlAbort.current = abort;
      setControl({
        action,
        id,
        state: "pending",
        text:
          action === "resume"
            ? "מחדשים את המפגש…"
            : action === "end"
              ? "מסיימים את המפגש…"
              : "ממתינים לאישור שמירה…",
      });
      try {
        const receipt = await api.control(action, id, abort.signal);
        if (abort.signal.aborted) return;
        setControl({
          action,
          id,
          state: "done",
          text: !receipt.current
            ? "הפעולה הקודמת הושלמה. מוצג המצב הנוכחי של המפגש."
            : action === "resume"
              ? "המפגש חודש. לחצו על כניסה לעולם כדי להמשיך."
              : action === "end"
                ? "המפגש הסתיים. אפשר לפתוח מפגש חדש."
                : "המפגש הושהה והשמירה אושרה.",
        });
        if (action === "end" && receipt.current) setEndConfirmed(true);
      } catch (error) {
        if (abort.signal.aborted) return;
        const code =
          error instanceof VoxelApiError ? error.code : "UNAVAILABLE";
        const uncertain = !(error instanceof VoxelApiError) || error.retryable;
        setControl({
          action,
          id,
          state: uncertain ? "unconfirmed" : "done",
          text: uncertain
            ? action === "end"
              ? "לא התקבל אישור לסיום המפגש. אפשר לנסות שוב."
              : "לא התקבל אישור להשלמת הפעולה. השמירה טרם אושרה; אפשר לנסות שוב."
            : admissionMessage(code),
        });
        callbacks.current.onDiagnostic?.("control", code, identity.current);
      } finally {
        if (controlAbort.current === abort) controlPending.current = false;
      }
    },
    [api, command],
  );
  useEffect(() => {
    if (control?.state !== "done") return;
    const current = control,
      timer = setTimeout(
        () => setControl((value) => (value === current ? null : value)),
        5000,
      );
    return () => clearTimeout(timer);
  }, [control]);
  const executeStaff = useCallback(
    async (value: StaffCommand, retryId?: string) => {
      if (
        controlPending.current ||
        staffPending.current ||
        moderationLock.current
      )
        return;
      staffPending.current = true;
      command({ type: "pause" });
      const id = retryId ?? crypto.randomUUID(),
        abort = new AbortController();
      staffAbort.current?.abort();
      staffAbort.current = abort;
      setStaffState({
        id,
        command: value,
        state: "pending",
        text: "ממתינים לאישור הפעולה…",
      });
      try {
        const receipt = await api.staff(value, id, abort.signal);
        if (abort.signal.aborted) return;
        setStaffState({
          id,
          command: value,
          state: "done",
          text: !receipt.current
            ? "זו תוצאה של פעולה קודמת. מוצג המצב הנוכחי של העולם."
            : !receipt.result.ok
              ? receipt.result.reason === "not_present"
                ? "המשתתף או המשתתפת כבר אינם בעולם."
                : "לא ניתן לבצע את הפעולה כעת."
              : value.kind === "mode"
                ? "מצב העולם עודכן. לחצו על כניסה לעולם כדי להמשיך."
                : "ההשתגרות אושרה. ממתינים לשטח בטוח, ואז אפשר להיכנס לעולם.",
        });
      } catch (error) {
        if (abort.signal.aborted) return;
        const code =
          error instanceof VoxelApiError ? error.code : "UNAVAILABLE";
        const retry = !(error instanceof VoxelApiError) || error.retryable;
        setStaffState({
          id,
          command: value,
          state: retry ? "unconfirmed" : "done",
          text: retry
            ? "לא התקבל אישור לפעולה. אפשר לבדוק את הבקשה; לפעולה חדשה, בחרו שוב בכלי המורה."
            : code === "SUPERSEDED"
              ? "בקשה מאוחרת יותר החליפה פעולה זו."
              : admissionMessage(code),
        });
        callbacks.current.onDiagnostic?.(
          "staff_control",
          code,
          identity.current,
        );
      } finally {
        if (staffAbort.current === abort) staffPending.current = false;
      }
    },
    [api, command],
  );
  useEffect(() => {
    if (staffState?.state !== "done") return;
    const current = staffState,
      timer = setTimeout(
        () => setStaffState((value) => (value === current ? null : value)),
        5000,
      );
    return () => clearTimeout(timer);
  }, [staffState]);
  const mouseReleased =
    hud?.status === "paused" &&
    hud.graphics === "ready" &&
    (hud.lifecycle === "playing" ||
      (hud.role === "observer" && hud.lifecycle === "paused"));
  const showStatus =
    terminal ||
    !!mountError ||
    !!errorCode ||
    !hud ||
    (hud.status !== "playing" &&
      !mouseReleased &&
      !hud.inventoryOpen &&
      !help &&
      !panelOpen);
  useEffect(() => {
    if (hud?.status === "playing") {
      setHelp(false);
    }
  }, [hud?.status]);
  const statusText = terminal
    ? "המפגש הסתיים"
    : (mountError ??
      (errorCode
        ? admissionMessage(errorCode)
        : hud?.message ||
          (hud?.lifecycle === "paused"
            ? "העולם מושהה"
            : hud?.status === "playing"
              ? "אתם בעולם"
              : "מכינים את העולם…")));
  const canEnter =
    !!hud &&
    hud.graphics === "ready" &&
    !terminal &&
    !errorCode &&
    !mountError &&
    hud.status === "paused" &&
    (hud.lifecycle === "playing" ||
      (hud.role === "observer" && hud.lifecycle === "paused"));
  const reconnect =
    !!hud &&
    ["ready", "failed"].includes(hud.graphics) &&
    !terminal &&
    ![
      "UNAUTHORIZED",
      "FORBIDDEN",
      "GENDER_MISMATCH",
      "RECESS_CLOSED",
      "PAUSED_ROSTER",
      "SESSION_CLOSED",
      "MODE_DENIED",
    ].includes(errorCode ?? "") &&
    ["error", "recovering", "stalled"].includes(hud.status);
  const title = "מיינקראפט";
  const selectedItem = browser?.content.items.find(
    (item) => item.itemType === hud?.inventory?.bag[hud.selectedSlot]?.itemType,
  );
  const selectedHotbarItem = hud?.hotbar.find((item) =>
    item.slot === null
      ? item.state === hud.selected
      : item.slot === hud.selectedSlot,
  );
  return (
    <section
      ref={root}
      className="voxel-session"
      dir="rtl"
      data-input={hud?.inputMode ?? ""}
      aria-label="מפגש עולם תלת־ממדי"
    >
      <div
        ref={world}
        className={`voxel-session__world${terminal ? " voxel-session__world--ended" : ""}`}
      />
      <VoxelVoice
        api={api}
        names={connected}
        manualJoin={
          props.manualVoiceJoin ?? (isStaff && hud?.role === "observer")
        }
        isStaff={false}
        ended={terminal}
        ready={
          !!hud &&
          !terminal &&
          !errorCode &&
          ["playing", "paused", "dead"].includes(hud.status)
        }
        scene={() => runtime.current?.voiceScene() ?? null}
        onOpen={() => {
          setPanelOpen(true);
          command({ type: "pause" });
        }}
        onResume={() => {
          setPanelOpen(false);
          command({ type: "resume" });
        }}
      />
      <VoxelChat
        api={api}
        isStaff={isStaff}
        active={
          !!hud &&
          !terminal &&
          !errorCode &&
          ["playing", "paused", "dead"].includes(hud.status)
        }
        canSend={
          !!hud &&
          hud.role === "participant" &&
          !terminal &&
          !errorCode &&
          ["playing", "paused", "dead"].includes(hud.status)
        }
        onOpen={() => {
          setPanelOpen(true);
          command({ type: "pause" });
        }}
        onResume={() => {
          setPanelOpen(false);
          command({ type: "resume" });
        }}
      />
      <header ref={header} className="voxel-session__header">
        <button
          type="button"
          onClick={() => {
            command({ type: "pause" });
            onExit();
          }}
        >
          יציאה
        </button>
        {canControl && !terminal && (
          <nav className="voxel-session__lifecycle" aria-label="ניהול המפגש">
            <button
              type="button"
              disabled={
                control?.state === "pending" ||
                staffState?.state === "pending" ||
                moderationBusy
              }
              onClick={() =>
                void executeControl(
                  hud?.lifecycle === "paused" ? "resume" : "pause",
                )
              }
            >
              {hud?.lifecycle === "paused" ? "המשך" : "השהה"}
            </button>
            <button
              type="button"
              disabled={
                control?.state === "pending" ||
                staffState?.state === "pending" ||
                moderationBusy
              }
              onClick={() => {
                command({ type: "pause" });
                endDialog.current?.showModal();
              }}
            >
              סיים
            </button>
          </nav>
        )}
        <h1>{title}</h1>
        <nav aria-label="כלי העולם">
          <button
            type="button"
            aria-pressed={fullscreen}
            onClick={() => command({ type: "fullscreen" })}
          >
            {fullscreen ? "יציאה ממסך מלא" : "מסך מלא"}
          </button>
          <button
            type="button"
            aria-expanded={help}
            onClick={() => {
              if (help) closeHelp();
              else {
                command({ type: "pause" });
                setHelp(true);
              }
            }}
          >
            עזרה (H)
          </button>
        </nav>
        {isStaff && hud && !terminal && (
          <details className="voxel-session__staff">
            <summary>כלי מורה</summary>
            <label>
              יעד להשתגרות
              <select
                aria-label="יעד להשתגרות"
                value={staffTarget}
                onChange={(event) => setStaffTarget(event.target.value)}
              >
                <option value="spawn">נקודת ההתחלה</option>
                {connected
                  .filter((actor) => actor.id !== userId)
                  .map((actor) => (
                    <option key={actor.id} value={actor.id}>
                      {actor.name}
                    </option>
                  ))}
              </select>
            </label>
            <button
              type="button"
              disabled={
                control?.state === "pending" ||
                staffState?.state === "pending" ||
                moderationBusy
              }
              onClick={() => {
                command({ type: "pause" });
                setStaffDraft({ kind: "teleport", target: staffTarget });
                staffDialog.current?.showModal();
              }}
            >
              השתגרות ליעד
            </button>
            <VoxelModeration
              api={api}
              busy={
                control?.state === "pending" ||
                staffState?.state === "pending" ||
                moderationBusy
              }
              acquire={acquireModeration}
              onPause={() => command({ type: "pause" })}
              onFailure={(code) =>
                callbacks.current.onDiagnostic?.(
                  "staff_moderation",
                  code,
                  identity.current,
                )
              }
            />
          </details>
        )}
        {!terminal && (
          <nav aria-label="אופן השתתפות">
            {" "}
            {isStaff &&
              onParticipation &&
              (hud?.role === "participant" || canChoosePlayer) && (
                <button
                  type="button"
                  onClick={() => {
                    command({ type: "pause" });
                    onParticipation(
                      hud?.role === "observer" ? "player" : "observer",
                    );
                  }}
                >
                  {hud?.role === "observer"
                    ? "הצטרפות כשחקן/ית"
                    : "מעבר לתצפית נסתרת"}
                </button>
              )}
          </nav>
        )}
      </header>
      {session?.hostId === userId && !terminal && (
        <VoxelRoomControls
          api={api}
          onInteract={() => command({ type: "pause" })}
        />
      )}
      <VoxelHelp
        open={help}
        items={browser?.content.items ?? []}
        behavior={browser?.content.behavior ?? []}
        labels={browser?.ITEM_LABELS ?? {}}
        onClose={closeHelp}
        canUseInventory={
          hud?.role === "participant" && hud?.lifecycle === "playing"
        }
        onInventory={() => {
          setHelp(false);
          command({
            type: "inventory",
            operation: { kind: "open", target: null },
          });
        }}
      />
      {!showStatus &&
        !panelOpen &&
        !help &&
        hud?.message &&
        !hud.inventoryOpen && (
          <p
            className="voxel-session__feedback"
            role="status"
            aria-live="polite"
          >
            {hud.message}
          </p>
        )}
      {showStatus && (
        <div className="voxel-session__status" role="status" aria-live="polite">
          <p>{statusText}</p>
          {(mountError || (hud && hud.graphics !== "ready")) && (
            <button type="button" onClick={() => location.reload()}>
              טעינה מחדש
            </button>
          )}
          {canEnter && hud?.status !== "playing" && (
            <button type="button" onClick={() => command({ type: "resume" })}>
              {hud?.role === "observer" ? "כניסה לתצפית" : "כניסה לעולם"}
            </button>
          )}
          {reconnect && (
            <button
              type="button"
              onClick={() => command({ type: "reconnect" })}
            >
              {hud?.graphics === "failed"
                ? "ניסיון נוסף לשחזור התצוגה"
                : "התחברות מחדש"}
            </button>
          )}
          {hud?.status === "dead" && (
            <button
              type="button"
              disabled={hud.vitals?.respawnIn !== 0}
              onClick={() => command({ type: "respawn" })}
            >
              חזרה לעולם
              {hud.vitals?.respawnIn
                ? ` בעוד ${Math.ceil(hud.vitals.respawnIn / 30)} שניות`
                : ""}
            </button>
          )}
        </div>
      )}
      {hud?.status === "playing" && !terminal && (
        <span className="voxel-session__crosshair" aria-hidden="true">
          +
        </span>
      )}
      {hud?.hit &&
        hud.role === "participant" &&
        !terminal &&
        (hud.status === "playing" || hud.status === "dead") &&
        performance.now() - hud.hit.at < 1500 && (
          <output
            key={hud.hit.at}
            className={`voxel-session__hit${hud.hit.received ? " voxel-session__hit--received" : ""}`}
            role="status"
            aria-live="polite"
          >
            {hud.hit.received ? "נפגעתם" : "פגיעה"} · {hud.hit.damage} נקודות
          </output>
        )}
      <div className="voxel-session__notices">
        {control && (
          <aside
            className={`voxel-session__save voxel-session__save--${control.state}`}
            role="status"
          >
            <p>{control.text}</p>
            {control.state === "unconfirmed" && (
              <button
                type="button"
                onClick={() => void executeControl(control.action, control.id)}
              >
                ניסיון חוזר של אותה פעולה
              </button>
            )}
          </aside>
        )}
        {staffState && (
          <aside
            className={`voxel-session__save voxel-session__save--${staffState.state}`}
            role="status"
          >
            <p>{staffState.text}</p>
            {staffState.state === "unconfirmed" && (
              <button
                type="button"
                onClick={() =>
                  void executeStaff(staffState.command, staffState.id)
                }
              >
                בדיקת אותה פעולה
              </button>
            )}
          </aside>
        )}
      </div>
      <dialog
        ref={staffDialog}
        className="voxel-session__dialog"
        aria-labelledby="voxel-staff-title"
      >
        <h2 id="voxel-staff-title">להשתגר ליעד?</h2>
        <p>רק המיקום שלכם ישתנה. לאחר טעינת השטח אפשר להמשיך לשחק.</p>
        <button type="button" onClick={() => staffDialog.current?.close()}>
          ביטול
        </button>
        <button
          type="button"
          onClick={() => {
            staffDialog.current?.close();
            if (staffDraft) void executeStaff(staffDraft);
          }}
        >
          אישור הפעולה
        </button>
      </dialog>
      {hud?.role === "observer" && (
        <p className="voxel-session__observer">
          תצפית נסתרת · אין בנייה או פגיעה בשחקנים
        </p>
      )}
      {hud?.vitals &&
        hud.role === "participant" &&
        (hud.mode === "survival" || hud.status === "dead") && (
          <aside className="voxel-session__vitals" aria-label="מצב השחקן">
            <label className="voxel-session__vital voxel-session__vital--health">
              <span aria-hidden="true">♥</span>
              <meter
                aria-label="בריאות"
                min={0}
                max={20}
                value={hud.vitals.health}
              />
              <small>{hud.vitals.health}/20</small>
            </label>
            <label className="voxel-session__vital voxel-session__vital--food">
              <span>מזון</span>
              <meter
                aria-label="מזון"
                min={0}
                max={20}
                value={hud.vitals.food}
              />
              <small>{hud.vitals.food}/20</small>
            </label>
            {hud.vitals.air < 300 && (
              <label className="voxel-session__vital voxel-session__vital--air">
                <span>אוויר</span>
                <meter
                  aria-label="אוויר"
                  min={0}
                  max={300}
                  value={hud.vitals.air}
                />
                <small>{Math.ceil(hud.vitals.air / 30)} שנ׳</small>
              </label>
            )}
            <button
              type="button"
              disabled={
                !selectedItem?.food ||
                hud.vitals.food === 20 ||
                (hud.status !== "playing" && !mouseReleased)
              }
              onClick={() => command({ type: "eat" })}
            >
              אכילה
            </button>
          </aside>
        )}
      <footer
        className="voxel-session__bottom"
        hidden={terminal || hud?.role === "observer"}
      >
        <span className="voxel-session__selected-item">
          {selectedHotbarItem?.family &&
            (browser?.ITEM_LABELS[selectedHotbarItem.family] ??
              selectedHotbarItem.family)}
        </span>
        <div ref={inventoryHost} className="voxel-session__inventory-tools" />
        <div
          className="voxel-session__hotbar"
          role="toolbar"
          aria-label="חפצים זמינים"
        >
          {hud?.hotbar.map((item, index) => {
            const stack =
              item.slot === null ? null : hud.inventory?.bag[item.slot];
            const definition = browser?.content.items.find((entry) =>
              item.slot === null
                ? entry.places === item.family
                : entry.itemType === item.family,
            );
            const name = definition
              ? (browser?.ITEM_LABELS[definition.itemType] ??
                definition.labelKey)
              : "יד ריקה";
            const icon =
              definition && runtime.current?.itemIcon(definition.itemType);
            const durability = stack?.instance?.durability;
            const ratio =
              durability !== undefined && definition?.durability
                ? durability / definition.durability
                : null;
            return (
              <button
                className="voxel-item-slot"
                title={`${index + 1}. ${name}${item.count ? ` ×${item.count}` : ""}${durability !== undefined ? ` · עמידות ${durability}/${definition?.durability}` : ""}`}
                aria-label={`${index + 1}. ${name}${item.count ? ` ×${item.count}` : ""}`}
                type="button"
                key={item.key}
                disabled={
                  (hud.role === "participant" && hud.lifecycle !== "playing") ||
                  hud.inventoryPending ||
                  hud.status === "dead"
                }
                aria-pressed={
                  item.slot === null
                    ? item.state === hud.selected
                    : item.slot === hud.selectedSlot
                }
                onClick={() =>
                  command(
                    item.slot === null
                      ? { type: "select", state: item.state }
                      : { type: "select-slot", slot: item.slot },
                  )
                }
              >
                <span className="voxel-item-slot__key" aria-hidden="true">
                  {index + 1}
                </span>
                {icon && <img src={icon} alt="" draggable={false} />}
                {!!item.count && item.count > 1 && (
                  <span className="voxel-item-slot__count" aria-hidden="true">
                    {item.count}
                  </span>
                )}
                {ratio !== null && (
                  <span
                    className="voxel-item-slot__durability"
                    aria-hidden="true"
                  >
                    <span
                      style={{
                        width: `${ratio * 100}%`,
                        background: `hsl(${Math.round(ratio * 110)} 65% 55%)`,
                      }}
                    />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </footer>
      <dialog
        ref={endDialog}
        className="voxel-session__dialog"
        aria-labelledby="voxel-end-title"
      >
        <h2 id="voxel-end-title">לסיים את המפגש?</h2>
        <p>
          סיום המפגש מנתק את המשתתפים ולא ניתן לחדש אותו. כדי לשמור ולחזור מאוחר
          יותר, בחרו בהשהיית המפגש.
        </p>
        <button type="button" onClick={() => endDialog.current?.close()}>
          ביטול
        </button>
        <button
          type="button"
          onClick={() => {
            endDialog.current?.close();
            void executeControl("end");
          }}
        >
          סיום המפגש
        </button>
      </dialog>
    </section>
  );
}
