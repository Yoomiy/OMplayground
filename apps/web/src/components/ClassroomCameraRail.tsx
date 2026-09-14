import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject
} from "react";
import { Crown, Grip, Hand, Mic, MicOff, Video as VideoIcon, VideoOff } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  DEFAULT_CAMERA_TILE_HEIGHT,
  MIN_CAMERA_TILE_HEIGHT,
  boardCameraRailBounds,
  cameraRailBounds,
  clampBoardCameraRailSize,
  clampCameraRailSize,
  clampNoBoardTileHeight,
  resolveBoardCameraLayout,
  resolveNoBoardCameraLayout,
  resolveSideCameraLayout,
  type CameraRailOrientation
} from "@/lib/classroomLayout";

export interface AttachableMediaTrack {
  attach(element: HTMLMediaElement): unknown;
  detach(element: HTMLMediaElement): unknown;
}

export interface ClassroomCameraParticipant {
  sid: string;
  identity: string;
  name: string;
  isHost: boolean;
  isMe: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isHandRaised: boolean;
  canUseMic: boolean;
  canUseCam: boolean;
  videoTrack?: AttachableMediaTrack;
  audioTrack?: AttachableMediaTrack;
}

interface ClassroomCameraRailProps {
  participants: ClassroomCameraParticipant[];
  activeSpeakerIdentities: ReadonlySet<string>;
  focusMode: boolean;
  isMainContentActive: boolean;
  stageRef: RefObject<HTMLDivElement>;
  stageWidth: number;
  stageHeight: number;
  viewerIsHost: boolean;
  onToggleMicPermission: (targetIdentity: string, currentAllowed: boolean) => void | Promise<void>;
  onToggleCamPermission: (targetIdentity: string, currentAllowed: boolean) => void | Promise<void>;
  onResizingChange: (resizing: boolean) => void;
}

interface CameraTileProps {
  participant: ClassroomCameraParticipant;
  isSpeaking: boolean;
  viewerIsHost: boolean;
  showNoBoardResizeHandle: boolean;
  noBoardResizeValue: number;
  noBoardResizeMaximum: number;
  onNoBoardResizeStart: (event: ReactPointerEvent<HTMLDivElement>) => void;
  onNoBoardResizeKeyDown: (event: ReactKeyboardEvent<HTMLDivElement>) => void;
  onResetNoBoardSize: () => void;
  onToggleMicPermission: (targetIdentity: string, currentAllowed: boolean) => void | Promise<void>;
  onToggleCamPermission: (targetIdentity: string, currentAllowed: boolean) => void | Promise<void>;
}

const CAMERA_TILE_STYLE: CSSProperties = {
  width: "var(--camera-tile-width)",
  height: "var(--camera-tile-height)"
};

export function attachMediaTrack(track: AttachableMediaTrack, element: HTMLMediaElement): () => void {
  track.attach(element);
  return () => {
    try {
      track.detach(element);
    } catch {
      // LiveKit may already have detached a track while the room is closing.
    }
  };
}

const AttachedVideo = memo(function AttachedVideo({ track }: { track: AttachableMediaTrack }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    return attachMediaTrack(track, video);
  }, [track]);

  return <video ref={videoRef} autoPlay playsInline className="h-full w-full object-cover" />;
});

const AttachedAudio = memo(function AttachedAudio({ track }: { track: AttachableMediaTrack }) {
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    return attachMediaTrack(track, audio);
  }, [track]);

  return <audio ref={audioRef} autoPlay />;
});

