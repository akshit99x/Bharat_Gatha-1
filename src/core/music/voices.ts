import type { Bol } from './theory';

/**
 * The instruments of the score, each synthesised from oscillators and filtered
 * noise: no samples, nothing to download. They are modelled on how the real
 * instruments make their sound — the breath and vibrato of a bansuri, the buzz
 * of a sitar's bridge, the hammered shimmer of a santoor, the nasal reed of a
 * shehnai, the pitch-bending left hand of a tabla — rather than on a generic
 * synth patch, because that is what makes them read as the instrument.
 */

/** Where a voice sends its sound: the dry mix, and the shared room. */
export interface Out {
  dry: AudioNode;
  wet: AudioNode;
}

export interface Note {
  hz: number;
  dur: number;
  /** 0–1. */
  vel: number;
  /** Start the note from this pitch and slide to `hz` (a meend, in Indian terms). */
  glideFrom?: number;
  /** -1 (left) to 1 (right). */
  pan?: number;
  /** How much goes to the room, 0–1. */
  wet?: number;
}

export type VoiceName = 'bansuri' | 'sitar' | 'veena' | 'santoor' | 'shehnai' | 'strings' | 'harmonium' | 'choir' | 'oud';
export type KitName = 'tabla' | 'mridangam' | 'dhol' | 'frame' | 'nagara' | 'none';

// ---------------------------------------------------------------- helpers

const noiseCache = new WeakMap<BaseAudioContext, AudioBuffer>();

/** A few seconds of white noise, made once per context and reused by every breath, click and hiss. */
export function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const len = ctx.sampleRate * 2;
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

/** Place a finished voice in the stereo field and send it to the room. */
function place(ctx: BaseAudioContext, node: AudioNode, out: Out, pan = 0, wet = 0.25): void {
  let tail: AudioNode = node;
  if (pan !== 0 && 'createStereoPanner' in ctx) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    node.connect(p);
    tail = p;
  }
  tail.connect(out.dry);
  if (wet > 0) {
    const w = ctx.createGain();
    w.gain.value = wet;
    tail.connect(w).connect(out.wet);
  }
}

/** An oscillator that cleans itself up. */
function osc(ctx: BaseAudioContext, type: OscillatorType, hz: number, from: number, to: number): OscillatorNode {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  o.start(from);
  o.stop(to);
  return o;
}

/** Smooth attack-sustain-release gain, ending at `end` with a release tail. */
function sustainEnv(ctx: BaseAudioContext, when: number, end: number, peak: number, attack: number, release: number): GainNode {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(peak, when + attack);
  g.gain.setValueAtTime(peak, Math.max(when + attack, end));
  g.gain.exponentialRampToValueAtTime(0.0001, end + release);
  return g;
}

/** Slide an oscillator's pitch from `from` to `to` over `time`. */
function glide(o: OscillatorNode, from: number | undefined, to: number, when: number, time: number): void {
  if (from && from !== to) {
    o.frequency.setValueAtTime(from, when);
    o.frequency.exponentialRampToValueAtTime(to, when + time);
  } else o.frequency.setValueAtTime(to, when);
}

/** Vibrato that arrives late, as a flautist or reed player's does. */
function vibrato(ctx: BaseAudioContext, targets: OscillatorNode[], when: number, stop: number, rateHz: number, cents: number, delay: number): void {
  const lfo = osc(ctx, 'sine', rateHz, when, stop);
  const depth = ctx.createGain();
  depth.gain.setValueAtTime(0, when);
  depth.gain.setValueAtTime(0, when + delay);
  depth.gain.linearRampToValueAtTime(cents, when + delay + 0.35);
  lfo.connect(depth);
  for (const t of targets) depth.connect(t.detune);
}

// ----------------------------------------------------------------- winds

