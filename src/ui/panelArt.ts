import type { Zone } from '../content/types';
import type { Motif, Panel } from '../content/story';

/**
 * Painted panels.
 *
 * Each panel of the Gatha is drawn at runtime onto a canvas, in the flat, boldly
 * outlined style of the phad and pat storytelling scrolls the game borrows its
 * frame from. Colours come from the region's own palette so a panel looks like
 * the place it belongs to. An unrestored panel is drawn the same way and then
 * veiled in grey, which is what the Dhundh does to it.
 */

export const PANEL_W = 480;
export const PANEL_H = 320;

const THREAD_COLOUR: Record<Motif, string> = {
  water: '#3b8fd1',
  writing: '#e8b44b',
  measure: '#d4503c',
};

const css = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

/** Lighten or darken a #rrggbb colour. */
function tone(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number): number => Math.max(0, Math.min(255, Math.round(v * k)));
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

export interface PanelDrawOptions {
  /** Restored panels are crisp; the rest sit under the Dhundh. */
  restored: boolean;
  /** Threads this panel has earned. Drawn as braided cords along the lower border. */
  lit?: readonly Motif[];
  /** 0 = clear, 1 = fully clouded. Defaults to clouded unless restored. Used to animate the lifting. */
  haze?: number;
  /** How much of each thread has been drawn, 0–1. */
  threadProgress?: number;
  /** Seconds, to drift the haze. */
  time?: number;
}

export function drawPanel(canvas: HTMLCanvasElement, panel: Panel, zone: Zone, opts: PanelDrawOptions): void {
  canvas.width = PANEL_W;
  canvas.height = PANEL_H;
  const g = canvas.getContext('2d');
  if (!g) return;

  const p = zone.palette;
  const horizon = css(p.horizon);
  const zenith = css(p.zenith);
  const ground = css(p.ground);
  const stone = css(p.stone);
  const rock = css(p.rock);

  // Sky and ground.
  const sky = g.createLinearGradient(0, 0, 0, PANEL_H * 0.66);
  sky.addColorStop(0, zenith);
  sky.addColorStop(1, horizon);
  g.fillStyle = sky;
  g.fillRect(0, 0, PANEL_W, PANEL_H);
  g.fillStyle = ground;
  g.fillRect(0, PANEL_H * 0.66, PANEL_W, PANEL_H * 0.34);
  g.fillStyle = tone(ground, 0.82);
  g.fillRect(0, PANEL_H * 0.66, PANEL_W, 5);

  // A low sun, placed by the zone's own sun elevation.
  const sunY = PANEL_H * 0.66 - 30 - (p.sunElevation / 90) * 130;
  g.fillStyle = css(p.sun);
  g.beginPath();
  g.arc(PANEL_W * 0.82, sunY, 22, 0, Math.PI * 2);
  g.fill();

  g.lineWidth = 3;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(30,18,10,0.85)';

  switch (panel.motif) {
    case 'seal':
      drawSeal(g);
      break;
    case 'tablet':
      drawTablet(g);
      break;
    case 'threeStyles':
      drawThreeStyles(g, zone);
      break;
    case 'causeway':
      drawCauseway(g);
      break;
    case 'field':
      drawField(g);
      break;
    case 'pillar':
      drawPillar(g, stone);
      break;
    case 'granite':
      drawGranite(g, stone, rock);
      break;
    case 'wheel':
      drawWheel(g, stone, zone);
      break;
    case 'ruin':
      drawRuin(g, stone);
      break;
    case 'tomb':
      drawTomb(g);
      break;
    case 'fort':
      drawFort(g, stone, rock);
      break;
  }

  drawGrain(g);
  drawFrame(g, opts.lit ?? [], opts.threadProgress ?? 1);
  const haze = opts.haze ?? (opts.restored ? 0 : 1);
  if (haze > 0.002) drawHaze(g, haze, opts.time ?? 0);
}

/**
 * Lift the haze off a panel over a couple of seconds, then draw its threads in
 * along the lower border. Resolves when finished. Under reduced-motion it just
 * paints the finished panel.
 */
