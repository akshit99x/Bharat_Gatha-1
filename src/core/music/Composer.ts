import { Rng } from '../Rng';
import { RAGA_BOOK, TAALS, noteHz, type Bol, type Raga, type Taal } from './theory';
import type { Theme } from './themes';
import type { VoiceName } from './voices';

/**
 * The composer.
 *
 * It turns a theme into music one bar at a time, as a list of timed events with
 * no audio in it at all — which is what makes it testable: every note it ever
 * chooses can be checked against the raga without a speaker in sight.
 *
 * How it keeps music pleasant rather than merely random:
 *  - **Melody is built from the raga's own phrases** (its pakad), varied a
 *    little, never improvised note by note. Phrases end on a note the raga rests
 *    on, and a long phrase is followed by silence.
 *  - **Two modes alternate.** Alap is free-time: long notes, glides between
 *    them, a drone underneath, no pulse. Gat is metered: a rhythmic cycle, a
 *    phrase fitted to it, the drum speaking its bols. A theme chooses how much
 *    of each it wants.
 *  - **Call and response.** The lead states a phrase; the echo voice answers it
 *    an octave up, quieter, on alternate bars.
 *  - **Resolution.** The last bar of every metered block lands on Sa.
 */

export type Instrument = VoiceName | 'tanpura' | 'bell' | 'manjira';

export interface NoteEvent {
  kind: 'note';
  t: number;
  voice: Instrument;
  midi: number;
  dur: number;
  vel: number;
  glideFromMidi?: number;
  pan?: number;
  wet?: number;
}

export interface DrumEvent {
  kind: 'drum';
  t: number;
  bol: Bol;
  vel: number;
}

export type ScoreEvent = NoteEvent | DrumEvent;

export interface Bar {
  mode: 'alap' | 'gat';
  /** Seconds. */
  duration: number;
  events: ScoreEvent[];
  /** Index of this bar in the theme's endless cycle. */
  index: number;
}

/** Rhythms for filling a bar of N beats, in beats. Each is tried in turn so a bar is never a single run of equal notes. */
const CELLS: number[][] = [
  [1, 1],
  [2],
  [1.5, 0.5],
  [0.5, 0.5, 1],
  [1, 0.5, 0.5],
  [0.5, 0.5, 0.5, 0.5],
  [0.75, 0.25, 1],
];

export class Composer {
  readonly raga: Raga;
  readonly taal: Taal;
  private readonly rng: Rng;
  private index = 0;
  private phraseCursor = 0;

  constructor(readonly theme: Theme, seed = 'score') {
    this.raga = RAGA_BOOK[theme.raga] ?? (RAGA_BOOK.bhairav as Raga);
    this.taal = TAALS[theme.taal] ?? (TAALS.keherwa as Taal);
    this.rng = new Rng(`${theme.id}:${seed}`);
  }

  /** Where the next bar falls in the alap/gat cycle. */
  private mode(): 'alap' | 'gat' {
    const { alapBars, gatBars } = this.theme;
    if (gatBars === 0) return 'alap';
    return this.index % (alapBars + gatBars) < alapBars ? 'alap' : 'gat';
  }

  nextBar(): Bar {
    const mode = this.mode();
    const bar = mode === 'alap' ? this.alap() : this.gat();
    this.index++;
    return bar;
  }

  // ----------------------------------------------------------------- pieces

  private sa(): number {
    return this.theme.tonic;
  }

  /** A phrase from the raga's pakad, varied a little so it does not repeat exactly. */
  private phrase(): number[] {
    const book = this.raga.pakad;
    // Walk the book in order with an occasional jump: familiar, but not a loop.
    this.phraseCursor = this.rng.bool(0.3) ? this.rng.int(0, book.length - 1) : (this.phraseCursor + 1) % book.length;
    let p = [...(book[this.phraseCursor] as number[])];

    if (p.length > 4 && this.rng.bool(0.3)) p = p.slice(this.rng.int(0, 1)); // start part-way in
    if (p.length > 4 && this.rng.bool(0.25)) p.splice(this.rng.int(1, p.length - 2), 1); // drop an inner note
    if (this.rng.bool(0.2)) {
      const at = this.rng.int(0, p.length - 1);
      p.splice(at, 0, p[at] as number); // linger on a note
    }
    // Phrases come to rest.
    const last = p[p.length - 1] as number;
    if (!this.raga.rest.includes(((last % 12) + 12) % 12) && this.rng.bool(0.7)) {
      p.push(this.raga.rest[this.rng.int(0, this.raga.rest.length - 1)] as number);
    }
    return p;
  }

  /** The neighbouring scale note above or below `semi`, for a grace note. */
  private neighbour(semi: number, dir: 1 | -1): number {
    const scale = this.raga.scale;
    const pc = ((semi % 12) + 12) % 12;
    const oct = semi - pc;
    const at = scale.indexOf(pc);
    if (at < 0) return semi;
    const next = at + dir;
    if (next < 0) return oct + (scale[scale.length - 1] as number) - 12;
    if (next >= scale.length) return oct + (scale[0] as number) + 12;
    return oct + (scale[next] as number);
  }

