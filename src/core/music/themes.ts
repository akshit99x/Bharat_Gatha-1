import type { KitName, VoiceName } from './voices';

/**
 * One theme per region, plus the title screen and the opening flight.
 *
 * A theme is a recipe, not a recording: which raga, at what tonic and tempo,
 * which rhythmic cycle, which instruments take which part, how long it spends in
 * free-time alap before the tabla joins, and what the air sounds like. The
 * composer turns the recipe into music that is never quite the same twice.
 */

export type AmbienceKind =
  | 'wind'
  | 'waves'
  | 'river'
  | 'crickets'
  | 'birds'
  | 'koel'
  | 'crowd'
  | 'forge'
  | 'bells'
  | 'frogs'
  | 'fountain'
  | 'gulls'
  | 'crows'
  | 'horn';

export interface AmbienceLayer {
  kind: AmbienceKind;
  /** 0–1, relative loudness. */
  level: number;
}

export interface Theme {
  id: string;
  /** What the player would call it. */
  name: string;
  raga: string;
  /** MIDI note of Sa. */
  tonic: number;
  /** Beats per minute, for metered sections. */
  bpm: number;
  taal: string;
  kit: KitName;
  lead: VoiceName;
  /** Answers the lead an octave up, call-and-response. */
  echo?: VoiceName;
  /** Scattered, shimmering notes. */
  shimmer?: VoiceName;
  /** A sustained bed under everything. */
  pad?: VoiceName;
  /** Octave the lead sits in, in semitones above Sa. */
  leadOctave: number;
  /** Bars of free-time alap, then bars of metered gat, repeating. gatBars 0 stays in alap. */
  alapBars: number;
  gatBars: number;
  /** Play a soft pulse on the drum even during alap. */
  pulseInAlap?: boolean;
  /** 0–1: how much of the room's reverb. */
  reverb: number;
  /** Overall loudness of this theme. Not a taste setting: each is calibrated from an offline render so that walking between regions never jumps in volume (target RMS about 0.07). */
  level: number;
  accents?: Array<'manjira' | 'bell'>;
  ambience: AmbienceLayer[];
}