export function revealPanel(canvas: HTMLCanvasElement, panel: Panel, zone: Zone, lit: readonly Motif[], ms = 2800): Promise<void> {
  const final = (): void => drawPanel(canvas, panel, zone, { restored: true, lit });
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    final();
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const start = performance.now();
    const ease = (t: number): number => t * t * (3 - 2 * t);
    const frame = (now: number): void => {
      if (!canvas.isConnected) return resolve();
      const t = Math.min(1, (now - start) / ms);
      drawPanel(canvas, panel, zone, {
        restored: true,
        lit,
        haze: 1 - ease(Math.min(1, t / 0.65)),
        threadProgress: ease(Math.max(0, (t - 0.45) / 0.55)),
        time: (now - start) / 1000,
      });
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

/** A fixed, deterministic paper grain, so the painted panels read as pigment on cloth rather than vector fills. */
function drawGrain(g: CanvasRenderingContext2D): void {
  let seed = 1337;
  const rnd = (): number => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  g.save();
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = rnd() > 0.5 ? 'rgba(255,248,230,0.07)' : 'rgba(40,24,10,0.07)';
    g.fillRect(rnd() * PANEL_W, rnd() * PANEL_H, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  // Soft vignette: the edges of an old scroll are always a little darker.
  const v = g.createRadialGradient(PANEL_W / 2, PANEL_H / 2, PANEL_H * 0.35, PANEL_W / 2, PANEL_H / 2, PANEL_W * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(30,14,4,0.38)');
  g.fillStyle = v;
  g.fillRect(0, 0, PANEL_W, PANEL_H);
  g.restore();
}

// ------------------------------------------------------------------- frame

function drawFrame(g: CanvasRenderingContext2D, lit: readonly Motif[], progress: number): void {
  g.lineWidth = 10;
  g.strokeStyle = '#6b2a1c';
  g.strokeRect(5, 5, PANEL_W - 10, PANEL_H - 10);
  g.lineWidth = 3;
  g.strokeStyle = '#e8b44b';
  g.strokeRect(13, 13, PANEL_W - 26, PANEL_H - 26);

  // Corner lotuses.
  g.fillStyle = '#e8b44b';
  for (const [x, y] of [
    [13, 13],
    [PANEL_W - 13, 13],
    [13, PANEL_H - 13],
    [PANEL_W - 13, PANEL_H - 13],
  ] as const) {
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
  }

  // Threads: braided cords running along the lower border.
  lit.forEach((motif, i) => {
    g.strokeStyle = THREAD_COLOUR[motif];
    g.lineWidth = 3;
    g.beginPath();
    const y = PANEL_H - 22 + i * 4 - (lit.length - 1) * 2;
    const end = 22 + (PANEL_W - 44) * progress;
    for (let x = 22; x <= end; x += 4) {
      const wave = Math.sin(x * 0.09 + i * 2.1) * 2.2;
      if (x === 22) g.moveTo(x, y + wave);
      else g.lineTo(x, y + wave);
    }
    g.stroke();
  });
}

/** The Dhundh: grey, soft, and a little too even. */
function drawHaze(g: CanvasRenderingContext2D, amount: number, time: number): void {
  g.save();
  g.globalAlpha = Math.min(1, amount);
  g.fillStyle = 'rgba(120,124,134,0.72)';
  g.fillRect(0, 0, PANEL_W, PANEL_H);
  for (let i = 0; i < 9; i++) {
    // Each bank of haze drifts on its own slow orbit, and thins from the edges inward as it lifts.
    const x = ((i * 97) % PANEL_W) + Math.sin(time * 0.9 + i) * 26 * (1 + (1 - amount) * 3);
    const y = 40 + ((i * 61) % (PANEL_H - 80)) + Math.cos(time * 0.7 + i * 1.7) * 14;
    const r = (70 + (i % 3) * 30) * (1 + (1 - amount) * 0.6);
    const grad = g.createRadialGradient(x, y, 4, x, y, r);
    grad.addColorStop(0, 'rgba(200,203,212,0.55)');
    grad.addColorStop(1, 'rgba(200,203,212,0)');
    g.fillStyle = grad;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
  g.restore();
}

// ------------------------------------------------------------------ motifs

function outline(g: CanvasRenderingContext2D, fill: string): void {
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = 'rgba(30,18,10,0.85)';
  g.lineWidth = 3;
  g.stroke();
}

function rect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  g.beginPath();
  g.rect(x, y, w, h);
  outline(g, fill);
}

function poly(g: CanvasRenderingContext2D, pts: ReadonlyArray<readonly [number, number]>, fill: string): void {
  g.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? g.moveTo(x, y) : g.lineTo(x, y)));
  g.closePath();
  outline(g, fill);
}

function circle(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  outline(g, fill);
}

/** An Indus seal: a bull in profile, a row of signs, and a line left blank. */
function drawSeal(g: CanvasRenderingContext2D): void {
  rect(g, 120, 70, 240, 190, '#b5523a');
  // Bull.
  rect(g, 175, 135, 120, 50, '#e6c9a0');
  rect(g, 180, 185, 14, 34, '#e6c9a0');
  rect(g, 275, 185, 14, 34, '#e6c9a0');
  poly(g, [[295, 128], [335, 118], [345, 150], [300, 160]], '#e6c9a0');
  g.beginPath();
  g.moveTo(325, 120);
  g.quadraticCurveTo(345, 92, 360, 108);
  g.stroke();
  // Signs.
  g.lineWidth = 4;
  g.strokeStyle = '#3a1a10';
  for (let i = 0; i < 5; i++) {
    const x = 150 + i * 44;
    g.beginPath();
    g.moveTo(x, 88);
    g.lineTo(x, 112);
    g.moveTo(x - 8, 100);
    g.lineTo(x + 8, 100);
    g.moveTo(x - 6, 112);
    g.lineTo(x + 6, 90);
    g.stroke();
  }
  // The blank line — dashed, deliberate.
  g.setLineDash([10, 8]);
  g.strokeStyle = '#f3e7cf';
  g.beginPath();
  g.moveTo(150, 240);
  g.lineTo(330, 240);
  g.stroke();
  g.setLineDash([]);
}

function drawTablet(g: CanvasRenderingContext2D): void {
  g.save();
  g.translate(220, 170);
  g.rotate(-0.05);
  g.beginPath();
  g.roundRect(-130, -85, 260, 170, 18);
  outline(g, '#c9a672');
  g.strokeStyle = '#5a3a1e';
  g.lineWidth = 2.5;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 9; col++) {
      const x = -108 + col * 24 + ((row * 7) % 5);
      const y = -58 + row * 28;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 12, y + 3);
      g.moveTo(x + 2, y - 6);
      g.lineTo(x + 5, y + 8);
      g.stroke();
    }
  }
  g.restore();
  // The bead from the Indus, with its etched boat, overlapping the border.
  circle(g, 372, 232, 34, '#c9382a');
  g.strokeStyle = '#f6e3c4';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(352, 238);
  g.quadraticCurveTo(372, 256, 392, 238);
  g.moveTo(372, 238);
  g.lineTo(372, 210);
  g.lineTo(388, 232);
  g.stroke();
}

