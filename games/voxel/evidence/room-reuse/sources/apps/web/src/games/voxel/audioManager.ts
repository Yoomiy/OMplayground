import {
  blockSoundStepPrefix,
  blockSoundUrl,
  randomStepVariantIndex,
  type BiomeId,
  type BlockSoundAction,
  type BlockSoundGroup,
  type StepSoundPrefix
} from "@playground/voxel-content";

export type VoxelEffectSound =
  | "swing"
  | "craft"
  | "hurt"
  | "eat"
  | "swallow"
  | "fuse"
  | "explosion";

export interface VoxelSoundDescriptor {
  readonly url: string | null;
  readonly action?: BlockSoundAction;
  readonly group?: BlockSoundGroup;
  readonly effect?: VoxelEffectSound;
  readonly volume: number;
}

type SoundSource = AudioScheduledSourceNode & AudioNode;

interface AmbientChannel {
  readonly biomeId: BiomeId;
  readonly gain: GainNode;
  readonly sources: SoundSource[];
  stopTimer: ReturnType<typeof setTimeout> | null;
}

interface MaterialPlayback {
  readonly volume: number;
  readonly rateMin: number;
  readonly rateMax: number;
}

const MATERIAL_PLAYBACK: Record<BlockSoundAction, MaterialPlayback> = {
  step: { volume: 1, rateMin: 0.9, rateMax: 1.1 },
  dig: { volume: 1, rateMin: 1.05, rateMax: 1.15 },
  place: { volume: 1, rateMin: 0.95, rateMax: 1.05 },
  break: { volume: 1, rateMin: 0.9, rateMax: 1.1 }
};

const EFFECT_URLS: Record<Exclude<VoxelEffectSound, "swing">, readonly string[]> = {
  craft: ["/minecraft-assets/sounds/random/pop.ogg"],
  hurt: ["/minecraft-assets/sounds/random/classic_hurt.ogg"],
  eat: [
    "/minecraft-assets/sounds/random/eat1.ogg",
    "/minecraft-assets/sounds/random/eat2.ogg",
    "/minecraft-assets/sounds/random/eat3.ogg"
  ],
  swallow: ["/minecraft-assets/sounds/random/burp.ogg"],
  fuse: ["/minecraft-assets/sounds/random/fuse.ogg"],
  explosion: [
    "/minecraft-assets/sounds/random/explode1.ogg",
    "/minecraft-assets/sounds/random/explode2.ogg",
    "/minecraft-assets/sounds/random/explode3.ogg",
    "/minecraft-assets/sounds/random/explode4.ogg"
  ]
};

/** Warmed on prime(); first play without preload may decode lazily. */
const PRELOAD_URLS: readonly string[] = [
  "/minecraft-assets/sounds/step/grass1.ogg",
  "/minecraft-assets/sounds/step/stone1.ogg",
  "/minecraft-assets/sounds/step/wood1.ogg",
  "/minecraft-assets/sounds/random/break.ogg",
  "/minecraft-assets/sounds/random/pop.ogg",
  "/minecraft-assets/sounds/random/classic_hurt.ogg",
  "/minecraft-assets/sounds/random/eat1.ogg",
  "/minecraft-assets/sounds/random/fuse.ogg",
  "/minecraft-assets/sounds/random/explode1.ogg"
];

const AMBIENT_PROFILES: Record<
  BiomeId,
  { readonly noiseFreq: number; readonly toneFreq: number; readonly gain: number }
> = {
  ocean: { noiseFreq: 260, toneFreq: 76, gain: 0.12 },
  beach: { noiseFreq: 320, toneFreq: 86, gain: 0.11 },
  desert: { noiseFreq: 1200, toneFreq: 102, gain: 0.065 },
  savanna: { noiseFreq: 900, toneFreq: 126, gain: 0.065 },
  forest: { noiseFreq: 1750, toneFreq: 208, gain: 0.075 },
  plains: { noiseFreq: 1180, toneFreq: 142, gain: 0.06 },
  mountains: { noiseFreq: 820, toneFreq: 96, gain: 0.075 },
  ice_mountains: { noiseFreq: 1450, toneFreq: 68, gain: 0.08 },
  iceplains: { noiseFreq: 1320, toneFreq: 72, gain: 0.075 }
};

type AudioContextConstructor = new () => AudioContext;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function pickRandom<T>(items: readonly T[], random: () => number): T {
  return items[Math.floor(random() * items.length)]!;
}