  private tanpura(events: ScoreEvent[], duration: number): void {
    const sa = this.sa();
    const pa = this.raga.scale.includes(7) ? 7 : 5;
    const cycle = [pa - 12, 0, 0, -12];
    const gap = 1.55;
    for (let t = 0, i = 0; t < duration - 0.2; t += gap, i++) {
      events.push({ kind: 'note', t, voice: 'tanpura', midi: sa + (cycle[i % 4] as number), dur: gap, vel: 0.8 });
    }
  }

  private padChord(events: ScoreEvent[], t: number, dur: number): void {
    const pad = this.theme.pad;
    if (!pad) return;
    const sa = this.sa();
    // Sa and Pa (or Ma, in a raga that has no Pa, like Malkauns), and a third when the raga has one,
    // an octave down: a bed, not a chord progression.
    const fifth = this.raga.scale.includes(7) ? 7 : 5;
    events.push({ kind: 'note', t, voice: pad, midi: sa - 12, dur, vel: 0.55 });
    events.push({ kind: 'note', t, voice: pad, midi: sa + fifth - 12, dur, vel: 0.42 });
    const third = this.raga.scale.find((s) => s === 4 || s === 3);
    if (third !== undefined) events.push({ kind: 'note', t, voice: pad, midi: sa + third - 12, dur, vel: 0.3 });
  }

  private shimmer(events: ScoreEvent[], duration: number, count: number): void {
    const voice = this.theme.shimmer;
    if (!voice) return;
    for (let i = 0; i < count; i++) {
      const semi = this.raga.scale[this.rng.int(0, this.raga.scale.length - 1)] as number;
      events.push({
        kind: 'note',
        t: this.rng.range(0.3, duration - 0.6),
        voice,
        midi: this.sa() + 24 + semi - (this.rng.bool(0.4) ? 12 : 0),
        dur: 1,
        vel: this.rng.range(0.25, 0.45),
        pan: this.rng.range(-0.6, 0.6),
      });
    }
  }

  // ------------------------------------------------------------------- alap

  /** Free time: long notes with glides between them, a drone, and room to breathe. */
  private alap(): Bar {
    const th = this.theme;
    const duration = this.rng.range(10, 13);
    const events: ScoreEvent[] = [];

    this.tanpura(events, duration);
    if (this.index % 2 === 0) this.padChord(events, 0, duration * 2 + 1);
    if (th.accents?.includes('bell') && this.rng.bool(0.3)) {
      events.push({ kind: 'note', t: this.rng.range(0.2, 2), voice: 'bell', midi: th.tonic + 24, dur: 4, vel: 0.5 });
    }

    // One phrase, slowly: the first note longest, glides on the shorter intervals.
    const phrase = this.phrase();
    let t = this.rng.range(0.6, 1.8);
    let prev: number | undefined;
    const lead = th.lead;
    const placed: NoteEvent[] = [];
    phrase.forEach((semi, i) => {
      const midi = th.tonic + th.leadOctave + semi;
      const dur = i === 0 ? this.rng.range(2, 3.4) : i === phrase.length - 1 ? this.rng.range(2.2, 3.6) : this.rng.range(0.9, 2.2);
      const glides = prev !== undefined && Math.abs(midi - prev) <= 4 && this.rng.bool(0.5);
      if (t + dur > duration + 1) return;
      const note: NoteEvent = { kind: 'note', t, voice: lead, midi, dur, vel: this.rng.range(0.7, 0.9), ...(glides ? { glideFromMidi: prev } : {}) };
      events.push(note);
      placed.push(note);
      prev = midi;
      t += dur * 0.92;
    });

    // The echo answers the last few notes, an octave up and softer.
    if (th.echo && placed.length >= 2 && this.rng.bool(0.5)) {
      const tail = placed.slice(-3);
      let at = t + this.rng.range(0.6, 1.2);
      for (const n of tail) {
        events.push({ kind: 'note', t: at, voice: th.echo, midi: n.midi + 12, dur: Math.min(1.6, n.dur), vel: 0.42, pan: 0.3 });
        at += Math.min(1.6, n.dur) * 0.85;
      }
    }

    this.shimmer(events, duration, th.shimmer ? this.rng.int(4, 8) : 0);

    // A pulse underneath, when the theme wants a heartbeat during alap.
    if (th.pulseInAlap && th.kit !== 'none') {
      for (let pt = 0.5; pt < duration; pt += 60 / th.bpm * 2) events.push({ kind: 'drum', t: pt, bol: 'dha', vel: 0.4 });
    }
    return { mode: 'alap', duration, events, index: this.index };
  }

  // -------------------------------------------------------------------- gat

