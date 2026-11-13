/**
 * Painterly looks for photo mode, done on a 2D canvas after the frame is captured.
 *
 *  - natural      the frame as rendered, with a soft vignette
 *  - pattachitra  Odisha scroll painting: a few mineral colours, bold black outlines, a patterned border
 *  - miniature    Mughal court painting: rich warm colour, softened, inside a gold-ruled margin
 *  - survey       an old survey photograph: sepia, grain, scratches and a darkened plate edge
 *  - sketch       a pencil study on paper, with a light wash of colour
 *
 * None of this needs WebGL: it runs once, on a still image, when the player picks a look.
 */

export type PhotoLook = 'natural' | 'pattachitra' | 'miniature' | 'survey' | 'sketch';

export const LOOKS: ReadonlyArray<{ id: PhotoLook; label: string; blurb: string }> = [
  { id: 'natural', label: 'As seen', blurb: 'The island as you saw it.' },
  { id: 'pattachitra', label: 'Pattachitra', blurb: 'Odisha cloth painting: mineral colours and bold outlines.' },
  { id: 'miniature', label: 'Miniature', blurb: 'A Mughal court painting inside a gold-ruled margin.' },
  { id: 'survey', label: 'Survey plate', blurb: 'An old glass-plate photograph from a survey, in sepia.' },
  { id: 'sketch', label: 'Sketchbook', blurb: 'A pencil study with a wash of colour.' },
];

function canvasOf(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('2D canvas unavailable');
  return [c, ctx];
}

/** A small deterministic random, so a look gives the same grain each time it is chosen. */
function rand(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

function luminance(d: Uint8ClampedArray): Float32Array {
  const n = d.length / 4;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.299 * (d[i * 4] as number) + 0.587 * (d[i * 4 + 1] as number) + 0.114 * (d[i * 4 + 2] as number);
  return out;
}

/** Sobel edge strength, 0..~1000. */
function edges(lum: Float32Array, w: number, h: number): Float32Array {
  const out = new Float32Array(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a = lum[i - w - 1] as number, b = lum[i - w] as number, c = lum[i - w + 1] as number;
      const d = lum[i - 1] as number, f = lum[i + 1] as number;
      const g = lum[i + w - 1] as number, hh = lum[i + w] as number, k = lum[i + w + 1] as number;
      const gx = c + 2 * f + k - a - 2 * d - g;
      const gy = g + 2 * hh + k - a - 2 * b - c;
      out[i] = Math.hypot(gx, gy);
    }
  }
  return out;
}

/** A 3x3 box blur, in place on a copy. */
function blur(d: Uint8ClampedArray, w: number, h: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (let ch = 0; ch < 3; ch++) {
        let sum = 0;
        let n = 0;
        for (let dy = -1; dy <= 1; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            sum += d[(yy * w + xx) * 4 + ch] as number;
            n++;
          }
        }
        out[(y * w + x) * 4 + ch] = sum / n;
      }
      out[(y * w + x) * 4 + 3] = 255;
    }
  }
  return out;
}

function vignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number, color = '0,0,0'): void {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.hypot(w, h) * 0.55);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

// ---------------------------------------------------------------- the looks

const PATTA_PALETTE: ReadonlyArray<readonly [number, number, number]> = [
  [184, 50, 31], // hingula red
  [224, 165, 38], // haritala yellow
  [243, 234, 215], // conch white
  [27, 22, 18], // lamp black
  [47, 79, 138], // indigo
  [63, 122, 58], // leaf green
  [150, 92, 52], // earth
  [120, 160, 190], // pale sky
];