/** Bansuri: a pure, airy bamboo flute with a breath of noise and a late vibrato. */
export function bansuri(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  const end = when + n.dur;
  const stop = end + 0.5;
  const peak = 0.34 * n.vel;
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 3400;
  const env = sustainEnv(ctx, when, end, peak, 0.07, 0.3);

  const bodies = [osc(ctx, 'sine', n.hz, when, stop), osc(ctx, 'triangle', n.hz, when, stop), osc(ctx, 'sine', n.hz * 2, when, stop)];
  const mix = [1, 0.28, 0.13];
  bodies.forEach((o, i) => {
    glide(o, n.glideFrom ? n.glideFrom * (i === 2 ? 2 : 1) : undefined, n.hz * (i === 2 ? 2 : 1), when, Math.min(0.16, n.dur * 0.4));
    const g = ctx.createGain();
    g.gain.value = mix[i] as number;
    o.connect(g).connect(env);
  });
  vibrato(ctx, bodies, when, stop, 5.1, 16, Math.min(0.35, n.dur * 0.4));

  // Breath: filtered noise that blooms at the start of each note and settles.
  const breath = ctx.createBufferSource();
  breath.buffer = noiseBuffer(ctx);
  breath.loop = true;
  breath.start(when, Math.random());
  breath.stop(stop);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = n.hz * 2.4;
  bp.Q.value = 1.6;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, when);
  bg.gain.linearRampToValueAtTime(0.1 * n.vel, when + 0.03);
  bg.gain.exponentialRampToValueAtTime(0.018 * n.vel + 0.0001, when + 0.25);
  bg.gain.setValueAtTime(0.018 * n.vel + 0.0001, end);
  bg.gain.exponentialRampToValueAtTime(0.0001, stop);
  breath.connect(bp).connect(bg).connect(env);

  env.connect(lp);
  place(ctx, lp, out, n.pan ?? 0, n.wet ?? 0.32);
}

/** Shehnai / nadaswaram: a double reed, nasal and bright, with formants and a quick vibrato. */
export function shehnai(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  const end = when + n.dur;
  const stop = end + 0.4;
  const env = sustainEnv(ctx, when, end, 0.3 * n.vel, 0.05, 0.22);
  const a = osc(ctx, 'sawtooth', n.hz, when, stop);
  const b = osc(ctx, 'square', n.hz * 1.004, when, stop);
  glide(a, n.glideFrom, n.hz, when, Math.min(0.12, n.dur * 0.4));
  glide(b, n.glideFrom ? n.glideFrom * 1.004 : undefined, n.hz * 1.004, when, Math.min(0.12, n.dur * 0.4));
  vibrato(ctx, [a, b], when, stop, 5.8, 22, 0.18);

  const mixG = ctx.createGain();
  mixG.gain.value = 0.5;
  const bg = ctx.createGain();
  bg.gain.value = 0.28;
  a.connect(mixG);
  b.connect(bg).connect(mixG);

  // Two formants give the reed its nasal vowel.
  for (const [f, q, gain] of [
    [820, 5, 1],
    [2300, 6, 0.7],
  ] as const) {
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f;
    bp.Q.value = q;
    const fg = ctx.createGain();
    fg.gain.value = gain;
    mixG.connect(bp).connect(fg).connect(env);
  }
  const body = ctx.createGain();
  body.gain.value = 0.35;
  mixG.connect(body).connect(env);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 4800;
  env.connect(lp);
  place(ctx, lp, out, n.pan ?? 0.1, n.wet ?? 0.36);
}

// --------------------------------------------------------------- strings

