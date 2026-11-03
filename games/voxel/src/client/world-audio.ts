import type { Environment } from '../shared/environment.ts';
export type MaterialAction = 'step' | 'dig' | 'break' | 'place';
export type EffectSound = 'pickup' | 'hurt' | 'eat' | 'swallow' | 'craft' | 'fuse' | 'explosion';
const assets = import.meta.glob('./sounds/**/*.ogg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;
const effects: Record<EffectSound, string[]> = {
  pickup: ['random/pop.ogg'],
  craft: ['random/pop.ogg'],
  hurt: ['random/classic_hurt.ogg'],
  eat: [1, 2, 3].map((n) => `random/eat${n}.ogg`),
  swallow: ['random/burp.ogg'],
  fuse: ['random/fuse.ogg'],
  explosion: [1, 2, 3, 4].map((n) => `random/explode${n}.ogg`),
};
export const ambientProfiles = {
  ocean: [260, 76, 0.12],
  beach: [320, 86, 0.11],
  desert: [1200, 102, 0.065],
  savanna: [900, 126, 0.065],
  forest: [1750, 208, 0.075],
  plains: [1180, 142, 0.06],
  mountains: [820, 96, 0.075],
  ice_mountains: [1450, 68, 0.08],
  iceplains: [1320, 72, 0.075],
} as const;
export function ambientBiome(biome: string): keyof typeof ambientProfiles {
  if (['FrozenOcean', 'FrozenRiver', 'SnowyBeach', 'SnowyPlains', 'SnowyTaiga'].includes(biome))
    return 'iceplains';
  if (biome === 'SnowyPeaks') return 'ice_mountains';
  if (['Ocean', 'DeepOcean', 'River'].includes(biome)) return 'ocean';
  if (biome === 'Beach') return 'beach';
  if (['Forest', 'BirchForest', 'Taiga'].includes(biome)) return 'forest';
  if (biome === 'Desert') return 'desert';
  if (biome === 'Savanna') return 'savanna';
  if (biome === 'Mountains') return 'mountains';
  return 'plains';
}
type AmbientChannel = {
  source: AudioBufferSourceNode;
  tone: OscillatorNode;
  nodes: AudioNode[];
  gain: GainNode;
  profile: keyof typeof ambientProfiles;
  retiring: number | null;
};
type Voice = { source: AudioScheduledSourceNode; nodes: AudioNode[] };
/** Game effects only. Voice/media have a separate platform adapter and ownership. */
export class WorldAudio {
  readonly supported = typeof AudioContext === 'function';
  private context: AudioContext | null = null;
  private output: GainNode | null = null;
  private ambientChannels: AmbientChannel[] = [];
  private rainSource: AudioBufferSourceNode | null = null;
  private rainGain: GainNode | null = null;
  private rainLoading = false;
  private buffers = new Map<string, AudioBuffer>();
  private loads = new Map<string, Promise<AudioBuffer | null>>();
  private abort = new AbortController();
  private generation = 0;
  private biome: keyof typeof ambientProfiles = 'plains';
  private noise: AudioBuffer | null = null;
  private voices = new Set<Voice>();
  private disposed = false;
  private active = false;
  private muted = false;
  private nextChirp = 0;
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
      biome: this.biome,
      ambientChannels: this.ambientChannels.length,
      rain: this.rainGain?.gain.value ?? 0,
      buffers: this.buffers.size,
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
    if (this.context?.state === 'running') return;
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
        // Warm variants once; effects share decoded buffers and in-flight loads.
        for (const path of Object.keys(assets))
          if (!path.includes('/ambient/')) void this.load(path);
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
    this.generation++;
    this.gain();
  }
  private gain(): void {
    if (!this.context || !this.output || this.disposed) return;
    this.output.gain.setTargetAtTime(
      this.active && !this.muted ? 0.7 : 0,
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
    biome = 'Plains',
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
    this.biome = ambientBiome(biome);
    this.updateAmbience(openSky, environment.rain);

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
  private load(path: string): Promise<AudioBuffer | null> {
    const key = path.startsWith('./') ? path : `./sounds/${path}`;
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = this.loads.get(key);
    if (pending) return pending;
    const context = this.context,
      url = assets[key];
    if (!context || !url || this.disposed) return Promise.resolve(null);
    const request = fetch(url, { signal: this.abort.signal })
      .then((response) => {
        if (!response.ok) throw new Error('sound download failed');
        return response.arrayBuffer();
      })
      .then((bytes) => context.decodeAudioData(bytes))
      .then((buffer) => {
        if (this.disposed) return null;
        this.buffers.set(key, buffer);
        return buffer;
      })
      .catch(() => null)
      .finally(() => this.loads.delete(key));
    this.loads.set(key, request);
    return request;
  }
  private updateAmbience(openSky: boolean, rain: number): void {
    const context = this.context;
    if (!context || !this.output || !this.noise || this.disposed) return;
    const now = context.currentTime;
    for (const channel of [...this.ambientChannels]) {
      if (channel.retiring !== null && now >= channel.retiring) {
        channel.source.stop();
        channel.tone.stop();
        channel.source.disconnect();
        channel.tone.disconnect();
        for (const node of channel.nodes) node.disconnect();
        this.ambientChannels.splice(this.ambientChannels.indexOf(channel), 1);
      }
    }
    if (
      !this.ambientChannels.some(
        (channel) => channel.profile === this.biome && channel.retiring === null,
      )
    ) {
      for (const channel of this.ambientChannels)
        if (channel.retiring === null) {
          channel.gain.gain.cancelScheduledValues(now);
          channel.gain.gain.setValueAtTime(channel.gain.gain.value, now);
          channel.gain.gain.linearRampToValueAtTime(0.0001, now + 1.4);
          channel.retiring = now + 1.5;
        }
      const [frequency, toneFrequency, volume] = ambientProfiles[this.biome];
      const source = context.createBufferSource(),
        filter = context.createBiquadFilter(),
        tone = context.createOscillator(),
        toneGain = context.createGain(),
        gain = context.createGain();
      source.buffer = this.noise;
      source.loop = true;
      filter.type = 'lowpass';
      filter.frequency.value = frequency;
      filter.Q.value = 0.35;
      tone.frequency.value = toneFrequency;
      toneGain.gain.value = volume * 0.22;
      source.connect(filter).connect(gain);
      tone.connect(toneGain).connect(gain);
      gain.connect(this.output);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 1.6);
      source.start();
      tone.start();
      this.ambientChannels.push({
        source,
        tone,
        nodes: [filter, toneGain, gain],
        gain,
        profile: this.biome,
        retiring: null,
      });
    }
    if (!this.rainSource && !this.rainLoading && rain > 0) {
      this.rainLoading = true;
      void this.load(`ambient/weather/rain${1 + Math.floor(Math.random() * 8)}.ogg`).then(
        (buffer) => {
          this.rainLoading = false;
          if (!buffer || this.disposed || !this.output) return;
          const source = context.createBufferSource(),
            gain = context.createGain();
          source.buffer = buffer;
          source.loop = true;
          gain.gain.value = 0;
          source.connect(gain).connect(this.output);
          source.start();
          this.rainSource = source;
          this.rainGain = gain;
        },
      );
    }
    this.rainGain?.gain.setTargetAtTime(rain * (openSky ? 0.3 : 0.035), now, 0.5);
  }
  material(action: MaterialAction, position: readonly number[], group: string): void {
    if (group === 'silent') return;
    const prefix = [
      'grass',
      'stone',
      'sand',
      'wood',
      'leaves',
      'cloth',
      'gravel',
      'snow',
      'ladder',
    ].includes(group)
      ? group
      : group === 'plant'
        ? 'grass'
        : group === 'water'
          ? 'sand'
          : 'stone';
    const paths =
      action === 'break' && group === 'glass'
        ? [1, 2, 3].map((n) => `random/glass${n}.ogg`)
        : Object.keys(assets).filter((key) => key.startsWith(`./sounds/step/${prefix}`));
    const volume = { step: 0.32, dig: 0.22, break: 0.58, place: 0.42 }[action];
    const rate = action === 'dig' ? 1.05 + Math.random() * 0.1 : 0.9 + Math.random() * 0.2;
    this.play(paths, volume, position, rate);
  }
  effect(effect: EffectSound, position?: readonly number[]): void {
    const volume = {
      pickup: 0.3,
      craft: 0.36,
      hurt: 0.34,
      eat: 0.38,
      swallow: 0.34,
      fuse: 0.32,
      explosion: 0.95,
    }[effect];
    this.play(effects[effect], volume, position, 1, effect === 'explosion');
    if (effect === 'eat') this.play(effects.swallow, 0.34, position, 1, false, 0.6);
  }
  private play(
    paths: readonly string[],
    volume: number,
    position?: readonly number[],
    rate = 1,
    priority = false,
    delay = 0,
  ): void {
    const context = this.context,
      generation = this.generation;
    if (
      !context ||
      !this.output ||
      this.disposed ||
      !this.active ||
      this.muted ||
      context.state !== 'running' ||
      !paths.length
    )
      return;
    if (position && Math.hypot(...position.map((v, i) => v - this.listenerPosition[i])) > 48) {
      this.dropped++;
      return;
    }
    const started = performance.now();
    void this.load(paths[Math.floor(Math.random() * paths.length)]).then((buffer) => {
      if (
        !buffer ||
        this.disposed ||
        generation !== this.generation ||
        !this.active ||
        this.muted ||
        !this.output ||
        performance.now() - started > 1000
      )
        return;
      if (this.voices.size >= 16) {
        if (!priority) {
          this.dropped++;
          return;
        }
        const oldest = this.voices.values().next().value;
        if (oldest) {
          oldest.source.onended = null;
          oldest.source.stop();
          oldest.source.disconnect();
          for (const node of oldest.nodes) node.disconnect();
          this.voices.delete(oldest);
        }
      }
      const source = context.createBufferSource(),
        gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = rate;
      gain.gain.value = volume;
      source.connect(gain);
      const nodes: AudioNode[] = [gain];
      if (position) {
        const panner = context.createPanner();
        panner.panningModel = 'equalpower';
        panner.distanceModel = 'inverse';
        panner.refDistance = 2;
        panner.maxDistance = 48;
        panner.rolloffFactor = 1.2;
        panner.positionX.value = position[0];
        panner.positionY.value = position[1];
        panner.positionZ.value = position[2];
        gain.connect(panner).connect(this.output);
        nodes.push(panner);
        this.lastSource = [...position];
      } else gain.connect(this.output);
      this.track(source, nodes);
      source.start(context.currentTime + delay);
      this.effects++;
    });
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
    this.abort.abort();
    this.buffers.clear();
    this.loads.clear();
    for (const channel of this.ambientChannels) {
      channel.source.stop();
      channel.tone.stop();
      channel.source.disconnect();
      channel.tone.disconnect();
      for (const node of channel.nodes) node.disconnect();
    }
    this.ambientChannels = [];
    this.rainSource?.stop();
    this.rainSource?.disconnect();
    this.rainGain?.disconnect();
    this.rainSource = null;
    this.rainGain = null;
    this.output?.disconnect();
    this.output = null;
    this.noise = null;
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
