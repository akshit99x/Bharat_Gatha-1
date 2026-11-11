import { Rng } from '../Rng';
import { bellStrike, noiseBuffer, type Out } from './voices';
import type { AmbienceKind, AmbienceLayer } from './themes';

/**
 * The air of each region: wind, water, insects, birds, crowds, a forge.
 *
 * Two kinds of layer. A *bed* is continuous — looped noise shaped by filters and
 * slow modulators into wind or surf or a crowd's murmur. An *event* layer
 * schedules individual sounds at irregular intervals — a koel's rising call, a
 * gull, a distant bell. Both are built from the same synthesis the music uses,
 * and both are scheduled against the audio clock so the soundscape can be
 * rendered offline for testing exactly as it plays.
 */

export interface AmbienceHandle {
  /** Schedule any events due before `until` (audio-clock seconds). */
  schedule(until: number): void;
  /** Stop every node. */
  stop(at: number): void;
}

type Maker = (ctx: BaseAudioContext, dest: AudioNode, out: Out, level: number, rng: Rng, from: number) => AmbienceHandle;

// ------------------------------------------------------------------ beds

interface BedSpec {
  filters: Array<{ type: BiquadFilterType; freq: number; q: number }>;
  /** Slow movement of the filter frequency, in Hz of modulation and depth in Hz. */
  sweep?: { rate: number; depth: number };
  /** Slow swell of the loudness. */
  swell?: { rate: number; depth: number };
  gain: number;
}

function bed(ctx: BaseAudioContext, dest: AudioNode, spec: BedSpec, level: number, from: number): AmbienceHandle {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  src.start(from, Math.random() * 1.5);

  const nodes: AudioScheduledSourceNode[] = [src];
  let tail: AudioNode = src;
  let firstFilter: BiquadFilterNode | null = null;
  for (const f of spec.filters) {
    const bq = ctx.createBiquadFilter();
    bq.type = f.type;
    bq.frequency.value = f.freq;
    bq.Q.value = f.q;
    tail.connect(bq);
    tail = bq;
    firstFilter ??= bq;
  }

  if (spec.sweep && firstFilter) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = spec.sweep.rate;
    const depth = ctx.createGain();
    depth.gain.value = spec.sweep.depth;
    lfo.connect(depth).connect(firstFilter.frequency);
    lfo.start(from);
    nodes.push(lfo);
  }

  const g = ctx.createGain();
  g.gain.value = spec.gain * level;
  if (spec.swell) {
    const lfo = ctx.createOscillator();
    lfo.frequency.value = spec.swell.rate;
    const depth = ctx.createGain();
    depth.gain.value = spec.gain * level * spec.swell.depth;
    lfo.connect(depth).connect(g.gain);
    lfo.start(from);
    nodes.push(lfo);
  }
  tail.connect(g).connect(dest);

  return {
    schedule: () => undefined,
    stop: (at) => {
      for (const n of nodes) {
        try {
          n.stop(at);
        } catch {
          /* already stopped */
        }
      }
    },
  };
}

const BEDS: Partial<Record<AmbienceKind, BedSpec>> = {
  wind: { filters: [{ type: 'bandpass', freq: 520, q: 0.55 }], sweep: { rate: 0.06, depth: 320 }, swell: { rate: 0.1, depth: 0.45 }, gain: 0.5 },
  waves: { filters: [{ type: 'lowpass', freq: 760, q: 0.7 }], swell: { rate: 0.11, depth: 0.85 }, gain: 0.55 },
  river: { filters: [{ type: 'bandpass', freq: 1250, q: 0.6 }], sweep: { rate: 0.4, depth: 260 }, swell: { rate: 0.17, depth: 0.2 }, gain: 0.3 },
  fountain: { filters: [{ type: 'highpass', freq: 2400, q: 0.5 }, { type: 'lowpass', freq: 7600, q: 0.5 }], swell: { rate: 0.8, depth: 0.12 }, gain: 0.16 },
  crowd: { filters: [{ type: 'bandpass', freq: 640, q: 0.9 }], sweep: { rate: 0.23, depth: 190 }, swell: { rate: 0.31, depth: 0.5 }, gain: 0.34 },
};

