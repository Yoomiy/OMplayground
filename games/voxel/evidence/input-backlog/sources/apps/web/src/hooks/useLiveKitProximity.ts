import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Participant, RemoteTrackPublication, RemoteTrack, Track } from "livekit-client";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";
import { reportTelemetry } from "@/utils/telemetry";
import { getCorrelationId } from "@/utils/correlation";

interface UseLiveKitProximityArgs {
  sessionId: string;
  noaRef: React.MutableRefObject<any>;
  remoteEntities: React.MutableRefObject<Map<string, number>>;
  onMuteAll: (cb: (payload: { mutedBy: string }) => void) => () => void;
}

export interface AudioRig {
  source: MediaStreamAudioSourceNode;
  filter: BiquadFilterNode;
  panner: PannerNode;
  stream: MediaStream;
  audioEl: HTMLAudioElement;
  track: RemoteTrack;
}

export function useLiveKitProximity(args: UseLiveKitProximityArgs) {
  const { sessionId, noaRef, remoteEntities, onMuteAll } = args;
  const [activeRoom, setActiveRoom] = useState<Room | null>(null);
  const [micEnabled, setMicEnabled] = useState(false);
  const [activeSpeakers, setActiveSpeakers] = useState<string[]>([]);
  const [mutedByHostReason, setMutedByHostReason] = useState<string | null>(null);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<string>("");

  const audioContextRef = useRef<AudioContext | null>(null);
  const audioRigsRef = useRef<Map<string, AudioRig>>(new Map());
  const mutedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume().catch(() => {
        reportTelemetry(
          {
            level: "warn",
            message: "AudioContext resume failed",
            sessionId,
            context: { protocol: "webrtc", appArea: "livekit" }
          },
          "voxel-server"
        );
      });
    }
    return audioContextRef.current;
  };

  useEffect(() => {
    const resumeAudio = () => {
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "suspended") {
        void ctx.resume();
      }
    };
    window.addEventListener("click", resumeAudio);
    window.addEventListener("keydown", resumeAudio);
    window.addEventListener("mousedown", resumeAudio);
    return () => {
      window.removeEventListener("click", resumeAudio);
      window.removeEventListener("keydown", resumeAudio);
      window.removeEventListener("mousedown", resumeAudio);
    };
  }, []);

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
        setAudioDevices(audioOutputs);
      } catch {
        reportTelemetry(
          {
            level: "warn",
            message: "Failed to enumerate audio output devices",
            sessionId,
            context: { protocol: "webrtc", appArea: "livekit" }
          },
          "voxel-server"
        );
      }
    };
    void loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
  }, [sessionId]);

  const changeAudioOutput = async (deviceId: string) => {
    const ctx = getAudioContext();
    if (typeof (ctx as any).setSinkId === "function") {
      try {
        await (ctx as any).setSinkId(deviceId);
        setSelectedDevice(deviceId);
      } catch {
        reportTelemetry(
          {
            level: "error",
            message: "Failed to set audio output device",
            sessionId,
            context: { protocol: "webrtc", deviceId, appArea: "livekit" }
          },
          "voxel-server"
        );
      }
    } else {
      reportTelemetry(
        {
          level: "warn",
          message: "setSinkId is not supported in this browser",
          sessionId,
          context: { protocol: "webrtc", appArea: "livekit" }
        },
        "voxel-server"
      );
    }
  };

  useEffect(() => {
    let active = true;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true
    });

    const setupLiveKit = async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("No Supabase session for LiveKit token.");

        const response = await fetch(`${getVoxelServerUrl()}/rtc/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
            "x-correlation-id": getCorrelationId()
          },
          body: JSON.stringify({ sessionId })
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          reportTelemetry(
            {
              level: "error",
              message: "LiveKit token fetch failed",
              sessionId,
              context: {
                protocol: "webrtc",
                status: response.status,
                reason: errData.error,
                appArea: "livekit"
              }
            },
            "voxel-server"
          );
          throw new Error(
            `Server returned ${response.status}: ${errData.message || errData.error || "Unknown error"}`
          );
        }
        const { token, serverUrl } = await response.json();
        const livekitUrl =
          serverUrl ||
          import.meta.env.VITE_LIVEKIT_URL?.trim() ||
          "wss://livekit.play-ormenachem.com";
        if (!active) return;

        await room.connect(livekitUrl, token);
        setActiveRoom(room);

        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _pub: RemoteTrackPublication, participant: Participant) => {
          if (track.kind === Track.Kind.Audio) {
            setupSpatialAudioNode(participant.identity, track);
          }
        });

        room.on(RoomEvent.TrackUnsubscribed, (_track: RemoteTrack, _pub: RemoteTrackPublication, participant: Participant) => {
          removeSpatialAudioNode(participant.identity);
        });

        room.on(RoomEvent.ParticipantDisconnected, (participant: Participant) => {
          removeSpatialAudioNode(participant.identity);
        });

        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setActiveSpeakers(speakers.map((s) => s.identity));
        });

        await room.localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        });
        setMicEnabled(true);
      } catch (err) {
        reportTelemetry(
          {
            level: "error",
            message: "LiveKit room.connect failed",
            sessionId,
            stack: err instanceof Error ? err.stack : undefined,
            context: {
              protocol: "webrtc",
              livekitRoom: `voxel-session-${sessionId}`,
              appArea: "livekit"
            }
          },
          "voxel-server"
        );
      }
    };

    void setupLiveKit();

    return () => {
      active = false;
      room.disconnect();
      audioRigsRef.current.forEach((rig) => {
        rig.panner.disconnect();
        rig.filter.disconnect();
        rig.source.disconnect();
        try {
          rig.track.detach(rig.audioEl);
        } catch {
          // ignore
        }
      });
      audioRigsRef.current.clear();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [sessionId]);

  const setupSpatialAudioNode = (participantId: string, track: RemoteTrack) => {
    const ctx = getAudioContext();
    const audioEl = track.attach();
    audioEl.muted = true;
    const mediaStream = new MediaStream([track.mediaStreamTrack]);
    const source = ctx.createMediaStreamSource(mediaStream);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(20000, ctx.currentTime);
    const panner = new PannerNode(ctx, {
      panningModel: "HRTF",
      distanceModel: "linear",
      refDistance: 2,
      maxDistance: 32,
      rolloffFactor: 1.0
    });
    source.connect(filter).connect(panner).connect(ctx.destination);
    audioRigsRef.current.set(participantId, {
      source,
      filter,
      panner,
      stream: mediaStream,
      audioEl,
      track
    });
  };

  const removeSpatialAudioNode = (participantId: string) => {
    const rig = audioRigsRef.current.get(participantId);
    if (rig) {
      rig.panner.disconnect();
      rig.filter.disconnect();
      rig.source.disconnect();
      try {
        rig.track.detach(rig.audioEl);
      } catch {
        // ignore
      }
      audioRigsRef.current.delete(participantId);
    }
  };

  useEffect(() => {
    if (!activeRoom) return;

    const unsubscribe = onMuteAll(({ mutedBy }) => {
      void activeRoom.localParticipant.setMicrophoneEnabled(false).then(() => {
        setMicEnabled(false);
        setMutedByHostReason(`הושתקת על ידי ${mutedBy}`);
        if (mutedHintTimerRef.current) clearTimeout(mutedHintTimerRef.current);
        mutedHintTimerRef.current = setTimeout(() => {
          setMutedByHostReason(null);
          mutedHintTimerRef.current = null;
        }, 6000);
      });
    });

    return () => {
      unsubscribe();
      if (mutedHintTimerRef.current) {
        clearTimeout(mutedHintTimerRef.current);
        mutedHintTimerRef.current = null;
      }
    };
  }, [onMuteAll, activeRoom]);

  const toggleMute = async () => {
    if (activeRoom) {
      const state = !micEnabled;
      await activeRoom.localParticipant.setMicrophoneEnabled(state, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      });
      setMicEnabled(state);
      if (state) {
        setMutedByHostReason(null);
      }
    }
  };

  useEffect(() => {
    if (!activeRoom) return;

    const cullingTimer = setInterval(() => {
      const engine = noaRef.current;
      if (!engine) return;
      const myPos = engine.entities.getPosition(engine.playerEntity) as number[];
      if (!myPos) return;

      activeRoom.remoteParticipants.forEach((participant) => {
        const eid = remoteEntities.current.get(participant.identity);
        if (eid === undefined) {
          const pub = participant.getTrackPublication(Track.Source.Microphone);
          if (pub && pub.isSubscribed) {
            pub.setSubscribed(false);
          }
          return;
        }

        const pPos = engine.entities.getPosition(eid) as number[];
        if (!pPos) return;

        const dx = pPos[0] - myPos[0];
        const dy = pPos[1] - myPos[1];
        const dz = pPos[2] - myPos[2];
        const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

        const pub = participant.getTrackPublication(Track.Source.Microphone);
        if (pub) {
          const inRange = distance <= 32;
          if (pub.isSubscribed !== inRange) {
            pub.setSubscribed(inRange);
          }
        }
      });
    }, 2000);

    return () => clearInterval(cullingTimer);
  }, [activeRoom, noaRef, remoteEntities]);

  return {
    activeRoom,
    micEnabled,
    toggleMute,
    audioRigsRef,
    getAudioContext,
    activeSpeakers,
    mutedByHostReason,
    audioDevices,
    selectedDevice,
    changeAudioOutput
  };
}

export function countSolidBlocksBetween(
  noa: any,
  start: [number, number, number],
  end: [number, number, number]
): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance === 0) return 0;

  const steps = Math.max(1, Math.ceil(distance * 2));
  let solidCount = 0;
  let lastKey = "";

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = Math.floor(start[0] + dx * t);
    const py = Math.floor(start[1] + dy * t);
    const pz = Math.floor(start[2] + dz * t);
    const key = `${px},${py},${pz}`;
    if (key === lastKey) continue;
    lastKey = key;
    const blockId = noa.getBlock(px, py, pz);
    if (blockId !== 0) {
      const isSolid = noa.registry.getBlockSolidity(blockId);
      if (isSolid) {
        solidCount++;
      }
    }
  }
  return solidCount;
}