function pattachitra(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const [c, ctx] = canvasOf(w, h);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const soft = blur(blur(img.data, w, h), w, h);
  const lum = luminance(soft);
  const edge = edges(lum, w, h);
  const d = img.data;
  for (let i = 0; i < w * h; i++) {
    // Push saturation up before matching, so greens stay green and skies stay blue.
    let r = soft[i * 4] as number, g = soft[i * 4 + 1] as number, b = soft[i * 4 + 2] as number;
    const m = (r + g + b) / 3;
    r = m + (r - m) * 1.7;
    g = m + (g - m) * 1.7;
    b = m + (b - m) * 1.7;
    let best = 0;
    let bestD = Infinity;
    for (let k = 0; k < PATTA_PALETTE.length; k++) {
      const p = PATTA_PALETTE[k] as readonly [number, number, number];
      const dd = (r - p[0]) ** 2 * 0.9 + (g - p[1]) ** 2 * 1.2 + (b - p[2]) ** 2 * 0.8;
      if (dd < bestD) {
        bestD = dd;
        best = k;
      }
    }
    const p = PATTA_PALETTE[best] as readonly [number, number, number];
    d[i * 4] = p[0];
    d[i * 4 + 1] = p[1];
    d[i * 4 + 2] = p[2];
  }
  // Outlines, thickened by one pixel.
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const e = Math.max(edge[i] as number, (edge[i - 1] as number) * 0.8, (edge[i - w] as number) * 0.8);
      if (e > 110) {
        d[i * 4] = 27;
        d[i * 4 + 1] = 22;
        d[i * 4 + 2] = 18;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  // Cloth texture.
  const rnd = rand(7);
  ctx.globalAlpha = 0.06;
  for (let y = 0; y < h; y += 3) {
    ctx.fillStyle = rnd() > 0.5 ? '#fff' : '#000';
    ctx.fillRect(0, y, w, 1);
  }
  ctx.globalAlpha = 1;
  // Border: a red band, a yellow band with petals, a black rule.
  const band = Math.round(Math.min(w, h) * 0.045);
  ctx.fillStyle = '#b8321f';
  ctx.fillRect(0, 0, w, band);
  ctx.fillRect(0, h - band, w, band);
  ctx.fillRect(0, 0, band, h);
  ctx.fillRect(w - band, 0, band, h);
  ctx.strokeStyle = '#1b1612';
  ctx.lineWidth = 3;
  ctx.strokeRect(band, band, w - band * 2, h - band * 2);
  ctx.fillStyle = '#e0a526';
  const petal = (x: number, y: number): void => {
    ctx.beginPath();
    ctx.ellipse(x, y, band * 0.32, band * 0.18, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  for (let x = band; x < w - band / 2; x += band * 0.9) {
    petal(x, band / 2);
    petal(x, h - band / 2);
  }
  for (let y = band; y < h - band / 2; y += band * 0.9) {
    petal(band / 2, y);
    petal(w - band / 2, y);
  }
  return c;
}

function miniature(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const [c, ctx] = canvasOf(w, h);
  ctx.fillStyle = '#5e1a1a';
  ctx.fillRect(0, 0, w, h);
  const m = Math.round(Math.min(w, h) * 0.08);
  const [inner, ictx] = canvasOf(w - m * 2, h - m * 2);
  ictx.drawImage(src, 0, 0, inner.width, inner.height);
  const img = ictx.getImageData(0, 0, inner.width, inner.height);
  const soft = blur(img.data, inner.width, inner.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    let r = (d[i] as number) * 0.6 + (soft[i] as number) * 0.4;
    let g = (d[i + 1] as number) * 0.6 + (soft[i + 1] as number) * 0.4;
    let b = (d[i + 2] as number) * 0.6 + (soft[i + 2] as number) * 0.4;
    const mm = (r + g + b) / 3;
    r = mm + (r - mm) * 1.35;
    g = mm + (g - mm) * 1.3;
    b = mm + (b - mm) * 1.2;
    d[i] = r * 1.07 + 6;
    d[i + 1] = g * 1.0 + 2;
    d[i + 2] = b * 0.86;
  }
  ictx.putImageData(img, 0, 0);
  vignette(ictx, inner.width, inner.height, 0.35, '60,30,10');
  ctx.drawImage(inner, m, m);
  // Gold rules and corner rosettes.
  ctx.strokeStyle = '#d4a63a';
  ctx.lineWidth = 4;
  ctx.strokeRect(m - 6, m - 6, w - (m - 6) * 2, h - (m - 6) * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(m - 14, m - 14, w - (m - 14) * 2, h - (m - 14) * 2);
  ctx.strokeStyle = '#2d5a4a';
  ctx.lineWidth = 2;
  ctx.strokeRect(m - 2, m - 2, w - (m - 2) * 2, h - (m - 2) * 2);
  const rosette = (x: number, y: number): void => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#d4a63a';
    for (let k = 0; k < 8; k++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.ellipse(m * 0.22, 0, m * 0.2, m * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#5e1a1a';
    ctx.beginPath();
    ctx.arc(0, 0, m * 0.09, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };
  rosette(m / 2, m / 2);
  rosette(w - m / 2, m / 2);
  rosette(m / 2, h - m / 2);
  rosette(w - m / 2, h - m / 2);
  // A thin vine along the margin.
  ctx.strokeStyle = 'rgba(212,166,58,0.6)';
  ctx.lineWidth = 1.5;
  for (const [y0, flip] of [[m / 2, 1], [h - m / 2, -1]] as const) {
    ctx.beginPath();
    for (let x = m; x < w - m; x += 4) {
      const y = y0 + Math.sin(x / 18) * m * 0.12 * flip;
      if (x === m) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  return c;
}

function survey(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const [c, ctx] = canvasOf(w, h);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const rnd = rand(1900);
  for (let i = 0; i < d.length; i += 4) {
    let l = 0.299 * (d[i] as number) + 0.587 * (d[i + 1] as number) + 0.114 * (d[i + 2] as number);
    l = 255 * Math.pow(l / 255, 0.9);
    l = (l - 128) * 1.15 + 128 + (rnd() - 0.5) * 34;
    d[i] = l * 1.06 + 18;
    d[i + 1] = l * 0.93 + 10;
    d[i + 2] = l * 0.72;
  }
  ctx.putImageData(img, 0, 0);
  // Scratches and dust.
  ctx.strokeStyle = 'rgba(255,245,220,0.35)';
  for (let k = 0; k < 7; k++) {
    const x = rnd() * w;
    ctx.lineWidth = rnd() * 1.4 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x, rnd() * h * 0.3);
    ctx.lineTo(x + (rnd() - 0.5) * 30, h * (0.6 + rnd() * 0.4));
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(30,20,10,0.5)';
  for (let k = 0; k < 120; k++) ctx.fillRect(rnd() * w, rnd() * h, rnd() * 2 + 1, rnd() * 2 + 1);
  vignette(ctx, w, h, 0.75, '40,25,10');
  // The plate's uneven edge.
  ctx.strokeStyle = 'rgba(20,12,6,0.85)';
  ctx.lineWidth = Math.min(w, h) * 0.03;
  ctx.strokeRect(0, 0, w, h);
  return c;
}

function sketch(src: HTMLCanvasElement): HTMLCanvasElement {
  const w = src.width, h = src.height;
  const [c, ctx] = canvasOf(w, h);
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, w, h);
  const soft = blur(img.data, w, h);
  const lum = luminance(soft);
  const edge = edges(lum, w, h);
  const d = img.data;
  const rnd = rand(42);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const l = (lum[i] as number) / 255;
      // Paper, then a pale wash of the scene's colour.
      const r0 = soft[i * 4] as number, g0 = soft[i * 4 + 1] as number, b0 = soft[i * 4 + 2] as number;
      let r = 244 * 0.8 + r0 * 0.2;
      let g = 239 * 0.8 + g0 * 0.2;
      let b = 228 * 0.8 + b0 * 0.2;
      // Pencil: outlines, and cross-hatching in the shadows.
      let dark = Math.min(1, ((edge[i] as number) - 40) / 220);
      if (l < 0.42 && (x + y) % 7 === 0) dark = Math.max(dark, 0.45);
      if (l < 0.25 && (x - y + 1000) % 7 === 0) dark = Math.max(dark, 0.55);
      dark = Math.max(0, dark) * (0.85 + rnd() * 0.15);
      r = r * (1 - dark) + 58 * dark;
      g = g * (1 - dark) + 56 * dark;
      b = b * (1 - dark) + 60 * dark;
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

export function applyLook(src: HTMLCanvasElement, look: PhotoLook): HTMLCanvasElement {
  switch (look) {
    case 'pattachitra':
      return pattachitra(src);
    case 'miniature':
      return miniature(src);
    case 'survey':
      return survey(src);
    case 'sketch':
      return sketch(src);
    default: {
      const [c, ctx] = canvasOf(src.width, src.height);
      ctx.drawImage(src, 0, 0);
      vignette(ctx, src.width, src.height, 0.28);
      return c;
    }
  }
}
