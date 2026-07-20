import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { Room, RoomEvent, Participant, Track } from "livekit-client";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import { DrawingCanvas } from "@/games/drawing/DrawingCanvas";
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
  PenTool,
  Users,
  Shield,
  LogOut,
  Copy,
  Check,
  Crown,
  UserX,
  VolumeX,
  Trash2,
  Sparkles,
  AlertCircle,
  Radio
} from "lucide-react";

interface ClassroomSessionData {
  id: string;
  title: string;
  subject: string | null;
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

  // UI Tabs & Toggles
  const [activeTab, setActiveTab] = useState<"video" | "whiteboard">("video");
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [inviteCopied, setInviteCopied] = useState(false);

  // Participants & Data Stream state
  const [participants, setParticipants] = useState<CustomParticipantInfo[]>([]);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [screenShareParticipant, setScreenShareParticipant] = useState<CustomParticipantInfo | null>(null);

  // Room Level Dynamic Settings (Controlled by Host)
  const [roomSettings, setRoomSettings] = useState({
    allowStudentChat: false,
    allowStudentScreenShare: false,
    allowStudentMic: false,
    allowWhiteboardDraw: false
  });

  // In-Room Chat & Reactions
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [recentReaction, setRecentReaction] = useState<{ emoji: string; name: string } | null>(null);

  // Ephemeral Whiteboard State
  const [whiteboardState, setWhiteboardState] = useState<any>({
    status: "playing",
    canvas: { engine: "excalidraw", version: 1, elements: [], files: {} }
  });

  // Fetch classroom session details from Supabase
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

  // Handle participant updates in room
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

    const localInfo: CustomParticipantInfo = {
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
    };
    list.push(localInfo);

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

    setParticipants(list);

