/**
 * Music theory for the score: ragas (and one maqam), their characteristic
 * phrases, and the rhythmic cycles (taals) that give each region its pulse.
 *
 * Everything is in semitones from Sa. A raga here is more than a scale: it
 * carries its *pakad*, the short characteristic phrases by which a listener
 * recognises it, and the notes it likes to rest on. The generator builds
 * melody out of those phrases rather than wandering the scale at random, which
 * is the difference between music that sounds Indian and music that merely uses
 * Indian notes.
 */

export const noteHz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

export interface Raga {
  name: string;
  /** Semitone offsets within the octave. */
  scale: number[];
  /** Characteristic phrases, as semitones from Sa (negative = the octave below). */
  pakad: number[][];
  /** Notes the raga rests on; phrases tend to end here. */
  rest: number[];
}

export const RAGA_BOOK: Record<string, Raga> = {
  /** Serious, ancient, first light. */
  bhairav: {
    name: 'Bhairav',
    scale: [0, 1, 4, 5, 7, 8, 11],
    pakad: [
      [0, 1, 4, 1, 0],
      [4, 5, 4, 1, 0],
      [7, 8, 7, 5, 4, 1, 0],
      [0, 4, 5, 7, 8, 7],
    ],
    rest: [0, 7, 4],
  },
  /** Luminous, evening. */
  yaman: {
    name: 'Yaman',
    scale: [0, 2, 4, 6, 7, 9, 11],
    pakad: [
      [-1, 2, 4, 2, 0],
      [4, 6, 7, 6, 4, 2, 0],
      [7, 9, 11, 9, 7, 6, 4],
      [-1, 0, 2, 4, 6, 7],
    ],
    rest: [0, 4, 7],
  },
  /** Open pentatonic, pastoral and sweet. */
  bhupali: {
    name: 'Bhupali',
    scale: [0, 2, 4, 7, 9],
    pakad: [
      [0, 2, 4, 7, 4, 2, 0],
      [9, 7, 4, 2, 0],
      [4, 2, 0, -3, 0],
      [7, 9, 12, 9, 7, 4],
    ],
    rest: [0, 4, 7],
  },
  /** A hill raga: bhupali with a softened seventh. */
  pahadi: {
    name: 'Pahadi',
    scale: [0, 2, 4, 7, 9, 10],
    pakad: [
      [4, 7, 9, 7, 4, 2, 0],
      [0, 2, 4, 2, 0, -2, 0],
      [9, 10, 9, 7, 4],
    ],
    rest: [0, 4, 7],
  },
  /** Dark, weighty, midnight. */
  malkauns: {
    name: 'Malkauns',
    scale: [0, 3, 5, 8, 10],
    pakad: [
      [0, 3, 5, 8, 5, 3, 0],
      [10, 8, 5, 3, 0],
      [-2, 0, 3, 5, 3, 0],
      [5, 8, 10, 12, 10, 8],
    ],
    rest: [0, 5, 10],
  },
  /** Devotional, warm. */
  kafi: {
    name: 'Kafi',
    scale: [0, 2, 3, 5, 7, 9, 10],
    pakad: [
      [0, 2, 3, 5, 7],
      [7, 5, 3, 2, 0],
      [10, 9, 7, 5, 3, 2, 0],
      [3, 5, 7, 9, 7, 5],
    ],
    rest: [0, 7, 3],
  },
  /** Heroic and bright. */
  durga: {
    name: 'Durga',
    scale: [0, 2, 5, 7, 9],
    pakad: [
      [0, 2, 5, 7, 9, 7, 5, 2, 0],
      [9, 12, 9, 7, 5, 2],
      [5, 7, 9, 7, 5, 2, 0],
    ],
    rest: [0, 5, 7],
  },
  /** Monsoon, longing: the sea. */
  desh: {
    name: 'Desh',
    scale: [0, 2, 5, 7, 9, 10, 11],
    pakad: [
      [2, 5, 7, 10, 9, 7],
      [10, 9, 7, 5, 2, 0],
      [0, 2, 5, 7, 5, 2],
    ],
    rest: [0, 7, 5],
  },
  /** The bright major mode of the south: festive, open. */
  shankarabharanam: {
    name: 'Shankarabharanam',
    scale: [0, 2, 4, 5, 7, 9, 11],
    pakad: [
      [0, 2, 4, 5, 7],
      [7, 9, 11, 12, 11, 9, 7],
      [12, 11, 9, 7, 5, 4, 2, 0],
    ],
    rest: [0, 7, 4],
  },
  /** Courtly, aching: every note soft. */
  bhairavi: {
    name: 'Bhairavi',
    scale: [0, 1, 3, 5, 7, 8, 10],
    pakad: [
      [0, 1, 3, 5, 3, 1, 0],
      [7, 8, 7, 5, 3],
      [10, 8, 7, 5, 3, 1, 0],
    ],
    rest: [0, 5, 7],
  },
  /** For Sumer: a Hijaz-like maqam, with its characteristic augmented second. */
  hijaz: {
    name: 'Hijaz',
    scale: [0, 1, 4, 5, 7, 8, 10],
    pakad: [
      [0, 1, 4, 1, 0],
      [4, 5, 4, 1, 0],
      [7, 8, 7, 5, 4],
      [10, 8, 7, 5, 4, 1, 0],
    ],
    rest: [0, 7, 4],
  },
};

