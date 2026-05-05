"use client";

// Engine de sonidos con síntesis realista usando Web Audio API.
// Técnicas:
//  - Modal synthesis para fichas (3-4 resonancias no-armónicas → clay)
//  - Ruido browniano filtrado + envolventes para fricción de cartas
//  - Reverb convolutivo procedural (impulso aleatorio decayendo)
//  - Transientes (noise bursts cortos) para "clicks" naturales

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private convolver: ConvolverNode | null = null;
  enabled = true;

  ensure(): boolean {
    if (typeof window === "undefined") return false;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return false;
      try {
        this.ctx = new Ctor();
      } catch {
        return false;
      }
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);

      // Reverb: convolver con impulso procedural (room corto)
      this.convolver = this.ctx.createConvolver();
      this.convolver.buffer = this.makeReverbIR(this.ctx, 0.35, 2.5);
      this.convolver.connect(this.master);
      this.reverbSend = this.ctx.createGain();
      this.reverbSend.gain.value = 0.18;
      this.reverbSend.connect(this.convolver);
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
    return this.enabled;
  }

  private makeReverbIR(
    ctx: AudioContext,
    duration: number,
    decay: number,
  ): AudioBuffer {
    const sr = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sr * duration));
    const buf = ctx.createBuffer(2, length, sr);
    for (let ch = 0; ch < 2; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return buf;
  }

  // Genera un buffer de ruido browniano (más cálido que blanco)
  private makeBrownNoise(ctx: AudioContext, duration: number): AudioBuffer {
    const sr = ctx.sampleRate;
    const length = Math.max(1, Math.floor(sr * duration));
    const buf = ctx.createBuffer(1, length, sr);
    const data = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      data[i] = last * 3.5;
    }
    return buf;
  }

  // Conecta una fuente al master + un poquito al reverb
  private route(node: AudioNode) {
    if (this.master) node.connect(this.master);
    if (this.reverbSend) node.connect(this.reverbSend);
  }

  // ─── Ficha cayendo: modal synthesis (clay-like) ─────────────────
  chipDrop() {
    if (!this.ensure() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Transiente: noise burst muy corto (el "click" de impacto)
    const noiseBuf = this.makeBrownNoise(ctx, 0.012);
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuf;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "highpass";
    noiseFilter.frequency.value = 1500;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.6, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    this.route(noiseGain);
    noise.start(now);

    // Resonancias modales (no-armónicas para que suene a arcilla, no metal)
    const baseFreq = 800 + Math.random() * 200;
    const modes = [
      { f: baseFreq, gain: 0.35, decay: 0.12 },
      { f: baseFreq * 1.6, gain: 0.22, decay: 0.09 },
      { f: baseFreq * 2.3, gain: 0.14, decay: 0.07 },
      { f: baseFreq * 3.1, gain: 0.08, decay: 0.05 },
    ];
    modes.forEach((m) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = m.f;
      gain.gain.setValueAtTime(m.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + m.decay);
      osc.connect(gain);
      this.route(gain);
      osc.start(now);
      osc.stop(now + m.decay + 0.02);
    });

    // Thump grave (impacto de baja frecuencia)
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = "sine";
    thump.frequency.setValueAtTime(120, now);
    thump.frequency.exponentialRampToValueAtTime(60, now + 0.06);
    thumpGain.gain.setValueAtTime(0.35, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    thump.connect(thumpGain);
    if (this.master) thumpGain.connect(this.master);
    thump.start(now);
    thump.stop(now + 0.1);
  }

  // ─── Stack de fichas: 3-4 chip drops en rápida sucesión ─────────
  chipStack() {
    for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
      setTimeout(() => this.chipDrop(), i * 35);
    }
  }

  // ─── Knock seco (CHECK): golpe corto en madera ──────────────────
  knock() {
    if (!this.ensure() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Transiente
    const noise = ctx.createBufferSource();
    noise.buffer = this.makeBrownNoise(ctx, 0.015);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 600;
    filter.Q.value = 4;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    noise.connect(filter);
    filter.connect(gain);
    this.route(gain);
    noise.start(now);

    // Resonancia de madera (3 modos)
    [240, 380, 580].forEach((f, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = f;
      const decay = 0.08 - i * 0.015;
      g.gain.setValueAtTime(0.25 / (i + 1), now);
      g.gain.exponentialRampToValueAtTime(0.001, now + decay);
      osc.connect(g);
      this.route(g);
      osc.start(now);
      osc.stop(now + decay + 0.02);
    });
  }

  // ─── Carta repartida: fricción + landing ─────────────────────────
  cardDeal() {
    if (!this.ensure() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    // Whoosh de la fricción del aire (sweep descendente en pitch)
    const whooshDur = 0.18;
    const whooshBuf = this.makeBrownNoise(ctx, whooshDur);
    const whoosh = ctx.createBufferSource();
    whoosh.buffer = whooshBuf;
    const whooshFilter = ctx.createBiquadFilter();
    whooshFilter.type = "bandpass";
    whooshFilter.Q.value = 1.2;
    whooshFilter.frequency.setValueAtTime(4500, now);
    whooshFilter.frequency.exponentialRampToValueAtTime(
      1200,
      now + whooshDur,
    );
    const whooshGain = ctx.createGain();
    whooshGain.gain.setValueAtTime(0, now);
    whooshGain.gain.linearRampToValueAtTime(0.45, now + 0.025);
    whooshGain.gain.exponentialRampToValueAtTime(0.001, now + whooshDur);
    whoosh.connect(whooshFilter);
    whooshFilter.connect(whooshGain);
    this.route(whooshGain);
    whoosh.start(now);

    // Click final (la carta tocando la mesa) ~50ms después
    setTimeout(() => {
      if (!this.ctx) return;
      const ctx2 = this.ctx;
      const t = ctx2.currentTime;
      const tap = ctx2.createBufferSource();
      tap.buffer = this.makeBrownNoise(ctx2, 0.02);
      const tapFilter = ctx2.createBiquadFilter();
      tapFilter.type = "bandpass";
      tapFilter.frequency.value = 1200;
      tapFilter.Q.value = 2;
      const tapGain = ctx2.createGain();
      tapGain.gain.setValueAtTime(0.5, t);
      tapGain.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      tap.connect(tapFilter);
      tapFilter.connect(tapGain);
      this.route(tapGain);
      tap.start(t);
    }, 70);
  }

  // ─── Cartas siendo recogidas (fold) ─────────────────────────────
  fold() {
    if (!this.ensure() || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = 0.28;
    const noise = ctx.createBufferSource();
    noise.buffer = this.makeBrownNoise(ctx, dur);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2800, now);
    filter.frequency.exponentialRampToValueAtTime(900, now + dur);
    filter.Q.value = 0.8;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.32, now + 0.05);
    gain.gain.linearRampToValueAtTime(0.18, now + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    noise.connect(filter);
    filter.connect(gain);
    this.route(gain);
    noise.start(now);
  }

  // ─── Notify: te toca el turno (campanita) ────────────────────────
  notify() {
    if (!this.ensure() || !this.ctx) return;
    const ctx = this.ctx;
    const master = this.master;
    if (!master) return;
    const start = ctx.currentTime;
    [659.25, 880].forEach((freq, i) => {
      const t = start + i * 0.1;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.35, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
      osc.connect(gain);
      this.route(gain);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  }

  // ─── Cheer: arpegio mayor con resonancia ─────────────────────────
  cheer() {
    if (!this.ensure() || !this.ctx) return;
    const ctx = this.ctx;
    const start = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((freq, i) => {
      const t = start + i * 0.1;
      // Cada nota: dos osciladores ligeramente desafinados (más rico)
      [freq, freq * 1.005].forEach((f, j) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = j === 0 ? "triangle" : "sine";
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
        osc.connect(gain);
        this.route(gain);
        osc.start(t);
        osc.stop(t + 0.75);
      });
    });
  }

  // ─── Cascada de fichas (varios drops escalonados) ────────────────
  chipCascade(count = 8) {
    for (let i = 0; i < count; i++) {
      setTimeout(() => this.chipDrop(), i * 75 + Math.random() * 30);
    }
  }
}

export const sounds = new SoundManager();

// Auto-unlock al primer gesto del usuario
if (typeof window !== "undefined") {
  const unlock = () => sounds.ensure();
  document.addEventListener("click", unlock, { once: true });
  document.addEventListener("touchstart", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });
}
