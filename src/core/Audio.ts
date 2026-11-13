/**
 * Fully procedural audio — no sample files, nothing to download.
 *
 * Sound effects live here. The score and the soundscapes are in `core/music/`:
 * each region has a theme (a raga, a rhythmic cycle, a set of instruments and
 * the sound of its air), and the conductor crossfades between them as you walk.
 */

import { Emitters, type EmitterSource } from './music/Emitters';
import { Conductor, buildRoom } from './music/Conductor';
import { buildImpulse } from './music/reverb';
import { RAGA_BOOK } from './music/theory';
import { themeFor } from './music/themes';

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
  private musicFilter: BiquadFilterNode | null = null;
  private sfxBus: GainNode | null = null;
  private conductor: Conductor | null = null;
  private conchHall: ConvolverNode | null = null;
  private emitters: Emitters | null = null;
  private pendingEmitters: readonly EmitterSource[] = [];
  /** The theme asked for before the audio context existed. */
  private pendingTheme: string | null = null;

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
    this.musicBus.gain.value = this.musicVolume * 0.9;
    // A low-pass in front of the compressor lets the score recede behind a conversation or a puzzle.
    this.musicFilter = ctx.createBiquadFilter();
    this.musicFilter.type = 'lowpass';
    this.musicFilter.frequency.value = 20000;
    this.musicFilter.Q.value = 0.5;
    this.musicBus.connect(this.musicFilter).connect(comp);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(comp);

    // The score: a conductor playing into the music bus, through a shared room.
    this.conductor = new Conductor(ctx, this.musicBus, buildRoom(ctx, this.musicBus));
    // Places that make their own sound travel with the sound effects, not the score, so reading
    // (which softens the music) never silences the world.
    this.emitters = new Emitters(ctx, this.sfxBus);
    this.emitters.setLevel(0.9);
    if (this.pendingEmitters.length) this.emitters.setSources(this.pendingEmitters);
    if (this.pendingTheme) this.setTheme(this.pendingTheme);
  }

  setVolumes(music: number, sfx: number): void {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.musicBus) this.musicBus.gain.value = music * 0.9;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
  }

  /** The places in the world that make their own sound (see music/Emitters.ts). */
  setEmitters(list: readonly EmitterSource[]): void {
    this.pendingEmitters = list;
    this.emitters?.setSources(list);
  }

  /** Tell the audio where the listener is and which way they face. Call once per frame. */
  listen(x: number, y: number, z: number, fx: number, fy: number, fz: number): void {
    this.emitters?.update(x, y, z, fx, fy, fz);
  }

  /**
   * Lower the music while somebody is speaking, and bring it back after. The
   * score is a drone and sparse plucks, so a dip of about two-thirds is enough
   * to make speech clear without the music seeming to stop.
   */
  duck(on: boolean): void {
    if (!this.ctx || !this.musicBus) return;
    const target = this.musicVolume * 0.9 * (on ? 0.3 : 1);
    this.musicBus.gain.setTargetAtTime(target, this.ctx.currentTime, on ? 0.12 : 0.6);
  }

  /**
   * Soften the score while the player is reading or thinking: the highs roll
   * off and it sits further back, then comes forward again afterward.
   */
  focus(on: boolean): void {
    if (!this.ctx || !this.musicFilter) return;
    this.musicFilter.frequency.setTargetAtTime(on ? 1300 : 20000, this.ctx.currentTime, on ? 0.25 : 0.6);
  }

  /**
   * Move the score to a region's theme (or the title or flight themes),
   * crossfading from whatever was playing. Safe to call before audio is unlocked:
   * the request is remembered and played once it is.
   */
  setTheme(id: string, fadeSeconds = 3): void {
    const theme = themeFor(id);
    if (!theme) return;
    this.pendingTheme = id;
    this.raga = RAGA_BOOK[theme.raga] ? theme.raga : 'bhairav';
    this.tonic = theme.tonic;
    this.conductor?.setTheme(theme, fadeSeconds);
  }

  startScore(): void {
    this.unlock();
    if (!this.ctx || !this.conductor || this.started) return;
    this.started = true;
    if (this.pendingTheme) this.conductor.setTheme(themeFor(this.pendingTheme) ?? null, 2);
    this.conductor.start();
  }

  stopScore(): void {
    this.started = false;
    this.conductor?.stop();
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

  /** What the ground is, for footsteps. Set by the player controller. */
  surface: 'earth' | 'grass' | 'stone' | 'sand' | 'water' = 'earth';

  footstep(soft = false): void {
    // A little different every time, so a long walk is not a metronome.
    const j = 0.88 + Math.random() * 0.24;
    switch (this.surface) {
      case 'stone':
        // A harder tap with a short ring, as on a worn paving slab.
        this.noise(0.07, soft ? 0.05 : 0.1, 'bandpass', 1500 * j, 2.4, 700);
        this.noise(0.12, soft ? 0.03 : 0.06, 'bandpass', 380 * j, 1.5, 220);
        break;
      case 'sand':
        // A soft crunch: filtered noise with more air in it.
        this.noise(0.2, soft ? 0.04 : 0.08, 'highpass', 1500 * j, 0.6, 3200);
        this.noise(0.12, soft ? 0.03 : 0.05, 'lowpass', 300, 0.8, 120);
        break;
      case 'grass':
        this.noise(0.17, soft ? 0.04 : 0.075, 'bandpass', 2300 * j, 0.7, 1100);
        this.noise(0.1, soft ? 0.03 : 0.05, 'lowpass', 260, 1, 100);
        break;
      case 'water':
        this.noise(0.28, soft ? 0.05 : 0.09, 'bandpass', 900 * j, 0.8, 2600);
        break;
      default:
        this.noise(soft ? 0.09 : 0.13, soft ? 0.055 : 0.1, 'bandpass', (soft ? 420 : 240) * j, 1.2, soft ? 180 : 90);
    }
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
    const scale = RAGA_BOOK[this.raga]?.scale ?? RAGA_BOOK.bhairav!.scale;
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

  /**
   * A struck stone colonette: a clear fundamental over the inharmonic partials of a solid bar, with a tick
   * at the strike. Used by Hampi's musical pillars.
   */
  stoneNote(hz: number, level = 0.32): void {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;
    const now = ctx.currentTime;
    for (const [mult, lv, decay] of [
      [1, 1, 2.6],
      [2.0, 0.22, 1.6],
      [2.76, 0.18, 1.1],
      [5.4, 0.07, 0.6],
    ] as Array<[number, number, number]>) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = hz * mult;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(level * lv, now + 0.004);
      env.gain.exponentialRampToValueAtTime(0.0004, now + decay);
      osc.connect(env).connect(dest);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }
    // The tick of the strike: a very short burst of filtered noise.
    const len = Math.floor(ctx.sampleRate * 0.03);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = hz * 4;
    bp.Q.value = 1.2;
    const g = ctx.createGain();
    g.gain.value = level * 0.6;
    src.connect(bp).connect(g).connect(dest);
    src.start(now);
  }

  /**
   * The shankh. Played rarely on purpose: once when a journey begins, and once for each chapter whose
   * panel is restored. Heard every few minutes it stops meaning anything.
   *
   * A real conch is a bright, buzzy, nasal horn: a strong fundamental with a ladder of harmonics, two
   * vocal-like resonances, breath at the lips, a scoop up into the note, a long held swell with a slow
   * waver, and a lift in pitch as the breath runs out. It is built from exactly those pieces, into its
   * own small hall, so it reads clearly over the music instead of as a muffled drone.
   */
  conch(): void {
    const ctx = this.ctx;
    const dest = this.sfxBus;
    if (!ctx || !dest) return;
    const now = ctx.currentTime + 0.02;
    const f0 = 196; // G3, the usual pitch of a large shankh
    const dur = 5.6;

    // A short hall of its own, so the note blooms and hangs.
    if (!this.conchHall) {
      this.conchHall = ctx.createConvolver();
      this.conchHall.buffer = buildImpulse(ctx, 3.4, 2.6);
      const wet = ctx.createGain();
      wet.gain.value = 0.32;
      this.conchHall.connect(wet).connect(dest);
    }
    const out = ctx.createGain();
    out.gain.value = 1;
    out.connect(dest);
    out.connect(this.conchHall);

    // Pitch: scoop up from below into the note, waver while held, lift as the breath ends.
    const pitch = (o: OscillatorNode, mult: number): void => {
      const f = o.frequency;
      f.setValueAtTime(f0 * mult * 0.86, now);
      f.exponentialRampToValueAtTime(f0 * mult, now + 0.42);
      f.setValueAtTime(f0 * mult, now + dur - 1.1);
      f.exponentialRampToValueAtTime(f0 * mult * 1.045, now + dur - 0.15);
    };
    const vib = ctx.createOscillator();
    vib.frequency.value = 4.6;
    const vibDepth = ctx.createGain();
    vibDepth.gain.setValueAtTime(0, now);
    vibDepth.gain.linearRampToValueAtTime(2.2, now + 1.6);
    vib.connect(vibDepth);

    // The body: a buzzy source through two resonances, plus a clean fundamental underneath.
    const body = ctx.createGain();
    const env = body.gain;
    env.setValueAtTime(0.0001, now);
    env.exponentialRampToValueAtTime(0.16, now + 0.35);
    env.linearRampToValueAtTime(0.24, now + 2.4); // the long swell
    env.linearRampToValueAtTime(0.2, now + dur - 0.9);
    env.exponentialRampToValueAtTime(0.0001, now + dur);

    const oscs: OscillatorNode[] = [];
    for (const [type, mult, level] of [
      ['sawtooth', 1, 0.55],
      ['square', 2, 0.18],
      ['sine', 1, 0.6],
      ['sawtooth', 1.003, 0.3], // a second reed, slightly apart: the conch's beating buzz
    ] as Array<[OscillatorType, number, number]>) {
      const o = ctx.createOscillator();
      o.type = type;
      pitch(o, mult);
      vibDepth.connect(o.frequency);
      const g = ctx.createGain();
      g.gain.value = level;
      o.connect(g).connect(body);
      oscs.push(o);
    }
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 110;
    const f1 = ctx.createBiquadFilter();
    f1.type = 'peaking';
    f1.frequency.value = 700;
    f1.Q.value = 2.2;
    f1.gain.value = 7;
    const f2 = ctx.createBiquadFilter();
    f2.type = 'peaking';
    f2.frequency.value = 1750;
    f2.Q.value = 3;
    f2.gain.value = 5;
    const top = ctx.createBiquadFilter();
    top.type = 'lowpass';
    top.frequency.setValueAtTime(1600, now);
    top.frequency.linearRampToValueAtTime(4200, now + 1.8); // brightens as it is blown harder
    body.connect(hp).connect(f1).connect(f2).connect(top).connect(out);

    // Breath at the lips, strongest at the start.
    const frames = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) ch[i] = Math.random() * 2 - 1;
    const breath = ctx.createBufferSource();
    breath.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 0.9;
    const bg = ctx.createGain();
    bg.gain.setValueAtTime(0.0001, now);
    bg.gain.exponentialRampToValueAtTime(0.05, now + 0.08);
    bg.gain.exponentialRampToValueAtTime(0.012, now + 0.6);
    bg.gain.linearRampToValueAtTime(0.008, now + dur - 0.5);
    bg.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    breath.connect(bp).connect(bg).connect(out);

    for (const o of oscs) {
      o.start(now);
      o.stop(now + dur + 0.05);
    }
    vib.start(now);
    vib.stop(now + dur + 0.05);
    breath.start(now);
    breath.stop(now + dur + 0.05);
    // Keep the music out of its way while it sounds.
    this.duckFor(dur);
  }

  /** Dip the score briefly under a sound that should be heard on its own. */
  private duckFor(seconds: number): void {
    if (!this.ctx || !this.musicBus) return;
    const t = this.ctx.currentTime;
    const g = this.musicBus.gain;
    const full = this.musicVolume * 0.9;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(full * 0.35, t, 0.15);
    g.setTargetAtTime(full, t + seconds - 0.6, 0.6);
  }

  /** A swing through the air: the melee strike. */
  swing(): void {
    this.noise(0.18, 0.09, 'bandpass', 900, 1.1, 2600);
  }

  /** A shade struck: a dull thud with a hiss of haze. */
  shadeHit(): void {
    this.noise(0.12, 0.16, 'lowpass', 500, 1.2, 120);
    this.noise(0.3, 0.05, 'highpass', 3000, 0.6);
  }

  /** A shade dispersed: a rising exhale and a soft bell. */
  shadeGone(): void {
    this.noise(0.7, 0.07, 'bandpass', 700, 0.8, 3200);
    this.pluck(noteHz(this.tonic + 19, 0), 0.12);
  }

  /** The player is struck. */
  hurt(): void {
    this.noise(0.16, 0.2, 'lowpass', 340, 1.4, 90);
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
