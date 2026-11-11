/**
 * The title screen's skyline: one silhouette for each era of the island, drawn
 * as SVG so it costs nothing to load and scales to any screen.
 *
 * Three depths — a pale far range, a mid layer, and a near layer that is almost
 * black — give the parallax its depth, and a low mist drifts across the lot. The
 * monuments run roughly in the order of the chapters from left to right, so the
 * horizon reads as a timeline: a ziggurat and a Harappan citadel at one end, a
 * hill fort at the other.
 */

const NS = 'http://www.w3.org/2000/svg';

type Draw = (x: number, base: number, s: number) => string;

const rect = (x: number, y: number, w: number, h: number): string => `M${x} ${y}h${w}v${h}h${-w}z`;
const poly = (...p: Array<[number, number]>): string => `M${p.map(([x, y]) => `${x} ${y}`).join('L')}z`;
const dome = (cx: number, base: number, r: number, squash = 1): string =>
  `M${cx - r} ${base}A${r} ${r * squash} 0 0 1 ${cx + r} ${base}z`;

/** Each returns an SVG path "d" for one monument standing on `base`, scaled by `s`, centred at `x`. */
const MONUMENTS: Record<string, Draw> = {
  /** Indus citadel: stacked mud-brick blocks with a long low bath. */
  citadel: (x, b, s) =>
    rect(x - 90 * s, b - 38 * s, 180 * s, 38 * s) +
    rect(x - 60 * s, b - 74 * s, 70 * s, 36 * s) +
    rect(x + 20 * s, b - 58 * s, 46 * s, 20 * s) +
    rect(x - 40 * s, b - 90 * s, 22 * s, 16 * s),

  /** Ziggurat: three receding terraces, a shrine on top. */
  ziggurat: (x, b, s) =>
    poly([x - 110 * s, b], [x - 86 * s, b - 36 * s], [x + 86 * s, b - 36 * s], [x + 110 * s, b]) +
    poly([x - 76 * s, b - 36 * s], [x - 58 * s, b - 70 * s], [x + 58 * s, b - 70 * s], [x + 76 * s, b - 36 * s]) +
    poly([x - 44 * s, b - 70 * s], [x - 32 * s, b - 100 * s], [x + 32 * s, b - 100 * s], [x + 44 * s, b - 70 * s]) +
    rect(x - 14 * s, b - 124 * s, 28 * s, 24 * s),

  /** A dhow: curved hull and a lateen sail. */
  dhow: (x, b, s) =>
    `M${x - 70 * s} ${b - 20 * s}Q${x} ${b + 8 * s} ${x + 76 * s} ${b - 26 * s}L${x + 60 * s} ${b - 8 * s}Q${x} ${b + 18 * s} ${x - 56 * s} ${b - 6 * s}z` +
    poly([x - 4 * s, b - 24 * s], [x - 8 * s, b - 120 * s], [x + 56 * s, b - 32 * s]) +
    rect(x - 7 * s, b - 126 * s, 4 * s, 102 * s),

  /** A Nagara temple: a curving shikhara over a porch. */
  shikhara: (x, b, s) =>
    `M${x - 44 * s} ${b}C${x - 46 * s} ${b - 70 * s} ${x - 24 * s} ${b - 130 * s} ${x} ${b - 160 * s}C${x + 24 * s} ${b - 130 * s} ${x + 46 * s} ${b - 70 * s} ${x + 44 * s} ${b}z` +
    rect(x - 70 * s, b - 24 * s, 140 * s, 24 * s) +
    `M${x - 8 * s} ${b - 160 * s}h16v-12h-16z`,

  /** Ashokan pillar with its four lions. */
  pillar: (x, b, s) =>
    rect(x - 6 * s, b - 150 * s, 12 * s, 150 * s) +
    rect(x - 22 * s, b - 160 * s, 44 * s, 10 * s) +
    dome(x - 14 * s, b - 160 * s, 9 * s) +
    dome(x + 14 * s, b - 160 * s, 9 * s) +
    dome(x, b - 160 * s, 10 * s) +
    rect(x - 16 * s, b - 8 * s, 32 * s, 8 * s),

  /** A great stupa: hemisphere, harmika, mast and parasols, with a railing. */
  stupa: (x, b, s) =>
    rect(x - 100 * s, b - 14 * s, 200 * s, 14 * s) +
    dome(x, b - 14 * s, 82 * s, 0.92) +
    rect(x - 16 * s, b - 106 * s, 32 * s, 14 * s) +
    rect(x - 2 * s, b - 150 * s, 4 * s, 44 * s) +
    rect(x - 20 * s, b - 134 * s, 40 * s, 3 * s) +
    rect(x - 13 * s, b - 144 * s, 26 * s, 3 * s) +
    rect(x - 130 * s, b - 52 * s, 8 * s, 52 * s) +
    rect(x + 122 * s, b - 52 * s, 8 * s, 52 * s) +
    rect(x - 134 * s, b - 58 * s, 70 * s, 8 * s),

  /** A Dravida vimana: seven receding storeys and a kalasha. */
  gopuram: (x, b, s) => {
    let d = rect(x - 66 * s, b - 20 * s, 132 * s, 20 * s);
    for (let i = 0; i < 7; i++) {
      const w = (56 - i * 6.5) * s;
      d += rect(x - w, b - (20 + 20 * (i + 1)) * s, w * 2, 19 * s);
    }
    d += dome(x, b - 160 * s, 14 * s) + rect(x - 2 * s, b - 186 * s, 4 * s, 16 * s);
    return d;
  },

  /** Konark: a chariot wheel (ring and spokes are cut out by drawing it as a stroke elsewhere) on a plinth. */
  konark: (x, b, s) =>
    rect(x - 100 * s, b - 20 * s, 200 * s, 20 * s) +
    `M${x - 74 * s} ${b - 20 * s}h148v-26h-148z` +
    `M${x - 52 * s} ${b - 46 * s}h104v-46h-104z` +
    `M${x - 34 * s} ${b - 92 * s}h68v-62h-68z` +
    `M${x - 16 * s} ${b - 154 * s}h32v-28h-32z`,

  /** Hampi: heaped granite boulders and a pillared mandapa. */
  hampi: (x, b, s) =>
    `M${x - 130 * s} ${b}Q${x - 118 * s} ${b - 60 * s} ${x - 70 * s} ${b - 44 * s}Q${x - 40 * s} ${b - 76 * s} ${x - 6 * s} ${b - 36 * s}L${x - 6 * s} ${b}z` +
    `M${x + 4 * s} ${b}Q${x + 20 * s} ${b - 58 * s} ${x + 62 * s} ${b - 40 * s}Q${x + 100 * s} ${b - 66 * s} ${x + 128 * s} ${b}z` +
    rect(x - 40 * s, b - 82 * s, 80 * s, 6 * s) +
    [-34, -14, 6, 26].map((dx) => rect(x + dx * s, b - 76 * s, 5 * s, 40 * s)).join(''),

  /** The Taj: a double-domed tomb, four minarets, a high plinth. */
  taj: (x, b, s) =>
    rect(x - 120 * s, b - 14 * s, 240 * s, 14 * s) +
    rect(x - 56 * s, b - 76 * s, 112 * s, 62 * s) +
    `M${x - 36 * s} ${b - 76 * s}C${x - 52 * s} ${b - 116 * s} ${x - 14 * s} ${b - 138 * s} ${x} ${b - 168 * s}C${x + 14 * s} ${b - 138 * s} ${x + 52 * s} ${b - 116 * s} ${x + 36 * s} ${b - 76 * s}z` +
    rect(x - 2 * s, b - 186 * s, 4 * s, 20 * s) +
    [-104, 96].map((dx) => rect(x + dx * s, b - 112 * s, 8 * s, 98 * s) + dome(x + (dx + 4) * s, b - 112 * s, 8 * s)).join('') +
    dome(x - 66 * s, b - 76 * s, 13 * s) +
    dome(x + 66 * s, b - 76 * s, 13 * s),

  /** A hill fort: a rock mound with curtain walls, bastions and a tower. */
  fort: (x, b, s) => {
    let d = poly([x - 150 * s, b], [x - 96 * s, b - 66 * s], [x + 100 * s, b - 66 * s], [x + 150 * s, b]);
    d += rect(x - 96 * s, b - 98 * s, 196 * s, 32 * s);
    for (let i = 0; i < 12; i++) d += rect(x - 96 * s + i * 17.5 * s, b - 108 * s, 9 * s, 10 * s);
    d += rect(x - 30 * s, b - 150 * s, 60 * s, 52 * s) + poly([x - 36 * s, b - 150 * s], [x, b - 176 * s], [x + 36 * s, b - 150 * s]);
    d += rect(x - 112 * s, b - 118 * s, 26 * s, 50 * s) + rect(x + 90 * s, b - 118 * s, 26 * s, 50 * s);
    return d;
  },

  palm: (x, b, s) =>
    rect(x - 2 * s, b - 90 * s, 4 * s, 90 * s) +
    `M${x} ${b - 90 * s}Q${x - 34 * s} ${b - 112 * s} ${x - 52 * s} ${b - 84 * s}Q${x - 24 * s} ${b - 104 * s} ${x} ${b - 90 * s}z` +
    `M${x} ${b - 90 * s}Q${x + 34 * s} ${b - 112 * s} ${x + 52 * s} ${b - 84 * s}Q${x + 24 * s} ${b - 104 * s} ${x} ${b - 90 * s}z` +
    `M${x} ${b - 90 * s}Q${x - 8 * s} ${b - 128 * s} ${x - 30 * s} ${b - 126 * s}Q${x - 6 * s} ${b - 118 * s} ${x} ${b - 90 * s}z` +
    `M${x} ${b - 90 * s}Q${x + 8 * s} ${b - 128 * s} ${x + 30 * s} ${b - 126 * s}Q${x + 6 * s} ${b - 118 * s} ${x} ${b - 90 * s}z`,
};