function drawThreeStyles(g: CanvasRenderingContext2D, zone: Zone): void {
  const palettes = [
    ['#e8c27a', '#8a3b2a', '#2f6b5a'],
    ['#6fa6cf', '#f0e1b8', '#b5523a'],
    ['#2a2a44', '#d8a24a', '#9cc2b0'],
  ];
  palettes.forEach((pal, i) => {
    const x = 34 + i * 142;
    rect(g, x, 60, 128, 190, pal[0] as string);
    // The same scene each time: a hill, a bow, a tiny figure at the edge.
    poly(g, [[x, 250], [x + 64, 150], [x + 128, 250]], pal[2] as string);
    circle(g, x + 94, 98, 14, pal[1] as string);
    g.beginPath();
    g.arc(x + 40, 205, 28, -1.2, 1.2);
    g.stroke();
    circle(g, x + 12 + i * 2, 228, 8, pal[1] as string);
  });
  void zone;
}

function drawCauseway(g: CanvasRenderingContext2D): void {
  g.fillStyle = '#2f78b5';
  g.fillRect(0, 150, PANEL_W, 110);
  g.strokeStyle = 'rgba(255,255,255,0.35)';
  g.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.moveTo(30 + i * 80, 175 + (i % 2) * 40);
    g.quadraticCurveTo(50 + i * 80, 165 + (i % 2) * 40, 72 + i * 80, 175 + (i % 2) * 40);
    g.stroke();
  }
  poly(g, [[0, 150], [95, 135], [110, 215], [0, 230]], '#c9a672');
  poly(g, [[480, 150], [385, 130], [372, 220], [480, 235]], '#b8d4a0');
  // Left half of the span: a solid bridge. Right half: a dotted shoal.
  rect(g, 100, 172, 130, 16, '#d8b27a');
  g.fillStyle = '#f3e7cf';
  for (let i = 0; i < 9; i++) {
    g.beginPath();
    g.arc(250 + i * 16, 180, 4.5, 0, Math.PI * 2);
    g.fill();
  }
}