const CameraTile = memo(function CameraTile({
  participant,
  isSpeaking,
  viewerIsHost,
  showNoBoardResizeHandle,
  noBoardResizeValue,
  noBoardResizeMaximum,
  onNoBoardResizeStart,
  onNoBoardResizeKeyDown,
  onResetNoBoardSize,
  onToggleMicPermission,
  onToggleCamPermission
}: CameraTileProps) {
  return (
    <div
      className={cn(
        "relative aspect-video w-full shrink-0 overflow-hidden rounded-xl border bg-slate-100 shadow-sm transition-[border-color,box-shadow,background-color] duration-150 dark:bg-slate-900",
        isSpeaking
          ? "border-emerald-400 ring-2 ring-emerald-400/40"
          : participant.isHost
            ? "border-amber-500/60 ring-2 ring-amber-500/20"
            : "border-slate-200 dark:border-slate-800"
      )}
      style={CAMERA_TILE_STYLE}
    >
      {!participant.isVideoOff && participant.videoTrack ? (
        <AttachedVideo track={participant.videoTrack} />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-slate-400 dark:text-slate-500">
          <div className="flex size-10 items-center justify-center rounded-xl border border-slate-300 bg-slate-200 text-base font-black text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            {participant.name.charAt(0)}
          </div>
        </div>
      )}

      {!participant.isMe && participant.audioTrack && <AttachedAudio track={participant.audioTrack} />}

      <div className="pointer-events-none absolute right-1.5 top-1.5 z-10 flex items-center gap-1">
        {isSpeaking && (
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-emerald-400" />
          </span>
        )}
        <span className="flex items-center gap-1 rounded-md border border-slate-200/80 bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-800 shadow-sm backdrop-blur-md dark:border-transparent dark:bg-slate-950/80 dark:text-slate-200">
          {participant.name} {participant.isHost && <Crown className="inline size-3 text-amber-500 dark:text-amber-400" />}
        </span>

        <span className={cn(
          "rounded-md p-0.5 text-xs shadow-sm backdrop-blur-md",
          participant.isMuted
            ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400"
        )}>
          {participant.isMuted ? <MicOff className="size-3" /> : <Mic className="size-3" />}
        </span>
      </div>

      {participant.isHandRaised && (
        <div className="pointer-events-none absolute bottom-1.5 left-1/2 z-10 flex -translate-x-1/2 animate-bounce items-center justify-center gap-1 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black text-slate-950 shadow-lg">
          <Hand className="size-3 fill-slate-950" />
          <span>הרם/ה יד ✋</span>
        </div>
      )}

      {viewerIsHost && !participant.isMe && (
        <div className="absolute left-1.5 top-1.5 z-20 flex items-center gap-1 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md backdrop-blur-md dark:border-slate-700/80 dark:bg-slate-950/85">
          <button
            onClick={() => onToggleMicPermission(participant.identity, participant.canUseMic)}
            title={participant.canUseMic ? "הרשאת מיקרופון פעילה - לחץ לחסימה" : "מיקרופון חסום - לחץ להרשאה"}
            className={cn(
              "rounded p-1 text-xs transition-colors duration-150",
              participant.canUseMic
                ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                : "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/20"
            )}
          >
            {participant.canUseMic ? <Mic className="size-3" /> : <MicOff className="size-3" />}
          </button>

          <button
            onClick={() => onToggleCamPermission(participant.identity, participant.canUseCam)}
            title={participant.canUseCam ? "הרשאת מצלמה פעילה - לחץ לחסימה" : "מצלמה חסומה - לחץ להרשאה"}
            className={cn(
              "rounded p-1 text-xs transition-colors duration-150",
              participant.canUseCam
                ? "text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
                : "text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/20"
            )}
          >
            {participant.canUseCam ? <VideoIcon className="size-3" /> : <VideoOff className="size-3" />}
          </button>
        </div>
      )}

      {showNoBoardResizeHandle && (
        <div
          role="slider"
          tabIndex={0}
          aria-label="שנה את גודל אריחי המצלמות"
          aria-valuemin={MIN_CAMERA_TILE_HEIGHT}
          aria-valuemax={noBoardResizeMaximum}
          aria-valuenow={noBoardResizeValue}
          onPointerDown={onNoBoardResizeStart}
          onKeyDown={onNoBoardResizeKeyDown}
          onDoubleClick={onResetNoBoardSize}
          title="גררו לשינוי גודל כל המצלמות. לחיצה כפולה מחזירה לברירת המחדל."
          className="absolute bottom-0 left-0 z-30 flex size-8 touch-none select-none cursor-nesw-resize items-end justify-start rounded-tr-xl bg-white/90 p-1 text-slate-600 shadow-sm outline-none transition-colors hover:bg-indigo-50 hover:text-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 dark:bg-slate-950/85 dark:text-slate-300 dark:hover:bg-indigo-500/20 dark:hover:text-indigo-200"
        >
          <Grip className="size-4 -rotate-45" />
        </div>
      )}
    </div>
  );
});

