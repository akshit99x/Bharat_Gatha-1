import { getChapter } from '../content/story';
import type { Zone } from '../content/types';
import { audio } from '../core/Audio';
import { buildPanel, button, closeOverlay, el, mountOverlay } from '../ui/overlay';
import { drawPanel } from '../ui/panelArt';
import { LOOKS, applyLook, type PhotoLook } from './photoFilters';

/**
 * Photo mode. `P` captures the frame exactly as rendered (the HUD is HTML, so it is never in the picture),
 * then a darkroom opens: pick a look, write a line, and save the result as a postcard of the region, with a
 * stamp painted from its panel of the Gatha and a postmark.
 */

const MAX_WIDTH = 1280;

/** Copy the WebGL canvas into a 2D canvas. Call right after rendering, in the same task. */
export function captureFrame(gl: HTMLCanvasElement): HTMLCanvasElement {
  const scale = Math.min(1, MAX_WIDTH / gl.width);
  const c = document.createElement('canvas');
  c.width = Math.round(gl.width * scale);
  c.height = Math.round(gl.height * scale);
  c.getContext('2d')?.drawImage(gl, 0, 0, c.width, c.height);
  return c;
}

/** A white flash and a shutter click. */
export function shutter(): void {
  const flash = document.createElement('div');
  flash.className = 'photo-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 600);
  audio.click();
  setTimeout(() => audio.click(), 70);
}

function stamp(zone: Zone): HTMLCanvasElement {
  const chapter = getChapter(zone.id);
  const art = document.createElement('canvas');
  if (chapter) drawPanel(art, chapter.panel, zone, { restored: true, lit: chapter.panel.threads });
  const W = 170, H = 210;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  // Perforated paper edge.
  ctx.fillStyle = '#fbf6ea';
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'destination-out';
  for (let x = 6; x < W; x += 12) {
    ctx.beginPath();
    ctx.arc(x, 0, 4.5, 0, Math.PI * 2);
    ctx.arc(x, H, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let y = 6; y < H; y += 12) {
    ctx.beginPath();
    ctx.arc(0, y, 4.5, 0, Math.PI * 2);
    ctx.arc(W, y, 4.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  if (art.width > 0) ctx.drawImage(art, 14, 14, W - 28, (W - 28) * (art.height / art.width));
  ctx.fillStyle = '#5a1f14';
  ctx.textAlign = 'center';
  ctx.font = '600 15px Georgia, serif';
  ctx.fillText('भारत गाथा', W / 2, H - 38);
  ctx.font = '600 12px Georgia, serif';
  ctx.fillText(`CHAPTER ${zone.chapter}`, W / 2, H - 20);
  return c;
}

function postmark(ctx: CanvasRenderingContext2D, x: number, y: number, zone: Zone): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.18);
  ctx.strokeStyle = 'rgba(40,40,70,0.65)';
  ctx.fillStyle = 'rgba(40,40,70,0.65)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.stroke();
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, 0, 48, 0, Math.PI * 2);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 12px Georgia, serif';
  const label = zone.name.toUpperCase().slice(0, 22);
  // Name around the ring.
  const step = 0.16;
  const start = -((label.length - 1) * step) / 2 - Math.PI / 2;
  for (let i = 0; i < label.length; i++) {
    const a = start + i * step;
    ctx.save();
    ctx.rotate(a + Math.PI / 2);
    ctx.fillText(label[i] as string, 0, -55);
    ctx.restore();
  }
  const d = new Date();
  ctx.font = '700 13px Georgia, serif';
  ctx.fillText(`${d.getDate()} ${d.toLocaleString('en', { month: 'short' }).toUpperCase()} ${d.getFullYear()}`, 0, 0);
  ctx.font = '600 11px Georgia, serif';
  ctx.fillText('GATHA POST', 0, 18);
  // Wavy cancellation lines.
  ctx.lineWidth = 2;
  for (let k = 0; k < 4; k++) {
    ctx.beginPath();
    for (let t = 0; t <= 160; t += 4) {
      const yy = -24 + k * 14 + Math.sin(t / 12) * 4;
      if (t === 0) ctx.moveTo(70 + t, yy);
      else ctx.lineTo(70 + t, yy);
    }
    ctx.stroke();
  }
  ctx.restore();
}