function drawField(g: CanvasRenderingContext2D): void {
  const colour = '#c9382a';
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      for (const side of [0, 1]) {
        const x = side === 0 ? 40 + i * 28 : PANEL_W - 40 - i * 28;
        const y = 150 + row * 26;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, y - 26);
        g.stroke();
        poly(g, [[x, y - 26], [x + (side === 0 ? 14 : -14), y - 20], [x, y - 14]], colour);
        circle(g, x, y + 4, 6, '#e6c9a0');
      }
    }
  }
  // The single figure between them.
  circle(g, PANEL_W / 2, 214, 8, '#f3e7cf');
  g.beginPath();
  g.moveTo(PANEL_W / 2, 222);
  g.lineTo(PANEL_W / 2, 248);
  g.stroke();
}

function drawPillar(g: CanvasRenderingContext2D, stone: string): void {
  rect(g, 215, 70, 50, 180, stone);
  rect(g, 200, 248, 80, 14, tone(stone, 0.85));
  // Lion capital, simplified: four seated figures around an abacus.
  rect(g, 195, 52, 90, 18, tone(stone, 1.1));
  for (const dx of [-34, -12, 12, 34]) circle(g, 240 + dx, 36, 12, tone(stone, 1.05));
  // A real line of script at the base, and a single chisel mark beside it.
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 2.5;
  for (let i = 0; i < 6; i++) {
    const x = 222 + i * 7;
    g.beginPath();
    g.moveTo(x, 205);
    g.lineTo(x, 222);
    g.moveTo(x - 3, 213);
    g.lineTo(x + 3, 213);
    g.stroke();
  }
  g.strokeStyle = '#c9382a';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(276, 228);
  g.lineTo(290, 240);
  g.stroke();
}

function drawGranite(g: CanvasRenderingContext2D, stone: string, rock: string): void {
  for (let tier = 0; tier < 7; tier++) {
    const w = 190 - tier * 22;
    rect(g, 240 - w / 2, 230 - tier * 24, w, 24, tier % 2 === 0 ? stone : tone(stone, 0.9));
  }
  poly(g, [[221, 62], [259, 62], [250, 30], [230, 30]], tone(rock, 0.9));
  circle(g, 240, 24, 8, '#e8b44b');
  // The signature: tiny, in the corner, on purpose.
  g.strokeStyle = '#3a2a1a';
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(402, 262);
  g.quadraticCurveTo(410, 248, 416, 262);
  g.quadraticCurveTo(422, 252, 430, 262);
  g.stroke();
}

function drawWheel(g: CanvasRenderingContext2D, stone: string, zone: Zone): void {
  const cx = 240;
  const cy = 160;
  circle(g, cx, cy, 104, stone);
  circle(g, cx, cy, 86, tone(stone, 0.92));
  g.lineWidth = 3;
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
    g.lineTo(cx + Math.cos(a) * 86, cy + Math.sin(a) * 86);
    g.stroke();
    const m = a + Math.PI / 8;
    g.lineWidth = 1.6;
    g.beginPath();
    g.moveTo(cx + Math.cos(m) * 40, cy + Math.sin(m) * 40);
    g.lineTo(cx + Math.cos(m) * 86, cy + Math.sin(m) * 86);
    g.stroke();
    g.lineWidth = 3;
  }
  // Rim beads.
  g.fillStyle = '#f3e7cf';
  for (let i = 0; i < 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    g.beginPath();
    g.arc(cx + Math.cos(a) * 95, cy + Math.sin(a) * 95, 2.4, 0, Math.PI * 2);
    g.fill();
  }
  circle(g, cx, cy, 16, '#e8b44b');
  // The shadow: it points away from the zone's real sun azimuth and shortens as the sun climbs.
  const az = (zone.palette.sunAzimuth * Math.PI) / 180 + Math.PI;
  const len = 40 + 52 * (1 - zone.palette.sunElevation / 90);
  g.strokeStyle = 'rgba(20,12,8,0.78)';
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(cx + Math.sin(az) * len, cy - Math.cos(az) * len);
  g.stroke();
  g.lineCap = 'butt';
}