  /** A rhythm that fills exactly `beats` beats, from cells and the occasional rest. */
  private rhythm(beats: number): Array<{ beats: number; rest: boolean }> {
    const out: Array<{ beats: number; rest: boolean }> = [];
    let left = beats;
    while (left > 1e-6) {
      const fit = CELLS.filter((c) => c.reduce((a, b) => a + b, 0) <= left + 1e-6);
      const cell = fit[this.rng.int(0, fit.length - 1)] as number[];
      for (const b of cell) {
        out.push({ beats: b, rest: out.length > 0 && this.rng.bool(0.12) });
      }
      left -= cell.reduce((a, b) => a + b, 0);
    }
    return out;
  }

  /** Metered: a taal, its bols on the drum, a phrase fitted to the cycle. */
  private gat(): Bar {
    const th = this.theme;
    const matras = this.taal.bols.length;
    const beat = 60 / th.bpm;
    const duration = matras * beat;
    const events: ScoreEvent[] = [];
    const blockBar = (this.index - th.alapBars) % (th.alapBars + th.gatBars);
    const lastOfBlock = (this.index % (th.alapBars + th.gatBars)) === th.alapBars + th.gatBars - 1;

    this.tanpura(events, duration);
    if (this.index % 2 === 0) this.padChord(events, 0, duration * 2 + 0.5);

    // Drum.
    if (th.kit !== 'none') {
      this.taal.bols.forEach((bol, m) => {
        const strong = m === 0 ? 1 : this.taal.vibhag.includes(m) ? 0.82 : 0.62;
        events.push({ kind: 'drum', t: m * beat + this.rng.range(-0.006, 0.006), bol, vel: strong * this.rng.range(0.9, 1.05) });
      });
      // An occasional fill into the next sam.
      if (this.rng.bool(0.3) && matras >= 6) {
        const fillBols: Bol[] = ['ti', 'ka', 'ge', 'na'];
        events.push({ kind: 'drum', t: (matras - 0.5) * beat, bol: fillBols[this.rng.int(0, 3)] as Bol, vel: 0.5 });
      }
    }
    if (th.accents?.includes('manjira')) events.push({ kind: 'note', t: 0, voice: 'manjira', midi: 0, dur: 0.3, vel: 0.7 });
    if (th.accents?.includes('bell') && blockBar === 0) events.push({ kind: 'note', t: 0, voice: 'bell', midi: th.tonic + 24, dur: 3, vel: 0.4 });

    // Melody: a phrase fitted to the cycle. Odd bars hand the line to the echo voice, if there is one.
    const response = !!th.echo && this.index % 2 === 1 && this.rng.bool(0.6);
    const voice: VoiceName = response ? (th.echo as VoiceName) : th.lead;
    const octave = th.leadOctave + (response ? 12 : 0);
    const phrase = this.phrase();
    const rhythm = this.rhythm(matras);

    let t = 0;
    let n = 0;
    let prev: number | undefined;
    for (const cell of rhythm) {
      const dur = cell.beats * beat;
      if (cell.rest && !(n === 0)) {
        t += dur;
        continue;
      }
      // The last note of the last bar of a block lands on Sa and holds.
      const finalNote = lastOfBlock && t + dur >= duration - 1e-6;
      const semi = finalNote ? 0 : (phrase[n % phrase.length] as number);
      const midi = th.tonic + octave + semi;
      const glides = prev !== undefined && cell.beats >= 1 && Math.abs(midi - prev) <= 3 && this.rng.bool(0.3);
      const hold = finalNote ? Math.max(dur, beat * 2) : dur * 0.92;
      // A grace note before a longer note gives the phrase its ornament.
      if (cell.beats >= 1 && !finalNote && this.rng.bool(0.2) && n > 0) {
        events.push({
          kind: 'note',
          t: Math.max(0, t - 0.09),
          voice,
          midi: th.tonic + octave + this.neighbour(semi, this.rng.bool(0.5) ? 1 : -1),
          dur: 0.1,
          vel: 0.4,
        });
      }
      events.push({
        kind: 'note',
        t,
        voice,
        midi,
        dur: hold,
        vel: (response ? 0.5 : 0.78) * (n === 0 ? 1 : this.rng.range(0.85, 1)),
        ...(glides ? { glideFromMidi: prev } : {}),
        ...(response ? { pan: 0.3 } : {}),
      });
      prev = midi;
      t += dur;
      n++;
    }

    // Shimmer on the off-beats.
    this.shimmer(events, duration, th.shimmer ? this.rng.int(3, 6) : 0);
    return { mode: 'gat', duration, events, index: this.index };
  }

  /** Every pitch class the composer is allowed to use, for tests. */
  allowedPitchClasses(): Set<number> {
    return new Set(this.raga.scale);
  }

  /** The frequency of Sa, for tuning drums. */
  saHz(): number {
    return noteHz(this.theme.tonic);
  }
}
