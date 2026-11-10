/**
 * Fully procedural audio — no sample files, nothing to download.
 *
 * The score is built from raga scales: each zone carries a raga, and the
 * ambient drone + sparse plucked phrases are generated from its swaras. That
 * keeps the soundtrack culturally grounded and the repo tiny, and it means the
 * music never loops identically twice.
 */

import { Rng } from './Rng';

/** Semitone offsets from Sa for a handful of ragas. */
export const RAGAS: Record<string, number[]> = {
  // Serious, ancient, pre-dawn — used for the Indus and Mesopotamia zones.
  bhairav: [0, 1, 4, 5, 7, 8, 11],
  // Evening, luminous — Mughal and courtly zones.
  yaman: [0, 2, 4, 6, 7, 9, 11],
  // Open pentatonic, pastoral — Ramayana forests, Chola fields.
  bhupali: [0, 2, 4, 7, 9],
  // Dark, weighty — Kurukshetra.
  malkauns: [0, 3, 5, 8, 10],
  // Devotional, warm — Maurya, temple zones.
  kafi: [0, 2, 3, 5, 7, 9, 10],
  // Heroic, bright — fort and Maratha zones.
  durga: [0, 2, 5, 7, 9],
  // Wide, contemplative — astronomy zone.
  kalyan: [0, 2, 4, 7, 9, 11],
};

export type RagaName = keyof typeof RAGAS | string;

const A4 = 440;