/** A plucked string with a decaying brightness: the shape of every sitar, veena and tanpura note. */
function pluckVoice(
  ctx: BaseAudioContext,
  out: Out,
  when: number,
  n: Note,
  o: { wave: OscillatorType; detune: number; bright: number; dark: number; decay: number; buzz: number; sym: number; wet: number },
): void {
  const length = Math.max(0.6, n.dur) * o.decay;
  const stop = when + length + 0.2;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(0.4 * n.vel, when + 0.005);
  env.gain.exponentialRampToValueAtTime(0.0001, when + length);

  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 2.4;
  lp.frequency.setValueAtTime(o.bright, when);
  lp.frequency.exponentialRampToValueAtTime(o.dark, when + length * 0.55);

  const strings = [osc(ctx, o.wave, n.hz, when, stop), osc(ctx, o.wave, n.hz * (1 + o.detune), when, stop)];
  strings.forEach((s, i) => {
    glide(s, n.glideFrom ? n.glideFrom * (i ? 1 + o.detune : 1) : undefined, n.hz * (i ? 1 + o.detune : 1), when, 0.11);
    const g = ctx.createGain();
    g.gain.value = i ? 0.5 : 1;
    s.connect(g).connect(env);
  });

  // The bridge buzz: a little waveshaping adds the metallic harmonics of a jawari.
  if (o.buzz > 0) {
    const shaper = ctx.createWaveShaper();
    const curve = new Float32Array(257);
    for (let i = 0; i < 257; i++) {
      const x = (i - 128) / 128;
      curve[i] = Math.tanh(x * (1 + o.buzz * 4)) * 0.9;
    }
    shaper.curve = curve;
    env.connect(shaper).connect(lp);
  } else env.connect(lp);

  // Sympathetic strings ring on after the note.
  if (o.sym > 0) {
    const sym = osc(ctx, 'sine', n.hz * 2, when, stop + 1);
    const sg = ctx.createGain();
    sg.gain.setValueAtTime(0.0001, when);
    sg.gain.linearRampToValueAtTime(0.06 * o.sym * n.vel, when + 0.08);
    sg.gain.exponentialRampToValueAtTime(0.0001, stop + 0.9);
    sym.connect(sg);
    place(ctx, sg, out, n.pan ?? 0, o.wet);
  }
  place(ctx, lp, out, n.pan ?? 0, n.wet ?? o.wet);
}

export function sitar(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  pluckVoice(ctx, out, when, n, { wave: 'sawtooth', detune: 0.003, bright: 7000, dark: 850, decay: 1.9, buzz: 1, sym: 1, wet: 0.28 });
}

export function veena(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  pluckVoice(ctx, out, when, n, { wave: 'triangle', detune: 0.002, bright: 4200, dark: 1100, decay: 2.3, buzz: 0.15, sym: 0.6, wet: 0.3 });
}

/** The oud-like pluck for Sumer: short, woody, a little nasal. */
export function oud(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  pluckVoice(ctx, out, when, n, { wave: 'triangle', detune: 0.004, bright: 3000, dark: 600, decay: 1.2, buzz: 0, sym: 0.2, wet: 0.22 });
}

/** Santoor: hammered strings, a shimmer of detuned partials. */
export function santoor(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  const length = 1.7;
  const stop = when + length + 0.1;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(0.3 * n.vel, when + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, when + length);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.setValueAtTime(7000, when);
  lp.frequency.exponentialRampToValueAtTime(1800, when + length * 0.6);
  for (const [mult, level] of [
    [1, 1],
    [1.0045, 0.8],
    [0.9962, 0.7],
    [2.003, 0.25],
  ] as const) {
    const o = osc(ctx, 'triangle', n.hz * mult, when, stop);
    const g = ctx.createGain();
    g.gain.value = level * 0.5;
    o.connect(g).connect(env);
  }
  // The strike itself: a tiny click of noise.
  const click = ctx.createBufferSource();
  click.buffer = noiseBuffer(ctx);
  click.start(when, Math.random());
  click.stop(when + 0.02);
  const cb = ctx.createBiquadFilter();
  cb.type = 'bandpass';
  cb.frequency.value = 4200;
  const cg = ctx.createGain();
  cg.gain.value = 0.12 * n.vel;
  click.connect(cb).connect(cg).connect(lp);
  env.connect(lp);
  place(ctx, lp, out, n.pan ?? (Math.random() * 0.8 - 0.4), n.wet ?? 0.42);
}

