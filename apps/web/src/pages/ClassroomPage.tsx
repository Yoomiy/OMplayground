import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { DisconnectReason, Room, RoomEvent, Participant, Track } from "livekit-client";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import { reportTelemetry } from "@/utils/telemetry";
import { getCorrelationId } from "@/utils/correlation";
import { DrawingBoard, type DrawingBoardHandle } from "@/games/drawing/DrawingBoard";
import {
  ClassroomPresentationPublisher,
  type ClassroomMediaUploadStatus,
  type ClassroomPresentationPublisherHandle
} from "@/components/ClassroomPresentationPublisher";
import { ClassroomPresentationReceiver } from "@/components/ClassroomPresentationReceiver";
import { clearClassroomLibrary } from "@/lib/classroomMediaLibrary";

function gameServerUrl(): string {
  const fromEnv = import.meta.env.VITE_GAME_SERVER_URL?.trim();
  if (fromEnv) return fromEnv;
  if (import.meta.env.DEV && typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:8080";
}
import { cn } from "@/lib/cn";
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  Monitor,
  MonitorOff,
  Hand,
  MessageSquare,
  Users,
  Shield,
  LogOut,
  Copy,
  Check,
  Crown,
  UserX,
  AlertCircle,
  Radio,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Sparkles,
  Trash2,
  Upload
} from "lucide-react";

interface ClassroomSessionData {
  id: string;
  title: string;
  teacher_id: string | null;
  teacher_name: string;
  room_code: string;
  status: string;
  settings: {
    allowStudentMic?: boolean;
    allowStudentCam?: boolean;
    allowStudentChat?: boolean;
    allowStudentScreenShare?: boolean;
    allowWhiteboardDraw?: boolean;
    whiteboardVisible?: boolean;
    presentationPercent?: number;
    presentationPresenterIdentity?: string | null;
    presentationPresenterEpoch?: number;
    presentationVisible?: boolean;
    presentationTitle?: string | null;
  };
  whiteboard_data?: any;
}

interface ChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestamp: number;
  isHost?: boolean;
}

interface CustomParticipantInfo {
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
  screenTrack?: any;
  screenAudioTrack?: any;
  presentationTrack?: any;
  presentationAudioTrack?: any;
  videoTrack?: any;
  audioTrack?: any;
}

const HOST_CONTROL_MESSAGE_TYPES = new Set([
  "TOGGLE_BOARD",
  "KICK",
  "SET_PARTICIPANT_PERMISSIONS",
  "SET_ALL_PERMISSIONS"
]);

function participantIsHost(participant?: Participant): boolean {
  if (!participant) return false;
  try {
    return JSON.parse(participant.metadata || "{}").isHost === true;
  } catch {
    return false;
  }
}

function presenterSessionKey(roomCode: string): string {
  return `classroom-presenter:${roomCode}`;
}

function readPresenterSessionToken(roomCode: string): string | null {
  try { return window.sessionStorage.getItem(presenterSessionKey(roomCode)); } catch { return null; }
}

function writePresenterSessionToken(roomCode: string, token: string | null) {
  try {
    if (token) window.sessionStorage.setItem(presenterSessionKey(roomCode), token);
    else window.sessionStorage.removeItem(presenterSessionKey(roomCode));
  } catch {}
}

function guestAttendanceStorageKey(roomCode: string, displayName: string): string {
  return `classroom-attendance:${roomCode}:${displayName.trim().toLocaleLowerCase()}`;
}

function getGuestAttendanceKey(roomCode: string, displayName: string): string {
  const key = guestAttendanceStorageKey(roomCode, displayName);
  try {
    const existing = window.localStorage.getItem(key);
    if (existing) return existing;
    const value = crypto.randomUUID();
    window.localStorage.setItem(key, value);
    return value;
  } catch {
    return crypto.randomUUID();
  }
}

