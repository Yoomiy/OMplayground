import {
  Room,
  RoomEvent,
  ConnectionState,
  Track,
  createLocalAudioTrack,
  getLogger,
  LogLevel,
} from "livekit-client";
import type {
  LocalAudioTrack,
  RemoteParticipant,
  RemoteTrack,
  RemoteTrackPublication,
} from "livekit-client";
import type { VoiceScene } from "@playground/voxel-runtime";
import { VoxelApiError } from "./session-api";
import type { VoxelApi } from "./session-api";
import { VoiceAudio } from "./voice-audio";
export type VoiceState = Readonly<{
  phase:
    | "off"
    | "starting"
    | "connected"
    | "reconnecting"
    | "unavailable"
    | "blocked";
  publishAllowed: boolean;
  hidden: boolean;
  microphone: "off" | "asking" | "on" | "denied" | "unavailable";
  capturePending: boolean;
  outputMuted: boolean;
  audioLocked: boolean;
  outputSelection: boolean;
}>;
const initial: VoiceState = {
  phase: "off",
  publishAllowed: false,
  hidden: false,
  microphone: "off",
  capturePending: false,
  outputMuted: false,
  audioLocked: false,
  outputSelection: false,
};
const identity =
  /^([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}):[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
type Options = {
  api: VoxelApi;
  host: HTMLElement;
  scene: () => VoiceScene | null;
  onState: (state: VoiceState) => void;
};
/** One owned media connection/mix. Pose sampling never enters React state. */
export class VoiceSession {
  private options: Options;
  private audio: VoiceAudio;
  private room: Room | null = null;
  private desired = false;
  private disposed = false;
  private value: VoiceState = Object.freeze({ ...initial });
  private turn = 0;
  private activation = 0;
  private busy = false;
  private abort: AbortController | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private attempts = 0;
  private sample: ReturnType<typeof setInterval>;
  private active = new Map<
    string,
    { identity: string; track: MediaStreamTrack }
  >();
  private mic: LocalAudioTrack | null = null;
  private micTurn = 0;
  private capturePending = false;
  private micEnded: (() => void) | null = null;
  private retiring = new Set<Promise<void>>();
  private closing: Promise<void> | null = null;
  constructor(options: Options) {
    this.options = options;
    this.audio = new VoiceAudio(options.host);
    // A named logger avoids changing classroom SDK logging. Public diagnostics
    // are fixed state codes; SDK context must not log child identities/tokens.
    getLogger("voxel-voice").setLevel(LogLevel.silent);
    this.sample = setInterval(() => this.tick(), 100);
    document.addEventListener("visibilitychange", this.visibility);
  }
  private emit(patch: Partial<VoiceState>) {
    if (this.disposed) return;
    const next = Object.freeze({
      ...this.value,
      ...patch,
      capturePending: this.capturePending,
      outputSelection: this.audio.stats.outputSelection,
    });
    if (JSON.stringify(next) === JSON.stringify(this.value)) return;
    this.value = next;
    this.options.onState(next);
  }
  get state() {
    return this.value;
  }
  async start(): Promise<void> {
    if (this.disposed) return;
    const activation = ++this.activation;
    // Resume/create the graph synchronously within the user's gesture.
    let activated = false;
    try {
      activated = await this.audio.activate();
    } catch {
      if (this.disposed || activation !== this.activation) return;
      this.emit({ phase: "unavailable", audioLocked: true });
      return;
    }
    if (this.disposed || activation !== this.activation) return;
    this.desired = true;
    this.attempts = 0;
    this.emit({ audioLocked: !activated });
    if (this.room?.state === ConnectionState.Connected) return;
    if (this.retry) {
      clearTimeout(this.retry);
      this.retry = null;
    }
    await this.connect();
  }
  stop(): void {
    this.activation++;
    this.desired = false;
    this.turn++;
    this.abort?.abort();
    this.abort = null;
    this.busy = false;
    if (this.retry) {
      clearTimeout(this.retry);
      this.retry = null;
    }
    this.stopMic();
    if (this.room) this.retire(this.room);
    this.emit({ phase: "off", publishAllowed: false, hidden: false });
    this.audio.scene(null);
  }
  private retryLater() {
    if (!this.desired || this.disposed || this.retry) return;
    this.retry = setTimeout(
      () => {
        this.retry = null;
        if (!this.desired || this.disposed) return;
        if (this.scene()) void this.connect();
        else this.retryLater();
      },
      Math.min(5000, 1000 * 2 ** Math.min(this.attempts++, 3)),
    );
  }
  private scene(): VoiceScene | null {
    if (document.visibilityState !== "visible") return null;
    try {
      return this.options.scene();
    } catch {
      return null;
    }
  }
  private async connect() {
    if (this.disposed || !this.desired || this.busy) return;
    this.busy = true;
    const turn = ++this.turn,
      abort = new AbortController();
    this.abort = abort;
    let room: Room | null = null;
    const owns = () => !this.disposed && this.desired && this.turn === turn;
    this.emit({
      phase: this.attempts ? "reconnecting" : "starting",
      publishAllowed: false,
    });
    try {
      const grant = await this.options.api.voiceTicket(abort.signal);
      if (!owns()) return;
      room = new Room({
        loggerName: "voxel-voice",
        stopLocalTrackOnUnpublish: true,
        reconnectPolicy: { nextRetryDelayInMs: () => null },
      });
      this.room = room;
      const owned = room;
      room
        .on(RoomEvent.TrackSubscribed, (track, publication, participant) =>
          this.subscribed(owned, track, publication, participant),
        )
        .on(RoomEvent.TrackUnsubscribed, (track, _publication, participant) =>
          this.unsubscribed(participant.identity, track.mediaStreamTrack),
        )
        .on(RoomEvent.TrackPublished, () => this.tick())
        .on(RoomEvent.ParticipantConnected, () => this.tick())
        .on(RoomEvent.ParticipantDisconnected, (participant) => {
          for (const [actor, current] of this.active)
            if (current.identity === participant.identity) {
              this.active.delete(actor);
              this.audio.remove(actor);
            }
        })
        .on(RoomEvent.Reconnecting, () => {
          if (this.room === owned) {
            this.stopMic();
            this.retire(owned);
            this.emit({ phase: "reconnecting", publishAllowed: false });
            this.retryLater();
          }
        })
        .on(RoomEvent.Disconnected, () => {
          if (this.room !== owned || !owns()) return;
          this.stopMic();
          this.retire(owned);
          this.emit({ phase: "reconnecting", publishAllowed: false });
          this.retryLater();
        });
      await room.connect(this.options.api.voiceUrl, grant.ticket, {
        autoSubscribe: false,
        maxRetries: 0,
        websocketTimeout: 5000,
        peerConnectionTimeout: 7000,
      });
      if (!owns() || this.room !== room) {
        this.retire(room);
        return;
      }
      this.attempts = 0;
      this.emit({
        phase: "connected",
        publishAllowed: grant.publish,
        hidden: grant.hidden,
      });
      this.tick();
    } catch (error) {
      if (room) this.retire(room);
      if (!owns()) return;
      this.stopMic();
      const blocked =
        error instanceof VoxelApiError &&
        [
          "UNAUTHORIZED",
          "FORBIDDEN",
          "BANNED",
          "SESSION_ENDED",
          "RECESS_CLOSED",
          "MODE_DENIED",
          "GENDER_MISMATCH",
        ].includes(error.code);
      if (blocked) this.desired = false;
      this.emit({
        phase: blocked ? "blocked" : "unavailable",
        publishAllowed: false,
      });
      this.retryLater();
    } finally {
      if (this.turn === turn) {
        this.busy = false;
        this.abort = null;
      }
    }
  }
  private retire(room: Room) {
    if (this.room === room) {
      this.room = null;
      for (const actor of this.active.keys()) this.audio.remove(actor);
      this.active.clear();
    }
    room.removeAllListeners();
    const done = room
      .disconnect(true)
      .catch(() => {})
      .finally(() => this.retiring.delete(done));
    this.retiring.add(done);
  }
  private tick() {
    if (this.disposed) return;
    const scene = this.scene();
    if (!scene && (this.mic || this.value.microphone === "asking"))
      this.stopMic();
    this.audio.scene(scene);
    if (this.audio.stats.blockedInputs > 0) this.emit({ audioLocked: true });
    const room = this.room;
    if (room?.state !== ConnectionState.Connected) return;
    const audible = new Set(
      scene?.sources.filter((s) => s.gain > 0).map((s) => s.id) ?? [],
    );
    for (const participant of room.remoteParticipants.values()) {
      const actor = identity.exec(participant.identity)?.[1];
      for (const publication of participant.trackPublications.values()) {
        const wanted =
          !!actor &&
          audible.has(actor) &&
          publication.kind === Track.Kind.Audio &&
          publication.source === Track.Source.Microphone;
        if (publication.isDesired !== wanted) publication.setSubscribed(wanted);
      }
    }
  }
  private subscribed(
    room: Room,
    track: RemoteTrack,
    publication: RemoteTrackPublication,
    participant: RemoteParticipant,
  ) {
    if (
      this.disposed ||
      this.room !== room ||
      track.kind !== Track.Kind.Audio ||
      publication.source !== Track.Source.Microphone
    )
      return;
    const actor = identity.exec(participant.identity)?.[1];
    if (!actor) return;
    this.active.set(actor, {
      identity: participant.identity,
      track: track.mediaStreamTrack,
    });
    this.audio.add(actor, track.mediaStreamTrack);
    this.tick();
  }
  private unsubscribed(remote: string, track: MediaStreamTrack) {
    const actor = identity.exec(remote)?.[1];
    if (!actor) return;
    const current = this.active.get(actor);
    if (current?.identity === remote && current.track === track) {
      this.active.delete(actor);
      this.audio.remove(actor);
    }
  }
  private visibility = () => {
    if (document.visibilityState !== "visible") {
      this.stopMic();
      this.audio.scene(null);
    }
    this.tick();
  };
  private stopMic() {
    this.micTurn++;
    const track = this.mic;
    this.mic = null;
    if (track) {
      if (this.micEnded)
        track.mediaStreamTrack.removeEventListener("ended", this.micEnded);
      track.stop();
      void this.room?.localParticipant
        .unpublishTrack(track, true)
        .catch(() => {});
    }
    this.micEnded = null;
    this.emit({ microphone: "off" });
  }
  async microphone(enabled: boolean): Promise<boolean> {
    if (!enabled) {
      this.stopMic();
      return false;
    }
    const room = this.room;
    if (
      this.disposed ||
      !this.desired ||
      this.capturePending ||
      document.visibilityState !== "visible" ||
      !this.scene() ||
      !this.value.publishAllowed ||
      room?.state !== ConnectionState.Connected
    )
      return false;
    if (this.mic) return true;
    const turn = ++this.micTurn;
    this.capturePending = true;
    this.emit({ microphone: "asking" });
    let track: LocalAudioTrack | null = null;
    const owns = () =>
      !this.disposed &&
      this.desired &&
      this.room === room &&
      this.micTurn === turn &&
      this.value.publishAllowed &&
      room.state === ConnectionState.Connected;
    try {
      track = await createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });
      if (!owns()) {
        track.stop();
        return false;
      }
      this.mic = track;
      this.micEnded = () => {
        if (this.mic === track) this.stopMic();
      };
      track.mediaStreamTrack.addEventListener("ended", this.micEnded);
      await room.localParticipant.publishTrack(track, {
        source: Track.Source.Microphone,
      });
      if (!owns()) {
        track.stop();
        void room.localParticipant.unpublishTrack(track, true).catch(() => {});
        return false;
      }
      this.emit({ microphone: "on" });
      return true;
    } catch (error) {
      track?.stop();
      if (owns()) {
        this.stopMic();
        this.emit({
          microphone:
            error instanceof Error && error.name === "NotAllowedError"
              ? "denied"
              : "unavailable",
        });
      }
      return false;
    } finally {
      this.capturePending = false;
      this.emit({});
    }
  }
  muteOutput(muted: boolean) {
    this.audio.mute(muted);
    this.emit({ outputMuted: muted });
  }
  async selectOutput(id: string) {
    await this.audio.selectOutput(id);
  }
  get stats() {
    return {
      disposed: this.disposed,
      phase: this.value.phase,
      room: this.room?.state ?? "disconnected",
      remoteParticipants: this.room?.remoteParticipants.size ?? 0,
      pendingDisconnects: this.retiring.size,
      capturePending: this.capturePending,
      microphoneTracks:
        this.mic?.mediaStreamTrack.readyState === "live" ? 1 : 0,
      timers: this.disposed ? 0 : 1 + (this.retry ? 1 : 0),
      audio: this.audio.stats,
    };
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.stop();
    this.disposed = true;
    clearInterval(this.sample);
    document.removeEventListener("visibilitychange", this.visibility);
    this.value = Object.freeze({
      ...this.value,
      phase: "off",
      publishAllowed: false,
    });
    this.closing = Promise.allSettled([
      this.audio.close(),
      ...this.retiring,
    ]).then(() => {});
    return this.closing;
  }
}
