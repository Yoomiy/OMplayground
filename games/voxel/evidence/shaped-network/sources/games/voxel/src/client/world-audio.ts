import type { Environment } from '../shared/environment.ts';
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };
/** Game effects only. Voice/media have a separate platform adapter and ownership. */
export class WorldAudio {
  readonly supported = typeof AudioContext === 'function';
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientNodes: AudioNode[] = [];
  private ambient: AudioBufferSourceNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private disposed = false;
  private active = false;
  private muted = false;
  private nextChirp = 0;
  private nextAmbient = 0;
  private effects = 0;
  private dropped = 0;
  private listenerPosition = [0, 0, 0];
  private lastSource: number[] | null = null;
  private closing: Promise<void> | null = null;
  get stats() {
    return {
      supported: this.supported,
      contexts: this.context ? 1 : 0,
      state:
        this.context?.state ??
        (this.disposed ? 'closed' : this.supported ? 'locked' : 'unsupported'),
      active: this.active,
      muted: this.muted,
      voices: this.voices.size,
      effects: this.effects,
      gain: this.output?.gain.value ?? 0,
      dropped: this.dropped,
      listener: this.context?.listener.positionX
        ? [
            this.context.listener.positionX.value,
            this.context.listener.positionY.value,
            this.context.listener.positionZ.value,
          ]
        : [...this.listenerPosition],
      lastSource: this.lastSource ? [...this.lastSource] : null,
    };
  }
  unlock(): void {
    if (this.disposed || !this.supported || this.muted) return;
    try {
      if (!this.context) {
        const context = (this.context = new AudioContext());
        const output = (this.output = context.createGain());
        output.gain.value = 0;
        output.connect(context.destination);
        const buffer = (this.noise = context.createBuffer(
          1,
          context.sampleRate * 2,
          context.sampleRate,
        ));
        const samples = buffer.getChannelData(0);
        let random = 27;
        for (let i = 0; i < samples.length; i++) {
          random = Math.imul(random, 1664525) + 1013904223;
          samples[i] = ((random >>> 0) / 4294967296) * 2 - 1;
        }
        const source = (this.ambient = context.createBufferSource()),
          filter = context.createBiquadFilter();
        source.buffer = buffer;
        source.loop = true;
        filter.type = 'lowpass';
        filter.frequency.value = 450;
        const gain = (this.ambientGain = context.createGain());
        gain.gain.value = 0;
        source.connect(filter).connect(gain).connect(output);
        source.start();
        this.ambientNodes = [filter, gain];
      }
      void this.context.resume().catch(() => {});
      this.gain();
    } catch {
      void this.dispose();
    }
  }
  setMuted(muted: boolean): void {
    if (muted === this.muted) return;
    this.muted = muted;
    this.gain();
  }
  setActive(active: boolean): void {
    const next = active && !this.disposed;
    if (next === this.active) return;
    this.active = next;
    this.gain();
  }
  private gain(): void {
    if (!this.context || !this.output || this.disposed) return;
    this.output.gain.setTargetAtTime(
      this.active && !this.muted ? 0.22 : 0,
      this.context.currentTime,
      0.025,
    );
  }
  frame(
    position: readonly number[],
    yaw: number,
    pitch: number,
    environment: Environment,
    openSky: boolean,
    active: boolean,
  ): void {
    this.setActive(active);
    this.listenerPosition = [position[0], position[1] + 1.62, position[2]];
    const context = this.context;
    if (!context || this.disposed) return;
    const listener = context.listener;
    const c = Math.cos(pitch),
      forward = [Math.sin(yaw) * c, Math.sin(pitch), -Math.cos(yaw) * c];
    const up = [-Math.sin(yaw) * Math.sin(pitch), c, Math.cos(yaw) * Math.sin(pitch)];
    if (typeof listener.positionX === 'object') {
      for (const [i, axis] of ['X', 'Y', 'Z'].entries()) {
        (listener[`position${axis}` as 'positionX'] as AudioParam).value = this.listenerPosition[i];
        (listener[`forward${axis}` as 'forwardX'] as AudioParam).value = forward[i];
        (listener[`up${axis}` as 'upX'] as AudioParam).value = up[i];
      }
    } else {
      listener.setPosition(...(this.listenerPosition as [number, number, number]));
      listener.setOrientation(
        ...(forward as [number, number, number]),
        ...(up as [number, number, number]),
      );
    }
    if (this.ambientGain && context.currentTime >= this.nextAmbient) {
      this.nextAmbient = context.currentTime + 0.25;
      this.ambientGain.gain.setTargetAtTime(
        (openSky ? 1 : 0.12) * (0.006 + environment.rain * 0.045),
        context.currentTime,
        0.5,
      );
    }
    if (
      this.active &&
      !this.muted &&
      context.state === 'running' &&
      context.currentTime > this.nextChirp &&
      environment.rain < 0.2
    ) {
      this.nextChirp = context.currentTime + 6 + Math.sin(environment.seconds) ** 2 * 4;
      this.chirp(environment.daylight > 0.5);
    }
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[]): void {
    const voice = { source, nodes };
    this.voices.add(voice);
    source.onended = () => {
      for (const node of nodes) node.disconnect();
      source.disconnect();
      this.voices.delete(voice);
    };
  }
  private chirp(day: boolean): void {
    const context = this.context;
    if (!context || !this.output || this.voices.size >= 16) return;
    const source = context.createOscillator(),
      gain = context.createGain(),
      now = context.currentTime;
    source.type = 'sine';
    source.frequency.setValueAtTime(day ? 1700 : 3800, now);
    source.frequency.exponentialRampToValueAtTime(day ? 2500 : 4100, now + 0.08);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
    source.connect(gain).connect(this.output);
    this.track(source, [gain]);
    source.start(now);
    source.stop(now + 0.13);
  }
  effect(position: readonly number[], group: string, removal: boolean): void {
    const context = this.context;
    if (
      !context ||
      !this.noise ||
      !this.output ||
      this.disposed ||
      !this.active ||
      this.muted ||
      context.state !== 'running'
    )
      return;
    if (
      this.voices.size >= 16 ||
      Math.hypot(...position.map((v, i) => v - this.listenerPosition[i])) > 32
    ) {
      this.dropped++;
      return;
    }
    const source = context.createBufferSource(),
      filter = context.createBiquadFilter(),
      gain = context.createGain(),
      panner = context.createPanner();
    const now = context.currentTime;
    source.buffer = this.noise;
    source.playbackRate.value = group === 'glass' ? 2 : group === 'wood' ? 0.9 : 1.2;
    filter.type = group === 'water' || group === 'explosion' ? 'lowpass' : 'bandpass';
    filter.frequency.value =
      group === 'explosion'
        ? 240
        : group === 'wood'
          ? 420
          : group === 'glass'
            ? 2100
            : group === 'grass'
              ? 1300
              : group === 'water'
                ? 500
                : 780;
    filter.Q.value = 0.6;
    const duration = group === 'explosion' ? 0.4 : 0.13;
    gain.gain.setValueAtTime(group === 'explosion' ? 0.45 : removal ? 0.22 : 0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    panner.panningModel = 'equalpower';
    panner.distanceModel = 'inverse';
    panner.refDistance = 1;
    panner.maxDistance = 32;
    panner.rolloffFactor = 1.2;
    panner.positionX.value = position[0];
    panner.positionY.value = position[1];
    panner.positionZ.value = position[2];
    source.connect(filter).connect(gain).connect(panner).connect(this.output);
    this.track(source, [filter, gain, panner]);
    source.start(now, (this.effects * 0.173) % 1.7, duration + 0.01);
    this.effects++;
    this.lastSource = [panner.positionX.value, panner.positionY.value, panner.positionZ.value];
  }
  dispose(): Promise<void> {
    if (this.disposed) return this.closing ?? Promise.resolve();
    this.disposed = true;
    this.active = false;
    for (const voice of this.voices) {
      voice.source.onended = null;
      try {
        voice.source.stop();
      } catch {}
      voice.source.disconnect();
      for (const node of voice.nodes) node.disconnect();
    }
    this.voices.clear();
    if (this.ambient) {
      try {
        this.ambient.stop();
      } catch {}
      this.ambient.disconnect();
    }
    for (const node of this.ambientNodes) node.disconnect();
    this.output?.disconnect();
    this.output = this.ambientGain = null;
    this.ambient = null;
    this.noise = null;
    this.ambientNodes = [];
    const context = this.context;
    this.closing =
      context && context.state !== 'closed'
        ? context
            .close()
            .catch(() => {})
            .then(() => {
              this.context = null;
            })
        : Promise.resolve().then(() => {
            this.context = null;
          });
    return this.closing;
  }
}