export function ClassroomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();
  const { isAdmin } = useIsAdmin();

  // SECURITY & PERFORMANCE: Only evaluate admin check if URL explicitly requests spectate mode
  const rawSpectateMode = searchParams.get("spectate") as "invisible" | "visible" | null;
  const isRealAdmin = Boolean(rawSpectateMode && (isAdmin || (profile?.role as string) === "admin"));
  const spectateMode = isRealAdmin ? rawSpectateMode : null;
  const isStealthAdmin = isRealAdmin && spectateMode === "invisible";
  const canManageClassroom = profile?.role === "teacher" || isAdmin;

  // Classroom Session DB metadata
  const [sessionData, setSessionData] = useState<ClassroomSessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Guest name input state if unauthenticated
  const [guestName, setGuestName] = useState("");

  // Auto-fill display name if user is logged in
  const resolvedDisplayName = useMemo(() => {
    if (user) {
      return (profile?.full_name || profile?.username || user.email || "משתמש").trim();
    }
    return guestName.trim();
  }, [user, profile, guestName]);

  // LiveKit Connection & Room state
  const [room, setRoom] = useState<Room | null>(null);
  const roomRef = useRef<Room | null>(null);
  const isEndingClassroomRef = useRef(false);
  const [connState, setConnState] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [connError, setConnError] = useState<string | null>(null);
  const [classroomNotice, setClassroomNotice] = useState<{ text: string; type: "info" | "success" | "warn" } | null>(null);
  const [kickTarget, setKickTarget] = useState<CustomParticipantInfo | null>(null);
  const [isKicking, setIsKicking] = useState(false);

  useEffect(() => {
    if (!classroomNotice) return;
    const timer = window.setTimeout(() => setClassroomNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [classroomNotice]);

  // User Local Media & Permissions state
  const [isHost, setIsHost] = useState(false);
  const [isDelegatedHost, setIsDelegatedHost] = useState(false);
  const [classroomBoardToken, setClassroomBoardToken] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [canUseMic, setCanUseMic] = useState(true);
  const [canUseCam, setCanUseCam] = useState(true);
  const [individualPermissions, setIndividualPermissions] = useState<Record<string, { allowMic: boolean; allowCam: boolean }>>({});
  const individualPermissionsRef = useRef<Record<string, { allowMic: boolean; allowCam: boolean }>>({});
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

  useEffect(() => {
    individualPermissionsRef.current = individualPermissions;
  }, [individualPermissions]);

  // Layout & Visibility Options
  const [focusMode, setFocusMode] = useState(false); // Vertical cameras layout on side
  const [showBoard, setShowBoard] = useState(true); // Toggle board visibility
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Participants & Data Stream state
  const [participants, setParticipants] = useState<CustomParticipantInfo[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [screenShareParticipant, setScreenShareParticipant] = useState<CustomParticipantInfo | null>(null);
  const [presentationParticipant, setPresentationParticipant] = useState<CustomParticipantInfo | null>(null);
  const [presentationTitle, setPresentationTitle] = useState<string | null>(null);
  const [presentationActive, setPresentationActive] = useState(false);
  const [localPresentationLoaded, setLocalPresentationLoaded] = useState(false);
  const [localPresentationLibraryReady, setLocalPresentationLibraryReady] = useState(false);
  const [mediaUploadStatus, setMediaUploadStatus] = useState<ClassroomMediaUploadStatus | null>(null);
  const [classroomSessionId, setClassroomSessionId] = useState<string | null>(null);
  const [presenterIdentity, setPresenterIdentity] = useState<string | null>(null);
  const [presenterEpoch, setPresenterEpoch] = useState(0);
  const [presenterToken, setPresenterToken] = useState<string | null>(null);
  const [isClassCreator, setIsClassCreator] = useState(false);
  const presenterIdentityRef = useRef<string | null>(null);
  const presenterEpochRef = useRef(0);
  const presentationPublisherRef = useRef<ClassroomPresentationPublisherHandle>(null);
  const drawingBoardRef = useRef<DrawingBoardHandle>(null);
  const presenterTokenRef = useRef<string | null>(null);
  const [stageSplitPercent, setStageSplitPercent] = useState(60);

  useEffect(() => { presenterIdentityRef.current = presenterIdentity; }, [presenterIdentity]);
  useEffect(() => { presenterEpochRef.current = presenterEpoch; }, [presenterEpoch]);
  useEffect(() => { presenterTokenRef.current = presenterToken; }, [presenterToken]);

  useEffect(() => {
    if (!mediaUploadStatus || mediaUploadStatus.state === "preparing") return;
    const timer = window.setTimeout(() => setMediaUploadStatus(null), 8000);
    return () => window.clearTimeout(timer);
  }, [mediaUploadStatus]);

  // Under-the-hood Draw Game Room (Socket.io) for Whiteboard Syncing
  const [drawSessionId, setDrawSessionId] = useState<string | null>(null);
  const drawSocketRef = useRef<Socket | null>(null);
  const [drawSocketReady, setDrawSocketReady] = useState(false);
  const [boardInitialYjsUpdate, setBoardInitialYjsUpdate] = useState<string | null>(null);
  const [boardInitialYjsSyncToken, setBoardInitialYjsSyncToken] = useState<string | null>(null);
  const [boardInitialViewport, setBoardInitialViewport] = useState<{ scrollX: number; scrollY: number; zoom: number } | null>(null);

  const deltaListenersRef = useRef<Set<(payload: any) => void>>(new Set());

  const subscribeLiveDeltas = useCallback((cb: (payload: any) => void) => {
    deltaListenersRef.current.add(cb);
    return () => {
      deltaListenersRef.current.delete(cb);
    };
  }, []);

  // Room Level Dynamic Settings (Controlled by Host)
  const [roomSettings, setRoomSettings] = useState({
    allowStudentChat: true,
    allowStudentScreenShare: false,
    allowStudentMic: true,
    allowStudentCam: true,
    allowWhiteboardDraw: false, // By default only host can draw on board
    whiteboardVisible: true
  });

  // In-Room Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recentReaction, setRecentReaction] = useState<{ emoji: string; name: string } | null>(null);

  // Ephemeral Whiteboard State (Using drawingModule structure)
  const [whiteboardState, setWhiteboardState] = useState<any>({
    status: "playing",
    seats: {},
    canvas: { engine: "excalidraw", version: 0, clearVersion: 0, updatedAt: Date.now(), elements: [], files: {} }
  });

  // Connect socket to game-server when drawSessionId is ready and connected to classroom room
  useEffect(() => {
    setDrawSocketReady(false);
    setBoardInitialYjsUpdate(null);
    setBoardInitialYjsSyncToken(null);
    setBoardInitialViewport(null);
    if (!drawSessionId || connState !== "connected" || !classroomBoardToken) return;
    let cancelled = false;
    let s: Socket | null = null;

    void (async () => {
      if (cancelled) return;

      reportTelemetry(
        {
          level: "info",
          message: "Classroom drawgame socket connecting",
          sessionId: drawSessionId,
          context: {
            appArea: "classroom",
            event: "CLASSROOM_DRAW_SOCKET_CONNECTING",
            roomCode,
            isGuest: !user?.id
          }
        },
        "game-server"
      );

      s = io(gameServerUrl(), {
        auth: { token: `classroom-board:${classroomBoardToken}`, correlationId: getCorrelationId() },
        transports: ["websocket", "polling"]
      });
      drawSocketRef.current = s;

      s.on("connect", () => {
        if (cancelled) return;
        setBoardInitialYjsUpdate(null);
        setBoardInitialYjsSyncToken(null);
        reportTelemetry(
          {
            level: "info",
            message: "Classroom drawgame socket connected",
            sessionId: drawSessionId,
            context: {
              appArea: "classroom",
              event: "CLASSROOM_DRAW_SOCKET_CONNECTED",
              roomCode
            }
          },
          "game-server"
        );

        s?.emit("JOIN_ROOM", { sessionId: drawSessionId }, (reply: any) => {
          if (!reply?.ok) {
            console.warn("Failed to join classroom drawgame room:", reply?.error);
            reportTelemetry(
              {
                level: "warn",
                message: "Classroom drawgame JOIN_ROOM failed",
                sessionId: drawSessionId,
                context: {
                  appArea: "classroom",
                  event: "CLASSROOM_DRAW_JOIN_FAILED",
                  error: reply?.error
                }
              },
              "game-server"
            );
            setConnError("לא ניתן להתחבר ללוח השיעור.");
          }
        });
      });

      s.on("connect_error", (err) => {
        setDrawSocketReady(false);
        reportTelemetry(
          {
            level: "warn",
            message: "Classroom drawgame socket connect error",
            sessionId: drawSessionId,
            context: {
              appArea: "classroom",
              event: "CLASSROOM_DRAW_SOCKET_ERROR",
              error: err.message
            }
          },
          "game-server"
        );
      });

      s.on("ROOM_SNAPSHOT", (snapshot: any) => {
        if (cancelled) return;
        if (snapshot?.gameState) {
          setWhiteboardState(snapshot.gameState);
        }
      });

      s.on("DRAWING_SYNC", (payload: { sessionId?: string; yjsUpdate?: string; syncToken?: string; viewport?: { scrollX: number; scrollY: number; zoom: number } }) => {
        if (cancelled || payload?.sessionId !== drawSessionId || typeof payload.yjsUpdate !== "string") return;
        setBoardInitialYjsUpdate(payload.yjsUpdate);
        setBoardInitialYjsSyncToken(typeof payload.syncToken === "string" ? payload.syncToken : null);
        setBoardInitialViewport(payload.viewport ?? null);
        setDrawSocketReady(true);
      });

      s.on("disconnect", () => {
        if (cancelled) return;
        setBoardInitialYjsUpdate(null);
        setBoardInitialYjsSyncToken(null);
      });

      s.on("LIVE_DELTA", (payload: { from?: string; delta?: any }) => {
        if (cancelled) return;
        deltaListenersRef.current.forEach((cb) => {
          cb(payload);
        });
      });

      s.on("LIVE_DELTA_REJECTED", (payload: { code?: string }) => {
        if (cancelled || payload?.code !== "WHITEBOARD_EDIT_FORBIDDEN") return;
        setConnError("הציור בלוח אינו מורשה עבור משתמש זה.");
      });
    })();

    return () => {
      cancelled = true;
      if (s) {
        s.disconnect();
        drawSocketRef.current = null;
      }
      setDrawSocketReady(false);
      setBoardInitialYjsUpdate(null);
      setBoardInitialYjsSyncToken(null);
      setBoardInitialViewport(null);
    };
  }, [classroomBoardToken, connState, drawSessionId, roomCode, user?.id]);


  // Fetch classroom metadata. The drawing session socket is the source of whiteboard state.
  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    async function loadSession() {
      setLoadingSession(true);
      const { data, error } = await supabase
        .from("classroom_sessions")
        .select("*")
        .eq("room_code", roomCode)
        .maybeSingle();

      if (cancelled) return;
      if (error || !data) {
        setSessionError("הכיתה הווירטואלית לא נמצאה או שהיא בוטלה.");
        setLoadingSession(false);
        return;
      }
      if (data.status === "ended") {
        navigate("/classroom-ended", { replace: true });
        setLoadingSession(false);
        return;
      }

      setSessionData(data as ClassroomSessionData);
      if (data.settings) {
        setRoomSettings((prev) => ({ ...prev, ...data.settings }));
        if (typeof data.settings.whiteboardVisible === "boolean") {
          setShowBoard(data.settings.whiteboardVisible);
        }
        if (Number.isFinite(data.settings.presentationPercent)) {
          setStageSplitPercent(Math.max(30, Math.min(70, Number(data.settings.presentationPercent))));
        }
        setPresenterIdentity(typeof data.settings.presentationPresenterIdentity === "string" ? data.settings.presentationPresenterIdentity : null);
        setPresenterEpoch(Number.isInteger(data.settings.presentationPresenterEpoch) ? Number(data.settings.presentationPresenterEpoch) : 0);
        setPresentationActive(data.settings.presentationVisible === true);
        setPresentationTitle(typeof data.settings.presentationTitle === "string" ? data.settings.presentationTitle : null);
      }
      setLoadingSession(false);
    }

    void loadSession();
    return () => {
      cancelled = true;
    };
  }, [roomCode]);

  // Realtime subscription for session ending / setting changes
  useEffect(() => {
    if (!roomCode) return;
    const ch = supabase
      .channel(`classroom-room-${roomCode}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "classroom_sessions",
          filter: `room_code=eq.${roomCode}`
        },
        (payload) => {
          const updated = payload.new as ClassroomSessionData;
          if (updated.status === "ended") {
            void clearClassroomLibrary(updated.id).catch(() => {});
            writePresenterSessionToken(roomCode, null);
            setConnError("השיעור הופסק על ידי המורה.");
            roomRef.current?.disconnect();
            roomRef.current = null;
            setRoom(null);
            setConnState("disconnected");
            setMicOn(false);
            setCamOn(false);
            setIsScreenSharing(false);
            if (!isEndingClassroomRef.current) navigate("/classroom-ended", { replace: true });
          } else if (updated.settings) {
            setRoomSettings((prev) => ({ ...prev, ...updated.settings }));
            if (typeof updated.settings.whiteboardVisible === "boolean") {
              setShowBoard(updated.settings.whiteboardVisible);
            }
            setPresenterIdentity(typeof updated.settings.presentationPresenterIdentity === "string" ? updated.settings.presentationPresenterIdentity : null);
            setPresenterEpoch(Number.isInteger(updated.settings.presentationPresenterEpoch) ? Number(updated.settings.presentationPresenterEpoch) : 0);
            setPresentationActive(updated.settings.presentationVisible === true);
            setPresentationTitle(typeof updated.settings.presentationTitle === "string" ? updated.settings.presentationTitle : null);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(ch);
    };
  }, [roomCode]);

  // Handle participant updates in room (TEACHER ALWAYS FIRST)
  const updateParticipantList = useCallback((lkRoom: Room) => {
    const list: CustomParticipantInfo[] = [];

    // Local participant
    const local = lkRoom.localParticipant;
    let localScreenTrack: any = null;
    let localScreenAudioTrack: any = null;
    let localPresentationTrack: any = null;
    let localPresentationAudioTrack: any = null;
    let localVideoTrack: any = null;
    let localAudioTrack: any = null;

    local.trackPublications.forEach((pub) => {
      if (pub.trackName === "classroom-presentation-video" && pub.track) {
        localPresentationTrack = pub.track;
      } else if (pub.trackName === "classroom-presentation-audio" && pub.track) {
        localPresentationAudioTrack = pub.track;
      } else if (
        pub.source === Track.Source.ScreenShare &&
        pub.track &&
        !pub.isMuted &&
        pub.track.mediaStreamTrack?.readyState !== "ended"
      ) {
        localScreenTrack = pub.track;
      } else if (pub.source === Track.Source.ScreenShareAudio && pub.track) {
        localScreenAudioTrack = pub.track;
      } else if (pub.source === Track.Source.Camera && pub.track) {
        localVideoTrack = pub.track;
      } else if (pub.source === Track.Source.Microphone && pub.track) {
        localAudioTrack = pub.track;
      }
    });

    let localMetadata: any = {};
    try {
      localMetadata = JSON.parse(local.metadata || "{}");
    } catch {}

    // Skip stealth invisible admin from participant list & grid
    if (!localMetadata.hidden && !isStealthAdmin) {
      const localIsHost = localMetadata.isHost === true;
      const localPerm = individualPermissionsRef.current[local.identity] ?? { allowMic: true, allowCam: true };
      list.push({
        sid: local.sid,
        identity: local.identity,
        name: local.name || "אני",
        isHost: localIsHost,
        isMe: true,
        isMuted: !local.isMicrophoneEnabled,
        isVideoOff: !local.isCameraEnabled,
        isHandRaised: Boolean(localMetadata.handRaised),
        canUseMic: localIsHost || localPerm.allowMic !== false,
        canUseCam: localIsHost || localPerm.allowCam !== false,
        screenTrack: localScreenTrack,
        screenAudioTrack: localScreenAudioTrack,
        presentationTrack: localPresentationTrack,
        presentationAudioTrack: localPresentationAudioTrack,
        videoTrack: localVideoTrack,
        audioTrack: localAudioTrack
      });
    }

    // Remote participants
    lkRoom.remoteParticipants.forEach((p) => {
      let pScreenTrack: any = null;
      let pScreenAudioTrack: any = null;
      let pPresentationTrack: any = null;
      let pPresentationAudioTrack: any = null;
      let pVideoTrack: any = null;
      let pAudioTrack: any = null;

      p.trackPublications.forEach((pub) => {
        if (pub.trackName === "classroom-presentation-video" && pub.track) {
          pPresentationTrack = pub.track;
        } else if (pub.trackName === "classroom-presentation-audio" && pub.track) {
          pPresentationAudioTrack = pub.track;
        } else if (
          pub.source === Track.Source.ScreenShare &&
          pub.track &&
          !pub.isMuted &&
          pub.track.mediaStreamTrack?.readyState !== "ended"
        ) {
          pScreenTrack = pub.track;
        } else if (pub.source === Track.Source.ScreenShareAudio && pub.track) {
          pScreenAudioTrack = pub.track;
        } else if (pub.source === Track.Source.Camera && pub.track) {
          pVideoTrack = pub.track;
        } else if (pub.source === Track.Source.Microphone && pub.track) {
          pAudioTrack = pub.track;
        }
      });

      let pMetadata: any = {};
      try {
        pMetadata = JSON.parse(p.metadata || "{}");
      } catch {}

      // Skip stealth invisible admin from remote participants
      if (
        pMetadata.hidden === true ||
        pMetadata.spectateMode === "invisible" ||
        (p.permissions as any)?.hidden === true ||
        (pMetadata.role === "admin" && pMetadata.hidden)
      ) {
        return;
      }

      const pIsHost = Boolean(pMetadata.isHost);
      const pPerm = individualPermissionsRef.current[p.identity] ?? { allowMic: true, allowCam: true };
      list.push({
        sid: p.sid,
        identity: p.identity,
        name: p.name || p.identity,
        isHost: pIsHost,
        isMe: false,
        isMuted: !p.isMicrophoneEnabled,
        isVideoOff: !p.isCameraEnabled,
        isHandRaised: Boolean(pMetadata.handRaised),
        canUseMic: pIsHost || pPerm.allowMic !== false,
        canUseCam: pIsHost || pPerm.allowCam !== false,
        screenTrack: pScreenTrack,
        screenAudioTrack: pScreenAudioTrack,
        presentationTrack: pPresentationTrack,
        presentationAudioTrack: pPresentationAudioTrack,
        videoTrack: pVideoTrack,
        audioTrack: pAudioTrack
      });
    });

    // SORT: TEACHER / HOST ALWAYS FIRST IN TOP ROW
    list.sort((a, b) => {
      if (a.isHost && !b.isHost) return -1;
      if (!a.isHost && b.isHost) return 1;
      return a.name.localeCompare(b.name);
    });

    setParticipants(list);

    // Find screen share participant
    const screenSharing = list.find((p) => p.screenTrack != null);
    setScreenShareParticipant(screenSharing || null);
    const presenting = list.find((p) => p.identity === presenterIdentityRef.current && p.presentationTrack != null);
    setPresentationParticipant(presenting || null);
  }, [isStealthAdmin]);

  // Connect to LiveKit Room
  const connectToRoom = async () => {
    if (!roomCode) return;
    setConnState("connecting");
    setConnError(null);
    setDrawSessionId(null);
    setClassroomBoardToken(null);

    if (!resolvedDisplayName) {
      setConnError("נא להזין שם תצוגה לפני ההתחברות.");
      setConnState("disconnected");
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${getVoxelServerUrl()}/rtc/classroom-token`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "x-correlation-id": getCorrelationId(),
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          roomCode,
          displayName: resolvedDisplayName,
          spectateMode: spectateMode ?? undefined,
          presenterToken: readPresenterSessionToken(roomCode) ?? undefined,
          guestAttendanceKey: user ? undefined : getGuestAttendanceKey(roomCode, resolvedDisplayName)
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.message || "ההתחברות לחדר הוידאו נכשלה.";
        reportTelemetry({
          level: "warn",
          message: "Classroom LiveKit token request failed",
          sessionId: roomCode,
          context: { event: "CLASSROOM_TOKEN_FAILED", roomCode, error: errMsg }
        }, "voxel-server");
        throw new Error(errMsg);
      }

      const {
        token,
        serverUrl,
        isHost: tokenIsHost,
        role,
        isDelegate,
        canPublishMicrophone,
        canPublishCamera,
        classroomBoardToken: issuedClassroomBoardToken,
        classroomSessionId: issuedClassroomSessionId,
        drawingSessionId: issuedDrawingSessionId,
        isClassCreator: issuedIsClassCreator,
        presenterIdentity: issuedPresenterIdentity,
        presenterEpoch: issuedPresenterEpoch,
        presentationVisible: issuedPresentationVisible,
        presentationTitle: issuedPresentationTitle,
        presenterToken: issuedPresenterToken
      } = await response.json();
      setIsDelegatedHost(Boolean(isDelegate));
      setClassroomBoardToken(
        typeof issuedClassroomBoardToken === "string" ? issuedClassroomBoardToken : null
      );
      setDrawSessionId(typeof issuedDrawingSessionId === "string" ? issuedDrawingSessionId : null);
      setClassroomSessionId(issuedClassroomSessionId || sessionData?.id || null);
      setIsClassCreator(Boolean(issuedIsClassCreator));
      setPresenterIdentity(typeof issuedPresenterIdentity === "string" ? issuedPresenterIdentity : null);
      setPresenterEpoch(Number.isInteger(issuedPresenterEpoch) ? issuedPresenterEpoch : 0);
      setPresentationActive(Boolean(issuedPresentationVisible));
      setPresentationTitle(typeof issuedPresentationTitle === "string" ? issuedPresentationTitle : null);
      setPresenterToken(typeof issuedPresenterToken === "string" ? issuedPresenterToken : null);
      presenterIdentityRef.current = typeof issuedPresenterIdentity === "string" ? issuedPresenterIdentity : null;
      presenterEpochRef.current = Number.isInteger(issuedPresenterEpoch) ? issuedPresenterEpoch : 0;
      presenterTokenRef.current = typeof issuedPresenterToken === "string" ? issuedPresenterToken : null;
      if (typeof issuedPresenterToken === "string") writePresenterSessionToken(roomCode, issuedPresenterToken);
      const isUserHost = Boolean(tokenIsHost || isAdmin || (profile?.role as string) === "admin" || role === "admin");
      setIsHost(isUserHost);

      reportTelemetry({
        level: "info",
        message: "Classroom LiveKit token issued",
        sessionId: roomCode,
        context: { event: "CLASSROOM_TOKEN_ISSUED", roomCode, role, isUserHost }
      }, "voxel-server");

      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      // Handle LiveKit Data Channel Messages (Chat, Reactions, Hand Raise, Controls)
      lkRoom.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: Participant) => {
        try {
          const str = new TextDecoder().decode(payload);
          const msg = JSON.parse(str);
          const senderIsHost = participantIsHost(participant);

          if (msg.type === "CLASSROOM_DELEGATE_ENROLLMENT" && !participant) {
            if (msg.roomCode !== roomCode || typeof msg.enrollmentCode !== "string") return;
            void fetch(`${getVoxelServerUrl()}/rtc/classroom-delegate/activate`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ roomCode, enrollmentCode: msg.enrollmentCode })
            })
              .then(async (response) => {
                if (!response.ok) throw new Error("delegate activation failed");
                return response.json();
              })
              .then((result) => {
                setIsDelegatedHost(true);
                if (drawSocketRef.current && drawSessionId && result.delegateGameToken) {
                  drawSocketRef.current.emit("CLASSROOM_DELEGATE_ACTIVATED", {
                    sessionId: drawSessionId,
                    delegateGameToken: result.delegateGameToken
                  });
                }
              })
              .catch(() => setConnError("לא ניתן לשמור את הרשאת המארח."));
            return;
          }

          if (msg.type === "PRESENTATION_STATE" && !participant) {
            const started = msg.action === "started";
            setPresentationActive(started);
            setPresentationTitle(started && typeof msg.title === "string" ? msg.title : null);
            if (typeof msg.presenterIdentity === "string") {
              setPresenterIdentity(msg.presenterIdentity);
              presenterIdentityRef.current = msg.presenterIdentity;
            }
            if (Number.isInteger(msg.presenterEpoch)) {
              setPresenterEpoch(msg.presenterEpoch);
              presenterEpochRef.current = msg.presenterEpoch;
            }
            return;
          }

          if (msg.type === "PRESENTATION_VISIBILITY" && !participant) {
            setPresentationActive(msg.visible === true);
            if (typeof msg.presenterIdentity === "string") {
              setPresenterIdentity(msg.presenterIdentity);
              presenterIdentityRef.current = msg.presenterIdentity;
            }
            if (Number.isInteger(msg.presenterEpoch)) {
              setPresenterEpoch(msg.presenterEpoch);
              presenterEpochRef.current = msg.presenterEpoch;
            }
            return;
          }

          if (msg.type === "PRESENTER_ASSIGNED" && !participant) {
            const nextPresenterIdentity = typeof msg.presenterIdentity === "string" ? msg.presenterIdentity : null;
            setPresenterIdentity(nextPresenterIdentity);
            presenterIdentityRef.current = nextPresenterIdentity;
            if (Number.isInteger(msg.presenterEpoch)) {
              setPresenterEpoch(msg.presenterEpoch);
              presenterEpochRef.current = msg.presenterEpoch;
            }
            setPresentationActive(msg.visible === true);
            if (msg.presenterIdentity !== lkRoom.localParticipant.identity) {
              setPresenterToken(null);
              presenterTokenRef.current = null;
              writePresenterSessionToken(roomCode, null);
            }
            return;
          }

          if (msg.type === "PRESENTER_CAPABILITY" && !participant) {
            if (msg.presenterIdentity !== lkRoom.localParticipant.identity || typeof msg.presenterToken !== "string") return;
            setPresenterIdentity(msg.presenterIdentity);
            setPresenterEpoch(Number(msg.presenterEpoch) || 0);
            setPresenterToken(msg.presenterToken);
            presenterIdentityRef.current = msg.presenterIdentity;
            presenterEpochRef.current = Number(msg.presenterEpoch) || 0;
            presenterTokenRef.current = msg.presenterToken;
            writePresenterSessionToken(roomCode, msg.presenterToken);
            return;
          }

          if (HOST_CONTROL_MESSAGE_TYPES.has(msg.type) && !senderIsHost) {
            return;
          }

          if (msg.type === "CHAT") {
            setChatMessages((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                senderName: participant?.name || participant?.identity || "משתתף",
                text: msg.text,
                timestamp: Date.now(),
                isHost: senderIsHost
              }
            ]);
          } else if (msg.type === "REACTION") {
            setRecentReaction({ emoji: msg.emoji, name: participant?.name || participant?.identity || "משתתף" });
            setTimeout(() => setRecentReaction(null), 3000);
          } else if (msg.type === "HAND_RAISE") {
            const targetIdentity = participant?.identity;
            if (!targetIdentity) return;
            setParticipants((prev) =>
              prev.map((p) => (p.identity === targetIdentity ? { ...p, isHandRaised: Boolean(msg.handRaised) } : p))
            );
          } else if (msg.type === "TOGGLE_BOARD") {
            setShowBoard(Boolean(msg.show));
          } else if (msg.type === "STAGE_LAYOUT" && !participant && Number.isFinite(msg.presentationPercent)) {
            setStageSplitPercent(Math.max(30, Math.min(70, Number(msg.presentationPercent))));
          } else if (msg.type === "KICK") {
            if (participant && lkRoom.localParticipant.identity === msg.targetIdentity) {
              setConnError("הוצאת מהכיתה על ידי המורה.");
              void disconnectFromRoom();
            }
          } else if (msg.type === "SET_PARTICIPANT_PERMISSIONS") {
            if (typeof msg.targetIdentity === "string") {
              const current = individualPermissionsRef.current[msg.targetIdentity] ?? { allowMic: true, allowCam: true };
              const next = {
                allowMic: typeof msg.allowMic === "boolean" ? msg.allowMic : current.allowMic,
                allowCam: typeof msg.allowCam === "boolean" ? msg.allowCam : current.allowCam
              };
              const updatedRecord = { ...individualPermissionsRef.current, [msg.targetIdentity]: next };
              individualPermissionsRef.current = updatedRecord;
              setIndividualPermissions(updatedRecord);

              if (lkRoom.localParticipant.identity === msg.targetIdentity && !isStealthAdmin) {
                if (typeof msg.allowMic === "boolean") {
                  setCanUseMic(msg.allowMic);
                  if (!msg.allowMic) {
                    void lkRoom.localParticipant.setMicrophoneEnabled(false).catch(() => {});
                    setMicOn(false);
                    setClassroomNotice({ text: "המיקרופון שלך נחסם על ידי המורה.", type: "warn" });
                  } else {
                    setClassroomNotice({ text: "המורה אישר/ה לך להשתמש במיקרופון.", type: "success" });
                  }
                }
                if (typeof msg.allowCam === "boolean") {
                  setCanUseCam(msg.allowCam);
                  if (!msg.allowCam) {
                    void lkRoom.localParticipant.setCameraEnabled(false).catch(() => {});
                    setCamOn(false);
                    setClassroomNotice({ text: "המצלמה שלך נחסמה על ידי המורה.", type: "warn" });
                  } else {
                    setClassroomNotice({ text: "המורה אישר/ה לך לפתוח מצלמה.", type: "success" });
                  }
                }
              }
              window.queueMicrotask(() => updateParticipantList(lkRoom));
            }
          } else if (msg.type === "SET_ALL_PERMISSIONS") {
            const updatedRecord = { ...individualPermissionsRef.current };
            lkRoom.remoteParticipants.forEach((p) => {
              const current = updatedRecord[p.identity] ?? { allowMic: true, allowCam: true };
              updatedRecord[p.identity] = {
                allowMic: typeof msg.allowMic === "boolean" ? msg.allowMic : current.allowMic,
                allowCam: typeof msg.allowCam === "boolean" ? msg.allowCam : current.allowCam
              };
            });
            const localId = lkRoom.localParticipant.identity;
            const currentLocal = updatedRecord[localId] ?? { allowMic: true, allowCam: true };
            updatedRecord[localId] = {
              allowMic: typeof msg.allowMic === "boolean" ? msg.allowMic : currentLocal.allowMic,
              allowCam: typeof msg.allowCam === "boolean" ? msg.allowCam : currentLocal.allowCam
            };
            individualPermissionsRef.current = updatedRecord;
            setIndividualPermissions(updatedRecord);

            const isLocalHost = participantIsHost(lkRoom.localParticipant) || tokenIsHost || isUserHost;
            if (!isLocalHost && !isStealthAdmin) {
              if (typeof msg.allowMic === "boolean") {
                setCanUseMic(msg.allowMic);
                if (!msg.allowMic) {
                  void lkRoom.localParticipant.setMicrophoneEnabled(false).catch(() => {});
                  setMicOn(false);
                  setClassroomNotice({ text: "המיקרופונים בכיתה נחסמו על ידי המורה.", type: "warn" });
                } else {
                  setClassroomNotice({ text: "המיקרופונים בכיתה אושרו על ידי המורה.", type: "success" });
                }
              }
              if (typeof msg.allowCam === "boolean") {
                setCanUseCam(msg.allowCam);
                if (!msg.allowCam) {
                  void lkRoom.localParticipant.setCameraEnabled(false).catch(() => {});
                  setCamOn(false);
                  setClassroomNotice({ text: "המצלמות בכיתה נחסמו על ידי המורה.", type: "warn" });
                } else {
                  setClassroomNotice({ text: "המצלמות בכיתה אושרו על ידי המורה.", type: "success" });
                }
              }
            }
            window.queueMicrotask(() => updateParticipantList(lkRoom));
          }
        } catch (e) {
          console.error("Data channel parse error", e);
        }
      });

      lkRoom.on(RoomEvent.ParticipantConnected, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.ParticipantDisconnected, () => {
        updateParticipantList(lkRoom);
      });
      lkRoom.on(RoomEvent.Disconnected, (reason?: DisconnectReason) => {
        if (
          reason !== DisconnectReason.PARTICIPANT_REMOVED &&
          reason !== DisconnectReason.ROOM_DELETED
        ) return;

        roomRef.current = null;
        setRoom(null);
        setConnState("disconnected");
        setMicOn(false);
        setCamOn(false);
        setIsScreenSharing(false);
        setPresentationActive(false);
        setPresentationTitle(null);
        writePresenterSessionToken(roomCode, null);

        if (!isEndingClassroomRef.current) {
          const wasRemoved = reason === DisconnectReason.PARTICIPANT_REMOVED;
          setConnError(wasRemoved ? "הוסרת מהכיתה על ידי המורה." : "השיעור הופסק על ידי המורה.");
          navigate("/classroom-ended", {
            replace: true,
            state: wasRemoved ? { reason: "removed", roomCode } : undefined
          });
        }
      });
      lkRoom.on(RoomEvent.TrackPublished, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.TrackSubscribed, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        if (publication.source === Track.Source.ScreenShare) {
          if (publication.trackName === "classroom-presentation-video") {
            setPresentationParticipant((current) => current?.identity === participant.identity ? { ...current, presentationTrack: undefined } : current);
          } else {
            setScreenShareParticipant((current) =>
              current?.identity === participant.identity ? null : current
            );
          }
        }
        window.queueMicrotask(() => updateParticipantList(lkRoom));
      });
      lkRoom.on(RoomEvent.TrackUnsubscribed, (_track, publication, participant) => {
        if (publication.source === Track.Source.ScreenShare) {
          if (publication.trackName === "classroom-presentation-video") {
            setPresentationParticipant((current) => current?.identity === participant.identity ? { ...current, presentationTrack: undefined } : current);
          } else {
            setScreenShareParticipant((current) =>
              current?.identity === participant.identity ? null : current
            );
          }
        }
        window.queueMicrotask(() => updateParticipantList(lkRoom));
      });
      lkRoom.on(RoomEvent.LocalTrackPublished, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.LocalTrackUnpublished, (publication) => {
        if (publication.source === Track.Source.ScreenShare) {
          if (publication.trackName === "classroom-presentation-video") {
            setPresentationParticipant((current) => current?.isMe ? { ...current, presentationTrack: undefined } : current);
          } else {
            setIsScreenSharing(false);
            setScreenShareParticipant((current) => current?.isMe ? null : current);
          }
        }
        window.queueMicrotask(() => updateParticipantList(lkRoom));
      });
      lkRoom.on(RoomEvent.TrackMuted, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.TrackUnmuted, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.ParticipantMetadataChanged, (_previousMetadata, participant) => {
        if (participant.identity === lkRoom.localParticipant.identity) {
          setIsHost(participantIsHost(participant));
        }
        updateParticipantList(lkRoom);
      });
      lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeakers(speakers.map((s) => s.identity));
      });

      // Connect to LiveKit room with timeout safety to prevent hanging on WebRTC PC connection errors
      const connectPromise = lkRoom.connect(serverUrl, token);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("לא ניתן להשלים חיבור PeerConnection בזמן (Timeout). נא לבדוק את החיבור לרשת ולנסות שוב.")), 10000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      roomRef.current = lkRoom;
      setRoom(lkRoom);
      setConnState("connected");
      reportTelemetry(
        {
          level: "info",
          message: "Classroom LiveKit room connected successfully",
          sessionId: roomCode,
          context: {
            appArea: "classroom",
            event: "CLASSROOM_RTC_CONNECTED",
            roomCode,
            isUserHost
          }
        },
        "voxel-server"
      );

      // ADMIN STEALTH MODE vs Normal participant
      if (isStealthAdmin) {
        setMicOn(false);
        setCamOn(false);
        void lkRoom.localParticipant.setMicrophoneEnabled(false).catch(() => {});
        void lkRoom.localParticipant.setCameraEnabled(false).catch(() => {});
      } else {
        // Normal participant: Try enabling mic and cam safely in background so errors NEVER block entry!
        setTimeout(async () => {
          if (canPublishMicrophone) {
            try {
              await lkRoom.localParticipant.setMicrophoneEnabled(true);
              setMicOn(true);
            } catch (mErr) {
              console.warn("Could not start microphone source", mErr);
              setMicOn(false);
            }
          } else {
            setMicOn(false);
          }

          if (canPublishCamera) {
            try {
              await lkRoom.localParticipant.setCameraEnabled(true);
              setCamOn(true);
            } catch (cErr) {
              console.warn("Could not start video source", cErr);
              setCamOn(false);
            }
          } else {
            setCamOn(false);
          }
          updateParticipantList(lkRoom);
        }, 50);
      }

      updateParticipantList(lkRoom);

    } catch (err: any) {
      console.error(err);
      reportTelemetry(
        {
          level: "error",
          message: "Classroom LiveKit room connection error",
          sessionId: roomCode,
          context: {
            appArea: "classroom",
            event: "CLASSROOM_RTC_CONNECT_ERROR",
            roomCode,
            error: err.message || String(err)
          },
          stack: err.stack
        },
        "voxel-server"
      );

      try { roomRef.current?.disconnect(); } catch {}
      roomRef.current = null;
      setRoom(null);
      setConnError(err.message || "ההתחברות לשיעור נכשלה (PC Connection Error).");
      setConnState("disconnected");
    }
  };

  const disconnectFromRoom = async () => {
    if (roomRef.current?.localParticipant.identity === presenterIdentityRef.current && presenterTokenRef.current) {
      await classroomRequest("/rtc/classroom-presenter-leave", {
        roomCode,
        presenterEpoch: presenterEpochRef.current,
        presenterToken: presenterTokenRef.current
      }).catch(() => null);
    }
    roomRef.current?.disconnect();
    roomRef.current = null;
    setRoom(null);
    setConnState("disconnected");
    setMicOn(false);
    setCamOn(false);
    setIsScreenSharing(false);
    setPresentationActive(false);
    setPresentationTitle(null);
  };

  const classroomRequest = useCallback(async (path: string, body: Record<string, unknown>) => {
    const { data } = await supabase.auth.getSession();
    return fetch(`${getVoxelServerUrl()}${path}`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...(data.session?.access_token ? { Authorization: `Bearer ${data.session.access_token}` } : {})
      },
      body: JSON.stringify(body)
    });
  }, []);

  const handleLocalPresentationChange = useCallback((snapshot: {
    ready: boolean;
    hasMedia: boolean;
    title: string | null;
  }) => {
    setLocalPresentationLibraryReady(snapshot.ready);
    setLocalPresentationLoaded(snapshot.hasMedia);
    if (snapshot.hasMedia && room?.localParticipant.identity === presenterIdentity) {
      setPresentationTitle(snapshot.title);
    }
  }, [presenterIdentity, room]);

  const requestMediaHidden = useCallback(() => {
    if (!presentationActive) return;
    void classroomRequest("/rtc/classroom-presentation-visibility", { roomCode, visible: false });
  }, [classroomRequest, presentationActive, roomCode]);

  useEffect(() => {
    const identity = room?.localParticipant.identity;
    if (!identity || identity !== presenterIdentity || !presenterToken || !localPresentationLibraryReady) return;
    void classroomRequest("/rtc/classroom-presenter-ready", {
      roomCode,
      presenterEpoch,
      presenterToken,
      hasMedia: localPresentationLoaded
    }).catch(() => {});
  }, [classroomRequest, localPresentationLibraryReady, localPresentationLoaded, presentationActive, presenterEpoch, presenterIdentity, presenterToken, room, roomCode]);

  useEffect(() => {
    if (!isHost || !room || !presenterIdentity) return;
    if (room.localParticipant.identity === presenterIdentity || participants.some((participant) => participant.identity === presenterIdentity)) return;
    const expectedIdentity = presenterIdentity;
    const expectedEpoch = presenterEpoch;
    const timer = window.setTimeout(() => {
      void classroomRequest("/rtc/classroom-presenter-elect", {
        roomCode,
        expectedPresenterIdentity: expectedIdentity,
        expectedPresenterEpoch: expectedEpoch
      }).catch(() => {});
    }, 15_000);
    return () => window.clearTimeout(timer);
  }, [classroomRequest, isHost, participants, presenterEpoch, presenterIdentity, room, roomCode]);

  // Broadcast Whiteboard Deltas via Socket.io to under-the-hood drawgame room
  const handleLocalBoardDelta = useCallback(
    (delta: any) => {
      if (drawSocketRef.current && drawSessionId) {
        drawSocketRef.current.emit("LIVE_DELTA", {
          sessionId: drawSessionId,
          delta
        });
      }
    },
    [drawSessionId]
  );

  const acknowledgeBoardSync = useCallback((syncToken: string) => {
    if (!drawSocketRef.current || !drawSessionId) return;
    drawSocketRef.current.emit("DRAWING_SYNC_ACK", {
      sessionId: drawSessionId,
      syncToken
    });
  }, [drawSessionId]);

  // Clearing is a host-authorized canonical drawing operation.
  const clearBoard = useCallback(() => new Promise<boolean>((resolve) => {
    if (!drawSocketRef.current || !drawSessionId || !isHost) {
      resolve(false);
      return;
    }
    drawSocketRef.current.emit(
      "INTENT_GAME",
      { sessionId: drawSessionId, intent: { type: "CLEAR_CANVAS" } },
      (ack: { ok?: boolean; error?: { message?: string } }) => {
        if (!ack?.ok) setConnError(ack?.error?.message ?? "ניקוי הלוח נכשל");
        resolve(ack?.ok === true);
      }
    );
  }), [drawSessionId, isHost]);

  const drawingPlayers = useMemo(() => participants.map((participant) => ({
    userId: participant.identity,
    displayName: participant.name
  })), [participants]);

  const drawingMode = useMemo(() => ({
    kind: "canonical" as const,
    initialSync: boardInitialYjsUpdate && boardInitialYjsSyncToken
      ? { update: boardInitialYjsUpdate, token: boardInitialYjsSyncToken }
      : null,
    initialViewport: boardInitialViewport,
    viewportRole: isHost
      ? "publish" as const
      : roomSettings.allowWhiteboardDraw
        ? "independent" as const
        : "follow" as const,
    canClear: isHost,
    sendDelta: handleLocalBoardDelta,
    acknowledgeSync: acknowledgeBoardSync,
    subscribe: subscribeLiveDeltas,
    clear: clearBoard
  }), [
    acknowledgeBoardSync,
    boardInitialViewport,
    boardInitialYjsSyncToken,
    boardInitialYjsUpdate,
    clearBoard,
    handleLocalBoardDelta,
    isHost,
    roomSettings.allowWhiteboardDraw,
    subscribeLiveDeltas
  ]);

  // Toggle Microphone
  const toggleMic = async () => {
    if (!room || isStealthAdmin) return;
    if (!isHost && !canUseMic) {
      setConnError("המיקרופון חסום כעת על ידי המורה.");
      return;
    }
    const nextState = !micOn;
    try {
      await room.localParticipant.setMicrophoneEnabled(nextState);
      setMicOn(nextState);
      updateParticipantList(room);
    } catch (err) {
      console.warn("Could not toggle microphone", err);
      setMicOn(room.localParticipant.isMicrophoneEnabled);
      updateParticipantList(room);
    }
  };

  // Toggle Camera
  const toggleCam = async () => {
    if (!room || isStealthAdmin) return;
    if (!isHost && !canUseCam) {
      setConnError("המצלמה חסומה כעת על ידי המורה.");
      return;
    }
    const nextState = !camOn;
    try {
      await room.localParticipant.setCameraEnabled(nextState);
      setCamOn(nextState);
      updateParticipantList(room);
    } catch (err) {
      console.warn("Could not toggle camera", err);
      setCamOn(room.localParticipant.isCameraEnabled);
      updateParticipantList(room);
    }
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!room || isStealthAdmin) return;
    if (presentationActive && !isScreenSharing) {
      setConnError("יש לעצור את מצגת המדיה לפני התחלת שיתוף מסך.");
      return;
    }
    const canShare = isHost || roomSettings.allowStudentScreenShare;
    if (!canShare && !isScreenSharing) {
      alert("שיתוף מסך מורשה באישור המורה בלבד.");
      return;
    }
    try {
      const nextState = !isScreenSharing;
      await room.localParticipant.setScreenShareEnabled(nextState);
      setIsScreenSharing(nextState);
      updateParticipantList(room);
    } catch (err) {
      console.error("Screen share toggle failed", err);
      setConnError("לא ניתן להתחיל שיתוף מסך. בדוק את הרשאות הדפדפן ונסה שוב.");
    }
  };

  // Raise / Lower Hand (Safe metadata update + Data Channel broadcast)
  const toggleHandRaise = async () => {
    if (!room || isStealthAdmin) return;
    const next = !isHandRaised;
    setIsHandRaised(next);

    try {
      let meta: any = {};
      try {
        meta = JSON.parse(room.localParticipant.metadata || "{}");
      } catch {}
      meta.handRaised = next;
      await room.localParticipant.setMetadata(JSON.stringify(meta)).catch(() => {});
    } catch {}

    const payload = JSON.stringify({
      type: "HAND_RAISE",
      targetIdentity: room.localParticipant.identity,
      handRaised: next
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });

    updateParticipantList(room);
  };

  // Send In-Room Chat Message
  const sendChatMessage = async () => {
    if (!room || !chatInput.trim()) return;
    const canChat = isHost || roomSettings.allowStudentChat;
    if (!canChat) {
      alert("הצ'אט סגור כעת על ידי המורה.");
      return;
    }

    const payload = JSON.stringify({
      type: "CHAT",
      senderName: room.localParticipant.name || "משתתף",
      text: chatInput.trim(),
      isHost
    });

    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
      reliable: true
    });

    setChatMessages((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).substring(2, 9),
        senderName: room.localParticipant.name || "אני",
        text: chatInput.trim(),
        timestamp: Date.now(),
        isHost
      }
    ]);

    setChatInput("");
  };

  // Send Emoji Reaction
  const sendReaction = async (emoji: string) => {
    if (!room || isStealthAdmin) return;
    const payload = JSON.stringify({
      type: "REACTION",
      senderName: room.localParticipant.name || "משתתף",
      emoji
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
      reliable: false
    });
    setRecentReaction({ emoji, name: "אני" });
    setTimeout(() => setRecentReaction(null), 3000);
  };

  // HOST ACTION: Toggle Board Visibility
  const toggleBoardVisibility = async () => {
    if (!room || !sessionData || !isHost || !(canManageClassroom || isDelegatedHost)) return;
    const next = !showBoard;
    setShowBoard(next);
    setRoomSettings((current) => ({ ...current, whiteboardVisible: next }));
    const response = await classroomRequest("/rtc/classroom-settings", {
      roomCode: sessionData.room_code,
      settings: { whiteboardVisible: next }
    });
    if (!response.ok) {
      setShowBoard(!next);
      setRoomSettings((current) => ({ ...current, whiteboardVisible: !next }));
      setConnError("לא ניתן לעדכן את תצוגת לוח השרטוט.");
      return;
    }
    const payload = JSON.stringify({ type: "TOGGLE_BOARD", show: next });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  const sendPresentationPageToWhiteboard = useCallback(async (page: Blob, title: string) => {
    if (!showBoard && isHost) {
      await toggleBoardVisibility();
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    }
    return await drawingBoardRef.current?.insertImage(page, title) ?? false;
  }, [isHost, showBoard, toggleBoardVisibility]);

  const toggleMediaBoardVisibility = async () => {
    if (!isHost || !presenterIdentity) return;
    if (!presentationActive && screenShareParticipant) {
      setConnError("יש לעצור את שיתוף המסך לפני הצגת לוח המדיה.");
      return;
    }
    const response = await classroomRequest("/rtc/classroom-presentation-visibility", {
      roomCode,
      visible: !presentationActive
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setConnError(body.error === "presenter_unavailable" ? "אין כרגע מגיש זמין." : "לא ניתן לשנות את תצוגת לוח המדיה.");
    }
  };

  const transferPresentation = async (targetIdentity: string) => {
    const response = await classroomRequest("/rtc/classroom-presenter-transfer", { roomCode, targetIdentity });
    if (!response.ok) setConnError("לא ניתן להעביר את זכויות ההצגה למשתתף שנבחר.");
  };

  const updateStageSplit = (presentationPercent: number) => {
    const next = Math.max(30, Math.min(70, presentationPercent));
    setStageSplitPercent(next);
  };

  const publishStageSplit = async (presentationPercent: number) => {
    if (!isHost) return;
    const response = await classroomRequest("/rtc/classroom-stage-layout", {
      roomCode,
      presentationPercent: Math.max(30, Math.min(70, presentationPercent))
    });
    if (!response.ok) setConnError("לא ניתן לעדכן את גודל הלוחות אצל המשתתפים.");
  };

  // HOST ACTION: Individual Mic Permission Toggle
  const toggleIndividualMicPermission = async (targetIdentity: string, currentAllowed: boolean) => {
    if (!room || !isHost) return;
    const nextAllow = !currentAllowed;
    const current = individualPermissionsRef.current[targetIdentity] ?? { allowMic: true, allowCam: true };
    const updatedRecord = {
      ...individualPermissionsRef.current,
      [targetIdentity]: { ...current, allowMic: nextAllow }
    };
    individualPermissionsRef.current = updatedRecord;
    setIndividualPermissions(updatedRecord);
    setParticipants((prev) =>
      prev.map((p) => (p.identity === targetIdentity ? { ...p, canUseMic: nextAllow } : p))
    );
    const payload = JSON.stringify({
      type: "SET_PARTICIPANT_PERMISSIONS",
      targetIdentity,
      allowMic: nextAllow
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Individual Cam Permission Toggle
  const toggleIndividualCamPermission = async (targetIdentity: string, currentAllowed: boolean) => {
    if (!room || !isHost) return;
    const nextAllow = !currentAllowed;
    const current = individualPermissionsRef.current[targetIdentity] ?? { allowMic: true, allowCam: true };
    const updatedRecord = {
      ...individualPermissionsRef.current,
      [targetIdentity]: { ...current, allowCam: nextAllow }
    };
    individualPermissionsRef.current = updatedRecord;
    setIndividualPermissions(updatedRecord);
    setParticipants((prev) =>
      prev.map((p) => (p.identity === targetIdentity ? { ...p, canUseCam: nextAllow } : p))
    );
    const payload = JSON.stringify({
      type: "SET_PARTICIPANT_PERMISSIONS",
      targetIdentity,
      allowCam: nextAllow
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Kick Participant
  const kickParticipant = async (blockRejoin: boolean) => {
    if (!room || !isHost || !kickTarget || isKicking) return;
    setIsKicking(true);
    try {
      const response = await classroomRequest("/rtc/classroom-remove-participant", {
        roomCode,
        targetIdentity: kickTarget.identity,
        blockRejoin
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        setConnError(body.message || "לא ניתן להוציא את המשתתף.");
        return;
      }
      setKickTarget(null);
      setClassroomNotice({
        type: "success",
        text: blockRejoin
          ? `${kickTarget.name} הוצא/ה מהכיתה ולא יוכל/תוכל להצטרף מחדש.`
          : `${kickTarget.name} הוצא/ה מהכיתה ויכול/ה להצטרף מחדש.`
      });
    } finally {
      setIsKicking(false);
    }
  };

  // HOST ACTION: Grant Host Status
  const grantHostStatus = async (identity: string) => {
    if (!room || !isHost) return;
    if (!window.confirm("להעניק סמכויות מארח מלאות למשתתף זה?")) return;
    const response = await classroomRequest("/rtc/classroom-promote", { roomCode, targetIdentity: identity });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setConnError(body.message || "לא ניתן להעניק סמכויות מארח.");
      return;
    }
  };

  // HOST ACTIONS: Class-wide Media Permission Toggles
  const setClassWideMicPermission = async (allow: boolean) => {
    if (!room || !isHost) return;
    const updatedRecord: Record<string, { allowMic: boolean; allowCam: boolean }> = { ...individualPermissionsRef.current };
    participants.forEach((p) => {
      if (!p.isHost) {
        const current = updatedRecord[p.identity] ?? { allowMic: true, allowCam: true };
        updatedRecord[p.identity] = { ...current, allowMic: allow };
      }
    });
    individualPermissionsRef.current = updatedRecord;
    setIndividualPermissions(updatedRecord);
    setParticipants((prev) =>
      prev.map((p) => (p.isHost ? p : { ...p, canUseMic: allow }))
    );
    const payload = JSON.stringify({
      type: "SET_ALL_PERMISSIONS",
      allowMic: allow
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  const setClassWideCamPermission = async (allow: boolean) => {
    if (!room || !isHost) return;
    const updatedRecord: Record<string, { allowMic: boolean; allowCam: boolean }> = { ...individualPermissionsRef.current };
    participants.forEach((p) => {
      if (!p.isHost) {
        const current = updatedRecord[p.identity] ?? { allowMic: true, allowCam: true };
        updatedRecord[p.identity] = { ...current, allowCam: allow };
      }
    });
    individualPermissionsRef.current = updatedRecord;
    setIndividualPermissions(updatedRecord);
    setParticipants((prev) =>
      prev.map((p) => (p.isHost ? p : { ...p, canUseCam: allow }))
    );
    const payload = JSON.stringify({
      type: "SET_ALL_PERMISSIONS",
      allowCam: allow
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Clear Whiteboard
  const clearWhiteboard = async () => {
    if (!isHost) return;
    if (drawSocketRef.current && drawSessionId) {
      drawSocketRef.current.emit("INTENT_GAME", {
        sessionId: drawSessionId,
        intent: { type: "CLEAR_CANVAS" }
      });
    }
  };

  // HOST ACTION: Toggle Room Setting
  const toggleRoomSetting = async (key: keyof typeof roomSettings) => {
    if (!sessionData || !isHost || !(canManageClassroom || isDelegatedHost)) return;
    const updated = { ...roomSettings, [key]: !roomSettings[key] };
    setRoomSettings(updated);
    const response = await classroomRequest("/rtc/classroom-settings", {
      roomCode: sessionData.room_code,
      settings: { [key]: updated[key] }
    });
    if (!response.ok) {
      setRoomSettings(roomSettings);
      setConnError("לא ניתן לעדכן את הגדרות הכיתה.");
      return;
    }
    if (key === "allowWhiteboardDraw" && drawSocketRef.current && drawSessionId) {
      drawSocketRef.current.emit("CLASSROOM_WHITEBOARD_POLICY", {
        sessionId: drawSessionId,
        allowWhiteboardDraw: updated.allowWhiteboardDraw
      });
    }
  };

  // HOST ACTION: End Class & Destroy Room
  const endClassroomSession = async () => {
    if (!sessionData || !isHost || !canManageClassroom) return;
    if (!window.confirm("לסיים את השיעור ולסגור את החדר לכל המשתתפים?")) return;

    isEndingClassroomRef.current = true;

    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) {
      isEndingClassroomRef.current = false;
      setConnError("סיום השיעור זמין רק למשתמש מורשה.");
      return;
    }
    let response: Response;
    try {
      response = await fetch(`${getVoxelServerUrl()}/rtc/classroom-end`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${data.session.access_token}`
        },
        body: JSON.stringify({ roomCode: sessionData.room_code })
      });
    } catch {
      isEndingClassroomRef.current = false;
      setConnError("לא ניתן לסיים את השיעור. בדוק את החיבור ונסה שוב.");
      return;
    }
    if (!response.ok) {
      isEndingClassroomRef.current = false;
      const body = await response.json().catch(() => ({}));
      setConnError(body.message || "לא ניתן לסיים את השיעור.");
      return;
    }

    if (classroomSessionId) await clearClassroomLibrary(classroomSessionId).catch(() => {});
    writePresenterSessionToken(roomCode || sessionData.room_code, null);
    void disconnectFromRoom();
    navigate("/teacher");
  };

  // Copy Invite Link
  const copyInviteLink = async () => {
    const url = `${window.location.origin}/classroom/${roomCode}`;
    try {
      await navigator.clipboard.writeText(url);
      setInviteCopied(true);
      setTimeout(() => setInviteCopied(false), 2000);
    } catch {
      window.prompt("העתק קישור להזמנה:", url);
    }
  };

  if (loadingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="size-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-bold text-slate-300">טוען נתוני כיתה וירטואלית…</p>
        </div>
      </div>
    );
  }

  if (sessionError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6">
        <div className="max-w-md rounded-2xl border border-rose-500/30 bg-rose-500/10 p-6 text-center shadow-2xl backdrop-blur-md">
          <AlertCircle className="mx-auto mb-3 size-12 text-rose-400" />
          <h2 className="text-xl font-black text-rose-200">לא ניתן להתחבר לכיתה</h2>
          <p className="mt-2 text-sm text-rose-300/80">{sessionError}</p>
          <button
            className="mt-6 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 font-bold text-white text-xs"
            onClick={() => navigate("/home")}
          >
            חזרה לחמש
          </button>
        </div>
      </div>
    );
  }

  const localIsPresenter = room?.localParticipant.identity === presenterIdentity;
  const hasPresentationPane = screenShareParticipant != null || presentationActive;
  const isMainContentActive = hasPresentationPane || showBoard;
  const beginStageResize = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!isHost || !showBoard) return;
    const stage = event.currentTarget.parentElement;
    if (!stage) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const updateFromPointer = (clientX: number) => {
      const rect = stage.getBoundingClientRect();
      // The classroom uses RTL layout, so the presentation starts at the right edge.
      updateStageSplit(Math.round(((rect.right - clientX) / rect.width) * 100));
    };
    const onMove = (moveEvent: PointerEvent) => updateFromPointer(moveEvent.clientX);
    const onUp = (upEvent: PointerEvent) => {
      updateFromPointer(upEvent.clientX);
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      const rect = stage.getBoundingClientRect();
      void publishStageSplit(Math.round(((rect.right - upEvent.clientX) / rect.width) * 100));
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp, { once: true });
  };

  return (
    <div className="min-h-screen h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden" dir="rtl">
      <style>{`
        #feedback-trigger-btn,
        button#feedback-trigger-btn {
          display: none !important;
        }
      `}</style>
      
      {/* HEADER BAR */}
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-6 py-2.5 backdrop-blur-md shrink-0">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Radio className="size-4 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              {sessionData?.title || "כיתה וירטואלית"}
              {isHost && (
                <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Crown className="size-3" /> מורה 
                </span>
              )}
              {isStealthAdmin && (
                <span className="rounded-md bg-indigo-500/20 border border-indigo-500/30 px-2 py-0.5 text-xs font-bold text-indigo-300">
                  🕵️ צופה בסתר
                </span>
              )}
            </h1>
            <p className="text-xs font-semibold text-slate-400">
              מורה: {sessionData?.teacher_name}
            </p>
          </div>
        </div>

        {recentReaction && (
          <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-bold text-indigo-300 animate-bounce">
            <Sparkles className="size-3.5 text-indigo-400" />
            <span>{recentReaction.name}: {recentReaction.emoji}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {/* HOST BOARD VISIBILITY TOGGLE BUTTON */}
          {isHost && connState === "connected" && (
            <button
              onClick={toggleBoardVisibility}
              className={cn(
                "rounded-xl border px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 transition duration-200",
                showBoard
                  ? "bg-indigo-600/80 border-indigo-500 text-white"
                  : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-400"
              )}
            >
              {showBoard ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {showBoard ? "הסתר לוח שרטוט" : "הצג לוח שרטוט ✏️"}
            </button>
          )}

          {isHost && connState === "connected" && presenterIdentity && (
            <button
              onClick={() => void toggleMediaBoardVisibility()}
              disabled={!presentationActive && Boolean(screenShareParticipant)}
              className={cn(
                "rounded-xl border px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 transition duration-200",
                presentationActive
                  ? "bg-fuchsia-600/80 border-fuchsia-500 text-white"
                  : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300 disabled:cursor-not-allowed disabled:opacity-40"
              )}
            >
              {presentationActive ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              {presentationActive ? "הסתר לוח מדיה" : "הצג לוח מדיה"}
            </button>
          )}

          {localIsPresenter && connState === "connected" && !isScreenSharing && (
            <button
              onClick={() => presentationPublisherRef.current?.openMaterialPicker()}
              disabled={mediaUploadStatus?.state === "preparing"}
              className="rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-bold text-fuchsia-100 transition hover:bg-fuchsia-500/20 flex items-center gap-1.5 disabled:cursor-wait disabled:opacity-60"
              title="הוספת קובץ לספריית חומרי המדיה המקומית"
            >
              <Upload className="size-3.5" /> הוסף חומרים ללוח המדיה
            </button>
          )}

          {isClassCreator && connState === "connected" && room && !localIsPresenter && (
            <button onClick={() => void transferPresentation(room.localParticipant.identity)} className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-200">
              <Radio className="size-3.5" /> קח בחזרה את ההצגה
            </button>
          )}

          {isHost && hasPresentationPane && showBoard && (
            <label className="hidden items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/60 px-3 py-1.5 text-xs font-bold text-slate-200 lg:flex">
              גודל מצגת
              <input
                type="range"
                min="30"
                max="70"
                value={stageSplitPercent}
                onChange={(event) => updateStageSplit(Number(event.target.value))}
                onPointerUp={(event) => void publishStageSplit(Number((event.target as HTMLInputElement).value))}
                onKeyUp={(event) => void publishStageSplit(Number((event.target as HTMLInputElement).value))}
                className="w-24 accent-fuchsia-500"
                aria-label="גודל המצגת ביחס ללוח"
              />
            </label>
          )}

          {/* FOCUS MODE TOGGLE BUTTON */}
          {connState === "connected" && isMainContentActive && (
            <button
              onClick={() => setFocusMode(!focusMode)}
              className={cn(
                "rounded-xl border px-3 py-1.5 font-bold text-xs flex items-center gap-1.5 transition duration-200",
                focusMode
                  ? "bg-indigo-600 border-indigo-500 text-white"
                  : "border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-300"
              )}
            >
              {focusMode ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
              {focusMode ? "מצב רגיל" : "מצב פוקוס 🔍"}
            </button>
          )}

          {isHost && (
            <button
              onClick={copyInviteLink}
              className="rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-200 font-bold text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              {inviteCopied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
              {inviteCopied ? "קישור הועתק!" : "העתק קישור להזמנה"}
            </button>
          )}

          {connState === "connected" && (
            <button
              onClick={disconnectFromRoom}
              className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-1.5 flex items-center gap-1.5"
            >
              <LogOut className="size-3.5" />
              יציאה מהכיתה
            </button>
          )}
        </div>
      </header>

      {connState === "connected" && connError && (
        <div className="fixed left-4 top-20 z-50 flex max-w-md items-center gap-2 rounded-xl border border-rose-500/40 bg-slate-950/95 px-3 py-2 text-xs font-bold text-rose-200 shadow-xl" role="alert">
          <AlertCircle className="size-4 shrink-0 text-rose-400" />
          <p>{connError}</p>
          <button onClick={() => setConnError(null)} className="mr-1 rounded px-1 text-rose-300 hover:bg-rose-500/20" aria-label="סגור הודעת שגיאה">×</button>
        </div>
      )}

      {connState === "connected" && classroomNotice && (
        <div
          role="status"
          aria-live="polite"
          className={cn(
            "fixed left-4 z-50 flex max-w-md items-center gap-2 rounded-xl border bg-slate-950/95 px-3.5 py-2.5 text-xs font-bold shadow-xl transition-all",
            connError ? "top-32" : "top-20",
            classroomNotice.type === "warn"
              ? "border-amber-500/50 text-amber-200"
              : classroomNotice.type === "success"
              ? "border-emerald-500/50 text-emerald-200"
              : "border-indigo-500/50 text-indigo-200"
          )}
        >
          {classroomNotice.type === "warn" ? (
            <AlertCircle className="size-4 shrink-0 text-amber-400" />
          ) : classroomNotice.type === "success" ? (
            <Check className="size-4 shrink-0 text-emerald-400" />
          ) : (
            <Sparkles className="size-4 shrink-0 text-indigo-400" />
          )}
          <p>{classroomNotice.text}</p>
          <button onClick={() => setClassroomNotice(null)} className="mr-1 rounded px-1 text-slate-400 hover:bg-slate-800" aria-label="סגור הודעה">×</button>
        </div>
      )}

      {connState === "connected" && mediaUploadStatus && (
        <div
          role={mediaUploadStatus.state === "error" ? "alert" : "status"}
          aria-live="polite"
          className={cn(
            "fixed left-4 z-50 flex max-w-md items-center gap-2 rounded-xl border bg-slate-950/95 px-3 py-2 text-xs font-bold shadow-xl transition-all",
            connError ? "top-32" : "top-20",
            mediaUploadStatus.state === "error"
              ? "border-rose-500/40 text-rose-200"
              : mediaUploadStatus.state === "success"
                ? "border-emerald-500/40 text-emerald-200"
                : "border-fuchsia-500/40 text-fuchsia-100"
          )}
        >
          {mediaUploadStatus.state === "error" ? <AlertCircle className="size-4 shrink-0 text-rose-400" /> : mediaUploadStatus.state === "success" ? <Check className="size-4 shrink-0 text-emerald-400" /> : <span className="size-4 shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent" />}
          <p>{mediaUploadStatus.message}</p>
          <button onClick={() => setMediaUploadStatus(null)} className="mr-1 rounded px-1 hover:bg-white/10" aria-label="סגור הודעת העלאה">×</button>
        </div>
      )}

      {/* DISCONNECTED ENTRY / GUEST FORM */}
      {connState !== "connected" && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-6">
              <div className="size-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                <VideoIcon className="size-8" />
              </div>
              <h2 className="text-xl font-black text-white">הצטרפות לכיתה הווירטואלית</h2>
            </div>

            {connError && (
              <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-bold text-rose-300 flex items-center gap-2">
                <AlertCircle className="size-4 shrink-0 text-rose-400" />
                <p>{connError}</p>
              </div>
            )}

            {!user && (
              <div className="flex flex-col gap-2 mb-4 text-right">
                <label className="text-xs font-bold text-slate-300">שם תצוגה להצטרפות (תלמיד/אורח):</label>
                <input
                  type="text"
                  required
                  placeholder="הכנס שם מלא (למשל: דניאל כהן)"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm font-bold text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>
            )}

            <button
              className="w-full py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm shadow-lg transition duration-200 disabled:opacity-50"
              disabled={connState === "connecting" || (!user && !guestName.trim())}
              onClick={connectToRoom}
            >
              {connState === "connecting" ? "מתחבר לכיתה..." : "הכנס לכיתה"}
            </button>
          </div>
        </div>
      )}

      {/* CONNECTED CLASSROOM MAIN VIEW */}
      {connState === "connected" && (
        <div className="flex-1 flex overflow-hidden relative">
          
          {/* MAIN CLASSROOM WORKSPACE */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/90 p-3 gap-3">
            
            {/* DYNAMIC CAMERAS CONTAINER & MAIN CONTENT */}
            <div className={cn("flex-1 flex gap-3 overflow-hidden", focusMode && isMainContentActive ? "flex-row" : "flex-col")}>

              {/* CAMERAS SECTION: Teacher ALWAYS FIRST in top row / side column */}
              <div
                className={cn(
                  "flex gap-2 overflow-x-auto overflow-y-auto shrink-0 transition-all duration-300 p-1.5 bg-slate-900/40 rounded-2xl border border-slate-800/60",
                  focusMode && isMainContentActive
                    ? "w-64 flex-col justify-start max-h-full" // Vertical column in focus mode
                    : isMainContentActive
                    ? "w-full flex-row justify-start max-h-44" // Compact row on top when board/screen is active
                    : "w-full flex-row flex-wrap justify-center items-center flex-1 max-h-full" // Expanded grid when no board/screen
                )}
              >
                {participants.map((p) => {
                  const isSpeaking = activeSpeakers.includes(p.identity);
                  return (
                    <div
                      key={p.sid}
                      className={cn(
                        "relative aspect-video rounded-xl border bg-slate-900 overflow-hidden shadow-sm flex flex-col items-center justify-center shrink-0 transition duration-200",
                        focusMode && isMainContentActive
                          ? "w-full"
                          : isMainContentActive
                          ? "h-36 min-w-[190px]"
                          : "h-48 w-72", // Larger solo video tile when board is hidden
                        p.isHost ? "border-amber-500/60 ring-2 ring-amber-500/20" : isSpeaking ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-800"
                      )}
                    >
                      {/* Video Element */}
                      {!p.isVideoOff && p.videoTrack ? (
                        <video
                          ref={(el) => {
                            if (el && p.videoTrack) p.videoTrack.attach(el);
                          }}
                          autoPlay
                          playsInline
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center gap-1.5 text-slate-500">
                          <div className="size-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-slate-300 text-base">
                            {p.name.charAt(0)}
                          </div>
                        </div>
                      )}

                      {/* Audio Element */}
                      {!p.isMe && p.audioTrack && (
                        <audio
                          ref={(el) => {
                            if (el && p.audioTrack) p.audioTrack.attach(el);
                          }}
                          autoPlay
                        />
                      )}

                      {/* Top Name & Live Mic Status Badge */}
                      <div className="absolute top-1.5 right-1.5 flex items-center gap-1 pointer-events-none z-10">
                        <span className="rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-slate-200 backdrop-blur-md flex items-center gap-1">
                          {p.name} {p.isHost && <Crown className="size-3 text-amber-400 inline" />}
                        </span>

                        <span className={cn("rounded-md p-0.5 text-xs backdrop-blur-md", p.isMuted ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400")}>
                          {p.isMuted ? <MicOff className="size-3" /> : <Mic className="size-3" />}
                        </span>
                      </div>

                      {/* RAISED HAND BADGE (AT THE BOTTOM OF THE CAMERA TILE UNTIL DROPPED) */}
                      {p.isHandRaised && (
                        <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-full font-black text-[10px] flex items-center justify-center gap-1 shadow-lg animate-bounce z-10 pointer-events-none">
                          <Hand className="size-3 fill-slate-950" />
                          <span>הרם/ה יד ✋</span>
                        </div>
                      )}

                      {/* INDIVIDUAL TEACHER PERMISSION CONTROLS OVERLAY */}
                      {isHost && !p.isMe && (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-slate-950/85 p-1 rounded-lg border border-slate-700/80 backdrop-blur-md z-20 shadow-md">
                          <button
                            onClick={() => toggleIndividualMicPermission(p.identity, p.canUseMic)}
                            title={p.canUseMic ? "הרשאת מיקרופון פעילה - לחץ לחסימה" : "מיקרופון חסום - לחץ להרשאה"}
                            className={cn("p-1 rounded text-xs transition duration-150", p.canUseMic ? "text-emerald-400 hover:bg-emerald-500/20" : "text-rose-400 hover:bg-rose-500/20")}
                          >
                            {p.canUseMic ? <Mic className="size-3" /> : <MicOff className="size-3" />}
                          </button>

                          <button
                            onClick={() => toggleIndividualCamPermission(p.identity, p.canUseCam)}
                            title={p.canUseCam ? "הרשאת מצלמה פעילה - לחץ לחסימה" : "מצלמה חסומה - לחץ להרשאה"}
                            className={cn("p-1 rounded text-xs transition duration-150", p.canUseCam ? "text-emerald-400 hover:bg-emerald-500/20" : "text-rose-400 hover:bg-rose-500/20")}
                          >
                            {p.canUseCam ? <VideoIcon className="size-3" /> : <VideoOff className="size-3" />}
                          </button>

                          {(isClassCreator || (localIsPresenter && isHost)) && (
                            <button onClick={() => void transferPresentation(p.identity)} title="העבר למשתתף זה את זכויות ההצגה" className="p-1 text-fuchsia-300 hover:bg-fuchsia-500/20 rounded">
                              <Radio className="size-3" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* MAIN CONTENT FRAME: EXCALIDRAW BOARD OR SHARED SCREEN */}
              <div
                className={cn(
                  "flex-1 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl flex relative",
                  hasPresentationPane && showBoard ? "flex-row gap-px bg-slate-800" : "flex-col",
                  !isMainContentActive && "hidden"
                )}
              >
                  {connState === "connected" && roomCode && classroomSessionId && (
                    <ClassroomPresentationPublisher
                      ref={presentationPublisherRef}
                      room={room}
                      roomCode={roomCode}
                      sessionId={classroomSessionId}
                      canPresent={Boolean(localIsPresenter && presenterToken && !isScreenSharing)}
                      visible={presentationActive}
                      presenterEpoch={presenterEpoch}
                      presenterToken={presenterToken}
                      classroomRequest={classroomRequest}
                      onPresentationChange={handleLocalPresentationChange}
                      onUploadStatus={setMediaUploadStatus}
                      canSendToWhiteboard={drawSocketReady && (
                        showBoard
                          ? isHost || roomSettings.allowWhiteboardDraw
                          : isHost && (canManageClassroom || isDelegatedHost)
                      )}
                      onSendPageToWhiteboard={sendPresentationPageToWhiteboard}
                      onRequestHidden={requestMediaHidden}
                      onError={setConnError}
                      showBoard={showBoard}
                      presentationPercent={stageSplitPercent}
                    />
                  )}

                  {screenShareParticipant && (
                    <div className={cn("bg-black flex items-center justify-center relative min-w-0", showBoard ? "shrink-0" : "flex-1")} style={showBoard ? { flexBasis: `${stageSplitPercent}%` } : undefined}>
                      <div className="absolute top-2 right-2 bg-slate-950/80 px-3 py-1 rounded-lg text-xs font-bold text-indigo-300 z-10 border border-slate-800 flex items-center gap-1.5">
                        <Monitor className="size-3.5 text-indigo-400" />
                        {`מסך משותף מאת: ${screenShareParticipant.name}`}
                      </div>
                      <video
                        ref={(el) => {
                          if (el && screenShareParticipant?.screenTrack) {
                            screenShareParticipant.screenTrack.attach(el);
                          }
                        }}
                        autoPlay
                        playsInline
                        className="h-full w-full object-contain"
                      />
                      {screenShareParticipant?.screenAudioTrack && !screenShareParticipant.isMe && (
                        <audio
                          ref={(el) => {
                            if (el && screenShareParticipant?.screenAudioTrack) {
                              screenShareParticipant.screenAudioTrack.attach(el);
                            }
                          }}
                          autoPlay
                        />
                      )}
                    </div>
                  )}

                  {presentationActive && !localIsPresenter && !screenShareParticipant && (
                    <div className={cn("min-w-0 bg-black", showBoard ? "shrink-0" : "flex-1")} style={showBoard ? { flexBasis: `${stageSplitPercent}%` } : undefined}>
                      <ClassroomPresentationReceiver
                        videoTrack={presentationParticipant?.presentationTrack}
                        audioTrack={presentationParticipant?.presentationAudioTrack}
                        title={presentationTitle}
                        presenterName={participants.find((participant) => participant.identity === presenterIdentity)?.name ?? null}
                      />
                    </div>
                  )}

                  {isHost && hasPresentationPane && showBoard && (
                    // The presentation is the first flex item in the RTL stage, so it occupies
                    // `stageSplitPercent` from the physical right edge.
                    <div
                      role="separator"
                      aria-label="שנה את גודל המצגת ביחס ללוח"
                      aria-orientation="vertical"
                      onPointerDown={beginStageResize}
                      className="absolute inset-y-0 z-40 w-2 -translate-x-1/2 cursor-col-resize bg-transparent hover:bg-fuchsia-400/70 active:bg-fuchsia-300"
                      style={{ right: `${stageSplitPercent}%` }}
                    />
                  )}

                  {/*
                    Keep the collaborative board mounted while it is hidden or a screen is
                    being shared. Unmounting it destroys the local Yjs document and drops its
                    live-delta subscription, causing a later mount to reopen from the older
                    connection-time snapshot.
                  */}
                  <div
                    className={cn(
                      "relative overflow-hidden min-w-0",
                      hasPresentationPane ? "shrink-0" : "flex-1",
                      !showBoard && "hidden"
                    )}
                    style={hasPresentationPane ? { flexBasis: `${100 - stageSplitPercent}%` } : undefined}
                    aria-hidden={!showBoard}
                  >
                    {drawSocketReady ? (
                      <DrawingBoard
                        ref={drawingBoardRef}
                        gameState={whiteboardState}
                        mode={drawingMode}
                        mySeat={isHost || roomSettings.allowWhiteboardDraw ? "player" : null}
                        myUserId={room?.localParticipant.identity || null}
                        hideTopBar={true}
                        isVisible={showBoard}
                        players={drawingPlayers}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-slate-950 text-sm text-slate-300">
                        טוען את לוח השיעור...
                      </div>
                    )}
                  </div>
                </div>
            </div>

            {/* BOTTOM CONTROL BAR */}
            <div className="border-t border-slate-800 bg-slate-900/90 rounded-2xl p-2.5 flex items-center justify-between flex-wrap gap-2 shrink-0 backdrop-blur-md">
              
              {/* Media Toggles */}
              <div className="flex items-center gap-2">
                {!isStealthAdmin ? (
                  <>
                    {canUseMic || isHost ? (
                      <button
                        onClick={toggleMic}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200",
                          micOn ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        )}
                      >
                        {micOn ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
                        {micOn ? "מיקרופון פעיל" : "מיקרופון כבוי"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setConnError("המיקרופון חסום כעת על ידי המורה.")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800 transition duration-200"
                        title="המיקרופון חסום על ידי המורה"
                      >
                        <MicOff className="size-3.5 text-rose-400" />
                        <span>מיקרופון חסום</span>
                      </button>
                    )}

                    {canUseCam || isHost ? (
                      <button
                        onClick={toggleCam}
                        className={cn(
                          "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200",
                          camOn ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                        )}
                      >
                        {camOn ? <VideoIcon className="size-3.5" /> : <VideoOff className="size-3.5" />}
                        {camOn ? "מצלמה פעילה" : "מצלמה כבויה"}
                      </button>
                    ) : (
                      <button
                        onClick={() => setConnError("המצלמה חסומה כעת על ידי המורה.")}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/60 text-slate-400 border border-slate-700/50 hover:bg-slate-800 transition duration-200"
                        title="המצלמה חסומה על ידי המורה"
                      >
                        <VideoOff className="size-3.5 text-rose-400" />
                        <span>מצלמה חסומה</span>
                      </button>
                    )}

                    <button
                      onClick={toggleScreenShare}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200",
                        isScreenSharing ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      )}
                    >
                      {isScreenSharing ? <MonitorOff className="size-3.5" /> : <Monitor className="size-3.5" />}
                      {isScreenSharing ? "עצור שיתוף" : "שתף מסך"}
                    </button>

                    <button
                      onClick={toggleHandRaise}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200",
                        isHandRaised ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                      )}
                    >
                      <Hand className="size-3.5" />
                      {isHandRaised ? "הורד יד" : "הרם יד ✋"}
                    </button>
                  </>
                ) : (
                  <div className="px-3 py-1.5 rounded-xl bg-slate-800 text-indigo-300 text-xs font-bold flex items-center gap-1.5">
                    🕵️ מצב צפייה בסתר בלבד (ללא מיקרופון/מצלמה)
                  </div>
                )}
              </div>

              {/* Emoji Quick Reactions */}
              {!isStealthAdmin && (
                <div className="flex items-center gap-1 border-x border-slate-800 px-3">
                  {["👏", "👍", "❤️", "❓", "😊"].map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => sendReaction(emoji)}
                      className="p-1 rounded-lg hover:bg-slate-800 text-sm transition duration-150"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}

              {/* Side Panels Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowParticipants(!showParticipants)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200",
                    showParticipants ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  <Users className="size-3.5" />
                  משתתפים ({participants.length})
                </button>

                <button
                  onClick={() => setShowChat(!showChat)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition duration-200",
                    showChat ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  <MessageSquare className="size-3.5" />
                  צ'אט
                </button>
              </div>
            </div>
          </div>

          {/* SIDE PANEL 1: PARTICIPANTS & HOST GLOBAL CONTROLS */}
          {showParticipants && (
            <div className="w-full lg:w-80 border-r border-slate-800 bg-slate-900/95 p-4 flex flex-col gap-4 overflow-y-auto shrink-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Users className="size-4 text-indigo-400" />
                  משתתפי הכיתה
                </h3>
                <button onClick={() => setShowParticipants(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
              </div>

              {/* HOST GLOBAL ACTIONS PANEL */}
              {isHost && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col gap-2">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1 mb-1">
                    <Shield className="size-3.5" /> בקרת מורים
                  </span>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => void setClassWideMicPermission(false)}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <MicOff className="size-3 text-rose-400" />
                      חסום מיקרופונים
                    </button>

                    <button
                      onClick={() => void setClassWideMicPermission(true)}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <Mic className="size-3 text-emerald-400" />
                      אפשר מיקרופונים
                    </button>

                    <button
                      onClick={() => void setClassWideCamPermission(false)}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <VideoOff className="size-3 text-rose-400" />
                      חסום מצלמות
                    </button>

                    <button
                      onClick={() => void setClassWideCamPermission(true)}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <VideoIcon className="size-3 text-emerald-400" />
                      אפשר מצלמות
                    </button>
                  </div>

                  {(canManageClassroom || isDelegatedHost) && <div className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-300 mt-2">
                    <label className="flex items-center justify-between">
                      <span>אפשר צ'אט לתלמידים:</span>
                      <input
                        type="checkbox"
                        checked={roomSettings.allowStudentChat}
                        onChange={() => toggleRoomSetting("allowStudentChat")}
                        className="rounded accent-indigo-600"
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <span>אפשר שיתוף מסך למשתתפים:</span>
                      <input
                        type="checkbox"
                        checked={roomSettings.allowStudentScreenShare}
                        onChange={() => toggleRoomSetting("allowStudentScreenShare")}
                        className="rounded accent-indigo-600"
                      />
                    </label>

                    <label className="flex items-center justify-between">
                      <span>אפשר לתלמידים לצייר בלוח:</span>
                      <input
                        type="checkbox"
                        checked={roomSettings.allowWhiteboardDraw}
                        onChange={() => toggleRoomSetting("allowWhiteboardDraw")}
                        className="rounded accent-indigo-600"
                      />
                    </label>
                  </div>}

                  <button
                    onClick={clearWhiteboard}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold flex items-center gap-1.5 justify-center"
                  >
                    <Trash2 className="size-3.5" />
                    נקה/בטל לוח שרטוט
                  </button>

                  {canManageClassroom && <button
                    onClick={endClassroomSession}
                    className="w-full mt-1 font-black text-xs py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    סים שיעור וסגור כיתה
                  </button>}
                </div>
              )}

              {/* PARTICIPANTS LIST */}
              <div className="flex flex-col gap-2 overflow-y-auto">
                {participants.map((p) => (
                  <div key={p.sid} className="flex items-center justify-between rounded-xl bg-slate-950/60 p-2 border border-slate-800 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      <span className="text-slate-200">{p.name}</span>
                      {p.isHost && <Crown className="size-3 text-amber-400" />}
                    </div>

                    {isHost && (canManageClassroom || isDelegatedHost) && !p.isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => toggleIndividualMicPermission(p.identity, p.canUseMic)}
                          title={p.canUseMic ? "הרשאת מיקרופון פעילה - לחץ לחסימה" : "מיקרופון חסום - לחץ להרשאה"}
                          className={cn("p-1 rounded", p.canUseMic ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20")}
                        >
                          {p.canUseMic ? <Mic className="size-3.5" /> : <MicOff className="size-3.5" />}
                        </button>

                        <button
                          onClick={() => toggleIndividualCamPermission(p.identity, p.canUseCam)}
                          title={p.canUseCam ? "הרשאת מצלמה פעילה - לחץ לחסימה" : "מצלמה חסומה - לחץ להרשאה"}
                          className={cn("p-1 rounded", p.canUseCam ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20" : "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20")}
                        >
                          {p.canUseCam ? <VideoIcon className="size-3.5" /> : <VideoOff className="size-3.5" />}
                        </button>

                        <button
                          onClick={() => grantHostStatus(p.identity)}
                          title="הפוך למארח מלא "
                          className="p-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        >
                          <Crown className="size-3.5" />
                        </button>

                        <button
                          onClick={() => setKickTarget(p)}
                          title="הוצא מהכיתה"
                          className="p-1 rounded bg-rose-500/10 text-rose-400 hover:bg-rose-500/20"
                        >
                          <UserX className="size-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SIDE PANEL 2: CHAT (SCROLLABLE & NEVER STRETCHES SCREEN DOWN) */}
          {showChat && (
            <div className="w-full lg:w-80 border-r border-slate-800 bg-slate-900/95 p-4 flex flex-col h-full overflow-hidden shrink-0">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <MessageSquare className="size-4 text-indigo-400" />
                  צ'אט כיתתי
                </h3>
                <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
              </div>

              {/* MESSAGES LIST: SCROLLABLE CONTAINER */}
              <div className="flex-1 min-h-0 overflow-y-auto p-1 py-3 flex flex-col gap-2">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">אין הודעות בצ'אט עדיין.</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="rounded-xl bg-slate-950/80 p-2.5 border border-slate-800/80 flex flex-col gap-1 shrink-0">
                      <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                        <span className="text-indigo-300 flex items-center gap-1">
                          {msg.senderName} {msg.isHost && <Crown className="size-3 text-amber-400 inline" />}
                        </span>
                        <span>{new Date(msg.timestamp).toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      <p className="text-xs font-semibold text-slate-200 leading-relaxed">{msg.text}</p>
                    </div>
                  ))
                )}
              </div>

              {/* CHAT INPUT FORM */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800 shrink-0">
                <input
                  type="text"
                  placeholder={isHost || roomSettings.allowStudentChat ? "רשום הודעה..." : "הצ'אט נעול למשתתפים"}
                  disabled={!isHost && !roomSettings.allowStudentChat}
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && sendChatMessage()}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                />
                <button
                  disabled={(!isHost && !roomSettings.allowStudentChat) || !chatInput.trim()}
                  onClick={sendChatMessage}
                  className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white disabled:opacity-50"
                >
                  שלח
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {kickTarget && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kick-participant-title"
          onClick={() => !isKicking && setKickTarget(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-5 text-right shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="kick-participant-title" className="text-base font-black text-white">
              להוציא את {kickTarget.name} מהכיתה
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              בחרו אם זו הוצאה זמנית או חסימה מהצטרפות מחדש לכיתה זו.
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={isKicking}
                onClick={() => void kickParticipant(false)}
                className="rounded-xl border border-amber-500/50 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-100 transition hover:bg-amber-500/20 disabled:cursor-wait disabled:opacity-60"
              >
                הוצאה זמנית — אפשר להצטרף שוב
              </button>
              <button
                type="button"
                disabled={isKicking}
                onClick={() => void kickParticipant(true)}
                className="rounded-xl bg-rose-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-rose-500 disabled:cursor-wait disabled:opacity-60"
              >
                הוצאה וחסימה מהצטרפות מחדש
              </button>
              <button
                type="button"
                disabled={isKicking}
                onClick={() => setKickTarget(null)}
                className="px-4 py-2 text-sm font-bold text-slate-400 transition hover:text-white disabled:opacity-60"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