/** Lay the photograph, a caption, the stamp and the postmark on a card. */
export function composePostcard(photo: HTMLCanvasElement, zone: Zone | null, message: string, from: string): HTMLCanvasElement {
  const pad = 36;
  const W = photo.width + pad * 2;
  const band = 170;
  const H = photo.height + pad * 2 + band;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  // Card stock with a little tooth.
  ctx.fillStyle = '#f3e9d2';
  ctx.fillRect(0, 0, W, H);
  ctx.globalAlpha = 0.05;
  for (let i = 0; i < 2600; i++) {
    ctx.fillStyle = i % 2 ? '#000' : '#fff';
    ctx.fillRect(Math.random() * W, Math.random() * H, 2, 2);
  }
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'rgba(0,0,0,0.25)';
  ctx.shadowBlur = 14;
  ctx.shadowOffsetY = 4;
  ctx.drawImage(photo, pad, pad);
  ctx.shadowColor = 'transparent';

  const top = photo.height + pad * 2;
  ctx.fillStyle = '#3a1f12';
  ctx.textBaseline = 'alphabetic';
  ctx.font = '700 38px Georgia, "Times New Roman", serif';
  ctx.fillText(zone ? `Greetings from ${zone.name}` : 'Greetings from the island of the Gatha', pad, top + 44);
  ctx.font = '400 22px Georgia, serif';
  ctx.fillStyle = '#6b4a30';
  if (zone) ctx.fillText(`${zone.nameLocal}  ·  ${zone.era}`, pad, top + 78);
  ctx.font = 'italic 24px Georgia, serif';
  ctx.fillStyle = '#3a1f12';
  const text = message.trim() || (zone ? zone.tagline : 'Eleven eras, one scroll.');
  ctx.fillText(`“${text.slice(0, 90)}”`, pad, top + 116);
  ctx.font = '400 18px Georgia, serif';
  ctx.fillStyle = '#6b4a30';
  ctx.fillText(`— ${from || 'a Gathak'}, Bharat Gatha`, pad, top + 146);

  if (zone) {
    const s = stamp(zone);
    const sx = W - pad - s.width;
    const sy = top - 40;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 8;
    ctx.translate(sx + s.width / 2, sy + s.height / 2);
    ctx.rotate(0.04);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
    ctx.restore();
    postmark(ctx, sx - 30, sy + 80, zone);
  }
  return c;
}

/** The darkroom: choose a look, write a line, save the postcard. */
export function openDarkroom(shot: HTMLCanvasElement, zone: Zone | null, playerName: string, onSaved: () => void): void {
  const { panel, body, foot } = buildPanel({
    title: 'Chitrashala · the darkroom',
    subtitle: zone ? `${zone.name} · ${zone.era}` : 'The island of the Gatha',
    width: 'wide',
    closable: true,
    onClose: () => closeOverlay(),
  });
  const layout = el('div', 'dk-layout');
  const preview = el('div', 'dk-preview');
  const side = el('div', 'dk-side');
  layout.append(preview, side);
  body.appendChild(layout);

  let look: PhotoLook = 'natural';
  let message = '';
  const cache = new Map<PhotoLook, HTMLCanvasElement>();
  let card: HTMLCanvasElement | null = null;

  const redraw = (): void => {
    let styled = cache.get(look);
    if (!styled) {
      styled = applyLook(shot, look);
      cache.set(look, styled);
    }
    card = composePostcard(styled, zone, message, playerName);
    card.className = 'dk-card';
    preview.replaceChildren(card);
  };

  side.appendChild(el('div', 'dk-label', 'Look'));
  const looks = el('div', 'dk-looks');
  const buttons: HTMLButtonElement[] = [];
  for (const l of LOOKS) {
    const b = button(l.label, l.id === look ? 'dk-look active' : 'dk-look');
    b.title = l.blurb;
    b.addEventListener('click', () => {
      look = l.id;
      for (const x of buttons) x.classList.toggle('active', x === b);
      blurb.textContent = l.blurb;
      audio.click();
      // Let the button state paint before the (short) filter work.
      requestAnimationFrame(() => setTimeout(redraw, 0));
    });
    buttons.push(b);
    looks.appendChild(b);
  }
  side.appendChild(looks);
  const blurb = el('p', 'dk-blurb', LOOKS[0]?.blurb ?? '');
  side.appendChild(blurb);

  side.appendChild(el('div', 'dk-label', 'Write on the card'));
  const input = document.createElement('input');
  input.type = 'text';
  input.maxLength = 90;
  input.className = 'dk-input';
  input.placeholder = zone ? zone.tagline : 'A line for the back of the card';
  let timer = 0;
  input.addEventListener('input', () => {
    message = input.value;
    clearTimeout(timer);
    timer = window.setTimeout(redraw, 180);
  });
  // Typing must not move the player or open menus.
  input.addEventListener('keydown', (e) => e.stopPropagation());
  side.appendChild(input);
  side.appendChild(el('p', 'dk-blurb', 'The stamp is this region’s panel of the Gatha. Press P anywhere on the island to take another.'));

  const saveBtn = button('Save postcard', 'btn btn-primary');
  saveBtn.addEventListener('click', () => {
    if (!card) return;
    card.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bharat-gatha-${zone?.id ?? 'island'}-${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      audio.success(2);
      onSaved();
      saveBtn.textContent = 'Saved ✓';
    }, 'image/png');
  });
  const close = button('Back to the island', 'btn btn-ghost');
  close.addEventListener('click', () => closeOverlay());
  foot.append(saveBtn, close);

  mountOverlay('darkroom', panel, { onEscape: () => closeOverlay() });
  redraw();
}