    // Find screen share participant
    const screenSharing = list.find((p) => p.screenTrack != null);
    setScreenShareParticipant(screenSharing || null);
  }, []);

  // Connect to LiveKit Room
  const connectToRoom = async () => {
    if (!roomCode) return;
    setConnState("connecting");
    setConnError(null);

    const displayName = user ? (profile?.full_name || user.email || "משתתף") : guestName.trim();
    if (!displayName) {
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
          displayName,
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

      // Handle Data Channel Messages (Chat, Whiteboard, Controls, Reactions)
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
          } else if (msg.type === "WHITEBOARD_DELTA") {
            setWhiteboardState((prev: any) => ({
              ...prev,
              canvas: {
                ...prev.canvas,
                version: prev.canvas.version + 1,
                elements: msg.elements ?? prev.canvas.elements
              }
            }));
          } else if (msg.type === "CLEAR_WHITEBOARD") {
            setWhiteboardState((prev: any) => ({
              ...prev,
              canvas: { ...prev.canvas, version: prev.canvas.version + 1, elements: [] }
            }));
          } else if (msg.type === "KICK") {
            if (participant && lkRoom.localParticipant.identity === msg.targetIdentity) {
              setConnError("הוצאת מהכיתה על ידי המורה.");
              void disconnectFromRoom();
            }
          } else if (msg.type === "GRANT_HOST") {
            if (lkRoom.localParticipant.identity === msg.targetIdentity) {
              setIsHost(true);
              // Update local metadata
              void lkRoom.localParticipant.setMetadata(JSON.stringify({ isHost: true }));
              updateParticipantList(lkRoom);
            }
          } else if (msg.type === "MUTE_ALL") {
            if (!tokenIsHost && !isHost) {
              void lkRoom.localParticipant.setMicrophoneEnabled(false);
              setMicOn(false);
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
      updateParticipantList(lkRoom);
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

  // Toggle Microphone
  const toggleMic = async () => {
    if (!room) return;
    const canUseMic = isHost || roomSettings.allowStudentMic;
    if (!canUseMic && !micOn) {
      alert("המיקרופונים בכיתה מופעלים באישור המורה בלבד.");
      return;
    }
    const nextState = !micOn;
    await room.localParticipant.setMicrophoneEnabled(nextState);
    setMicOn(nextState);
    updateParticipantList(room);
  };

  // Toggle Camera
  const toggleCam = async () => {
    if (!room) return;
    const nextState = !camOn;
    await room.localParticipant.setCameraEnabled(nextState);
    setCamOn(nextState);
    updateParticipantList(room);
  };

  // Toggle Screen Sharing
  const toggleScreenShare = async () => {
    if (!room) return;
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

  // Raise / Lower Hand
  const toggleHandRaise = async () => {
    if (!room) return;
    const next = !isHandRaised;
    setIsHandRaised(next);
    let meta: any = {};
    try {
      meta = JSON.parse(room.localParticipant.metadata || "{}");
    } catch {}
    meta.handRaised = next;
    await room.localParticipant.setMetadata(JSON.stringify(meta));
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
    if (!room) return;
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

  // HOST ACTION: Kick Participant
  const kickParticipant = async (identity: string) => {
    if (!room || !isHost) return;
    if (!window.confirm("להוציא משתתף זה מהכיתה?")) return;
    const payload = JSON.stringify({ type: "KICK", targetIdentity: identity });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
      reliable: true
    });
  };

  // HOST ACTION: Grant Host Status
  const grantHostStatus = async (identity: string) => {
    if (!room || !isHost) return;
    if (!window.confirm("להעניק סמכויות מורה/מארח מלאות למשתתף זה?")) return;
    const payload = JSON.stringify({ type: "GRANT_HOST", targetIdentity: identity });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
      reliable: true
    });
  };

  // HOST ACTION: Mute All
  const muteAllStudents = async () => {
    if (!room || !isHost) return;
    const payload = JSON.stringify({ type: "MUTE_ALL" });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
      reliable: true
    });
  };

  // HOST ACTION: Clear Whiteboard
  const clearWhiteboard = async () => {
    if (!room || !isHost) return;
    const payload = JSON.stringify({ type: "CLEAR_WHITEBOARD" });
    await room.localParticipant.publishData(new TextEncoder().encode(payload), {
      reliable: true
    });
    setWhiteboardState((prev: any) => ({
      ...prev,
      canvas: { ...prev.canvas, version: prev.canvas.version + 1, elements: [] }
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans" dir="rtl">
      
      {/* HEADER BAR */}
      <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-900/60 px-6 py-3.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Radio className="size-5 animate-pulse" />
          </div>
          <div>
            <h1 className="text-base font-black text-white flex items-center gap-2">
              {sessionData?.title || "כיתה וירטואלית"}
              {isHost && (
                <span className="rounded-md bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 text-xs font-bold text-amber-300 flex items-center gap-1">
                  <Crown className="size-3" /> מורה / מארח
                </span>
              )}
            </h1>
            <p className="text-xs font-semibold text-slate-400">
              מורה: {sessionData?.teacher_name} · מקצוע: {sessionData?.subject || "כללי"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
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
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">
          
          {/* MAIN STAGE & NAVIGATION */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950/80 p-4 gap-4">
            
            {/* VIEW MODE TAB SELECTOR */}
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-3 flex-wrap">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab("video")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition duration-200",
                    activeTab === "video"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  <VideoIcon className="size-4" />
                  שידור וידאו ותמונות
                </button>

                <button
                  onClick={() => setActiveTab("whiteboard")}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition duration-200",
                    activeTab === "whiteboard"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "bg-slate-900 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                  )}
                >
                  <PenTool className="size-4" />
                  לוח שרטוט שיתופי (Excalidraw)
                </button>
              </div>

              {/* FLOATING REACTION NOTIFICATION */}
              {recentReaction && (
                <div className="flex items-center gap-2 rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-3 py-1.5 text-xs font-bold text-indigo-300 animate-bounce">
                  <Sparkles className="size-3.5 text-indigo-400" />
                  <span>{recentReaction.name}: {recentReaction.emoji}</span>
                </div>
              )}
            </div>

            {/* TAB CONTENT 1: VIDEO GRID & SCREEN SHARE */}
            {activeTab === "video" && (
              <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                
                {/* MAIN STAGE: Screen Share presentation view if active */}
                {screenShareParticipant && (
                  <div className="relative w-full h-96 rounded-2xl border border-indigo-500/30 bg-slate-900 overflow-hidden shadow-2xl flex flex-col">
                    <div className="bg-slate-950/80 px-4 py-2 text-xs font-bold text-indigo-300 flex items-center justify-between border-b border-slate-800">
                      <span className="flex items-center gap-2">
                        <Monitor className="size-4 text-indigo-400" />
                        מסך משותף מאת: {screenShareParticipant.name}
                      </span>
                    </div>
                    <div className="flex-1 bg-black flex items-center justify-center relative">
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
                  </div>
                )}

                {/* PARTICIPANTS VIDEO TILES GRID */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                  {participants.map((p) => {
                    const isSpeaking = activeSpeakers.includes(p.identity);
                    return (
                      <div
                        key={p.sid}
                        className={cn(
                          "relative aspect-video rounded-2xl border bg-slate-900/90 overflow-hidden shadow-md flex flex-col items-center justify-center transition duration-200",
                          isSpeaking ? "border-emerald-500 ring-2 ring-emerald-500/20" : "border-slate-800"
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
                          <div className="flex flex-col items-center gap-2 text-slate-500">
                            <div className="size-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center font-black text-slate-300 text-lg">
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

                        {/* Top Indicators Badge */}
                        <div className="absolute top-2 right-2 left-2 flex items-center justify-between gap-1 pointer-events-none">
                          <span className="rounded-lg bg-slate-950/80 px-2 py-0.5 text-[11px] font-bold text-slate-200 backdrop-blur-md flex items-center gap-1">
                            {p.name} {p.isHost && <Crown className="size-3 text-amber-400 inline" />}
                          </span>

                          <div className="flex items-center gap-1">
                            {p.isHandRaised && (
                              <span className="rounded-lg bg-amber-500/20 border border-amber-500/30 p-1 text-amber-300 animate-pulse">
                                <Hand className="size-3.5" />
                              </span>
                            )}
                            <span className={cn("rounded-lg p-1 text-xs", p.isMuted ? "bg-rose-500/20 text-rose-400" : "bg-emerald-500/20 text-emerald-400")}>
                              {p.isMuted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: INTEGRATED EXCALIDRAW WHITEBOARD */}
            {activeTab === "whiteboard" && (
              <div className="flex-1 flex flex-col gap-2 relative">
                {isHost && (
                  <div className="flex items-center justify-end gap-2 mb-1">
                    <button
                      onClick={clearWhiteboard}
                      className="rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs px-3 py-1.5 flex items-center gap-1.5"
                    >
                      <Trash2 className="size-3.5" />
                      נקה/בטל לוח
                    </button>
                  </div>
                )}
                <DrawingCanvas
                  gameState={whiteboardState}
                  mySeat={isHost ? "host" : "student"}
                  myUserId={room?.localParticipant.identity || null}
                  onIntent={() => {}}
                  showToast={(msg) => console.log(msg)}
                  isFullscreen={true}
                  isHost={isHost}
                />
              </div>
            )}

            {/* BOTTOM CONTROL BAR */}
            <div className="mt-auto border-t border-slate-800/80 bg-slate-900/90 rounded-2xl p-3 flex items-center justify-between flex-wrap gap-3 backdrop-blur-md">
              
              {/* Media Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={toggleMic}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition duration-200",
                    micOn ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  {micOn ? <Mic className="size-4" /> : <MicOff className="size-4" />}
                  {micOn ? "מיקרופון פעיל" : "מיקרופון כבוי"}
                </button>

                <button
                  onClick={toggleCam}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition duration-200",
                    camOn ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  {camOn ? <VideoIcon className="size-4" /> : <VideoOff className="size-4" />}
                  {camOn ? "מצלמה פעילה" : "מצלמה כבויה"}
                </button>

                <button
                  onClick={toggleScreenShare}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition duration-200",
                    isScreenSharing ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  {isScreenSharing ? <MonitorOff className="size-4" /> : <Monitor className="size-4" />}
                  {isScreenSharing ? "עצור שיתוף" : "שתף מסך"}
                </button>

                <button
                  onClick={toggleHandRaise}
                  className={cn(
                    "flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition duration-200",
                    isHandRaised ? "bg-amber-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  <Hand className="size-4" />
                  {isHandRaised ? "הורד יד" : "הרם יד ✋"}
                </button>
              </div>

              {/* Emoji Quick Reactions */}
              <div className="flex items-center gap-1 border-x border-slate-800 px-3">
                {["👏", "👍", "❤️", "❓", "😊"].map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => sendReaction(emoji)}
                    className="p-1.5 rounded-lg hover:bg-slate-800 text-base transition duration-150"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Side Panels Toggles */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowParticipants(!showParticipants)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition duration-200",
                    showParticipants ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  <Users className="size-4" />
                  משתתפים ({participants.length})
                </button>

                <button
                  onClick={() => setShowChat(!showChat)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition duration-200",
                    showChat ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                  )}
                >
                  <MessageSquare className="size-4" />
                  צ'אט
                </button>
              </div>
            </div>
          </div>

          {/* SIDE PANEL 1: PARTICIPANTS & HOST CONTROLS */}
          {showParticipants && (
            <div className="w-full lg:w-80 border-r border-slate-800 bg-slate-900/95 p-4 flex flex-col gap-4 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <Users className="size-4 text-indigo-400" />
                  משתתפי הכיתה
                </h3>
                <button onClick={() => setShowParticipants(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
              </div>

              {/* HOST GLOBAL ACTIONS PANEL */}
              {isHost && (
                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 flex flex-col gap-2.5">
                  <span className="text-xs font-black text-amber-300 flex items-center gap-1">
                    <Shield className="size-3.5" /> בקרת מורה / מארח
                  </span>

                  <button
                    onClick={muteAllStudents}
                    className="w-full py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-2 justify-center"
                  >
                    <VolumeX className="size-3.5 text-rose-400" />
                    השתק את כל התלמידים
                  </button>

                  <div className="flex flex-col gap-1.5 text-xs font-bold text-slate-300 mt-1">
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
                  </div>

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
                  <div key={p.sid} className="flex items-center justify-between rounded-xl bg-slate-950/60 p-2.5 border border-slate-800 text-xs font-bold">
                    <div className="flex items-center gap-2">
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

          {/* SIDE PANEL 2: CHAT */}
          {showChat && (
            <div className="w-full lg:w-80 border-r border-slate-800 bg-slate-900/95 p-4 flex flex-col gap-3 overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-black text-white flex items-center gap-2">
                  <MessageSquare className="size-4 text-indigo-400" />
                  צ'אט כיתתי
                </h3>
                <button onClick={() => setShowChat(false)} className="text-slate-400 hover:text-white text-xs font-bold">✕</button>
              </div>

              {/* MESSAGES LIST */}
              <div className="flex-1 flex flex-col gap-2 overflow-y-auto p-1">
                {chatMessages.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-6">אין הודעות בצ'אט עדיין.</p>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="rounded-xl bg-slate-950/80 p-2.5 border border-slate-800/80 flex flex-col gap-1">
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
              <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
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
