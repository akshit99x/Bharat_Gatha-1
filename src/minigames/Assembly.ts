import { audio } from '../core/Audio';
import type { AssemblyChallenge } from '../content/types';
import { el } from '../ui/overlay';
import { clamp, reducedMotion, shuffledNotSolved, sparkle } from './shared';
import type { GameHost, MiniGameResult } from './types';

/**
 * Assembly.
 *
 * Every assembly in the game is a *process in order*: a drain from the house to
 * the sewer, a causeway from survey to surface, a stupa from the ground up, a
 * lost-wax bronze from model to polish. So the puzzle is the order, and the
 * game explains a wrong move instead of just refusing it: a piece that belongs
 * later says what has to come first; a piece that belongs nowhere near says so.
 *
 * Pieces are drawn as small isometric blocks at their real relative sizes, so a
 * sewer visibly dwarfs a soak-pit jar. When the last one is placed the whole
 * thing is "switched on": water runs through a drain, a gold pulse runs through
 * a monument, so the player sees that it works.
 */

type Piece = AssemblyChallenge['config']['pieces'][number];
type Socket = AssemblyChallenge['config']['sockets'][number];

const SVG_NS = 'http://www.w3.org/2000/svg';

const hex = (n: number | undefined, fallback = 0xb8956a): string => `#${(n ?? fallback).toString(16).padStart(6, '0')}`;

function shade(color: string, k: number): string {
  const n = parseInt(color.slice(1), 16);
  const c = (v: number): number => clamp(Math.round(v * k), 0, 255);
  return `rgb(${c((n >> 16) & 255)},${c((n >> 8) & 255)},${c(n & 255)})`;
}

/** An isometric block: front, top and right faces, sized by the piece's real dimensions. */
function blockSvg(piece: Piece, extent: { w: number; h: number }): SVGSVGElement {
  const [w, h, d] = piece.size;
  const skew = d * 0.45;
  const totalW = w + skew;
  const totalH = h + skew;
  const color = hex(piece.color);

  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);
  svg.setAttribute('class', 'as-block');
  svg.style.width = `${(totalW / extent.w) * 100}%`;
  svg.style.aspectRatio = `${totalW} / ${totalH}`;
  svg.setAttribute('aria-hidden', 'true');

  const face = (points: string, fill: string): void => {
    const p = document.createElementNS(SVG_NS, 'polygon');
    p.setAttribute('points', points);
    p.setAttribute('fill', fill);
    p.setAttribute('stroke', 'rgba(20,10,4,0.75)');
    p.setAttribute('stroke-width', String(Math.max(0.05, totalW * 0.012)));
    p.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(p);
  };
  // Front, top, right: lit from the upper left.
  face(`0,${skew} ${w},${skew} ${w},${totalH} 0,${totalH}`, color);
  face(`0,${skew} ${skew},0 ${w + skew},0 ${w},${skew}`, shade(color, 1.22));
  face(`${w},${skew} ${w + skew},0 ${w + skew},${h} ${w},${totalH}`, shade(color, 0.7));
  return svg;
}

function extentOf(pieces: readonly Piece[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const p of pieces) {
    w = Math.max(w, p.size[0] + p.size[2] * 0.45);
    h = Math.max(h, p.size[1] + p.size[2] * 0.45);
  }
  return { w, h };
}

