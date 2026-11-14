/**
 * Draw an akshara's glyph on a 2D canvas: a letter from the device's fonts, or a sign drawn stroke by stroke
 * (Indus signs, cuneiform wedges, Ashokan Brahmi) for scripts no ordinary device has a font for.
 */

import type { Akshara, StrokeGlyph } from '../content/aksharas';

const FONT_STACK =
  '"Noto Sans Devanagari", "Nirmala UI", "Mangal", "Noto Sans Tamil", "Latha", "Noto Sans Kannada", "Tunga", "Noto Sans Telugu", "Gautami", "Noto Sans Oriya", "Kalinga", "Noto Sans Sinhala", "Iskoola Pota", "Noto Sans Thai", "Leelawadee UI", "Noto Naskh Arabic", "Segoe UI", serif';

/** Draw the glyph centred at (cx, cy), filling a box `size` wide. */
export function drawGlyph(ctx: CanvasRenderingContext2D, glyph: Akshara['glyph'], cx: number, cy: number, size: number, color: string): void {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  if ('text' in glyph) {
    ctx.font = `${Math.round(size * 0.78)}px ${FONT_STACK}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Most scripts sit a little high on the em box; nudge them down to look centred.
    ctx.fillText(glyph.text, cx, cy + size * 0.05);
  } else {
    drawStrokes(ctx, glyph.strokes, cx - size / 2, cy - size / 2, size);
  }
  ctx.restore();
}

function drawStrokes(ctx: CanvasRenderingContext2D, g: StrokeGlyph, x0: number, y0: number, s: number): void {
  const X = (v: number): number => x0 + v * s;
  const Y = (v: number): number => y0 + v * s;
  ctx.lineWidth = Math.max(2, s * 0.075);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const line of g.lines ?? []) {
    ctx.beginPath();
    line.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))));
    ctx.stroke();
  }
  for (const shape of g.fills ?? []) {
    ctx.beginPath();
    shape.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(X(x), Y(y)) : ctx.lineTo(X(x), Y(y))));
    ctx.closePath();
    ctx.fill();
  }
  for (const [x, y, r] of g.rings ?? []) {
    ctx.beginPath();
    ctx.arc(X(x), Y(y), r * s, 0, Math.PI * 2);
    ctx.stroke();
  }
  for (const [x, y, r] of g.dots ?? []) {
    ctx.beginPath();
    ctx.arc(X(x), Y(y), r * s, 0, Math.PI * 2);
    ctx.fill();
  }
  // A wedge: a triangular head where the reed went in, tapering to a thin tail.
  for (const [x1, y1, x2, y2] of g.wedges ?? []) {
    const ax = X(x1), ay = Y(y1), bx = X(x2), by = Y(y2);
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const ux = (bx - ax) / len, uy = (by - ay) / len;
    const nx = -uy, ny = ux;
    const head = s * 0.11;
    const tail = s * 0.018;
    ctx.beginPath();
    ctx.moveTo(ax + nx * head, ay + ny * head);
    ctx.lineTo(ax + ux * head * 1.6, ay + uy * head * 1.6);
    ctx.lineTo(bx + nx * tail, by + ny * tail);
    ctx.lineTo(bx - nx * tail, by - ny * tail);
    ctx.lineTo(ax + ux * head * 1.6, ay + uy * head * 1.6);
    ctx.lineTo(ax - nx * head, ay - ny * head);
    ctx.closePath();
    ctx.fill();
  }
}

/** A round medallion: cream disc, gold rim, the glyph in deep red. Used for the floating letters in the world. */
export function medallionCanvas(a: Akshara, px = 256): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const m = px / 2;
  const r = px * 0.44;
  const grad = ctx.createRadialGradient(m, m * 0.85, r * 0.1, m, m, r);
  grad.addColorStop(0, '#fff8e6');
  grad.addColorStop(1, '#ecd7a6');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(m, m, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = px * 0.04;
  ctx.strokeStyle = '#c38b22';
  ctx.stroke();
  ctx.lineWidth = px * 0.008;
  ctx.strokeStyle = '#9a6a15';
  ctx.beginPath();
  ctx.arc(m, m, r * 0.86, 0, Math.PI * 2);
  ctx.stroke();
  // Eight small beads on the rim, like a seal's border.
  ctx.fillStyle = '#9a6a15';
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * Math.PI * 2 + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(m + Math.cos(t) * r * 0.93, m + Math.sin(t) * r * 0.93, px * 0.012, 0, Math.PI * 2);
    ctx.fill();
  }
  drawGlyph(ctx, a.glyph, m, m, px * 0.56, '#6a1d12');
  return c;
}