export function voxelSoundDescriptor(
  action: BlockSoundAction,
  group: BlockSoundGroup,
  volume = 0.5
): VoxelSoundDescriptor {
  const prefix = blockSoundStepPrefix(group);
  const variant =
    prefix !== null ? randomStepVariantIndex(prefix) : 1;
  return {
    url: blockSoundUrl(action, group, variant),
    action,
    group,
    volume: clamp01(volume)
  };
}

export function voxelEffectDescriptor(
  effect: VoxelEffectSound,
  volume = 0.5
): VoxelSoundDescriptor {
  if (effect === "swing") {
    return { url: null, effect, volume: clamp01(volume) };
  }
  return {
    url: pickRandom(EFFECT_URLS[effect], Math.random),
    effect,
    volume: clamp01(volume)
  };
}

/** Procedural biome ambient; no asset URL. */
export function ambientUrlForBiome(_biomeId: BiomeId): string {
  return "";
}

export function resolveVoxelSoundUrl(
  url: string,
  volume = 0.5
): VoxelSoundDescriptor | null {
  const stepMatch = url.match(/^\/minecraft-assets\/sounds\/step\/([a-z]+)(\d+)\.ogg$/);
  if (stepMatch) {
    const prefix = stepMatch[1] as StepSoundPrefix;
    const group = prefixToGroup(prefix);
    return {
      url,
      action: "step",
      group,
      volume: clamp01(volume)
    };
  }

  const randomMatch = url.match(/^\/minecraft-assets\/sounds\/random\/(.+)\.ogg$/);
  if (randomMatch) {
    const name = randomMatch[1]!;
    if (name === "pop") {
      return { url, effect: "craft", volume: clamp01(volume) };
    }
    if (name === "classic_hurt") {
      return { url, effect: "hurt", volume: clamp01(volume) };
    }
    if (name.startsWith("eat")) {
      return { url, effect: "eat", volume: clamp01(volume) };
    }
    if (name === "burp") {
      return { url, effect: "swallow", volume: clamp01(volume) };
    }
    if (name === "fuse") {
      return { url, effect: "fuse", volume: clamp01(volume) };
    }
    if (name.startsWith("explode")) {
      return { url, effect: "explosion", volume: clamp01(volume) };
    }
    if (name.startsWith("glass")) {
      return {
        url,
        action: "break",
        group: "glass",
        volume: clamp01(volume)
      };
    }
    if (name === "break") {
      return {
        url,
        action: "break",
        group: "stone",
        volume: clamp01(volume)
      };
    }
  }

  return null;
}