/** Bowed strings (sarangi-like): slow attack, singing vibrato. */
export function strings(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  const end = when + n.dur;
  const stop = end + 0.7;
  const env = sustainEnv(ctx, when, end, 0.2 * n.vel, 0.32, 0.55);
  const a = osc(ctx, 'sawtooth', n.hz, when, stop);
  const b = osc(ctx, 'sawtooth', n.hz, when, stop);
  b.detune.value = 7;
  glide(a, n.glideFrom, n.hz, when, 0.18);
  glide(b, n.glideFrom, n.hz, when, 0.18);
  vibrato(ctx, [a, b], when, stop, 4.8, 14, 0.4);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.1;
  lp.frequency.setValueAtTime(900, when);
  lp.frequency.linearRampToValueAtTime(2100, when + 0.7);
  const g = ctx.createGain();
  g.gain.value = 0.5;
  a.connect(g);
  b.connect(g);
  g.connect(env).connect(lp);
  place(ctx, lp, out, n.pan ?? -0.15, n.wet ?? 0.4);
}

// ------------------------------------------------------------------ pads

/** Harmonium: a reedy chord bed, slow to open and slow to close. */
export function harmonium(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  const end = when + n.dur;
  const stop = end + 1.4;
  const env = sustainEnv(ctx, when, end, 0.1 * n.vel, 0.9, 1.3);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 1100;
  lp.Q.value = 0.7;
  for (const detune of [-5, 0, 6]) {
    const o = osc(ctx, 'sawtooth', n.hz, when, stop);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = 0.34;
    o.connect(g).connect(env);
  }
  env.connect(lp);
  place(ctx, lp, out, n.pan ?? 0, n.wet ?? 0.38);
}

/** A held vowel, as a chant: formant-filtered partials, breathing slowly. */
export function choir(ctx: BaseAudioContext, out: Out, when: number, n: Note): void {
  const end = when + n.dur;
  const stop = end + 2;
  const env = sustainEnv(ctx, when, end, 0.12 * n.vel, 1.4, 1.8);
  const swell = osc(ctx, 'sine', 0.18, when, stop);
  const swellG = ctx.createGain();
  swellG.gain.value = 0.25;
  swell.connect(swellG).connect(env.gain);
  for (const [mult, level] of [
    [1, 1],
    [2, 0.5],
    [3, 0.32],
    [4, 0.18],
  ] as const) {
    const o = osc(ctx, 'sawtooth', n.hz * mult, when, stop);
    o.detune.value = (mult - 2) * 3;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = mult === 1 ? 700 : mult === 2 ? 1100 : 2400;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.value = level * 0.6;
    o.connect(f).connect(g).connect(env);
  }
  place(ctx, env, out, n.pan ?? 0, n.wet ?? 0.55);
}

/** The tanpura: Pa, Sa, Sa, Sa(low) in a slow cycle, each string with its buzzing jivari shimmer. */
export function tanpura(ctx: BaseAudioContext, out: Out, when: number, hz: number, vel = 1): void {
  const length = 5.2;
  const stop = when + length + 0.2;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, when);
  env.gain.linearRampToValueAtTime(0.16 * vel, when + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, when + length);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 1.4;
  lp.frequency.setValueAtTime(2600, when);
  lp.frequency.exponentialRampToValueAtTime(640, when + length * 0.7);
  for (const [mult, level, detune] of [
    [1, 1, 0],
    [1, 0.6, 4],
    [2, 0.35, -3],
  ] as const) {
    const o = osc(ctx, 'sawtooth', hz * mult, when, stop);
    o.detune.value = detune;
    const g = ctx.createGain();
    g.gain.value = level * 0.5;
    o.connect(g).connect(env);
  }
  env.connect(lp);
  place(ctx, lp, out, 0, 0.3);

  // Jivari: the buzz of the bridge, which swells in a beat after the pluck.
  const buzz = osc(ctx, 'sawtooth', hz * 4, when, stop);
  const bp = ctx.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz * 5.2;
  bp.Q.value = 6;
  const bg = ctx.createGain();
  bg.gain.setValueAtTime(0.0001, when);
  bg.gain.linearRampToValueAtTime(0.05 * vel, when + 0.7);
  bg.gain.exponentialRampToValueAtTime(0.0001, when + length * 0.8);
  buzz.connect(bp).connect(bg);
  place(ctx, bg, out, 0, 0.25);
}