export type RagaName = keyof typeof RAGA_BOOK;

// ------------------------------------------------------------------ taal

export type Bol = 'dha' | 'dhin' | 'na' | 'tin' | 'ta' | 'ge' | 'ke' | 'ti' | 'dhi' | 'tu' | 'ka' | 'mi' | 'ju' | 'dim' | 'rest';

export interface Taal {
  name: string;
  /** One bol per matra (beat). Sam, the first beat, is where the cycle lands. */
  bols: Bol[];
  /** Beats that open each vibhag (section), for phrasing. */
  vibhag: number[];
}

export const TAALS: Record<string, Taal> = {
  keherwa: { name: 'Keherwa', bols: ['dha', 'ge', 'na', 'ti', 'na', 'ka', 'dhi', 'na'], vibhag: [0, 4] },
  dadra: { name: 'Dadra', bols: ['dha', 'dhi', 'na', 'dha', 'tu', 'na'], vibhag: [0, 3] },
  teental: {
    name: 'Teental',
    bols: ['dha', 'dhin', 'dhin', 'dha', 'dha', 'dhin', 'dhin', 'dha', 'dha', 'tin', 'tin', 'ta', 'ta', 'dhin', 'dhin', 'dha'],
    vibhag: [0, 4, 8, 12],
  },
  rupak: { name: 'Rupak', bols: ['tin', 'tin', 'na', 'dhi', 'na', 'dhi', 'na'], vibhag: [0, 3, 5] },
  ektaal: {
    name: 'Ektaal',
    bols: ['dhin', 'dhin', 'dha', 'ge', 'ti', 'na', 'ka', 'ta', 'dha', 'ge', 'dhi', 'na'],
    vibhag: [0, 2, 4, 6, 8, 10],
  },
  /** The Carnatic eight-beat adi talam, as a mridangam would speak it. */
  adi: { name: 'Adi talam', bols: ['ta', 'ka', 'dhi', 'mi', 'ta', 'ka', 'ju', 'na'], vibhag: [0, 4] },
  /** A galloping six, for Maratha dhol. */
  dholi: { name: 'Dhol', bols: ['dha', 'ge', 'dim', 'dha', 'ge', 'dim'], vibhag: [0, 3] },
};

/** A pulse for regions that want a heartbeat rather than a rhythm. */
TAALS['heartbeat'] = { name: 'Heartbeat', bols: ['dha', 'rest', 'rest', 'rest', 'dhin', 'rest', 'rest', 'rest'], vibhag: [0, 4] };