// ---------------------------------------------------------------- crickets

function crickets(ctx: BaseAudioContext, dest: AudioNode, level: number, from: number): AmbienceHandle {
  const nodes: AudioScheduledSourceNode[] = [];
  const bus = ctx.createGain();
  bus.gain.value = 0.045 * level;
  bus.connect(dest);
  // Three "insects", slightly different in pitch and pulse rate, so it does not sound like one tone.
  for (const [hz, rate] of [
    [4300, 14],
    [4650, 17.5],
    [5000, 21],
  ] as const) {
    const o = ctx.createOscillator();
    o.frequency.value = hz;
    const gate = ctx.createGain();
    gate.gain.value = 0.5;
    const pulse = ctx.createOscillator();
    pulse.type = 'square';
    pulse.frequency.value = rate;
    const depth = ctx.createGain();
    depth.gain.value = 0.5;
    pulse.connect(depth).connect(gate.gain);
    // Slow chirp groups: the cricket pauses, then trills.
    const groups = ctx.createOscillator();
    groups.frequency.value = 0.35 + rate * 0.01;
    const groupDepth = ctx.createGain();
    groupDepth.gain.value = 0.35;
    const level2 = ctx.createGain();
    level2.gain.value = 0.65;
    groups.connect(groupDepth).connect(level2.gain);
    o.connect(gate).connect(level2).connect(bus);
    o.start(from);
    pulse.start(from);
    groups.start(from);
    nodes.push(o, pulse, groups);
  }
  return {
    schedule: () => undefined,
    stop: (at) => {
      for (const n of nodes) {
        try {
          n.stop(at);
        } catch {
          /* ignore */
        }
      }
    },
  };
}

// ------------------------------------------------------------ event layers

/** Run `emit` at irregular intervals between `min` and `max` seconds. */
function irregular(rng: Rng, from: number, min: number, max: number, emit: (t: number) => void): AmbienceHandle {
  let next = from + rng.range(0.5, max * 0.6);
  let stopped = false;
  return {
    schedule: (until) => {
      while (!stopped && next < until) {
        emit(next);
        next += rng.range(min, max);
      }
    },
    stop: () => {
      stopped = true;
    },
  };
}

function chirp(ctx: BaseAudioContext, dest: AudioNode, when: number, f0: number, f1: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
  const o = ctx.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, when);
  o.frequency.exponentialRampToValueAtTime(f1, when + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, when);
  g.gain.linearRampToValueAtTime(gain, when + dur * 0.15);
  g.gain.exponentialRampToValueAtTime(0.0001, when + dur);
  o.connect(g).connect(dest);
  o.start(when);
  o.stop(when + dur + 0.05);
}

