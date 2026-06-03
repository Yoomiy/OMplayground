import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Participant, RemoteTrackPublication, RemoteTrack, Track } from "livekit-client";
import { supabase } from "@/lib/supabase";
import { getVoxelServerUrl } from "@/lib/voxelServerUrl";

interface UseLiveKitProximityArgs {
  sessionId: string;
  noaRef: React.MutableRefObject<any>; // React ref wrapping noa-engine
  remoteEntities: React.MutableRefObject<Map<string, number>>; // userId -> noa entityId
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
  const audioRigsRef = useRef<Map<string, AudioRig>>(new Map()); // participantId -> Web Audio nodes
  const mutedHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1. Lazy-initialize AudioContext after user-interaction gesture
  const getAudioContext = (): AudioContext => {
    if (!audioContextRef.current || audioContextRef.current.state === "closed") {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioContextRef.current.state === "suspended") {
      void audioContextRef.current.resume();
    }
    return audioContextRef.current;
  };

  // Setup user interaction event listeners to reliably resume suspended AudioContext
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

  // Enumerate output devices for UI selector
  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioOutputs = devices.filter((d) => d.kind === "audiooutput");
        setAudioDevices(audioOutputs);
      } catch (err) {
        console.warn("Failed to enumerate audio output devices:", err);
      }
    };
    void loadDevices();
    navigator.mediaDevices.addEventListener("devicechange", loadDevices);
    return () => navigator.mediaDevices.removeEventListener("devicechange", loadDevices);
  }, []);

  const changeAudioOutput = async (deviceId: string) => {
    const ctx = getAudioContext();
    if (typeof (ctx as any).setSinkId === "function") {
      try {
        await (ctx as any).setSinkId(deviceId);
        setSelectedDevice(deviceId);
      } catch (err) {
        console.error("Failed to set audio output device:", err);
      }
    } else {
      console.warn("setSinkId is not supported in this browser.");
    }
  };

  useEffect(() => {
    let active = true;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
    });

    const setupLiveKit = async () => {
      try {
        // Authenticate the token request with the Supabase access token,
        // exactly like the Socket.io handshake does.
        const { data: sessionData } = await supabase.auth.getSession();
        const accessToken = sessionData.session?.access_token;
        if (!accessToken) throw new Error("No Supabase session for LiveKit token.");

        // Fetch LiveKit connection token from the voxel backend (not a Vite /api route)
        const response = await fetch(`${getVoxelServerUrl()}/rtc/token`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({ sessionId }),
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(`Server returned ${response.status}: ${errData.message || errData.error || "Unknown error"}`);
        }
        const { token } = await response.json();
        if (!active) return;

        // Establish WebRTC connection to self-hosted SFU
        await room.connect("wss://livekit.play-ormenachem.com", token);
        setActiveRoom(room);

        // Track and hook into incoming audio streams
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

        // Set up speaking states
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
          setActiveSpeakers(speakers.map(s => s.identity));
        });

        // Publish local mic audio automatically with modern browser processing configurations
        await room.localParticipant.setMicrophoneEnabled(true, {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });
        setMicEnabled(true);
      } catch (err) {
        console.error("LiveKit proximity voice chat failed to initialize:", err);
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
        } catch (err) {
          // ignore
        }
      });
      audioRigsRef.current.clear();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [sessionId]);

  // 2. Setup Web Audio nodes for remote participant stream
  const setupSpatialAudioNode = (participantId: string, track: RemoteTrack) => {
    const ctx = getAudioContext();

    // Attach the track to trigger Chromium's WebRTC audio pipeline
    const audioEl = track.attach();
    // Mute the raw audio element to avoid double playback
    audioEl.muted = true;

    const mediaStream = new MediaStream([track.mediaStreamTrack]);

    // Create audio source node from remote WebRTC track
    const source = ctx.createMediaStreamSource(mediaStream);

    // Create acoustic occlusion low-pass filter
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(20000, ctx.currentTime); // default open space frequency

    // Create 3D spatial panner node
    const panner = new PannerNode(ctx, {
      panningModel: "HRTF",
      distanceModel: "linear",
      refDistance: 2,
      maxDistance: 32,
      rolloffFactor: 1.0,
    });

    // Pipe nodes: Source -> Lowpass -> 3D Panner -> Destination
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
      } catch (err) {
        console.warn("Failed to detach track:", err);
      }
      audioRigsRef.current.delete(participantId);
    }
  };

  // Listen to Host "Mute All" signal from socket
  useEffect(() => {
    if (!activeRoom) return;

    const unsubscribe = onMuteAll(({ mutedBy }) => {
      // Soft-mute the player locally, but don't prevent them from manually unmuting
      void activeRoom.localParticipant.setMicrophoneEnabled(false).then(() => {
        setMicEnabled(false);
        setMutedByHostReason(`הושתקת על ידי ${mutedBy}`);
        // Transient hint: auto-dismiss after 6 seconds. Track the timer in a ref
        // so effect cleanup can clear it and avoid setState after unmount.
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

  // Toggle local mic mute state
  const toggleMute = async () => {
    if (activeRoom) {
      const state = !micEnabled;
      await activeRoom.localParticipant.setMicrophoneEnabled(state, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      setMicEnabled(state);
      // Clear host mute hint on manual toggle
      if (state) {
        setMutedByHostReason(null);
      }
    }
  };

  // Culling loop: update subscribe status of tracks every 2 seconds based on actual game distances
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
          // If entity is not rendered or out of voxel range, unsubscribe to save bandwidth
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
    changeAudioOutput,
  };
}

/**
 * Traces a line through the voxel grid to count solid blocks between two points.
 */
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

  // Sample at ~0.5-block spacing so thin diagonal walls are rarely skipped.
  const steps = Math.max(1, Math.ceil(distance * 2));
  let solidCount = 0;
  let lastKey = "";

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = Math.floor(start[0] + dx * t);
    const py = Math.floor(start[1] + dy * t);
    const pz = Math.floor(start[2] + dz * t);

    // Sub-block sampling visits the same voxel repeatedly; only count it once.
    const key = `${px},${py},${pz}`;
    if (key === lastKey) continue;
    lastKey = key;

    // noa engine block lookup
    const blockId = noa.getBlock(px, py, pz);
    if (blockId !== 0) { // Assuming 0 is AIR
      const isSolid = noa.registry.getBlockSolidity(blockId);
      if (isSolid) {
        solidCount++;
      }
    }
  }
  return solidCount;
}