export function runAssembly(challenge: AssemblyChallenge, host: GameHost): Promise<MiniGameResult> {
  return new Promise((resolve) => {
    const { pieces, sockets, ordered } = challenge.config;
    const extent = extentOf(pieces);
    const pieceById = new Map(pieces.map((p) => [p.id, p]));
    const filled = new Map<string, string>(); // socket id -> piece id
    let mistakes = 0;
    let picked: string | null = null;
    const stepOf = (socketId: string): number => sockets.findIndex((s) => s.id === socketId) + 1;

    host.setStatus('Drag each piece onto the step where it belongs — or tap a piece, then a step.');

    const scene = el('div', 'as-scene');
    scene.style.setProperty('--n', String(sockets.length));
    scene.style.setProperty('--ratio', String(extent.w / extent.h));

    const row = el('div', 'as-row');
    const flow = el('div', 'as-flow');
    const slotEls = new Map<string, HTMLElement>();
    sockets.forEach((socket, i) => {
      const slot = el('div', 'as-slot');
      slot.dataset.id = socket.id;
      const ghost = el('div', 'as-ghost');
      const label = el('div', 'as-slot-label');
      label.append(el('span', 'as-step', String(i + 1)), el('span', undefined, stripNumber(socket.label)));
      slot.append(ghost, label);
      slotEls.set(socket.id, slot);
      row.appendChild(slot);
    });

    const ground = el('div', 'as-ground');
    const tray = el('div', 'as-tray');
    tray.append(el('div', 'as-tray-title', 'Parts'));
    const trayRow = el('div', 'as-tray-row');
    tray.appendChild(trayRow);

    scene.append(row, flow, ground, tray);
    host.area.appendChild(scene);

    const pieceEls = new Map<string, HTMLElement>();
    for (const piece of shuffledNotSolved(pieces, challenge.id, (a, b) => a.id === b.id || !ordered)) {
      const card = el('div', 'as-piece');
      card.dataset.id = piece.id;
      card.tabIndex = 0;
      card.setAttribute('role', 'button');
      card.setAttribute('aria-label', piece.label);
      const art = el('div', 'as-art');
      art.appendChild(blockSvg(piece, extent));
      card.append(art, el('div', 'as-piece-label', piece.label));
      pieceEls.set(piece.id, card);
      trayRow.appendChild(card);
      bind(card, piece.id);
    }

    // ----------------------------------------------------------------- input

    function bind(card: HTMLElement, id: string): void {
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          e.stopPropagation();
          select(id);
        }
      });
      card.addEventListener('pointerdown', (e) => {
        if (filledPieces().has(id)) return;
        e.preventDefault();
        card.setPointerCapture(e.pointerId);
        const startX = e.clientX;
        const startY = e.clientY;
        let dragging = false;
        let over: HTMLElement | null = null;

        const onMove = (ev: PointerEvent): void => {
          const dx = ev.clientX - startX;
          const dy = ev.clientY - startY;
          if (!dragging && Math.hypot(dx, dy) > 7) {
            dragging = true;
            card.classList.add('dragging');
            card.style.transition = 'none';
            audio.hover();
          }
          if (!dragging) return;
          card.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
          const hit = slotAt(ev.clientX, ev.clientY);
          if (hit !== over) {
            over?.classList.remove('over');
            over = hit;
            over?.classList.add('over');
          }
        };
        const onUp = (ev: PointerEvent): void => {
          card.releasePointerCapture(e.pointerId);
          card.removeEventListener('pointermove', onMove);
          card.removeEventListener('pointerup', onUp);
          card.removeEventListener('pointercancel', onUp);
          over?.classList.remove('over');
          card.classList.remove('dragging');
          if (!dragging) {
            select(id);
            return;
          }
          const target = slotAt(ev.clientX, ev.clientY);
          card.style.transition = '';
          if (target) attempt(id, target.dataset.id as string, card);
          else settleBack(card);
        };
        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerup', onUp);
        card.addEventListener('pointercancel', onUp);
      });
    }

    function slotAt(x: number, y: number): HTMLElement | null {
      for (const slot of slotEls.values()) {
        const b = slot.getBoundingClientRect();
        if (x >= b.left - 6 && x <= b.right + 6 && y >= b.top - 14 && y <= b.bottom + 14) return slot;
      }
      return null;
    }

    for (const [sid, slot] of slotEls) {
      slot.addEventListener('click', () => {
        if (!picked) return;
        const card = pieceEls.get(picked) as HTMLElement;
        attempt(picked, sid, card);
      });
    }

    function select(id: string): void {
      if (filledPieces().has(id)) return;
      audio.click();
      for (const c of pieceEls.values()) c.classList.remove('picked');
      if (picked === id) {
        picked = null;
        host.setStatus('Drag each piece onto the step where it belongs — or tap a piece, then a step.');
        return;
      }
      picked = id;
      pieceEls.get(id)?.classList.add('picked');
      host.setStatus('Now tap the step it belongs to.');
    }

    const filledPieces = (): Set<string> => new Set(filled.values());

    function settleBack(card: HTMLElement): void {
      card.style.transform = '';
    }

    // ------------------------------------------------------------- the rules

    function attempt(pieceId: string, socketId: string, card: HTMLElement): void {
      const socket = sockets.find((s) => s.id === socketId) as Socket;
      const piece = pieceById.get(pieceId) as Piece;
      if (filled.has(socketId)) {
        reject(card, `Step ${stepOf(socketId)} is already done.`);
        return;
      }
      const wanted = socket.accepts;
      const belongsAt = sockets.find((s) => s.accepts === pieceId);

      if (wanted !== pieceId) {
        mistakes++;
        const there = belongsAt ? `That one is for step ${stepOf(belongsAt.id)}: ${stripNumber(belongsAt.label)}.` : 'That does not go here.';
        reject(card, `${piece.label} does not belong at step ${stepOf(socketId)} (${stripNumber(socket.label)}). ${there}`);
        return;
      }
      if (ordered) {
        const earlier = sockets.slice(0, sockets.indexOf(socket)).find((s) => !filled.has(s.id));
        if (earlier) {
          mistakes++;
          reject(card, `Right part, wrong moment. Step ${stepOf(earlier.id)} (${stripNumber(earlier.label)}) has to be done before this.`);
          return;
        }
      }
      place(pieceId, socketId, card);
    }

    function reject(card: HTMLElement, why: string): void {
      audio.failure();
      host.setStatus(why);
      card.classList.remove('shake');
      void card.offsetWidth;
      card.classList.add('shake');
      settleBack(card);
      for (const c of pieceEls.values()) c.classList.remove('picked');
      picked = null;
    }

    function place(pieceId: string, socketId: string, card: HTMLElement): void {
      const piece = pieceById.get(pieceId) as Piece;
      filled.set(socketId, pieceId);
      picked = null;
      for (const c of pieceEls.values()) c.classList.remove('picked');

      const slot = slotEls.get(socketId) as HTMLElement;
      const ghost = slot.querySelector('.as-ghost') as HTMLElement;
      ghost.replaceChildren();
      const block = blockSvg(piece, extent);
      block.classList.add('dropping');
      ghost.appendChild(block);
      slot.classList.add('filled');
      card.classList.add('used');
      card.style.transform = '';

      audio.pluck(260 + filled.size * 40, 0.2);
      audio.arrowHit(true);
      const sb = slot.getBoundingClientRect();
      const ab = scene.getBoundingClientRect();
      sparkle(scene, sb.left - ab.left + sb.width / 2, sb.top - ab.top + sb.height * 0.55);
      host.setStatus(`${filled.size} of ${sockets.length} in place.`);

      if (filled.size === sockets.length) window.setTimeout(switchOn, reducedMotion() ? 0 : 450);
    }

    // ------------------------------------------------------------- switch on

    /** Run water or light through the finished build, left to right, so the player sees it work. */
    function switchOn(): void {
      host.setStatus('All in place. Now watch it work.');
      const water = /water|drain|sewer|channel|aqueduct|tank|cistern/i.test(`${challenge.config.hint} ${challenge.name} ${challenge.brief}`);
      flow.dataset.kind = water ? 'water' : 'light';
      flow.classList.add('run');
      sockets.forEach((s, i) => {
        window.setTimeout(
          () => {
            slotEls.get(s.id)?.classList.add('lit');
            audio.pluck(300 + i * 45, 0.1);
          },
          reducedMotion() ? 0 : 200 + i * 260,
        );
      });
      window.setTimeout(
        () =>
          resolve({
            passed: true,
            score: clamp(100 - 10 * mistakes, 40, 100),
            stats: [mistakes === 0 ? 'No wrong placements' : `${mistakes} wrong placement${mistakes === 1 ? '' : 's'}`, `${sockets.length} steps in order`],
          }),
        reducedMotion() ? 200 : 600 + sockets.length * 260 + 500,
      );
    }
  });
}

/** "1 · At the house wall" → "At the house wall". */
function stripNumber(label: string): string {
  return label.replace(/^\s*\d+\s*[·.:-]\s*/, '');
}
