import { audio } from '../core/Audio';
import type { ScriptMatchChallenge } from '../content/types';
import { el } from '../ui/overlay';
import { clamp, reducedMotion, shuffledNotSolved, sparkle } from './shared';
import type { GameHost, MiniGameResult } from './types';

/**
 * Script matching.
 *
 * Pick a sign on the left, then its meaning on the right, and a line is drawn
 * between them. A right match locks green; a wrong one shakes and costs
 * nothing. After two misses on the same sign the correct answer pulses softly,
 * because the goal is to learn the pairing, not to guess it blind.
 *
 * The same component serves cuneiform, Brahmi, Indus seals, Jantar Mantar
 * instruments and Hampi's ruins — each config supplies its own caption on the
 * left and its own meaning on the right.
 */

type Left = ScriptMatchChallenge['config']['left'][number];
type Right = ScriptMatchChallenge['config']['right'][number];

const SVG_NS = 'http://www.w3.org/2000/svg';

export function runScriptMatch(challenge: ScriptMatchChallenge, host: GameHost): Promise<MiniGameResult> {
  return new Promise((resolve) => {
    const { left, right } = challenge.config;
    const rightOrder: Right[] = shuffledNotSolved(right, challenge.id, (a, b) => a.id === b.id);
    const leftOrder: Left[] = [...left];

    let selected: string | null = null;
    let mistakes = 0;
    const missesFor = new Map<string, number>();
    const matched = new Set<string>();

    host.setStatus('Choose a sign, then choose what it is. Nothing is lost for a wrong guess.');

    const stage = el('div', 'sm-stage');
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('class', 'sm-lines');
    const colL = el('div', 'sm-col');
    const colR = el('div', 'sm-col');
    stage.append(colL, colR, svg);
    host.area.appendChild(stage);

    const leftEls = new Map<string, HTMLElement>();
    const rightEls = new Map<string, HTMLElement>();

    for (const item of leftOrder) {
      const card = el('button', 'sm-card sm-left') as HTMLButtonElement;
      card.type = 'button';
      card.dataset.id = item.id;
      card.append(el('span', 'sm-glyph', item.glyph), el('span', 'sm-caption', item.caption));
      card.addEventListener('click', () => pickLeft(item.id));
      card.addEventListener('animationend', () => card.classList.remove('shake'));
      leftEls.set(item.id, card);
      colL.appendChild(card);
    }
    for (const item of rightOrder) {
      const card = el('button', 'sm-card sm-right') as HTMLButtonElement;
      card.type = 'button';
      card.dataset.id = item.id;
      card.append(el('span', 'sm-meaning', item.label));
      card.addEventListener('click', () => pickRight(item.id));
      card.addEventListener('animationend', () => card.classList.remove('shake'));
      rightEls.set(item.id, card);
      colR.appendChild(card);
    }

    // The rubber band that follows the pointer from the chosen sign.
    const band = document.createElementNS(SVG_NS, 'line');
    band.setAttribute('class', 'sm-band');
    band.style.display = 'none';
    svg.appendChild(band);
    const onPointer = (e: PointerEvent): void => {
      if (!selected) return;
      const origin = anchor(leftEls.get(selected) as HTMLElement, 'right');
      const box = stage.getBoundingClientRect();
      band.setAttribute('x1', String(origin.x));
      band.setAttribute('y1', String(origin.y));
      band.setAttribute('x2', String(e.clientX - box.left));
      band.setAttribute('y2', String(e.clientY - box.top));
    };
    stage.addEventListener('pointermove', onPointer);

    function anchor(card: HTMLElement, side: 'left' | 'right'): { x: number; y: number } {
      const box = card.getBoundingClientRect();
      const host0 = stage.getBoundingClientRect();
      return { x: (side === 'right' ? box.right : box.left) - host0.left, y: box.top + box.height / 2 - host0.top };
    }

    function pickLeft(id: string): void {
      if (matched.has(id)) return;
      audio.click();
      for (const c of leftEls.values()) c.classList.remove('selected');
      for (const c of rightEls.values()) c.classList.remove('hinted');
      if (selected === id) {
        selected = null;
        band.style.display = 'none';
        return;
      }
      selected = id;
      leftEls.get(id)?.classList.add('selected');
      const o = anchor(leftEls.get(id) as HTMLElement, 'right');
      band.setAttribute('x1', String(o.x));
      band.setAttribute('y1', String(o.y));
      band.setAttribute('x2', String(o.x));
      band.setAttribute('y2', String(o.y));
      band.style.display = '';
      host.setStatus('Now choose its meaning on the right.');
    }

    function pickRight(id: string): void {
      if (!selected) {
        host.setStatus('Choose a sign on the left first.');
        audio.hover();
        return;
      }
      const from = selected;
      const rightCard = rightEls.get(id) as HTMLElement;
      if (rightCard.classList.contains('matched')) return;
      const leftCard = leftEls.get(from) as HTMLElement;

      if (from === id) {
        // A match.
        matched.add(from);
        selected = null;
        band.style.display = 'none';
        leftCard.classList.remove('selected');
        leftCard.classList.add('matched');
        rightCard.classList.add('matched');
        drawLine(from);
        audio.success(3);
        const box = rightCard.getBoundingClientRect();
        const s0 = stage.getBoundingClientRect();
        sparkle(stage, box.left - s0.left + 20, box.top - s0.top + box.height / 2, '#76bb5a');
        host.setStatus(`${matched.size} of ${left.length} matched.`);
        if (matched.size === left.length) finish();
        return;
      }

      // A miss: shake, soft tone, and after two on the same sign, point at the answer.
      mistakes++;
      const n = (missesFor.get(from) ?? 0) + 1;
      missesFor.set(from, n);
      audio.failure();
      rightCard.classList.remove('shake');
      void rightCard.offsetWidth;
      rightCard.classList.add('shake');
      leftCard.classList.remove('shake');
      void leftCard.offsetWidth;
      leftCard.classList.add('shake');
      if (n >= 2) {
        rightEls.get(from)?.classList.add('hinted');
        host.setStatus('Not that one. The meaning that is pulsing belongs to your sign.');
      } else {
        host.setStatus('Not that one — try another. Nothing is lost.');
      }
    }

    function drawLine(id: string): void {
      const a = anchor(leftEls.get(id) as HTMLElement, 'right');
      const b = anchor(rightEls.get(id) as HTMLElement, 'left');
      const path = document.createElementNS(SVG_NS, 'path');
      const mid = (a.x + b.x) / 2;
      path.setAttribute('d', `M ${a.x} ${a.y} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`);
      path.setAttribute('class', 'sm-line');
      path.dataset.id = id;
      svg.insertBefore(path, band);
      if (!reducedMotion()) {
        const len = path.getTotalLength();
        path.style.strokeDasharray = String(len);
        path.style.strokeDashoffset = String(len);
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 0.5s ease';
        path.style.strokeDashoffset = '0';
      }
    }

    // Lines are positioned from the DOM, so redo them if the layout moves.
    const redraw = (): void => {
      for (const p of svg.querySelectorAll('path')) p.remove();
      for (const id of matched) drawLine(id);
    };
    window.addEventListener('resize', redraw);
    host.onDispose(() => window.removeEventListener('resize', redraw));

    function finish(): void {
      host.setStatus('Every sign is matched.');
      window.setTimeout(
        () =>
          resolve({
            passed: true,
            score: clamp(100 - 8 * mistakes, 40, 100),
            stats: [mistakes === 0 ? 'No wrong guesses' : `${mistakes} wrong guess${mistakes === 1 ? '' : 'es'}`, `${left.length} of ${left.length} matched`],
          }),
        reducedMotion() ? 200 : 900,
      );
    }
  });
}
