import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Room, RoomEvent, Participant, Track } from "livekit-client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import { DrawingBoard } from "@/games/drawing/DrawingBoard";
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
  VolumeX,
  Volume2,
  AlertCircle,
  Radio,
  Maximize2,
  Minimize2,
  Eye,
  EyeOff,
  Sparkles,
  Trash2
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
  screenTrack?: any;
  videoTrack?: any;
  audioTrack?: any;
}

export function ClassroomPage() {
  const { roomCode } = useParams<{ roomCode: string }>();
  const [searchParams] = useSearchParams();
  const spectateMode = searchParams.get("spectate") as "invisible" | "visible" | null;
  const isStealthAdmin = spectateMode === "invisible";
  const navigate = useNavigate();
  const { user } = useAuth();
  const { profile } = useProfile();

  // Classroom Session DB metadata
  const [sessionData, setSessionData] = useState<ClassroomSessionData | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [sessionError, setSessionError] = useState<string | null>(null);

  // Guest name input state if unauthenticated
  const [guestName, setGuestName] = useState("");

  // LiveKit Connection & Room state
  const [room, setRoom] = useState<Room | null>(null);
  const [connState, setConnState] = useState<"disconnected" | "connecting" | "connected">("disconnected");
  const [connError, setConnError] = useState<string | null>(null);

  // User Local Media & Permissions state
  const [isHost, setIsHost] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);

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

  // Dynamic Whiteboard Live Delta Subscriptions & Refs for full state sync
  const deltaListenersRef = useRef<Set<(payload: any) => void>>(new Set());
  const currentBoardElementsRef = useRef<any[]>([]);
  const currentBoardFilesRef = useRef<Record<string, any>>({});
  const dbSaveTimerRef = useRef<any>(null);

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
    allowWhiteboardDraw: false // By default only host can draw on board
  });

  // In-Room Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recentReaction, setRecentReaction] = useState<{ emoji: string; name: string } | null>(null);

  // Ephemeral Whiteboard State (Using drawingModule structure)
  const [whiteboardState, setWhiteboardState] = useState<any>({
    status: "playing",
    seats: {},
    canvas: { engine: "excalidraw", version: 1, updatedAt: Date.now(), elements: [], files: {} }
  });

  // Auto-fill display name if user is logged in
  const resolvedDisplayName = useMemo(() => {
    if (user) {
      return (profile?.full_name || profile?.username || user.email || "משתמש").trim();
    }
    return guestName.trim();
  }, [user, profile, guestName]);

  // Fetch classroom session details from Supabase (including initial DB whiteboard snapshot)
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
        setSessionError("השיעור בכיתה זו כבר הסתיים.");
        setLoadingSession(false);
        return;
      }

      setSessionData(data as ClassroomSessionData);
      if (data.settings) {
        setRoomSettings((prev) => ({ ...prev, ...data.settings }));
      }
      
      // Load initial whiteboard snapshot from DB if exists
      if (data.whiteboard_data) {
        currentBoardElementsRef.current = data.whiteboard_data.elements || [];
        currentBoardFilesRef.current = data.whiteboard_data.files || {};
        setWhiteboardState({
          status: "playing",
          canvas: {
            engine: "excalidraw",
            version: 1,
            updatedAt: Date.now(),
            elements: data.whiteboard_data.elements || [],
            files: data.whiteboard_data.files || {}
          }
        });
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
            setConnError("השיעור הופסק על ידי המורה.");
            void disconnectFromRoom();
          } else if (updated.settings) {
            setRoomSettings((prev) => ({ ...prev, ...updated.settings }));
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
    let localVideoTrack: any = null;
    let localAudioTrack: any = null;

    local.trackPublications.forEach((pub) => {
      if (pub.source === Track.Source.ScreenShare && pub.track) {
        localScreenTrack = pub.track;
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
      list.push({
        sid: local.sid,
        identity: local.identity,
        name: local.name || "אני",
        isHost: Boolean(localMetadata.isHost || (local.permissions?.canPublishData && (local.permissions as any)?.roomAdmin)),
        isMe: true,
        isMuted: !local.isMicrophoneEnabled,
        isVideoOff: !local.isCameraEnabled,
        isHandRaised: Boolean(localMetadata.handRaised),
        screenTrack: localScreenTrack,
        videoTrack: localVideoTrack,
        audioTrack: localAudioTrack
      });
    }

    // Remote participants
    lkRoom.remoteParticipants.forEach((p) => {
      let pScreenTrack: any = null;
      let pVideoTrack: any = null;
      let pAudioTrack: any = null;

      p.trackPublications.forEach((pub) => {
        if (pub.source === Track.Source.ScreenShare && pub.track) {
          pScreenTrack = pub.track;
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

      // Skip stealth invisible admin
      if (pMetadata.hidden) return;

      list.push({
        sid: p.sid,
        identity: p.identity,
        name: p.name || p.identity,
        isHost: Boolean(pMetadata.isHost),
        isMe: false,
        isMuted: !p.isMicrophoneEnabled,
        isVideoOff: !p.isCameraEnabled,
        isHandRaised: Boolean(pMetadata.handRaised),
        screenTrack: pScreenTrack,
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
  }, [isStealthAdmin]);

  // Connect to LiveKit Room
  const connectToRoom = async () => {
    if (!roomCode) return;
    setConnState("connecting");
    setConnError(null);

    if (!resolvedDisplayName) {
      setConnError("נא להזין שם תצוגה לפני ההתחברות.");
      setConnState("disconnected");
      return;
    }

    try {
      const session = (await supabase.auth.getSession()).data.session;
      const response = await fetch(`${getVoxelServerUrl()}/rtc/classroom-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {})
        },
        body: JSON.stringify({
          roomCode,
          displayName: resolvedDisplayName,
          spectateMode: spectateMode ?? undefined
        })
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.message || "ההתחברות לחדר הוידאו נכשלה.");
      }

      const { token, serverUrl, isHost: tokenIsHost } = await response.json();
      setIsHost(Boolean(tokenIsHost));

      const lkRoom = new Room({
        adaptiveStream: true,
        dynacast: true
      });

      // Handle Data Channel Messages (Chat, Whiteboard Deltas, Full State Sync, Controls, Reactions, Hand Raise)
      lkRoom.on(RoomEvent.DataReceived, (payload: Uint8Array, participant?: Participant) => {
        try {
          const str = new TextDecoder().decode(payload);
          const msg = JSON.parse(str);

          if (msg.type === "CHAT") {
            setChatMessages((prev) => [
              ...prev,
              {
                id: Math.random().toString(36).substring(2, 9),
                senderName: msg.senderName,
                text: msg.text,
                timestamp: Date.now(),
                isHost: msg.isHost
              }
            ]);
          } else if (msg.type === "REACTION") {
            setRecentReaction({ emoji: msg.emoji, name: msg.senderName });
            setTimeout(() => setRecentReaction(null), 3000);
          } else if (msg.type === "HAND_RAISE") {
            setParticipants((prev) =>
              prev.map((p) => (p.identity === msg.targetIdentity ? { ...p, isHandRaised: Boolean(msg.handRaised) } : p))
            );
          } else if (msg.type === "REQUEST_WHITEBOARD_STATE") {
            // LATE JOINER EDGE CASE: Send full current whiteboard state to newly joined participant
            if (currentBoardElementsRef.current.length > 0) {
              const fullPayload = JSON.stringify({
                type: "FULL_WHITEBOARD_STATE",
                targetIdentity: participant?.identity,
                elements: currentBoardElementsRef.current,
                files: currentBoardFilesRef.current
              });
              void lkRoom.localParticipant.publishData(
                new TextEncoder().encode(fullPayload),
                { reliable: true }
              );
            }
          } else if (msg.type === "FULL_WHITEBOARD_STATE") {
            // LATE JOINER EDGE CASE: Receive full whiteboard state upon joining
            if (!msg.targetIdentity || msg.targetIdentity === lkRoom.localParticipant.identity) {
              if (msg.elements) {
                currentBoardElementsRef.current = msg.elements;
                currentBoardFilesRef.current = msg.files || {};
                setWhiteboardState({
                  status: "playing",
                  canvas: {
                    engine: "excalidraw",
                    version: Date.now(),
                    updatedAt: Date.now(),
                    elements: msg.elements,
                    files: msg.files || {}
                  }
                });
              }
            }
          } else if (msg.type === "WHITEBOARD_DELTA") {
            // DISPATCH TO ALL DELTA LISTENERS
            deltaListenersRef.current.forEach((cb) => {
              cb({
                from: msg.from,
                delta: msg.delta
              });
            });
            // Update local state tracker
            if (msg.delta?.changed) {
              const changedIds = new Set(msg.delta.changed.map((e: any) => e.id));
              const filtered = currentBoardElementsRef.current.filter((e) => !changedIds.has(e.id));
              currentBoardElementsRef.current = [...filtered, ...msg.delta.changed];
            }
          } else if (msg.type === "TOGGLE_BOARD") {
            setShowBoard(Boolean(msg.show));
          } else if (msg.type === "CLEAR_WHITEBOARD") {
            currentBoardElementsRef.current = [];
            currentBoardFilesRef.current = {};
            setWhiteboardState((prev: any) => ({
              ...prev,
              canvas: { ...prev.canvas, version: prev.canvas.version + 1, updatedAt: Date.now(), elements: [] }
            }));
          } else if (msg.type === "KICK") {
            if (participant && lkRoom.localParticipant.identity === msg.targetIdentity) {
              setConnError("הוצאת מהכיתה על ידי המורה.");
              void disconnectFromRoom();
            }
          } else if (msg.type === "GRANT_HOST") {
            if (lkRoom.localParticipant.identity === msg.targetIdentity) {
              setIsHost(true);
              void lkRoom.localParticipant.setMetadata(JSON.stringify({ isHost: true })).catch(() => {});
              updateParticipantList(lkRoom);
            }
          } else if (msg.type === "INDIVIDUAL_MIC_TOGGLE") {
            if (lkRoom.localParticipant.identity === msg.targetIdentity && !isStealthAdmin) {
              const nextState = Boolean(msg.enable);
              void lkRoom.localParticipant.setMicrophoneEnabled(nextState);
              setMicOn(nextState);
            }
          } else if (msg.type === "INDIVIDUAL_CAM_TOGGLE") {
            if (lkRoom.localParticipant.identity === msg.targetIdentity && !isStealthAdmin) {
              const nextState = Boolean(msg.enable);
              void lkRoom.localParticipant.setCameraEnabled(nextState);
              setCamOn(nextState);
            }
          } else if (msg.type === "MUTE_ALL") {
            if (!tokenIsHost && !isHost) {
              void lkRoom.localParticipant.setMicrophoneEnabled(false);
              setMicOn(false);
            }
          } else if (msg.type === "UNMUTE_ALL") {
            if (!tokenIsHost && !isHost && !isStealthAdmin) {
              void lkRoom.localParticipant.setMicrophoneEnabled(true);
              setMicOn(true);
            }
          } else if (msg.type === "CLOSE_ALL_CAMS") {
            if (!tokenIsHost && !isHost) {
              void lkRoom.localParticipant.setCameraEnabled(false);
              setCamOn(false);
            }
          } else if (msg.type === "OPEN_ALL_CAMS") {
            if (!tokenIsHost && !isHost && !isStealthAdmin) {
              void lkRoom.localParticipant.setCameraEnabled(true);
              setCamOn(true);
            }
          }
        } catch (e) {
          console.error("Data channel parse error", e);
        }
      });

      lkRoom.on(RoomEvent.ParticipantConnected, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.ParticipantDisconnected, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.TrackSubscribed, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.TrackUnsubscribed, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.TrackMuted, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.TrackUnmuted, () => updateParticipantList(lkRoom));
      lkRoom.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setActiveSpeakers(speakers.map((s) => s.identity));
      });

      await lkRoom.connect(serverUrl, token);
      setRoom(lkRoom);
      setConnState("connected");

      // ADMIN STEALTH MODE: Completely hide cams and mics if spectateMode is invisible
      if (isStealthAdmin) {
        await lkRoom.localParticipant.setMicrophoneEnabled(false);
        await lkRoom.localParticipant.setCameraEnabled(false);
        setMicOn(false);
        setCamOn(false);
      } else {
        // Normal participant: Enable mic and cam by default
        await lkRoom.localParticipant.setMicrophoneEnabled(true);
        await lkRoom.localParticipant.setCameraEnabled(true);
        setMicOn(true);
        setCamOn(true);
      }

      updateParticipantList(lkRoom);

      // LATE JOINER EDGE CASE: Request full whiteboard state from active room participants
      setTimeout(() => {
        const reqPayload = JSON.stringify({ type: "REQUEST_WHITEBOARD_STATE" });
        void lkRoom.localParticipant.publishData(new TextEncoder().encode(reqPayload), { reliable: true });
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setConnError(err.message || "שגיאה בחיבור לשיעור.");
      setConnState("disconnected");
    }
  };

  const disconnectFromRoom = async () => {
    if (room) {
      room.disconnect();
      setRoom(null);
    }
    setConnState("disconnected");
    setMicOn(false);
    setCamOn(false);
    setIsScreenSharing(false);
  };

  // Debounced DB persistence of whiteboard elements for Host/Teacher
  const scheduleDbBoardSave = useCallback((elements: any[], files: any) => {
    if (!roomCode) return;
    if (dbSaveTimerRef.current) clearTimeout(dbSaveTimerRef.current);
    dbSaveTimerRef.current = setTimeout(async () => {
      await supabase
        .from("classroom_sessions")
        .update({ whiteboard_data: { elements, files } })
        .eq("room_code", roomCode);
    }, 4000);
  }, [roomCode]);

  // Broadcast Whiteboard Deltas via LiveKit Data Channel & track current board elements
  const handleLocalBoardDelta = useCallback((delta: any) => {
    if (!room) return;

    if (delta.changed) {
      const changedIds = new Set(delta.changed.map((e: any) => e.id));
      const filtered = currentBoardElementsRef.current.filter((e) => !changedIds.has(e.id));
      currentBoardElementsRef.current = [...filtered, ...delta.changed];
    }

    if (isHost || roomSettings.allowWhiteboardDraw) {
      scheduleDbBoardSave(currentBoardElementsRef.current, currentBoardFilesRef.current);
    }

    const payload = JSON.stringify({
      type: "WHITEBOARD_DELTA",
      from: room.localParticipant.identity,
      delta
    });
    void room.localParticipant.publishData(
      new TextEncoder().encode(payload),
      { reliable: Boolean(delta.files || delta.changed || delta.deleted) }
    );
  }, [room, isHost, roomSettings.allowWhiteboardDraw, scheduleDbBoardSave]);

  // Handle board intent (such as CLEAR_CANVAS from DrawingBoard component)
  const handleBoardIntent = useCallback((intent: any) => {
    if (intent?.type === "CLEAR_CANVAS") {
      void clearWhiteboard();
    }
  }, []);

  // Toggle Microphone
  const toggleMic = async () => {
    if (!room || isStealthAdmin) return;
    const nextState = !micOn;
    await room.localParticipant.setMicrophoneEnabled(nextState);
    setMicOn(nextState);
    updateParticipantList(room);
  };

  // Toggle Camera
  const toggleCam = async () => {
    if (!room || isStealthAdmin) return;
    const nextState = !camOn;
    await room.localParticipant.setCameraEnabled(nextState);
    setCamOn(nextState);
    updateParticipantList(room);
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!room || isStealthAdmin) return;
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
    if (!room || !isHost) return;
    const next = !showBoard;
    setShowBoard(next);
    const payload = JSON.stringify({ type: "TOGGLE_BOARD", show: next });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Individual Mute/Unmute
  const toggleIndividualMic = async (targetIdentity: string, currentMuted: boolean) => {
    if (!room || !isHost) return;
    const payload = JSON.stringify({
      type: "INDIVIDUAL_MIC_TOGGLE",
      targetIdentity,
      enable: currentMuted // if currently muted, enable mic
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Individual Cam Toggle
  const toggleIndividualCam = async (targetIdentity: string, currentOff: boolean) => {
    if (!room || !isHost) return;
    const payload = JSON.stringify({
      type: "INDIVIDUAL_CAM_TOGGLE",
      targetIdentity,
      enable: currentOff // if currently off, enable cam
    });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Kick Participant
  const kickParticipant = async (identity: string) => {
    if (!room || !isHost) return;
    if (!window.confirm("להוציא משתתף זה מהכיתה?")) return;
    const payload = JSON.stringify({ type: "KICK", targetIdentity: identity });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Grant Host Status
  const grantHostStatus = async (identity: string) => {
    if (!room || !isHost) return;
    if (!window.confirm("להעניק סמכויות מורה/מארח מלאות למשתתף זה?")) return;
    const payload = JSON.stringify({ type: "GRANT_HOST", targetIdentity: identity });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTIONS: Global Media Toggles
  const triggerGlobalAction = async (type: "MUTE_ALL" | "UNMUTE_ALL" | "CLOSE_ALL_CAMS" | "OPEN_ALL_CAMS") => {
    if (!room || !isHost) return;
    const payload = JSON.stringify({ type });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });
  };

  // HOST ACTION: Clear Whiteboard
  const clearWhiteboard = async () => {
    if (!room || !isHost) return;
    currentBoardElementsRef.current = [];
    currentBoardFilesRef.current = {};
    const payload = JSON.stringify({ type: "CLEAR_WHITEBOARD" });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), { reliable: true });

    // Wipe from DB as well
    if (roomCode) {
      await supabase
        .from("classroom_sessions")
        .update({ whiteboard_data: null })
        .eq("room_code", roomCode);
    }

    setWhiteboardState((prev: any) => ({
      ...prev,
      canvas: { ...prev.canvas, version: prev.canvas.version + 1, updatedAt: Date.now(), elements: [] }
    }));
  };

  // HOST ACTION: Toggle Room Setting
  const toggleRoomSetting = async (key: keyof typeof roomSettings) => {
    if (!sessionData || !isHost) return;
    const updated = { ...roomSettings, [key]: !roomSettings[key] };
    setRoomSettings(updated);
    await supabase
      .from("classroom_sessions")
      .update({ settings: updated })
      .eq("room_code", sessionData.room_code);
  };

  // HOST ACTION: End Class & Destroy Room
  const endClassroomSession = async () => {
    if (!sessionData || !isHost) return;
    if (!window.confirm("לסיים את השיעור ולסגור את החדר לכל המשתתפים?")) return;

    await supabase.rpc("end_classroom_session", {
      p_room_code: sessionData.room_code
    });

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

  const isMainContentActive = screenShareParticipant != null || showBoard;

  return (
    <div className="min-h-screen h-screen bg-slate-950 text-slate-100 flex flex-col font-sans overflow-hidden" dir="rtl">
      
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
                  <Crown className="size-3" /> מורה / מארח
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

          <button
            onClick={copyInviteLink}
            className="rounded-xl border border-slate-700 bg-slate-800/50 hover:bg-slate-800 text-slate-200 font-bold text-xs px-3 py-1.5 flex items-center gap-1.5"
          >
            {inviteCopied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
            {inviteCopied ? "קישור הועתק!" : "העתק קישור להזמנה"}
          </button>

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

      {/* DISCONNECTED ENTRY / GUEST FORM */}
      {connState !== "connected" && (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900/80 p-8 shadow-2xl backdrop-blur-xl">
            <div className="text-center mb-6">
              <div className="size-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mx-auto mb-3 text-indigo-400">
                <VideoIcon className="size-8" />
              </div>
              <h2 className="text-xl font-black text-white">הצטרפות לכיתה הווירטואלית</h2>
              <p className="text-xs font-semibold text-slate-400 mt-1">שידור וידאו ואודיו בזמן אמת מבוסס LiveKit</p>
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
              {connState === "connecting" ? "מתחבר לכיתה..." : "הכנס לכיתה כעת 🚀"}
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

                      {/* Top Name Badge */}
                      <div className="absolute top-1.5 right-1.5 left-1.5 flex items-center justify-between gap-1 pointer-events-none">
                        <span className="rounded-md bg-slate-950/80 px-2 py-0.5 text-[10px] font-bold text-slate-200 backdrop-blur-md flex items-center gap-1">
                          {p.name} {p.isHost && <Crown className="size-3 text-amber-400 inline" />}
                        </span>

                        <span className={cn("rounded-md p-0.5 text-xs", p.isMuted ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400")}>
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

                      {/* INDIVIDUAL TEACHER CONTROLS OVERLAY */}
                      {isHost && !p.isMe && (
                        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-slate-950/80 p-1 rounded-lg border border-slate-700 backdrop-blur-md">
                          <button
                            onClick={() => toggleIndividualMic(p.identity, p.isMuted)}
                            title={p.isMuted ? "ביטול השתקה לתלמיד זה" : "השתק תלמיד זה"}
                            className={cn("p-1 rounded text-xs", p.isMuted ? "text-rose-400 hover:bg-rose-500/20" : "text-emerald-400 hover:bg-emerald-500/20")}
                          >
                            {p.isMuted ? <VolumeX className="size-3" /> : <Volume2 className="size-3" />}
                          </button>

                          <button
                            onClick={() => toggleIndividualCam(p.identity, p.isVideoOff)}
                            title={p.isVideoOff ? "פתח מצלמה לתלמיד זה" : "סגור מצלמה לתלמיד זה"}
                            className={cn("p-1 rounded text-xs", p.isVideoOff ? "text-rose-400 hover:bg-rose-500/20" : "text-emerald-400 hover:bg-emerald-500/20")}
                          >
                            {p.isVideoOff ? <VideoOff className="size-3" /> : <VideoIcon className="size-3" />}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* MAIN CONTENT FRAME: EXCALIDRAW BOARD OR SHARED SCREEN */}
              {isMainContentActive && (
                <div className="flex-1 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden shadow-2xl flex flex-col relative">
                  
                  {/* SHARED SCREEN PRECEDENCE */}
                  {screenShareParticipant ? (
                    <div className="flex-1 bg-black flex items-center justify-center relative">
                      <div className="absolute top-2 right-2 bg-slate-950/80 px-3 py-1 rounded-lg text-xs font-bold text-indigo-300 z-10 border border-slate-800 flex items-center gap-1.5">
                        <Monitor className="size-3.5 text-indigo-400" />
                        מסך משותף מאת: {screenShareParticipant.name}
                      </div>
                      <video
                        ref={(el) => {
                          if (el && screenShareParticipant.screenTrack) {
                            screenShareParticipant.screenTrack.attach(el);
                          }
                        }}
                        autoPlay
                        playsInline
                        className="h-full w-full object-contain"
                      />
                    </div>
                  ) : showBoard ? (
                    /* REUSED APP DRAWINGBOARD COMPONENT */
                    <div className="flex-1 w-full h-full relative overflow-hidden">
                      <DrawingBoard
                        gameState={whiteboardState}
                        mySeat={isHost || roomSettings.allowWhiteboardDraw ? "player" : null}
                        myUserId={room?.localParticipant.identity || null}
                        onIntent={handleBoardIntent}
                        onLiveDelta={handleLocalBoardDelta}
                        subscribeLiveDeltas={subscribeLiveDeltas}
                        isHost={isHost}
                        hideTopBar={true}
                        players={participants.map((p) => ({
                          userId: p.identity,
                          displayName: p.name
                        }))}
                      />
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {/* BOTTOM CONTROL BAR */}
            <div className="border-t border-slate-800 bg-slate-900/90 rounded-2xl p-2.5 flex items-center justify-between flex-wrap gap-2 shrink-0 backdrop-blur-md">
              
              {/* Media Toggles */}
              <div className="flex items-center gap-2">
                {!isStealthAdmin ? (
                  <>
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
                    <Shield className="size-3.5" /> בקרת מורה / מארח
                  </span>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      onClick={() => triggerGlobalAction("MUTE_ALL")}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <VolumeX className="size-3 text-rose-400" />
                      השתק הכל
                    </button>

                    <button
                      onClick={() => triggerGlobalAction("UNMUTE_ALL")}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <Volume2 className="size-3 text-emerald-400" />
                      בטל השתקה
                    </button>

                    <button
                      onClick={() => triggerGlobalAction("CLOSE_ALL_CAMS")}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <VideoOff className="size-3 text-rose-400" />
                      סגור מצלמות
                    </button>

                    <button
                      onClick={() => triggerGlobalAction("OPEN_ALL_CAMS")}
                      className="py-1.5 px-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold flex items-center gap-1 justify-center"
                    >
                      <VideoIcon className="size-3 text-emerald-400" />
                      פתח מצלמות
                    </button>
                  </div>

                  <div className="flex flex-col gap-1.5 text-[11px] font-bold text-slate-300 mt-2">
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
                  </div>

                  <button
                    onClick={clearWhiteboard}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-rose-300 text-xs font-bold flex items-center gap-1.5 justify-center"
                  >
                    <Trash2 className="size-3.5" />
                    נקה/בטל לוח שרטוט
                  </button>

                  <button
                    onClick={endClassroomSession}
                    className="w-full mt-1 font-black text-xs py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white"
                  >
                    סים שיעור וסגור כיתה
                  </button>
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

                    {isHost && !p.isMe && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => grantHostStatus(p.identity)}
                          title="הפוך למארח מלא (למשל מורה מחליף)"
                          className="p-1 rounded bg-amber-500/10 text-amber-400 hover:bg-amber-500/20"
                        >
                          <Crown className="size-3.5" />
                        </button>

                        <button
                          onClick={() => kickParticipant(p.identity)}
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
    </div>
  );
}
