/**
 * Aksharas: letters hidden around the island.
 *
 * Three in each region, each one a sign from a script that was written there (or, for the epic chapters, a
 * script the story was later carried in). Finding one adds it to the Varnamala page of the Gatha with a short
 * note about the script. Like every claim in the game, each note carries its kind of evidence.
 *
 * A glyph is either `text`, drawn with the device's own fonts (Devanagari, Tamil, Kannada, Persian and the
 * like are on every current phone and laptop), or `strokes`, drawn line by line for scripts no ordinary device
 * has a font for (Indus signs, cuneiform, Ashokan Brahmi). Stroke coordinates sit in a 0..1 box, y downwards.
 */

import type { SourceType } from './types';

export type Point = readonly [number, number];

export interface StrokeGlyph {
  /** Open polylines. */
  lines?: ReadonlyArray<ReadonlyArray<Point>>;
  /** Closed polylines, filled. */
  fills?: ReadonlyArray<ReadonlyArray<Point>>;
  /** Circles: centre x, centre y, radius. Stroked, not filled. */
  rings?: ReadonlyArray<readonly [number, number, number]>;
  /** Dots: centre x, centre y, radius. Filled. */
  dots?: ReadonlyArray<readonly [number, number, number]>;
  /** Cuneiform wedges: from the head (x1, y1) to the tip (x2, y2). */
  wedges?: ReadonlyArray<readonly [number, number, number, number]>;
}

export interface Akshara {
  id: string;
  zoneId: string;
  /** The letter as text, or how to draw it. */
  glyph: { text: string } | { strokes: StrokeGlyph };
  /** How it is said, or what it is called. */
  sound: string;
  script: string;
  /** One or two sentences: what this sign tells us. */
  note: string;
  source: SourceType;
  /** Which landmark it hides near (an index into the zone's landmarks) and roughly where around it. */
  near: number;
  angle: number;
  distance: number;
}

// Indus signs. Undeciphered: the names are descriptions of the shape, not readings.
const FISH: StrokeGlyph = {
  lines: [
    [[0.18, 0.5], [0.32, 0.36], [0.5, 0.3], [0.66, 0.36], [0.78, 0.5], [0.66, 0.64], [0.5, 0.7], [0.32, 0.64], [0.18, 0.5]],
    [[0.78, 0.5], [0.9, 0.36]],
    [[0.78, 0.5], [0.9, 0.64]],
  ],
  dots: [[0.32, 0.47, 0.025]],
};
const JAR: StrokeGlyph = {
  lines: [
    [[0.3, 0.22], [0.36, 0.3], [0.36, 0.62], [0.42, 0.76], [0.58, 0.76], [0.64, 0.62], [0.64, 0.3], [0.7, 0.22]],
    [[0.36, 0.38], [0.64, 0.38]],
  ],
};
const STROKES: StrokeGlyph = {
  lines: [
    [[0.32, 0.26], [0.32, 0.74]],
    [[0.5, 0.26], [0.5, 0.74]],
    [[0.68, 0.26], [0.68, 0.74]],
  ],
};

// Cuneiform: wedges pressed with a reed.
const DINGIR: StrokeGlyph = {
  wedges: [
    [0.16, 0.5, 0.86, 0.5],
    [0.5, 0.14, 0.5, 0.86],
    [0.24, 0.24, 0.76, 0.76],
    [0.24, 0.76, 0.76, 0.24],
  ],
};
const DISH: StrokeGlyph = { wedges: [[0.5, 0.16, 0.5, 0.84]] };
const WINKELHAKEN: StrokeGlyph = {
  fills: [[[0.28, 0.5], [0.72, 0.24], [0.6, 0.5], [0.72, 0.76]]],
};

// Ashokan Brahmi.
const BRAHMI_KA: StrokeGlyph = {
  lines: [
    [[0.5, 0.18], [0.5, 0.82]],
    [[0.22, 0.48], [0.78, 0.48]],
  ],
};
const BRAHMI_GA: StrokeGlyph = { lines: [[[0.24, 0.8], [0.5, 0.2], [0.76, 0.8]]] };
const BRAHMI_THA: StrokeGlyph = { rings: [[0.5, 0.5, 0.3]], dots: [[0.5, 0.5, 0.045]] };