function prefixToGroup(prefix: StepSoundPrefix): BlockSoundGroup {
  if (prefix === "ladder") return "wood";
  return prefix;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeAmbient: AmbientChannel | null = null;
  private loopTimers = new Map<string, ReturnType<typeof setInterval>>();
  private disposed = false;
  private muted = false;
  private primed = false;
  private readonly random: () => number;
  private readonly masterVolume: number;
  private readonly bufferCache = new Map<string, AudioBuffer>();
  private readonly bufferLoads = new Map<string, Promise<AudioBuffer>>();

  constructor(options: { masterVolume?: number; random?: () => number } = {}) {
    this.masterVolume = options.masterVolume ?? 0.72;
    this.random = options.random ?? Math.random;
  }

  public prime(): void {
    if (this.muted || this.primed) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.primed = true;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => {
        // User gesture unlocks can still be denied by browser policy.
      });
    }
    for (const url of PRELOAD_URLS) {
      void this.loadBuffer(url).catch(() => {
        // Missing assets in dev before borrow script; playback retries on demand.
      });
    }
  }

  public playSFX(url: string, volume = 0.5): void {
    if (this.muted) return;
    const descriptor = resolveVoxelSoundUrl(url, volume);
    if (!descriptor) return;
    if (descriptor.effect) {
      this.playEffect(descriptor.effect, descriptor.volume, descriptor.url);
      return;
    }
    if (descriptor.action && descriptor.group) {
      this.playMaterial(descriptor.action, descriptor.group, descriptor.volume, descriptor.url);
    }
  }

  public playStep(group: BlockSoundGroup, volume = 0.32): void {
    this.playMaterial("step", group, volume);
  }

  public playDig(group: BlockSoundGroup, volume = 0.22): void {
    this.playMaterial("dig", group, volume);
  }

  public playBreak(group: BlockSoundGroup, volume = 0.58): void {
    this.playMaterial("break", group, volume);
  }

  public playPlace(group: BlockSoundGroup, volume = 0.42): void {
    this.playMaterial("place", group, volume);
  }

  public playSwing(volume = 0.25): void {
    this.playEffect("swing", volume);
  }

  public playCraft(volume = 0.36): void {
    this.playEffect("craft", volume);
  }

  public playHurt(volume = 0.34): void {
    this.playEffect("hurt", volume);
  }

  public playFuse(volume = 0.28): void {
    this.playEffect("fuse", volume);
  }

  public playExplosion(volume = 0.9): void {
    this.playEffect("explosion", volume);
  }

  public startEating(volume = 0.32): void {
    if (this.muted) return;
    if (this.loopTimers.has("eat")) return;
    this.playEffect("eat", volume);
    const timer = setInterval(() => this.playEffect("eat", volume), 290);
    this.loopTimers.set("eat", timer);
  }

  public stopEating(playSwallow = false): void {
    const timer = this.loopTimers.get("eat");
    if (timer !== undefined) {
      clearInterval(timer);
      this.loopTimers.delete("eat");
    }
    if (playSwallow) this.playEffect("swallow", 0.34);
  }

  public updateAmbient(biomeId: BiomeId): void {
    if (this.disposed || this.muted || this.activeAmbient?.biomeId === biomeId) return;
    const ctx = this.ensureContext();
    if (!ctx) return;
    const profile = AMBIENT_PROFILES[biomeId];
    const next = this.createAmbientChannel(ctx, biomeId, profile);
    const previous = this.activeAmbient;
    this.activeAmbient = next;

    const now = ctx.currentTime;
    next.gain.gain.cancelScheduledValues(now);
    next.gain.gain.setValueAtTime(0.0001, now);
    next.gain.gain.linearRampToValueAtTime(profile.gain, now + 1.6);

    if (previous) {
      previous.gain.gain.cancelScheduledValues(now);
      previous.gain.gain.setValueAtTime(previous.gain.gain.value, now);
      previous.gain.gain.linearRampToValueAtTime(0.0001, now + 1.4);
      previous.stopTimer = setTimeout(() => this.stopAmbient(previous), 1500);
    }
  }

  public dispose(): void {
    this.disposed = true;
    this.stopEating(false);
    for (const timer of this.loopTimers.values()) clearInterval(timer);
    this.loopTimers.clear();
    if (this.activeAmbient) {
      this.stopAmbient(this.activeAmbient);
      this.activeAmbient = null;
    }
    try {
      this.masterGain?.disconnect();
    } catch {
      // Best-effort teardown; the browser may already be disposing the graph.
    }
    if (this.context) {
      try {
        void this.context.close();
      } catch {
        // Best-effort cleanup
      }
    }
    this.masterGain = null;
    this.context = null;
    this.bufferCache.clear();
    this.bufferLoads.clear();
  }

  public setMuted(muted: boolean): void {
    if (this.disposed || this.muted === muted) return;
    this.muted = muted;
    if (this.masterGain) {
      this.masterGain.gain.value = muted ? 0 : this.masterVolume;
    }
    if (!muted) return;
    this.stopEating(false);
    if (this.activeAmbient) {
      this.stopAmbient(this.activeAmbient);
      this.activeAmbient = null;
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.disposed || this.muted) return null;
    if (this.context) return this.context;
    if (typeof window === "undefined") return null;
    const win = window as unknown as Window & {
      webkitAudioContext?: AudioContextConstructor;
    };
    const Ctor = window.AudioContext ?? win.webkitAudioContext;
    if (!Ctor) return null;
    try {
      const ctx = new Ctor();
      const master = ctx.createGain();
      master.gain.value = this.masterVolume;
      master.connect(ctx.destination);
      this.context = ctx;
      this.masterGain = master;
      return ctx;
    } catch {
      return null;
    }
  }

  private async loadBuffer(url: string): Promise<AudioBuffer> {
    const cached = this.bufferCache.get(url);
    if (cached) return cached;

    const inFlight = this.bufferLoads.get(url);
    if (inFlight) return inFlight;

    const ctx = this.ensureContext();
    if (!ctx) throw new Error("AudioContext unavailable");

    const promise = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
        return res.arrayBuffer();
      })
      .then((data) =>
        new Promise<AudioBuffer>((resolve, reject) => {
          ctx.decodeAudioData(data, resolve, reject);
        })
      )
      .then((buffer) => {
        this.bufferCache.set(url, buffer);
        this.bufferLoads.delete(url);
        return buffer;
      })
      .catch((err) => {
        this.bufferLoads.delete(url);
        throw err;
      });

    this.bufferLoads.set(url, promise);
    return promise;
  }

  private playBuffer(url: string, volume: number, playbackRate?: number): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!ctx || !master) return;

    const rate =
      playbackRate ??
      0.9 + this.random() * 0.2;
    const volJitter = 1 + (this.random() * 0.1 - 0.05);

    void this.loadBuffer(url)
      .then((buffer) => {
        if (this.disposed || this.muted) return;
        const now = ctx.currentTime;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = rate;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.linearRampToValueAtTime(clamp01(volume) * volJitter, now + 0.008);
        gain.gain.linearRampToValueAtTime(0.0001, now + buffer.duration / rate + 0.02);
        source.connect(gain);
        gain.connect(master);
        source.start(now);
        source.stop(now + buffer.duration / rate + 0.05);
        this.disconnectLater([source, gain], buffer.duration / rate + 0.1);
      })
      .catch(() => {
        // Asset missing or decode failed.
      });
  }

  private materialUrl(action: BlockSoundAction, group: BlockSoundGroup): string | null {
    if (group === "silent") return null;
    const prefix = blockSoundStepPrefix(group);
    if (prefix) {
      const variant = randomStepVariantIndex(prefix, this.random);
      return blockSoundUrl(action, group, variant);
    }
    if (action === "break") {
      return "/minecraft-assets/sounds/random/break.ogg";
    }
    return null;
  }

  private playMaterial(
    action: BlockSoundAction,
    group: BlockSoundGroup,
    volume: number,
    specificUrl?: string | null
  ): void {
    const url = specificUrl ?? this.materialUrl(action, group);
    if (!url) return;
    const playback = MATERIAL_PLAYBACK[action];
    const rate =
      playback.rateMin + this.random() * (playback.rateMax - playback.rateMin);
    this.playBuffer(url, volume * playback.volume, rate);
  }

  private playEffect(effect: VoxelEffectSound, volume: number, specificUrl?: string | null): void {
    if (effect === "swing") {
      this.playToneSweep(320, 95, 0.16, clamp01(volume) * 0.12);
      return;
    }
    const url = specificUrl ?? pickRandom(EFFECT_URLS[effect], this.random);
    this.playBuffer(url, volume);
  }

  private createNoiseBuffer(ctx: AudioContext, durationSeconds: number): AudioBuffer {
    const frameCount = Math.max(1, Math.floor(ctx.sampleRate * durationSeconds));
    const buffer = ctx.createBuffer(1, frameCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i++) {
      last = last * 0.38 + (this.random() * 2 - 1) * 0.62;
      data[i] = last;
    }
    return buffer;
  }

  private playToneSweep(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number
  ): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(startFrequency, now);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), now + duration);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.01);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    this.disconnectLater([osc, gain], duration + 0.08);
  }

  private createAmbientChannel(
    ctx: AudioContext,
    biomeId: BiomeId,
    profile: { readonly noiseFreq: number; readonly toneFreq: number; readonly gain: number }
  ): AmbientChannel {
    const master = this.masterGain;
    if (!master) throw new Error("Audio master graph is unavailable");

    const channelGain = ctx.createGain();
    channelGain.gain.value = 0.0001;
    channelGain.connect(master);

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 2.5);
    noise.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = profile.noiseFreq;
    filter.Q.value = 0.35;
    noise.connect(filter);
    filter.connect(channelGain);

    const tone = ctx.createOscillator();
    tone.type = "sine";
    tone.frequency.value = profile.toneFreq;
    const toneGain = ctx.createGain();
    toneGain.gain.value = profile.gain * 0.22;
    tone.connect(toneGain);
    toneGain.connect(channelGain);

    const now = ctx.currentTime;
    noise.start(now);
    tone.start(now);

    return {
      biomeId,
      gain: channelGain,
      sources: [noise, tone],
      stopTimer: null
    };
  }

  private stopAmbient(channel: AmbientChannel): void {
    if (channel.stopTimer !== null) {
      clearTimeout(channel.stopTimer);
      channel.stopTimer = null;
    }
    for (const source of channel.sources) {
      try {
        source.stop();
      } catch {
        // Already stopped.
      }
      try {
        source.disconnect();
      } catch {
        // Already disconnected.
      }
    }
    try {
      channel.gain.disconnect();
    } catch {
      // Already disconnected.
    }
  }

  private disconnectLater(nodes: AudioNode[], seconds: number): void {
    setTimeout(() => {
      for (const node of nodes) {
        try {
          node.disconnect();
        } catch {
          // Already disconnected or context is shutting down.
        }
      }
    }, Math.ceil(seconds * 1000));
  }
}