// ---------------------------------------------------------------- bells

/** A bell struck at `hz`: inharmonic partials that die at different rates. */
export function bellStrike(ctx: BaseAudioContext, out: Out, when: number, hz: number, vel = 1): void {
  for (const [mult, level, decay] of [
    [1, 0.3, 5],
    [2.76, 0.12, 3.2],
    [5.4, 0.06, 2.2],
    [8.9, 0.03, 1.5],
  ] as const) {
    const o = osc(ctx, 'sine', hz * mult, when, when + decay + 0.1);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(level * vel, when + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
    o.connect(g);
    place(ctx, g, out, 0.1, 0.6);
  }
}

// ------------------------------------------------------------- percussion

function thump(ctx: BaseAudioContext, out: Out, when: number, from: number, to: number, decay: number, level: number, pan: number, wet: number): void {
  const o = osc(ctx, 'sine', from, when, when + decay + 0.05);
  o.frequency.setValueAtTime(from, when);
  o.frequency.exponentialRampToValueAtTime(to, when + decay * 0.6);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(level, when + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  o.connect(g);
  place(ctx, g, out, pan, wet);
}

function tick(ctx: BaseAudioContext, out: Out, when: number, freq: number, q: number, decay: number, level: number, pan: number, wet: number, type: BiquadFilterType = 'bandpass'): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.start(when, Math.random());
  src.stop(when + decay + 0.02);
  const f = ctx.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(level, when);
  g.gain.exponentialRampToValueAtTime(0.0001, when + decay);
  src.connect(f).connect(g);
  place(ctx, g, out, pan, wet);
}

/** A pitched ring: the sound of a tabla's right-hand drum or a mridangam's valanthalai. */
function ring(ctx: BaseAudioContext, out: Out, when: number, hz: number, decay: number, level: number, pan: number, wet: number, bend = 0): void {
  for (const [mult, lv, dec] of [
    [1, 1, 1],
    [2.3, 0.35, 0.4],
    [3.4, 0.18, 0.25],
  ] as const) {
    const o = osc(ctx, 'sine', hz * mult, when, when + decay * dec + 0.05);
    if (bend) {
      o.frequency.setValueAtTime(hz * mult * (1 + bend), when);
      o.frequency.exponentialRampToValueAtTime(hz * mult, when + 0.05);
    }
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(level * lv, when + 0.003);
    g.gain.exponentialRampToValueAtTime(0.0001, when + decay * dec);
    o.connect(g);
    place(ctx, g, out, pan, wet);
  }
}

/** Speak one bol on the named drum. `sa` is the tonic in Hz, to which the right-hand drum is tuned. */
export function playBol(ctx: BaseAudioContext, out: Out, when: number, bol: Bol, vel: number, kit: KitName, sa: number): void {
  if (kit === 'none' || bol === 'rest') return;
  const hi = Math.min(330, Math.max(170, sa * 2));
  const v = vel;

  switch (kit) {
    case 'tabla': {
      const bayan = (lv = 0.5): void => {
        thump(ctx, out, when, 118, 72, 0.4, lv * v, -0.25, 0.16);
        tick(ctx, out, when, 260, 1, 0.05, 0.09 * v, -0.25, 0.05, 'lowpass');
      };
      const na = (lv = 0.3, decay = 0.55): void => ring(ctx, out, when, hi, decay, lv * v, 0.2, 0.2);
      switch (bol) {
        case 'dha': bayan(); na(); break;
        case 'dhin': bayan(0.42); na(0.3, 0.8); break;
        case 'dhi': bayan(0.3); na(0.22, 0.4); break;
        case 'ge': bayan(0.46); break;
        case 'ke': bayan(0.26); break;
        case 'ka': bayan(0.2); break;
        case 'na': na(0.34); break;
        case 'tin': ring(ctx, out, when, hi * 1.5, 0.22, 0.3 * v, 0.2, 0.18); break;
        case 'ti': ring(ctx, out, when, hi * 1.5, 0.12, 0.2 * v, 0.2, 0.15); break;
        case 'tu': ring(ctx, out, when, hi * 1.25, 0.2, 0.22 * v, 0.2, 0.18); break;
        case 'ta': tick(ctx, out, when, 2600, 2, 0.05, 0.2 * v, 0.2, 0.1); ring(ctx, out, when, hi * 2, 0.07, 0.12 * v, 0.2, 0.08); break;
        default: break;
      }
      break;
    }
    case 'mridangam': {
      const left = (lv = 0.5): void => thump(ctx, out, when, 150, 92, 0.34, lv * v, -0.2, 0.2);
      const right = (lv = 0.3, decay = 0.5): void => ring(ctx, out, when, hi * 1.1, decay, lv * v, 0.25, 0.2, 0.06);
      switch (bol) {
        case 'ta': tick(ctx, out, when, 2200, 2.4, 0.05, 0.2 * v, 0.2, 0.1); right(0.2, 0.2); break;
        case 'ka': tick(ctx, out, when, 1800, 2, 0.04, 0.14 * v, 0.2, 0.08); break;
        case 'dhi': left(0.4); right(0.26, 0.4); break;
        case 'mi': right(0.16, 0.18); break;
        case 'ju': left(0.3); break;
        case 'na': right(0.32, 0.6); break;
        case 'dha': left(0.5); right(0.3, 0.5); break;
        default: break;
      }
      break;
    }
    case 'dhol': {
      switch (bol) {
        case 'dha': thump(ctx, out, when, 100, 55, 0.42, 0.62 * v, -0.2, 0.3); tick(ctx, out, when, 3000, 1.5, 0.05, 0.18 * v, 0.2, 0.15); break;
        case 'ge': tick(ctx, out, when, 3400, 1.2, 0.06, 0.22 * v, 0.25, 0.2); break;
        case 'dim': thump(ctx, out, when, 130, 80, 0.28, 0.4 * v, 0, 0.22); break;
        default: tick(ctx, out, when, 2800, 1.5, 0.05, 0.14 * v, 0.2, 0.15);
      }
      break;
    }
    case 'frame': {
      if (bol === 'dha' || bol === 'dhin') thump(ctx, out, when, 135, 88, 0.32, 0.45 * v, -0.1, 0.3);
      else tick(ctx, out, when, 2200, 1, 0.07, 0.14 * v, 0.15, 0.25);
      break;
    }
    case 'nagara': {
      if (bol === 'dha' || bol === 'dhin' || bol === 'dim') {
        thump(ctx, out, when, 82, 40, 1.1, 0.7 * v, 0, 0.55);
        tick(ctx, out, when, 180, 0.8, 0.5, 0.2 * v, 0, 0.5, 'lowpass');
      } else thump(ctx, out, when, 90, 50, 0.5, 0.3 * v, 0, 0.45);
      break;
    }
    default:
      break;
  }
}

/** Manjira: small brass cymbals, a bright metallic ting on the accents. */
export function manjira(ctx: BaseAudioContext, out: Out, when: number, vel = 1): void {
  for (const [hz, level] of [
    [3300, 1],
    [4600, 0.7],
    [6700, 0.5],
    [9100, 0.3],
  ] as const) {
    const o = osc(ctx, 'square', hz, when, when + 0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = hz;
    f.Q.value = 14;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.linearRampToValueAtTime(0.03 * level * vel, when + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
    o.connect(f).connect(g);
    place(ctx, g, out, 0.35, 0.3);
  }
}

export const VOICES: Record<VoiceName, (ctx: BaseAudioContext, out: Out, when: number, n: Note) => void> = {
  bansuri,
  sitar,
  veena,
  santoor,
  shehnai,
  strings,
  harmonium,
  choir,
  oud,
};