interface Placement {
  kind: keyof typeof MONUMENTS;
  x: number;
  scale: number;
}

const FAR: Placement[] = [
  { kind: 'fort', x: 90, scale: 0.7 },
  { kind: 'gopuram', x: 330, scale: 0.8 },
  { kind: 'taj', x: 620, scale: 0.7 },
  { kind: 'stupa', x: 900, scale: 0.7 },
  { kind: 'shikhara', x: 1160, scale: 0.8 },
  { kind: 'citadel', x: 1430, scale: 0.8 },
];

const MID: Placement[] = [
  { kind: 'citadel', x: 120, scale: 0.95 },
  { kind: 'ziggurat', x: 330, scale: 0.9 },
  { kind: 'shikhara', x: 560, scale: 0.9 },
  { kind: 'pillar', x: 730, scale: 0.9 },
  { kind: 'stupa', x: 950, scale: 0.8 },
  { kind: 'gopuram', x: 1150, scale: 0.9 },
  { kind: 'taj', x: 1370, scale: 0.8 },
];

const NEAR: Placement[] = [
  { kind: 'palm', x: 40, scale: 1.5 },
  { kind: 'dhow', x: 250, scale: 1.1 },
  { kind: 'palm', x: 430, scale: 1.2 },
  { kind: 'hampi', x: 640, scale: 1 },
  { kind: 'palm', x: 820, scale: 1.4 },
  { kind: 'konark', x: 1010, scale: 1 },
  { kind: 'palm', x: 1210, scale: 1.3 },
  { kind: 'fort', x: 1440, scale: 1.05 },
  { kind: 'palm', x: 1580, scale: 1.5 },
];

