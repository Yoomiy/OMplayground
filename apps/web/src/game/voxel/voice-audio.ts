import type { VoiceScene } from "@playground/voxel-runtime";
type Peer = {
  track: MediaStreamTrack;
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  panner: PannerNode;
  ended: () => void;
  driver: HTMLAudioElement;
  blocked: boolean;
};
/** Owns one output mix. Remote tracks remain owned by their media transport. */
export class VoiceAudio {
  private host: HTMLElement;
  private context: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private output: HTMLAudioElement | null = null;
  private master: GainNode | null = null;
  private peers = new Map<string, Peer>();
  private closing: Promise<void> | null = null;
  private muted = false;
  private disposed = false;
  constructor(host: HTMLElement) {
    this.host = host;
  }
  /** Call synchronously from a user gesture, before awaiting media admission. */
  async activate(): Promise<boolean> {
    if (this.disposed) return false;
    if (!this.context) {
      const context = new AudioContext(),
        destination = context.createMediaStreamDestination(),
        output = document.createElement("audio"),
        master = context.createGain();
      this.context = context;
      this.destination = destination;
      this.output = output;
      this.master = master;
      master.gain.value = this.muted ? 0 : 1;
      master.connect(destination);
      output.hidden = true;
      output.autoplay = true;
      output.setAttribute("playsinline", "");
      output.dataset.voxelVoiceOutput = "true";
      output.srcObject = destination.stream;
      this.host.appendChild(output);
    }
    const results = await Promise.allSettled([
      this.context.resume(),
      this.output!.play(),
      ...[...this.peers.values()].map((peer) => this.playDriver(peer)),
    ]);
    return (
      !this.disposed &&
      results.every((r) => r.status === "fulfilled") &&
      this.context.state === "running"
    );
  }
  add(id: string, track: MediaStreamTrack): void {
    if (this.disposed) return;
    if (!id || track.kind !== "audio" || track.readyState === "ended") return;
    if (!this.context || !this.master)
      throw new Error("Voice audio has not been activated");
    this.remove(id);
    const stream = new MediaStream([track]),
      driver = document.createElement("audio"),
      source = this.context.createMediaStreamSource(stream),
      gain = this.context.createGain(),
      filter = this.context.createBiquadFilter(),
      panner = this.context.createPanner();
    gain.gain.value = 0;
    filter.type = "lowpass";
    filter.frequency.value = 18000;
    panner.panningModel = "HRTF";
    panner.rolloffFactor = 0;
    source.connect(gain).connect(filter).connect(panner).connect(this.master);
    const ended = () => {
      if (this.peers.get(id)?.track === track) this.remove(id);
    };
    track.addEventListener("ended", ended);
    // Chromium can receive RTP without decoding samples for a WebAudio-only
    // consumer. An inaudible media element drives decoding; only the spatial
    // output mix is audible. Never stop this transport-owned input track.
    driver.hidden = true;
    driver.autoplay = true;
    driver.volume = 0;
    driver.setAttribute("playsinline", "");
    driver.dataset.voxelVoiceInput = "true";
    driver.srcObject = stream;
    this.host.appendChild(driver);
    const peer = {
      track,
      source,
      gain,
      filter,
      panner,
      ended,
      driver,
      blocked: false,
    };
    this.peers.set(id, peer);
    void this.playDriver(peer).catch(() => {});
  }
  private async playDriver(peer: Peer) {
    try {
      await peer.driver.play();
      peer.blocked = false;
    } catch (error) {
      peer.blocked = true;
      throw error;
    }
  }
  remove(id: string): void {
    const peer = this.peers.get(id);
    if (!peer) return;
    this.peers.delete(id);
    peer.track.removeEventListener("ended", peer.ended);
    peer.driver.pause();
    peer.driver.srcObject = null;
    peer.driver.remove();
    peer.source.disconnect();
    peer.gain.disconnect();
    peer.filter.disconnect();
    peer.panner.disconnect();
  }
  scene(scene: VoiceScene | null): void {
    const context = this.context;
    if (!context || this.disposed) return;
    const sources = new Map(
        scene?.sources.map((source) => [source.id, source]) ?? [],
      ),
      now = context.currentTime;
    if (scene) {
      const listener = context.listener;
      // Subtract absolute double-precision positions before WebAudio's float32
      // nodes, so terrain-origin shifts and distant worlds do not move voices.
      for (const [parameter, value] of [
        [listener.positionX, 0],
        [listener.positionY, 0],
        [listener.positionZ, 0],
        [listener.forwardX, scene.listener.forward[0]],
        [listener.forwardY, scene.listener.forward[1]],
        [listener.forwardZ, scene.listener.forward[2]],
        [listener.upX, scene.listener.up[0]],
        [listener.upY, scene.listener.up[1]],
        [listener.upZ, scene.listener.up[2]],
      ] as const)
        parameter.setValueAtTime(value, now);
    }
    for (const [id, peer] of this.peers) {
      const source = sources.get(id);
      peer.gain.gain.setTargetAtTime(source?.gain ?? 0, now, 0.025);
      peer.filter.frequency.setTargetAtTime(
        source?.occluded ? 900 : 18000,
        now,
        0.025,
      );
      if (source && scene) {
        peer.panner.positionX.setValueAtTime(
          source.position[0] - scene.listener.position[0],
          now,
        );
        peer.panner.positionY.setValueAtTime(
          source.position[1] - scene.listener.position[1],
          now,
        );
        peer.panner.positionZ.setValueAtTime(
          source.position[2] - scene.listener.position[2],
          now,
        );
      }
    }
  }
  mute(muted: boolean): void {
    this.muted = muted;
    if (this.context)
      this.master?.gain.setTargetAtTime(
        muted ? 0 : 1,
        this.context.currentTime,
        0.025,
      );
  }
  async selectOutput(id: string): Promise<void> {
    if (
      this.disposed ||
      !this.output ||
      typeof this.output.setSinkId !== "function"
    )
      throw new Error("Voice output selection unavailable");
    await this.output.setSinkId(id);
  }
  get stats() {
    return {
      disposed: this.disposed,
      context: this.context?.state ?? (this.disposed ? "closed" : "locked"),
      tracks: this.peers.size,
      nodes:
        this.peers.size * 4 +
        (this.master ? 1 : 0) +
        (this.destination ? 1 : 0),
      outputs: this.output ? 1 : 0,
      inputs: this.peers.size,
      blockedInputs: [...this.peers.values()].filter((p) => p.blocked).length,
      outputSelection:
        !!this.output && typeof this.output.setSinkId === "function",
    };
  }
  close(): Promise<void> {
    if (this.closing) return this.closing;
    this.disposed = true;
    for (const id of [...this.peers.keys()]) this.remove(id);
    this.master?.disconnect();
    this.master = null;
    this.output?.pause();
    if (this.output) {
      this.output.srcObject = null;
      this.output.remove();
      this.output = null;
    }
    this.destination?.stream.getTracks().forEach((track) => track.stop());
    this.destination?.disconnect();
    this.destination = null;
    const context = this.context;
    this.closing = (
      context && context.state !== "closed"
        ? context.close()
        : Promise.resolve()
    ).finally(() => {
      this.context = null;
    });
    return this.closing;
  }
}