export const THEMES: Record<string, Theme> = {
  /** Before the journey: an unhurried evening alap over a held harmonium. */
  title: {
    id: 'title',
    name: 'Prologue',
    raga: 'yaman',
    tonic: 52,
    bpm: 60,
    taal: 'dadra',
    kit: 'none',
    lead: 'bansuri',
    shimmer: 'santoor',
    pad: 'harmonium',
    leadOctave: 12,
    alapBars: 4,
    gatBars: 0,
    reverb: 0.75,
    level: 0.49,
    accents: ['bell'],
    ambience: [
      { kind: 'wind', level: 0.1 },
      { kind: 'crickets', level: 0.14 },
    ],
  },

  /** The vimana crossing: bright, rising, with a lilting keherwa under it. */
  flight: {
    id: 'flight',
    name: 'The Pushpaka Vimana',
    raga: 'bhupali',
    tonic: 55,
    bpm: 96,
    taal: 'keherwa',
    kit: 'tabla',
    lead: 'bansuri',
    echo: 'santoor',
    pad: 'strings',
    leadOctave: 12,
    alapBars: 1,
    gatBars: 16,
    reverb: 0.7,
    level: 0.64,
    accents: ['manjira'],
    ambience: [{ kind: 'wind', level: 0.45 }],
  },

  /** Sindhu-Sarasvati: ancient, spare, patient. A heartbeat on a frame drum under a lone flute. */
  sindhu: {
    id: 'sindhu',
    name: 'The Silent City',
    raga: 'bhairav',
    tonic: 50,
    bpm: 52,
    taal: 'heartbeat',
    kit: 'frame',
    lead: 'bansuri',
    pad: 'harmonium',
    leadOctave: 12,
    alapBars: 4,
    gatBars: 0,
    pulseInAlap: true,
    reverb: 0.6,
    level: 0.48,
    ambience: [
      { kind: 'river', level: 0.22 },
      { kind: 'crickets', level: 0.12 },
      { kind: 'wind', level: 0.14 },
      { kind: 'birds', level: 0.12 },
    ],
  },

  /** Sumer and Dilmun: a maqam, an oud, a frame drum, the harbour. */
  meluhha: {
    id: 'meluhha',
    name: 'The Neighbours Who Wrote It All Down',
    raga: 'hijaz',
    tonic: 52,
    bpm: 78,
    taal: 'dadra',
    kit: 'frame',
    lead: 'oud',
    echo: 'bansuri',
    pad: 'strings',
    leadOctave: 12,
    alapBars: 2,
    gatBars: 4,
    reverb: 0.5,
    level: 1.33,
    ambience: [
      { kind: 'river', level: 0.18 },
      { kind: 'frogs', level: 0.1 },
      { kind: 'gulls', level: 0.1 },
      { kind: 'crowd', level: 0.08 },
    ],
  },

  /** Kosala and Dandaka: pastoral, a flute by a river, the koel in the trees. */
  kosala: {
    id: 'kosala',
    name: 'Three Hundred Ramayanas',
    raga: 'pahadi',
    tonic: 55,
    bpm: 80,
    taal: 'keherwa',
    kit: 'tabla',
    lead: 'bansuri',
    shimmer: 'santoor',
    leadOctave: 12,
    alapBars: 2,
    gatBars: 6,
    reverb: 0.6,
    level: 0.51,
    ambience: [
      { kind: 'birds', level: 0.28 },
      { kind: 'koel', level: 0.12 },
      { kind: 'river', level: 0.16 },
      { kind: 'wind', level: 0.1 },
    ],
  },

  /** The Setu and Lanka: the sea, a raga of longing for the monsoon, a veena. */
  'setu-lanka': {
    id: 'setu-lanka',
    name: 'The Hardest Choice',
    raga: 'desh',
    tonic: 48,
    bpm: 68,
    taal: 'dadra',
    kit: 'frame',
    lead: 'veena',
    echo: 'bansuri',
    pad: 'strings',
    leadOctave: 12,
    alapBars: 3,
    gatBars: 4,
    reverb: 0.65,
    level: 0.85,
    ambience: [
      { kind: 'waves', level: 0.45 },
      { kind: 'gulls', level: 0.14 },
      { kind: 'wind', level: 0.2 },
    ],
  },

  /** Kurukshetra: low and heavy. A shehnai laments over a slow war drum. */
  kurukshetra: {
    id: 'kurukshetra',
    name: 'A Family That Could Not Talk',
    raga: 'malkauns',
    tonic: 45,
    bpm: 46,
    taal: 'ektaal',
    kit: 'nagara',
    lead: 'shehnai',
    pad: 'choir',
    leadOctave: 12,
    alapBars: 3,
    gatBars: 3,
    reverb: 0.8,
    level: 1.81,
    ambience: [
      { kind: 'wind', level: 0.32 },
      { kind: 'crows', level: 0.1 },
      { kind: 'horn', level: 0.1 },
    ],
  },

  /** Magadha: devotional. A held chant, a flute, temple bells. No drum at all. */
  magadha: {
    id: 'magadha',
    name: 'An Emperor’s Apology',
    raga: 'kafi',
    tonic: 50,
    bpm: 56,
    taal: 'heartbeat',
    kit: 'none',
    lead: 'bansuri',
    echo: 'strings',
    pad: 'choir',
    leadOctave: 12,
    alapBars: 4,
    gatBars: 0,
    reverb: 0.8,
    level: 0.5,
    accents: ['bell'],
    ambience: [
      { kind: 'bells', level: 0.24 },
      { kind: 'wind', level: 0.12 },
      { kind: 'birds', level: 0.14 },
    ],
  },

  /** The Chola country: Carnatic, brisk. A nadaswaram, a veena and a mridangam in adi talam. */
  chola: {
    id: 'chola',
    name: 'Ballots from a Pot',
    raga: 'bhupali',
    tonic: 55,
    bpm: 112,
    taal: 'adi',
    kit: 'mridangam',
    lead: 'shehnai',
    echo: 'veena',
    leadOctave: 12,
    alapBars: 1,
    gatBars: 8,
    reverb: 0.6,
    level: 2.0,
    accents: ['bell'],
    ambience: [
      { kind: 'bells', level: 0.18 },
      { kind: 'crowd', level: 0.12 },
      { kind: 'forge', level: 0.18 },
      { kind: 'birds', level: 0.1 },
    ],
  },

  /** Konark: an evening raga, a sitar and a santoor, the sea in the distance. */
  konark: {
    id: 'konark',
    name: 'A Chariot for the Sun',
    raga: 'yaman',
    tonic: 52,
    bpm: 108,
    taal: 'teental',
    kit: 'tabla',
    lead: 'sitar',
    shimmer: 'santoor',
    pad: 'strings',
    leadOctave: 12,
    alapBars: 2,
    gatBars: 4,
    reverb: 0.6,
    level: 0.47,
    ambience: [
      { kind: 'waves', level: 0.26 },
      { kind: 'crickets', level: 0.2 },
      { kind: 'wind', level: 0.1 },
    ],
  },

  /** Vijayanagara: festive, a bright major mode, a bazaar full of people. */
  hampi: {
    id: 'hampi',
    name: 'One Catastrophic Afternoon',
    raga: 'shankarabharanam',
    tonic: 53,
    bpm: 120,
    taal: 'adi',
    kit: 'mridangam',
    lead: 'veena',
    echo: 'bansuri',
    leadOctave: 12,
    alapBars: 1,
    gatBars: 8,
    reverb: 0.55,
    level: 0.84,
    accents: ['manjira'],
    ambience: [
      { kind: 'crowd', level: 0.24 },
      { kind: 'bells', level: 0.1 },
      { kind: 'birds', level: 0.1 },
    ],
  },

  /** Agra and Sikri: Mughal court music. Sitar and tabla in teental, a fountain in the garden. */
  agra: {
    id: 'agra',
    name: 'Whose Hands Built the Tomb?',
    raga: 'bhairavi',
    tonic: 51,
    bpm: 104,
    taal: 'teental',
    kit: 'tabla',
    lead: 'sitar',
    echo: 'santoor',
    pad: 'strings',
    leadOctave: 12,
    alapBars: 2,
    gatBars: 6,
    reverb: 0.7,
    level: 0.6,
    ambience: [
      { kind: 'fountain', level: 0.22 },
      { kind: 'birds', level: 0.16 },
      { kind: 'crowd', level: 0.06 },
    ],
  },

  /** The hill forts: heroic, a shehnai over a galloping dhol, wind on the ramparts. */
  maratha: {
    id: 'maratha',
    name: 'Where Geography Is the General',
    raga: 'durga',
    tonic: 52,
    bpm: 136,
    taal: 'dholi',
    kit: 'dhol',
    lead: 'shehnai',
    echo: 'bansuri',
    leadOctave: 12,
    alapBars: 1,
    gatBars: 8,
    reverb: 0.5,
    level: 1.57,
    ambience: [
      { kind: 'wind', level: 0.32 },
      { kind: 'crowd', level: 0.05 },
      { kind: 'horn', level: 0.07 },
    ],
  },
};

export function themeFor(id: string): Theme | undefined {
  return THEMES[id];
}