type CameraRailStyle = CSSProperties & {
  "--camera-tile-width": string;
  "--camera-tile-height": string;
};

export const ClassroomCameraRail = memo(function ClassroomCameraRail({
  participants,
  activeSpeakerIdentities,
  focusMode,
  isMainContentActive,
  stageRef,
  stageWidth,
  stageHeight,
  viewerIsHost,
  onToggleMicPermission,
  onToggleCamPermission,
  onResizingChange
}: ClassroomCameraRailProps) {
  const [customCameraRailSize, setCustomCameraRailSize] = useState<number | null>(null);
  const [noBoardTileHeight, setNoBoardTileHeight] = useState(DEFAULT_CAMERA_TILE_HEIGHT);
  const cameraResizeFrameRef = useRef<number | null>(null);
  const pendingCameraResizeRef = useRef<(() => void) | null>(null);
  const previousMainContentActiveRef = useRef(isMainContentActive);

  const cameraOrientation: CameraRailOrientation = focusMode && isMainContentActive ? "side" : "top";
  const cameraLayout = !isMainContentActive
    ? resolveNoBoardCameraLayout({
        availableWidth: stageWidth,
        availableHeight: stageHeight,
        participantCount: participants.length,
        requestedTileHeight: noBoardTileHeight
      })
    : cameraOrientation === "side"
      ? resolveSideCameraLayout({
          availableWidth: stageWidth,
          participantCount: participants.length,
          requestedWidth: customCameraRailSize
        })
      : resolveBoardCameraLayout({
          availableWidth: stageWidth,
          availableHeight: stageHeight,
          participantCount: participants.length,
          requestedHeight: customCameraRailSize
        });
  const cameraRailAvailable = cameraOrientation === "side" ? stageWidth : stageHeight;
  const cameraRailSize = cameraLayout.gridSize;
  const cameraLayoutRef = useRef(cameraLayout);
  cameraLayoutRef.current = cameraLayout;
  const cameraRailLimits = cameraOrientation === "side"
    ? cameraRailBounds(cameraRailAvailable, "side")
    : boardCameraRailBounds({
        availableWidth: stageWidth,
        availableHeight: stageHeight,
        participantCount: participants.length
      });
  const noBoardResizeMaximum = clampNoBoardTileHeight(Number.MAX_SAFE_INTEGER, stageHeight, stageWidth);

  const railStyle = useMemo(() => {
    const style: CameraRailStyle = {
      "--camera-tile-width": `${cameraLayout.tileWidth}px`,
      "--camera-tile-height": `${cameraLayout.tileHeight}px`
    };
    if (focusMode && isMainContentActive) {
      style.flexBasis = `${cameraRailSize}px`;
    } else {
      style.flexBasis = isMainContentActive ? `${cameraRailSize}px` : undefined;
      style.gridTemplateColumns = `repeat(${cameraLayout.columns}, var(--camera-tile-width))`;
      style.gridAutoRows = "var(--camera-tile-height)";
    }
    return style;
  }, [cameraLayout.columns, cameraLayout.tileHeight, cameraLayout.tileWidth, cameraRailSize, focusMode, isMainContentActive]);

  useEffect(() => () => {
    if (cameraResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraResizeFrameRef.current);
    }
  }, []);

  useEffect(() => {
    if (isMainContentActive && !previousMainContentActiveRef.current) {
      setNoBoardTileHeight(DEFAULT_CAMERA_TILE_HEIGHT);
      setCustomCameraRailSize(null);
    }
    previousMainContentActiveRef.current = isMainContentActive;
  }, [isMainContentActive]);

  useEffect(() => {
    if (!isMainContentActive || focusMode) return;
    setCustomCameraRailSize((current) => current == null
      ? null
      : clampBoardCameraRailSize(current, {
          availableWidth: stageWidth,
          availableHeight: stageHeight,
          participantCount: participants.length
        }));
  }, [focusMode, isMainContentActive, participants.length, stageHeight, stageWidth]);

  const queueCameraResizeUpdate = useCallback((update: () => void) => {
    pendingCameraResizeRef.current = update;
    if (cameraResizeFrameRef.current !== null) return;
    cameraResizeFrameRef.current = window.requestAnimationFrame(() => {
      cameraResizeFrameRef.current = null;
      const pendingUpdate = pendingCameraResizeRef.current;
      pendingCameraResizeRef.current = null;
      pendingUpdate?.();
    });
  }, []);

  const flushCameraResizeUpdate = useCallback(() => {
    if (cameraResizeFrameRef.current !== null) {
      window.cancelAnimationFrame(cameraResizeFrameRef.current);
      cameraResizeFrameRef.current = null;
    }
    const pendingUpdate = pendingCameraResizeRef.current;
    pendingCameraResizeRef.current = null;
    pendingUpdate?.();
  }, []);

  const setCameraRailFromPointer = useCallback((clientX: number, clientY: number) => {
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const available = cameraOrientation === "side" ? rect.width : rect.height;
    const requested = cameraOrientation === "side" ? rect.right - clientX : clientY - rect.top;
    queueCameraResizeUpdate(() => {
      setCustomCameraRailSize(cameraOrientation === "side"
        ? clampCameraRailSize(requested, available, "side")
        : clampBoardCameraRailSize(requested, {
            availableWidth: rect.width,
            availableHeight: rect.height,
            participantCount: participants.length
          }));
    });
  }, [cameraOrientation, participants.length, queueCameraResizeUpdate, stageRef]);

  const beginCameraResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (!isMainContentActive) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onResizingChange(true);
    setCameraRailFromPointer(event.clientX, event.clientY);
    const onMove = (moveEvent: PointerEvent) => setCameraRailFromPointer(moveEvent.clientX, moveEvent.clientY);
    const onEnd = () => {
      flushCameraResizeUpdate();
      onResizingChange(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd, { once: true });
    document.addEventListener("pointercancel", onEnd, { once: true });
  }, [flushCameraResizeUpdate, isMainContentActive, onResizingChange, setCameraRailFromPointer]);

  const resizeCameraWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    const decreaseKey = cameraOrientation === "side" ? "ArrowRight" : "ArrowUp";
    const increaseKey = cameraOrientation === "side" ? "ArrowLeft" : "ArrowDown";
    if (event.key !== decreaseKey && event.key !== increaseKey) return;
    event.preventDefault();
    const step = event.shiftKey ? 24 : 8;
    const direction = event.key === increaseKey ? 1 : -1;
    const requested = cameraRailSize + direction * step;
    setCustomCameraRailSize(cameraOrientation === "side"
      ? clampCameraRailSize(requested, cameraRailAvailable, "side")
      : clampBoardCameraRailSize(requested, {
          availableWidth: stageWidth,
          availableHeight: stageHeight,
          participantCount: participants.length
        }));
  }, [cameraOrientation, cameraRailAvailable, cameraRailSize, participants.length, stageHeight, stageWidth]);

  const beginNoBoardTileResize = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMainContentActive) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    onResizingChange(true);
    const startX = event.clientX;
    const startHeight = cameraLayoutRef.current.tileHeight;
    const updateFromPointer = (clientX: number) => {
      const horizontalDelta = startX - clientX;
      const nextHeight = clampNoBoardTileHeight(
        startHeight + horizontalDelta * 9 / 16,
        stageHeight,
        stageWidth
      );
      queueCameraResizeUpdate(() => setNoBoardTileHeight(nextHeight));
    };
    const onMove = (moveEvent: PointerEvent) => updateFromPointer(moveEvent.clientX);
    const onEnd = () => {
      flushCameraResizeUpdate();
      onResizingChange(false);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onEnd);
      document.removeEventListener("pointercancel", onEnd);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onEnd, { once: true });
    document.addEventListener("pointercancel", onEnd, { once: true });
  }, [flushCameraResizeUpdate, isMainContentActive, onResizingChange, queueCameraResizeUpdate, stageHeight, stageWidth]);

  const resizeNoBoardTileWithKeyboard = useCallback((event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
    event.preventDefault();
    const step = event.shiftKey ? 24 : 8;
    const increase = event.key === "ArrowLeft" || event.key === "ArrowUp";
    setNoBoardTileHeight((current) => clampNoBoardTileHeight(
      current + (increase ? step : -step),
      stageHeight,
      stageWidth
    ));
  }, [stageHeight, stageWidth]);

  const resetNoBoardSize = useCallback(() => setNoBoardTileHeight(DEFAULT_CAMERA_TILE_HEIGHT), []);
  const resetCameraRailSize = useCallback(() => setCustomCameraRailSize(null), []);

  return (
    <>
      <div
        className={cn(
          "min-h-0 min-w-0 shrink-0 gap-2 overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200 bg-slate-200/50 p-1.5 shadow-sm dark:border-slate-800/60 dark:bg-slate-900/40",
          focusMode && isMainContentActive
            ? "flex flex-col justify-start"
            : "grid content-start items-start [justify-content:start]",
          !isMainContentActive && "flex-1"
        )}
        style={railStyle}
      >
        {participants.map((participant, participantIndex) => (
          <CameraTile
            key={participant.sid}
            participant={participant}
            isSpeaking={activeSpeakerIdentities.has(participant.identity)}
            viewerIsHost={viewerIsHost}
            showNoBoardResizeHandle={!isMainContentActive && participantIndex === 0}
            noBoardResizeValue={!isMainContentActive && participantIndex === 0 ? Math.round(cameraLayout.tileHeight) : 0}
            noBoardResizeMaximum={!isMainContentActive && participantIndex === 0 ? noBoardResizeMaximum : 0}
            onNoBoardResizeStart={beginNoBoardTileResize}
            onNoBoardResizeKeyDown={resizeNoBoardTileWithKeyboard}
            onResetNoBoardSize={resetNoBoardSize}
            onToggleMicPermission={onToggleMicPermission}
            onToggleCamPermission={onToggleCamPermission}
          />
        ))}
      </div>

      {isMainContentActive && (
        <div
          role="separator"
          tabIndex={0}
          aria-label="שנה את גודל אזור המצלמות"
          aria-orientation={cameraOrientation === "side" ? "vertical" : "horizontal"}
          aria-valuemin={cameraRailLimits.min}
          aria-valuemax={cameraRailLimits.max}
          aria-valuenow={cameraRailSize}
          onPointerDown={beginCameraResize}
          onKeyDown={resizeCameraWithKeyboard}
          onDoubleClick={resetCameraRailSize}
          title="גררו לשינוי גודל המצלמות. לחיצה כפולה מחזירה לגודל אוטומטי."
          className={cn(
            "group flex shrink-0 touch-none select-none items-center justify-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-indigo-500",
            cameraOrientation === "side" ? "w-3 cursor-col-resize" : "h-3 cursor-row-resize"
          )}
        >
          <span className={cn(
            "block rounded-full bg-slate-300 transition-colors group-hover:bg-indigo-400 dark:bg-slate-700 dark:group-hover:bg-indigo-400",
            cameraOrientation === "side" ? "h-10 w-1" : "h-1 w-10"
          )} />
        </div>
      )}
    </>
  );
});