function layer(placements: readonly Placement[], base: number, fill: string, cls: string): SVGGElement {
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('class', cls);
  g.setAttribute('fill', fill);
  const path = document.createElementNS(NS, 'path');
  path.setAttribute('d', placements.map((p) => (MONUMENTS[p.kind] as Draw)(p.x, base, p.scale)).join(''));
  g.appendChild(path);
  return g;
}

/** The whole skyline as a single SVG, ready to be placed behind the title. */
export function buildSkyline(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 1600 420');
  svg.setAttribute('preserveAspectRatio', 'xMidYMax slice');
  svg.setAttribute('class', 'skyline');
  svg.setAttribute('aria-hidden', 'true');

  const defs = document.createElementNS(NS, 'defs');
  defs.innerHTML = `
    <linearGradient id="sky-far" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#6a4a86" stop-opacity="0.0"/>
      <stop offset="1" stop-color="#7a58a0" stop-opacity="0.8"/>
    </linearGradient>
    <linearGradient id="sky-near" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#120d1c"/>
      <stop offset="1" stop-color="#07050b"/>
    </linearGradient>`;
  svg.appendChild(defs);

  svg.appendChild(layer(FAR, 360, 'url(#sky-far)', 'sk-far'));
  svg.appendChild(layer(MID, 392, '#35244d', 'sk-mid'));
  // The near range stands on a rolling ground.
  const near = layer(NEAR, 420, 'url(#sky-near)', 'sk-near');
  const ground = document.createElementNS(NS, 'path');
  ground.setAttribute('d', 'M0 420V392Q220 374 440 396T880 388T1320 398T1600 384V420z');
  ground.setAttribute('fill', 'url(#sky-near)');
  near.appendChild(ground);
  svg.appendChild(near);

  // A few lit windows and lamps in the mid layer, so the dusk feels inhabited.
  const lamps = document.createElementNS(NS, 'g');
  lamps.setAttribute('class', 'sk-lamps');
  for (const [x, y] of [[560, 372], [947, 375], [1150, 384], [333, 368], [124, 360]] as const) {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', String(x));
    c.setAttribute('cy', String(y));
    c.setAttribute('r', '2.4');
    lamps.appendChild(c);
  }
  svg.appendChild(lamps);
  return svg;
}