function drawRuin(g: CanvasRenderingContext2D, stone: string): void {
  // Left: the city.
  for (const [x, h] of [[40, 70], [88, 100], [136, 60], [184, 84]] as const) rect(g, x, 232 - h, 40, h, stone);
  poly(g, [[88, 132], [128, 132], [108, 104]], '#c9a672');
  // Right: the same city, broken.
  for (const [x, h] of [[296, 26], [344, 52], [392, 18], [436, 40]] as const) rect(g, x, 232 - h, 34, h, tone(stone, 0.78));
  g.fillStyle = tone(stone, 0.7);
  for (let i = 0; i < 7; i++) {
    g.beginPath();
    g.arc(290 + i * 24, 238, 5, 0, Math.PI * 2);
    g.fill();
  }
  // The canal: the one line that is the same in both halves.
  g.strokeStyle = '#3b8fd1';
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(20, 250);
  g.bezierCurveTo(160, 236, 320, 262, 460, 246);
  g.stroke();
}

function drawTomb(g: CanvasRenderingContext2D): void {
  rect(g, 180, 140, 120, 100, '#f4efe4');
  g.beginPath();
  g.ellipse(240, 140, 54, 62, 0, Math.PI, 0);
  outline(g, '#fbf7ee');
  poly(g, [[236, 70], [244, 70], [240, 52]], '#e8b44b');
  for (const x of [150, 330]) {
    rect(g, x, 100, 20, 140, '#f4efe4');
    poly(g, [[x - 2, 100], [x + 22, 100], [x + 10, 80]], '#fbf7ee');
  }
  // Garden axes.
  g.strokeStyle = '#3b8fd1';
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(240, 242);
  g.lineTo(240, 296);
  g.stroke();
  // A section of border left deliberately unpainted: a dashed gap in the golden frame.
  g.setLineDash([6, 6]);
  g.strokeStyle = '#f3e7cf';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(88, 270);
  g.lineTo(392, 270);
  g.stroke();
  g.setLineDash([]);
}

function drawFort(g: CanvasRenderingContext2D, stone: string, rock: string): void {
  poly(g, [[60, 250], [150, 130], [330, 130], [420, 250]], rock);
  rect(g, 160, 100, 160, 34, stone);
  for (let i = 0; i < 9; i++) rect(g, 160 + i * 18, 90, 10, 12, stone);
  rect(g, 215, 60, 50, 44, tone(stone, 0.9));
  poly(g, [[212, 60], [268, 60], [240, 36]], '#c9382a');
  // The cistern: long, thin, running the whole width, where all three threads cross.
  g.fillStyle = '#3b8fd1';
  g.fillRect(34, 262, PANEL_W - 68, 9);
  g.strokeStyle = 'rgba(30,18,10,0.85)';
  g.lineWidth = 2;
  g.strokeRect(34, 262, PANEL_W - 68, 9);
}

// ------------------------------------------------------------------ braid

/** Three threads braided together — the finale's reward, drawn into any canvas. */
export function drawBraid(canvas: HTMLCanvasElement, tangle: number): void {
  const w = (canvas.width = 560);
  const h = (canvas.height = 120);
  const g = canvas.getContext('2d');
  if (!g) return;
  g.clearRect(0, 0, w, h);
  const motifs: Motif[] = ['water', 'writing', 'measure'];
  motifs.forEach((motif, i) => {
    g.strokeStyle = THREAD_COLOUR[motif];
    g.lineWidth = 6;
    g.lineCap = 'round';
    g.beginPath();
    for (let x = 0; x <= w; x += 3) {
      // At tangle 1 the threads wander independently; at 0 they braid in order.
      const braid = Math.sin(x * 0.045 + (i * Math.PI * 2) / 3) * 28;
      const wander = Math.sin(x * (0.021 + i * 0.013) + i * 5) * 44 + Math.cos(x * 0.05 * (i + 1)) * 12;
      const y = h / 2 + braid * (1 - tangle) + wander * tangle;
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  });
}
