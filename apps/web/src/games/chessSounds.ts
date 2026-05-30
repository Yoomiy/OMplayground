class ChessSounds {
  private ctx: AudioContext | null = null;
  private muted = false;

  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === "undefined") return null;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return null;
    try {
      this.ctx = new AudioContextClass();
    } catch {
      return null;
    }
    return this.ctx;
  }

  private ensureContext(): AudioContext | null {
    const context = this.getContext();
    if (!context) return null;
    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }
    return context;
  }

  public prime(): void {
    this.ensureContext();
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
  }

  private playTone(freqs: number[], durationMs: number, type: OscillatorType = "sine"): void {
    if (this.muted) return;
    const context = this.getContext();
    if (!context) return;
    if (context.state === "suspended") {
      void context.resume().catch(() => {});
    }

    try {
      const now = context.currentTime;
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.12, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);

      const oscillators = freqs.map((f) => {
        const osc = context.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(f, now);
        osc.connect(gainNode);
        return osc;
      });

      gainNode.connect(context.destination);
      oscillators.forEach((osc) => osc.start(now));
      oscillators.forEach((osc) => osc.stop(now + durationMs / 1000));
    } catch {
      // Ignored
    }
  }

  public playMove(): void {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    try {
      const now = context.currentTime;
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.006);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.1);

      osc.connect(gainNode);
      gainNode.connect(context.destination);
      osc.start(now);
      osc.stop(now + 0.1);
    } catch {
      // Ignored
    }
  }

  public playCapture(): void {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    try {
      const now = context.currentTime;
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + 0.005);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

      const osc = context.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);

      const bufferSize = context.sampleRate * 0.03;
      const buffer = context.createBuffer(1, bufferSize, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      const noise = context.createBufferSource();
      noise.buffer = buffer;
      const noiseGain = context.createGain();
      noiseGain.gain.setValueAtTime(0.08, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.03);

      osc.connect(gainNode);
      noise.connect(noiseGain);
      gainNode.connect(context.destination);
      noiseGain.connect(context.destination);

      osc.start(now);
      osc.stop(now + 0.12);
      noise.start(now);
      noise.stop(now + 0.03);
    } catch {
      // Ignored
    }
  }

  public playCheck(): void {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    try {
      const now = context.currentTime;
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.18, now + 0.008);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      const osc1 = context.createOscillator();
      const osc2 = context.createOscillator();
      osc1.type = "square";
      osc2.type = "sine";
      osc1.frequency.setValueAtTime(880, now);
      osc2.frequency.setValueAtTime(660, now);
      osc1.frequency.exponentialRampToValueAtTime(740, now + 0.08);
      osc2.frequency.exponentialRampToValueAtTime(520, now + 0.08);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(context.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.18);
      osc2.stop(now + 0.18);
    } catch {
      // Ignored
    }
  }

  public playMate(): void {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    try {
      const now = context.currentTime;
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.22, now + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      const freqs = [523.25, 659.25, 783.99, 1046.5];
      const oscillators = freqs.map((f, i) => {
        const osc = context.createOscillator();
        osc.type = i === 0 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(f, now + i * 0.04);
        osc.connect(gainNode);
        return osc;
      });

      gainNode.connect(context.destination);
      oscillators.forEach((osc, i) => {
        osc.start(now + i * 0.04);
        osc.stop(now + 0.55);
      });
    } catch {
      // Ignored
    }
  }

  public playGameEnd(won: boolean | null): void {
    if (this.muted) return;
    const context = this.ensureContext();
    if (!context) return;
    try {
      const now = context.currentTime;
      const gainNode = context.createGain();
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.16, now + 0.015);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      if (won === null) {
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        osc1.type = "sine";
        osc2.type = "sine";
        osc1.frequency.setValueAtTime(392, now);
        osc2.frequency.setValueAtTime(523.25, now);
        osc1.connect(gainNode);
        osc2.connect(gainNode);
        osc1.start(now);
        osc2.start(now);
        osc1.stop(now + 0.45);
        osc2.stop(now + 0.45);
      } else if (won) {
        const osc = context.createOscillator();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.exponentialRampToValueAtTime(880, now + 0.35);
        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.45);
      } else {
        const osc = context.createOscillator();
        osc.type = "sine";
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(165, now + 0.4);
        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + 0.45);
      }

      gainNode.connect(context.destination);
    } catch {
      // Ignored
    }
  }

  public playGameOver(won: boolean | null): void {
    this.playGameEnd(won);
  }
}

export const chessSounds = new ChessSounds();