export const AKSHARAS: readonly Akshara[] = [
  // ------------------------------------------------------------ Sindhu-Sarasvati
  {
    id: 'ak-indus-fish', zoneId: 'sindhu', glyph: { strokes: FISH }, sound: '"fish" sign', script: 'Indus signs',
    note: 'One of the commonest Indus signs. Nobody knows what it meant: "fish" only describes its shape. Some scholars propose readings, but none has been confirmed.',
    source: 'debate', near: 1, angle: 2.3, distance: 22,
  },
  {
    id: 'ak-indus-jar', zoneId: 'sindhu', glyph: { strokes: JAR }, sound: '"jar" sign', script: 'Indus signs',
    note: 'The most frequent sign in the whole Indus corpus, often at the end of an inscription. Its position helps show the script ran from right to left.',
    source: 'archaeology', near: 2, angle: 4.1, distance: 20,
  },
  {
    id: 'ak-indus-strokes', zoneId: 'sindhu', glyph: { strokes: STROKES }, sound: 'stroke signs', script: 'Indus signs',
    note: 'Groups of short upright strokes. Many scholars think they are numbers, which would make them the one part of the script we can half-read.',
    source: 'debate', near: 3, angle: 0.8, distance: 18,
  },
  // ------------------------------------------------------------ Sumer & Dilmun
  {
    id: 'ak-cun-dingir', zoneId: 'meluhha', glyph: { strokes: DINGIR }, sound: 'AN / DINGIR', script: 'Cuneiform',
    note: 'A star of wedges. Read as AN it means "sky"; as DINGIR it means "god", and scribes wrote it silently before a god\'s name as a label.',
    source: 'text', near: 0, angle: 3.6, distance: 26,
  },
  {
    id: 'ak-cun-dish', zoneId: 'meluhha', glyph: { strokes: DISH }, sound: 'DIŠ, "one"', script: 'Cuneiform',
    note: 'A single upright wedge: the number one. Scribes also put it before men\'s names, the way we might write "Mr".',
    source: 'text', near: 1, angle: 1.2, distance: 18,
  },
  {
    id: 'ak-cun-ten', zoneId: 'meluhha', glyph: { strokes: WINKELHAKEN }, sound: 'U, "ten"', script: 'Cuneiform',
    note: 'The corner wedge stands for ten. Ones and tens were enough to write any number in base sixty, which is why an hour still has sixty minutes.',
    source: 'text', near: 3, angle: 5.0, distance: 20,
  },
  // ------------------------------------------------------------ Kosala & Dandaka
  {
    id: 'ak-deva-a', zoneId: 'kosala', glyph: { text: 'अ' }, sound: 'a', script: 'Devanagari',
    note: 'The first letter of the varnamala. The Ramayana was recited long before it was written; the manuscripts we have are copies made in many scripts, most of them within the last thousand years.',
    source: 'text', near: 0, angle: 2.0, distance: 30,
  },
  {
    id: 'ak-tamil-ka-kamban', zoneId: 'kosala', glyph: { text: 'க' }, sound: 'ka', script: 'Tamil',
    note: 'Kamban\'s Ramavataram retold the story in Tamil around the twelfth century. Every telling has its own voice, and none of them is a copy of another.',
    source: 'text', near: 3, angle: 4.4, distance: 18,
  },
  {
    id: 'ak-thai-ro', zoneId: 'kosala', glyph: { text: 'ร' }, sound: 'ro', script: 'Thai',
    note: 'The first letter of "Ramakien", the Thai telling of the Ramayana. The story travelled with traders and monks across the Bay of Bengal.',
    source: 'text', near: 5, angle: 0.9, distance: 16,
  },
  // ------------------------------------------------------------ The Setu & Lanka
  {
    id: 'ak-deva-sa', zoneId: 'setu-lanka', glyph: { text: 'स' }, sound: 'sa', script: 'Devanagari',
    note: '"Setu" means a bridge or causeway. Whether the shoals were built or grew is a question for geology; what the story means is a question for the tradition.',
    source: 'epic', near: 0, angle: 3.0, distance: 22,
  },
  {
    id: 'ak-sinhala-la', zoneId: 'setu-lanka', glyph: { text: 'ල' }, sound: 'la', script: 'Sinhala',
    note: 'The first letter of "Lanka" in Sinhala. Sinhala is one of the many scripts descended from Brahmi.',
    source: 'archaeology', near: 1, angle: 1.4, distance: 24,
  },
  {
    id: 'ak-tamil-i', zoneId: 'setu-lanka', glyph: { text: 'இ' }, sound: 'i', script: 'Tamil',
    note: 'The first letter of "Ilankai", the island\'s name in Tamil. Two languages, two names, one island.',
    source: 'text', near: 3, angle: 5.2, distance: 18,
  },
  // ------------------------------------------------------------ Kurukshetra
  {
    id: 'ak-deva-dha', zoneId: 'kurukshetra', glyph: { text: 'ध' }, sound: 'dha', script: 'Devanagari',
    note: 'The Bhagavad Gita begins "dharmakshetre kurukshetre": on the field of dharma, the field of the Kurus. Its first sound is this one.',
    source: 'text', near: 3, angle: 2.6, distance: 20,
  },
  {
    id: 'ak-deva-ka', zoneId: 'kurukshetra', glyph: { text: 'क' }, sound: 'ka', script: 'Devanagari',
    note: 'Ka, for Kuru. In Ashokan Brahmi this letter was a plain cross; two thousand years of writing with pens and brushes turned it into क.',
    source: 'archaeology', near: 0, angle: 0.5, distance: 26,
  },
  {
    id: 'ak-deva-danda', zoneId: 'kurukshetra', glyph: { text: '॥' }, sound: 'double danda', script: 'Devanagari',
    note: 'Two upright strokes close a verse. The Mahabharata has around a hundred thousand of them.',
    source: 'text', near: 5, angle: 4.0, distance: 16,
  },
  // ------------------------------------------------------------ Magadha
  {
    id: 'ak-brahmi-ka', zoneId: 'magadha', glyph: { strokes: BRAHMI_KA }, sound: 'ka', script: 'Brahmi',
    note: 'In Ashoka\'s Brahmi, ka is a simple cross. James Prinsep worked out the script in the 1830s with the help of coins that named the same king in Greek and Brahmi.',
    source: 'archaeology', near: 1, angle: 2.2, distance: 20,
  },
  {
    id: 'ak-brahmi-ga', zoneId: 'magadha', glyph: { strokes: BRAHMI_GA }, sound: 'ga', script: 'Brahmi',
    note: 'An arch: ga. Devanagari, Tamil, Bengali, Sinhala, Thai and Khmer all grew from Brahmi, so this little arch has hundreds of millions of descendants.',
    source: 'archaeology', near: 0, angle: 4.8, distance: 24,
  },
  {
    id: 'ak-brahmi-tha', zoneId: 'magadha', glyph: { strokes: BRAHMI_THA }, sound: 'tha', script: 'Brahmi',
    note: 'A circle with a dot in the middle is tha. Each consonant carries a built-in "a", and small marks change the vowel: that makes Brahmi an abugida.',
    source: 'archaeology', near: 2, angle: 1.0, distance: 22,
  },
  // ------------------------------------------------------------ The Chola Country
  {
    id: 'ak-tamil-zha', zoneId: 'chola', glyph: { text: 'ழ' }, sound: 'zha', script: 'Tamil',
    note: 'A sound found in Tamil and Malayalam: the "zh" in "Tamizh". English has no letter for it, which is why it is usually spelt with an l.',
    source: 'text', near: 0, angle: 3.3, distance: 34,
  },
  {
    id: 'ak-tamil-ma', zoneId: 'chola', glyph: { text: 'ம' }, sound: 'ma', script: 'Tamil',
    note: 'Chola inscriptions run around temple walls in Tamil, recording gifts, wages and land. They are one of the richest written records of any medieval Indian state.',
    source: 'archaeology', near: 4, angle: 0.4, distance: 18,
  },
  {
    id: 'ak-tamil-one', zoneId: 'chola', glyph: { text: '௧' }, sound: 'Tamil numeral one', script: 'Tamil numerals',
    note: 'Tamil had its own numerals. Temple accounts were written in them, down to the measures of rice and ghee paid to each worker.',
    source: 'archaeology', near: 6, angle: 2.0, distance: 16,
  },
  // ------------------------------------------------------------ Konark & the Observatory
  {
    id: 'ak-odia-o', zoneId: 'konark', glyph: { text: 'ଓ' }, sound: 'o', script: 'Odia',
    note: 'Odia letters are round-topped. It is often said this comes from writing with a stylus on palm leaves, where a long straight line would split the leaf.',
    source: 'debate', near: 0, angle: 2.5, distance: 30,
  },
  {
    id: 'ak-deva-zero', zoneId: 'konark', glyph: { text: '०' }, sound: 'shunya, zero', script: 'Devanagari numerals',
    note: 'In 628 CE Brahmagupta set out rules for calculating with zero as a number in its own right, not just a gap in a column.',
    source: 'text', near: 1, angle: 5.0, distance: 22,
  },
  {
    id: 'ak-deva-aa', zoneId: 'konark', glyph: { text: 'आ' }, sound: 'aa', script: 'Devanagari',
    note: 'Aa, for "asanna": approximate. Aryabhata used that word for his value of pi, about 3.1416, and so was honest that it was not exact.',
    source: 'text', near: 3, angle: 0.7, distance: 18,
  },
  // ------------------------------------------------------------ Vijayanagara
  {
    id: 'ak-kannada-ka', zoneId: 'hampi', glyph: { text: 'ಕ' }, sound: 'ka', script: 'Kannada',
    note: 'Many Vijayanagara inscriptions are in Kannada, alongside Telugu and Sanskrit. A capital this large needed to be read in several languages.',
    source: 'archaeology', near: 1, angle: 3.9, distance: 24,
  },
  {
    id: 'ak-telugu-ta', zoneId: 'hampi', glyph: { text: 'త' }, sound: 'ta', script: 'Telugu',
    note: 'Krishnadevaraya, the empire\'s best-remembered king, wrote a long poem, the Amuktamalyada, in Telugu.',
    source: 'text', near: 3, angle: 1.1, distance: 20,
  },
  {
    id: 'ak-kannada-ha', zoneId: 'hampi', glyph: { text: 'ಹ' }, sound: 'ha', script: 'Kannada',
    note: 'Ha, for Hampi. The name is usually linked to Pampa, an old name of the Tungabhadra river that runs past the ruins.',
    source: 'debate', near: 6, angle: 4.6, distance: 18,
  },
  // ------------------------------------------------------------ Agra & Sikri
  {
    id: 'ak-persian-be', zoneId: 'agra', glyph: { text: 'ب' }, sound: 'be', script: 'Arabic script (thuluth)',
    note: 'The Quranic verses around the Taj\'s arches are in a large flowing hand called thuluth, laid out by the calligrapher Amanat Khan.',
    source: 'archaeology', near: 0, angle: 2.8, distance: 40,
  },
  {
    id: 'ak-persian-kaf', zoneId: 'agra', glyph: { text: 'ک' }, sound: 'kaf', script: 'Persian (nastaliq)',
    note: 'Persian was the language of the Mughal court and its paperwork. Nastaliq, the hanging script, was its everyday elegant hand.',
    source: 'text', near: 3, angle: 5.3, distance: 24,
  },
  {
    id: 'ak-persian-re', zoneId: 'agra', glyph: { text: 'ر' }, sound: 're', script: 'Persian (nastaliq)',
    note: 'Re, for Razmnama, "the book of war": the Mahabharata translated into Persian at Akbar\'s court and illustrated by its painters.',
    source: 'text', near: 5, angle: 1.6, distance: 18,
  },
  // ------------------------------------------------------------ The Hill Forts
  {
    id: 'ak-deva-lla', zoneId: 'maratha', glyph: { text: 'ळ' }, sound: 'ḷa', script: 'Devanagari (Marathi)',
    note: 'A letter Marathi uses that standard Hindi does not. One script can carry many languages, each picking the letters it needs.',
    source: 'text', near: 0, angle: 3.5, distance: 34,
  },
  {
    id: 'ak-deva-ga-gad', zoneId: 'maratha', glyph: { text: 'ग' }, sound: 'ga', script: 'Devanagari (Marathi)',
    note: 'Ga, for gad: a fort. Hence Raigad, Sinhagad, Pratapgad. The ridges of the Sahyadri are named by what was built on them.',
    source: 'text', near: 3, angle: 1.0, distance: 18,
  },
  {
    id: 'ak-deva-ma-modi', zoneId: 'maratha', glyph: { text: 'म' }, sound: 'ma', script: 'Devanagari (Marathi)',
    note: 'Maratha records were kept in Marathi. Clerks wrote day to day in Modi, a fast running script made for pens, and the archives still hold great bundles of such pages.',
    source: 'text', near: 5, angle: 4.9, distance: 18,
  },
];

export function aksharasIn(zoneId: string): Akshara[] {
  return AKSHARAS.filter((a) => a.zoneId === zoneId);
}
