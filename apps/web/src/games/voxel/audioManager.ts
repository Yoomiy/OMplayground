import {
  BIOME_DEFS,
  blockSoundUrl,
  type BiomeId,
  type BlockSoundAction,
  type BlockSoundGroup
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

interface GroupProfile {
  readonly filterType: BiquadFilterType;
  readonly frequency: number;
  readonly q: number;
  readonly gain: number;
  readonly toneFrequency?: number;
}

const GROUP_PROFILES: Record<BlockSoundGroup, GroupProfile> = {
  silent: { filterType: "lowpass", frequency: 1000, q: 0.2, gain: 0 },
  grass: { filterType: "bandpass", frequency: 520, q: 0.7, gain: 0.55 },
  stone: { filterType: "highpass", frequency: 650, q: 0.9, gain: 0.62, toneFrequency: 220 },
  sand: { filterType: "bandpass", frequency: 1050, q: 0.45, gain: 0.42 },
  wood: { filterType: "bandpass", frequency: 360, q: 1.2, gain: 0.58, toneFrequency: 155 },
  leaves: { filterType: "bandpass", frequency: 1400, q: 0.65, gain: 0.34 },
  cloth: { filterType: "lowpass", frequency: 740, q: 0.25, gain: 0.34 },
  glass: { filterType: "highpass", frequency: 1700, q: 1.6, gain: 0.34, toneFrequency: 880 },
  gravel: { filterType: "bandpass", frequency: 820, q: 0.9, gain: 0.58 },
  snow: { filterType: "lowpass", frequency: 920, q: 0.55, gain: 0.31 },
  plant: { filterType: "bandpass", frequency: 1180, q: 0.45, gain: 0.28 },
  metal: { filterType: "highpass", frequency: 900, q: 1.4, gain: 0.4, toneFrequency: 520 },
  water: { filterType: "lowpass", frequency: 430, q: 0.45, gain: 0.28 }
};

const EFFECT_URLS: Record<VoxelEffectSound, string> = {
  swing: "/sounds/effects/swing.mp3",
  craft: "/sounds/effects/pop.mp3",
  hurt: "/sounds/effects/hurt.mp3",
  eat: "/sounds/effects/eat.mp3",
  swallow: "/sounds/effects/swallow.mp3",
  fuse: "/sounds/effects/fuse.mp3",
  explosion: "/sounds/effects/explosion.mp3"
};

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

export function voxelSoundDescriptor(
  action: BlockSoundAction,
  group: BlockSoundGroup,
  volume = 0.5
): VoxelSoundDescriptor {
  return {
    url: blockSoundUrl(action, group),
    action,
    group,
    volume: clamp01(volume)
  };
}

export function voxelEffectDescriptor(
  effect: VoxelEffectSound,
  volume = 0.5
): VoxelSoundDescriptor {
  return {
    url: EFFECT_URLS[effect],
    effect,
    volume: clamp01(volume)
  };
}

export function ambientUrlForBiome(biomeId: BiomeId): string {
  return BIOME_DEFS[biomeId].ambientSoundUrl;
}

export function resolveVoxelSoundUrl(
  url: string,
  volume = 0.5
): VoxelSoundDescriptor | null {
  const materialMatch = url.match(/^\/sounds\/(step|dig|break|place)\/([a-z_]+)\.mp3$/);
  if (materialMatch) {
    return {
      url,
      action: materialMatch[1] as BlockSoundAction,
      group: materialMatch[2] as BlockSoundGroup,
      volume: clamp01(volume)
    };
  }
  const effect = Object.entries(EFFECT_URLS).find(([, effectUrl]) => effectUrl === url)?.[0];
  if (effect) return voxelEffectDescriptor(effect as VoxelEffectSound, volume);
  return null;
}

export class AudioManager {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeAmbient: AmbientChannel | null = null;
  private loopTimers = new Map<string, ReturnType<typeof setInterval>>();
  private disposed = false;
  private muted = false;
  private readonly random: () => number;
  private readonly masterVolume: number;

  constructor(options: { masterVolume?: number; random?: () => number } = {}) {
    this.masterVolume = options.masterVolume ?? 0.72;
    this.random = options.random ?? Math.random;
  }

  public prime(): void {
    if (this.muted) return;
    const ctx = this.ensureContext();
    if (!ctx || ctx.state !== "suspended") return;
    void ctx.resume().catch(() => {
      // User gesture unlocks can still be denied by browser policy.
    });
  }

  public playSFX(url: string, volume = 0.5): void {
    if (this.muted) return;
    const descriptor = resolveVoxelSoundUrl(url, volume);
    if (!descriptor) return;
    if (descriptor.effect) {
      this.playEffect(descriptor.effect, descriptor.volume);
      return;
    }
    if (descriptor.action && descriptor.group) {
      this.playMaterial(descriptor.action, descriptor.group, descriptor.volume);
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
    this.masterGain = null;
    this.context = null;
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

  private playMaterial(
    action: BlockSoundAction,
    group: BlockSoundGroup,
    volume: number
  ): void {
    if (group === "silent") return;
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!ctx || !master) return;
    const profile = GROUP_PROFILES[group] ?? GROUP_PROFILES.stone;
    const duration =
      action === "step" ? 0.09 : action === "dig" ? 0.12 : action === "place" ? 0.1 : 0.18;
    const actionGain =
      action === "break" ? 1.25 : action === "dig" ? 0.78 : action === "place" ? 0.88 : 1;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = profile.filterType;
    filter.frequency.value = profile.frequency;
    filter.Q.value = profile.q;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(
      clamp01(volume) * profile.gain * actionGain,
      now + 0.012
    );
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration + 0.02);
    this.disconnectLater([source, filter, gain], duration + 0.08);
    if (profile.toneFrequency && action !== "dig") {
      this.playTone(profile.toneFrequency, duration * 0.7, clamp01(volume) * 0.08, "triangle");
    }
  }

  private playEffect(effect: VoxelEffectSound, volume: number): void {
    switch (effect) {
      case "swing":
        this.playToneSweep(320, 95, 0.16, clamp01(volume) * 0.12);
        break;
      case "craft":
        this.playTone(660, 0.055, clamp01(volume) * 0.12, "square");
        setTimeout(() => this.playTone(980, 0.055, clamp01(volume) * 0.1, "square"), 45);
        break;
      case "hurt":
        this.playToneSweep(150, 90, 0.18, clamp01(volume) * 0.16);
        this.playMaterial("break", "cloth", clamp01(volume) * 0.7);
        break;
      case "eat":
        this.playMaterial("dig", "plant", clamp01(volume));
        break;
      case "swallow":
        this.playToneSweep(180, 120, 0.16, clamp01(volume) * 0.1);
        break;
      case "fuse":
        this.playMaterial("dig", "sand", clamp01(volume) * 0.8);
        this.playToneSweep(1200, 900, 0.12, clamp01(volume) * 0.045);
        break;
      case "explosion":
        this.playExplosionSynth(clamp01(volume));
        break;
    }
  }

  private playExplosionSynth(volume: number): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!ctx || !master) return;
    const duration = 0.72;
    const now = ctx.currentTime;
    const source = ctx.createBufferSource();
    source.buffer = this.createNoiseBuffer(ctx, duration);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(820, now);
    filter.frequency.exponentialRampToValueAtTime(90, now + duration);
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume * 0.82, now + 0.018);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(now);
    source.stop(now + duration + 0.03);
    this.disconnectLater([source, filter, gain], duration + 0.1);
    this.playToneSweep(88, 34, 0.42, volume * 0.22);
  }

  private playTone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType
  ): void {
    const ctx = this.ensureContext();
    const master = this.masterGain;
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.008);
    gain.gain.linearRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
    this.disconnectLater([osc, gain], duration + 0.08);
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