/** Convert a semitone offset from a tonic MIDI note into Hz. */
function noteHz(tonicMidi: number, semitone: number): number {
  return A4 * Math.pow(2, (tonicMidi + semitone - 69) / 12);
}

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private droneNodes: AudioNode[] = [];
  private melodyTimer: number | null = null;
  private rng = new Rng('score');

  private raga: RagaName = 'bhairav';
  private tonic = 50; // D3 — comfortable drone register
  private started = false;

  musicVolume = 0.5;
  sfxVolume = 0.75;

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;

    const ctx = new Ctor();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(ctx.destination);

    // A gentle master compressor keeps plucks from clipping over the drone.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.ratio.value = 4;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;
    comp.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume * 0.55;
    this.musicBus.connect(comp);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(comp);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.musicBus) this.musicBus.gain.value = music * 0.55;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
  }

  /**
   * Lower the music while somebody is speaking, and bring it back after. The
   * score is a drone and sparse plucks, so a dip of about two-thirds is enough
   * to make speech clear without the music seeming to stop.
   */
  duck(on: boolean): void {
    if (!this.ctx || !this.musicBus) return;
    const target = this.musicVolume * 0.55 * (on ? 0.3 : 1);
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, on ? 0.12 : 0.6);
  }

  /** Switch raga when the player crosses into a new zone. */
  setRaga(raga: RagaName, tonicMidi = 50): void {
    if (this.raga === raga && this.tonic === tonicMidi) return;
    this.raga = RAGAS[raga] ? raga : 'bhairav';
    this.tonic = tonicMidi;
    if (this.started) {
      this.stopDrone();
      this.startDrone();
    }
  }

  startScore(): void {
    this.unlock();
    if (!this.ctx || this.started) return;
    this.started = true;
    this.startDrone();
    this.scheduleMelody();
  }

  stopScore(): void {
    this.started = false;
    this.stopDrone();
    if (this.melodyTimer !== null) {
      window.clearTimeout(this.melodyTimer);
      this.melodyTimer = null;
    }
  }

  // ----------------------------------------------------------------- drone

  private startDrone(): void {
    const ctx = this.ctx;
    const bus = this.musicBus;
    if (!ctx || !bus) return;

    const sa = noteHz(this.tonic, 0);
    const scale = RAGAS[this.raga] ?? RAGAS.bhairav!;
    // Tanpura pairs Sa with Pa (7) — or Ma (5) in ragas that omit Pa.
    const second = scale.includes(7) ? 7 : 5;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 820;
    filter.Q.value = 0.6;
    filter.connect(bus);

    const droneGain = ctx.createGain();
    droneGain.gain.value = 0;
    droneGain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 4);
    droneGain.connect(filter);

    for (const [hz, detune, level] of [
      [sa, 0, 1],
      [sa, 5, 0.6],
      [sa * 2, -4, 0.3],
      [noteHz(this.tonic, second), 2, 0.55],
    ] as Array<[number, number, number]>) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = hz;
      osc.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = 0.09 * level;
      osc.connect(g).connect(droneGain);
      osc.start();
      this.droneNodes.push(osc, g);
    }

    // Slow breathing LFO so the drone never feels static.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.06;
    lfo.connect(lfoGain).connect(droneGain.gain);
    lfo.start();

    this.droneNodes.push(lfo, lfoGain, droneGain, filter);
  }

  private stopDrone(): void {
    const ctx = this.ctx;
    for (const node of this.droneNodes) {
      if (node instanceof OscillatorNode) {
        try {
          node.stop(ctx ? ctx.currentTime + 0.05 : 0);
        } catch {
          /* already stopped */
        }
      }
      try {
        node.disconnect();
      } catch {
        /* ignore */
      }
    }
    this.droneNodes = [];
  }

  // ---------------------------------------------------------------- melody

  private scheduleMelody(): void {
    const tick = () => {
      if (!this.started) return;
      const scale = RAGAS[this.raga] ?? RAGAS.bhairav!;
      const phraseLength = this.rng.int(2, 4);
      let step = this.rng.int(0, scale.length - 1);
      for (let i = 0; i < phraseLength; i++) {
        step = Math.max(0, Math.min(scale.length - 1, step + this.rng.int(-2, 2)));
        const octave = this.rng.bool(0.25) ? 12 : 0;
        const hz = noteHz(this.tonic + 12, (scale[step] as number) + octave);
        window.setTimeout(() => this.pluck(hz, 0.16, 'music'), i * this.rng.int(380, 720));
      }
      this.melodyTimer = window.setTimeout(tick, this.rng.int(6500, 14000));
    };
    this.melodyTimer = window.setTimeout(tick, 3500);
  }

  // ------------------------------------------------------------------- sfx

  /** Short plucked tone — the backbone of both melody and UI feedback. */
  pluck(hz: number, gain = 0.3, bus: 'music' | 'sfx' = 'sfx'): void {
    const ctx = this.ctx;
    const dest = bus === 'music' ? this.musicBus : this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = hz;

    const body = ctx.createOscillator();
    body.type = 'sine';
    body.frequency.value = hz * 2.01;

    const bodyGain = ctx.createGain();
    bodyGain.gain.value = 0.25;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(gain, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0008, now + 1.25);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, now);
    lp.frequency.exponentialRampToValueAtTime(700, now + 0.9);

    osc.connect(env);
    body.connect(bodyGain).connect(env);
    env.connect(lp).connect(dest);

    osc.start(now);
    body.start(now);
    osc.stop(now + 1.3);
    body.stop(now + 1.3);
  }

  /** Noise burst shaped by a filter — footsteps, bowstring, stone. */
  private noise(duration: number, gain: number, type: BiquadFilterType, freq: number, q = 1, sweepTo?: number): void {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;

    const now = ctx.currentTime;
    const frames = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const chan = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) chan[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(freq, now);
    filter.Q.value = q;
    if (sweepTo !== undefined) filter.frequency.exponentialRampToValueAtTime(Math.max(40, sweepTo), now + duration);

    const env = ctx.createGain();
    env.gain.setValueAtTime(gain, now);
    env.gain.exponentialRampToValueAtTime(0.0008, now + duration);

    src.connect(filter).connect(env).connect(dest);
    src.start(now);
  }

  footstep(soft = false): void {
    this.noise(soft ? 0.09 : 0.13, soft ? 0.055 : 0.1, 'bandpass', soft ? 420 : 240, 1.2, soft ? 180 : 90);
  }

  bowDraw(): void {
    this.noise(0.26, 0.07, 'highpass', 900, 0.7, 2600);
  }

  bowRelease(): void {
    this.noise(0.14, 0.2, 'bandpass', 1500, 2.2, 400);
    this.pluck(196, 0.18);
  }

  arrowHit(good: boolean): void {
    if (good) {
      this.noise(0.1, 0.22, 'bandpass', 2400, 3);
      this.pluck(noteHz(this.tonic + 24, 0), 0.22);
    } else {
      this.noise(0.18, 0.16, 'lowpass', 600, 1, 140);
    }
  }

  /** Rising arpeggio in the current raga — correct answers, quest completion. */
  success(steps = 3): void {
    const scale = RAGAS[this.raga] ?? RAGAS.bhairav!;
    for (let i = 0; i < steps; i++) {
      const semi = scale[Math.min(scale.length - 1, i * 2)] as number;
      window.setTimeout(() => this.pluck(noteHz(this.tonic + 12, semi + (i >= scale.length ? 12 : 0)), 0.26), i * 110);
    }
  }

  /** Flat, non-punishing "not yet" — deliberately soft so mistakes feel safe. */
  failure(): void {
    this.pluck(noteHz(this.tonic, 1), 0.2);
    window.setTimeout(() => this.pluck(noteHz(this.tonic - 2, 0), 0.16), 130);
  }

  click(): void {
    this.noise(0.035, 0.09, 'highpass', 2200, 0.8);
  }

  hover(): void {
    this.noise(0.02, 0.03, 'highpass', 3400, 0.8);
  }

  /** Temple bell — used when a chapter seal is earned. */
  bell(): void {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const base = noteHz(this.tonic + 12, 0);
    for (const [mult, level, decay] of [
      [1, 0.3, 4.5],
      [2.76, 0.12, 3],
      [5.4, 0.06, 2],
      [8.9, 0.03, 1.4],
    ] as Array<[number, number, number]>) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = base * mult;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(level, now + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0005, now + decay);
      osc.connect(env).connect(dest);
      osc.start(now);
      osc.stop(now + decay + 0.1);
    }
  }

  /** Conch — the vimana launch and chapter openings. */
  conch(): void {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.linearRampToValueAtTime(186, now + 0.4);
    osc.frequency.linearRampToValueAtTime(178, now + 1.6);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.Q.value = 4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0, now);
    env.gain.linearRampToValueAtTime(0.26, now + 0.25);
    env.gain.setValueAtTime(0.26, now + 1.3);
    env.gain.exponentialRampToValueAtTime(0.0008, now + 2.1);

    osc.connect(lp).connect(env).connect(dest);
    osc.start(now);
    osc.stop(now + 2.2);
  }

  /** Entering water. */
  splash(): void {
    this.noise(0.45, 0.22, 'lowpass', 1800, 0.8, 260);
    this.noise(0.22, 0.12, 'highpass', 2400, 0.7);
  }

  wind(intensity: number): void {
    // Called on every skydive frame tick at a low rate; cheap burst is fine.
    this.noise(0.22, 0.03 + intensity * 0.06, 'bandpass', 500 + intensity * 700, 0.6);
  }
}

export const audio = new AudioEngine();
