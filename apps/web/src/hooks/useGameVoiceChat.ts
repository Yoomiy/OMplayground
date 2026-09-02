import { useCallback, useEffect, useRef, useState } from "react";
import {
  Room,
  RoomEvent,
  Track,
  type Participant,
  type RemoteTrack,
  type RemoteTrackPublication
} from "livekit-client";
import { reportTelemetry } from "@/utils/telemetry";

export interface GameVoiceParticipant {
  identity: string;
  name: string;
  isLocal: boolean;
  isSpeaking: boolean;
}

interface GameVoiceToken {
  token: string;
  serverUrl: string;
}

export function useGameVoiceChat(args: {
  sessionId: string;
  requestToken: () => Promise<GameVoiceToken>;
}) {
  const { sessionId, requestToken } = args;
  const roomRef = useRef<Room | null>(null);
  const audioElementsRef = useRef<Map<string, HTMLMediaElement>>(new Map());
  const [connectionState, setConnectionState] = useState<
    "connecting" | "connected" | "error"
  >("connecting");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [canPlaybackAudio, setCanPlaybackAudio] = useState(true);
  const [participants, setParticipants] = useState<GameVoiceParticipant[]>([]);

  useEffect(() => {
    let active = true;
    const room = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = room;

    const refreshParticipants = () => {
      if (!active) return;
      const local = room.localParticipant;
      setParticipants([
        {
          identity: local.identity,
          name: local.name || "אני",
          isLocal: true,
          isSpeaking: local.isSpeaking
        },
        ...Array.from(room.remoteParticipants.values()).map((participant) => ({
          identity: participant.identity,
          name: participant.name || "שחקן",
          isLocal: false,
          isSpeaking: participant.isSpeaking
        }))
      ]);
    };

    const removeAudioElement = (trackSid: string) => {
      const element = audioElementsRef.current.get(trackSid);
      if (!element) return;
      element.remove();
      audioElementsRef.current.delete(trackSid);
    };
    const onTrackSubscribed = (
      track: RemoteTrack,
      _publication: RemoteTrackPublication,
      _participant: Participant
    ) => {
      if (track.kind !== Track.Kind.Audio) return;
      const trackKey = track.sid ?? track.mediaStreamTrack.id;
      const element = track.attach();
      element.autoplay = true;
      element.hidden = true;
      element.dataset.gameVoiceTrack = trackKey;
      document.body.appendChild(element);
      audioElementsRef.current.set(trackKey, element);
    };
    const onTrackUnsubscribed = (track: RemoteTrack) => {
      try {
        track.detach();
      } finally {
        removeAudioElement(track.sid ?? track.mediaStreamTrack.id);
      }
    };
    const onAudioPlaybackChanged = () => {
      if (active) setCanPlaybackAudio(room.canPlaybackAudio);
    };

    room
      .on(RoomEvent.TrackSubscribed, onTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, onTrackUnsubscribed)
      .on(RoomEvent.ParticipantConnected, refreshParticipants)
      .on(RoomEvent.ParticipantDisconnected, refreshParticipants)
      .on(RoomEvent.ActiveSpeakersChanged, refreshParticipants)
      .on(RoomEvent.AudioPlaybackStatusChanged, onAudioPlaybackChanged);

    void (async () => {
      try {
        const voiceToken = await requestToken();
        if (!active) return;
        await room.connect(voiceToken.serverUrl, voiceToken.token);
        if (!active) return;
        setConnectionState("connected");
        setCanPlaybackAudio(room.canPlaybackAudio);
        refreshParticipants();
        try {
          await room.localParticipant.setMicrophoneEnabled(true, {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          });
          if (active) setMicEnabled(true);
        } catch (err) {
          if (active) {
            setMicEnabled(false);
            setMicError("לא ניתן להפעיל את המיקרופון. אפשר לאשר גישה ולנסות שוב.");
          }
          reportTelemetry(
            {
              level: "warn",
              message: "Game voice microphone enable failed",
              sessionId,
              stack: err instanceof Error ? err.stack : undefined,
              context: { protocol: "webrtc", appArea: "game-voice" }
            },
            "game-server"
          );
        }
        refreshParticipants();
      } catch (err) {
        if (!active) return;
        setConnectionState("error");
        setErrorMessage(
          err instanceof Error && err.message
            ? err.message
            : "לא ניתן להתחבר לצ׳אט הקולי."
        );
        reportTelemetry(
          {
            level: "error",
            message: "Game voice connection failed",
            sessionId,
            stack: err instanceof Error ? err.stack : undefined,
            context: { protocol: "webrtc", appArea: "game-voice" }
          },
          "game-server"
        );
      }
    })();

    return () => {
      active = false;
      room.removeAllListeners();
      room.disconnect();
      for (const element of audioElementsRef.current.values()) element.remove();
      audioElementsRef.current.clear();
      if (roomRef.current === room) roomRef.current = null;
    };
  }, [requestToken, sessionId]);

  const toggleMicrophone = useCallback(async () => {
    const room = roomRef.current;
    if (!room || connectionState !== "connected") return;
    const nextEnabled = !micEnabled;
    try {
      await room.localParticipant.setMicrophoneEnabled(nextEnabled, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });
      setMicEnabled(nextEnabled);
      setMicError(null);
    } catch {
      setMicError("לא ניתן לשנות את מצב המיקרופון.");
    }
  }, [connectionState, micEnabled]);

  const startAudio = useCallback(async () => {
    const room = roomRef.current;
    if (!room) return;
    await room.startAudio();
    setCanPlaybackAudio(room.canPlaybackAudio);
  }, []);

  return {
    connectionState,
    errorMessage,
    micEnabled,
    micError,
    canPlaybackAudio,
    participants,
    toggleMicrophone,
    startAudio
  };
}