const EVENT_MAKERS: Partial<Record<AmbienceKind, Maker>> = {
  birds: (ctx, dest, _out, level, rng, from) =>
    irregular(rng, from, 3, 9, (t) => {
      // A phrase of two to five chirps, each a quick glide.
      const base = rng.range(2400, 4200);
      const n = rng.int(2, 5);
      for (let i = 0; i < n; i++) {
        const rise = rng.bool(0.5);
        chirp(ctx, dest, t + i * rng.range(0.1, 0.18), base * (rise ? 0.85 : 1.1), base * (rise ? 1.15 : 0.9), 0.08, 0.05 * level);
      }
    }),

  koel: (ctx, dest, _out, level, rng, from) =>
    irregular(rng, from, 14, 32, (t) => {
      // The koel's call: a whistled "ku-oo" that climbs a little each time.
      let hz = rng.range(780, 900);
      for (let i = 0; i < 4 + rng.int(0, 2); i++) {
        chirp(ctx, dest, t + i * 0.62, hz, hz * 1.4, 0.42, 0.07 * level);
        hz *= 1.07;
      }
    }),

  gulls: (ctx, dest, _out, level, rng, from) =>
    irregular(rng, from, 8, 20, (t) => {
      for (let i = 0; i < rng.int(2, 3); i++) {
        chirp(ctx, dest, t + i * 0.42, 1500, 2100, 0.34, 0.04 * level, 'sawtooth');
        chirp(ctx, dest, t + i * 0.42 + 0.2, 2100, 1400, 0.3, 0.035 * level, 'sawtooth');
      }
    }),

  crows: (ctx, dest, _out, level, rng, from) =>
    irregular(rng, from, 12, 30, (t) => {
      for (let i = 0; i < rng.int(2, 4); i++) chirp(ctx, dest, t + i * 0.45, 460, 340, 0.22, 0.05 * level, 'sawtooth');
    }),

  frogs: (ctx, dest, _out, level, rng, from) =>
    irregular(rng, from, 2.5, 7, (t) => {
      const base = rng.range(260, 340);
      for (let i = 0; i < rng.int(4, 8); i++) chirp(ctx, dest, t + i * 0.065, base, base * 1.12, 0.045, 0.045 * level, 'square');
    }),

  bells: (ctx, _dest, out, level, rng, from) =>
    irregular(rng, from, 9, 24, (t) => {
      // A distant temple bell, far off and heavily in the room.
      const hz = rng.pick([392, 440, 523.25, 587.33]);
      bellStrike(ctx, out, t, hz, 0.34 * level);
      if (rng.bool(0.4)) bellStrike(ctx, out, t + 1.4, hz * 1.003, 0.25 * level);
    }),

  forge: (ctx, _dest, out, level, rng, from) =>
    irregular(rng, from, 1.1, 2.8, (t) => {
      // A hammer on bronze: a short, bright, inharmonic ring.
      const hz = rng.range(1150, 1500);
      for (const [mult, lv, dec] of [
        [1, 0.1, 0.5],
        [2.41, 0.06, 0.3],
        [3.97, 0.035, 0.2],
      ] as const) {
        const o = ctx.createOscillator();
        o.frequency.value = hz * mult;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(lv * level, t + 0.002);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
        o.connect(g).connect(out.dry);
        o.start(t);
        o.stop(t + dec + 0.05);
      }
    }),

  horn: (ctx, dest, _out, level, rng, from) =>
    irregular(rng, from, 28, 60, (t) => {
      // A far-off conch or horn: one long, slow-opening note.
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(146, t);
      o.frequency.linearRampToValueAtTime(156, t + 1.4);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 520;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.07 * level, t + 1.1);
      g.gain.setValueAtTime(0.07 * level, t + 2.6);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2);
      o.connect(lp).connect(g).connect(dest);
      o.start(t);
      o.stop(t + 4.3);
    }),
};

// -------------------------------------------------------------------- mix

/** Start every layer of an ambience, returning one handle that schedules and stops them all. */
export function startAmbience(ctx: BaseAudioContext, dest: AudioNode, out: Out, layers: readonly AmbienceLayer[], seed: string, from: number): AmbienceHandle {
  const rng = new Rng(`ambience:${seed}`);
  const handles: AmbienceHandle[] = [];
  for (const layer of layers) {
    const spec = BEDS[layer.kind];
    if (spec) handles.push(bed(ctx, dest, spec, layer.level, from));
    else if (layer.kind === 'crickets') handles.push(crickets(ctx, dest, layer.level, from));
    else {
      const make = EVENT_MAKERS[layer.kind];
      if (make) handles.push(make(ctx, dest, out, layer.level, rng.fork(layer.kind), from));
    }
  }
  return {
    schedule: (until) => handles.forEach((h) => h.schedule(until)),
    stop: (at) => handles.forEach((h) => h.stop(at)),
  };
}
