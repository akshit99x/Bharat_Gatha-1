import { audio } from '../core/Audio';
import type { TradeChallenge } from '../content/types';
import { button, el } from '../ui/overlay';
import { animate, clamp, reducedMotion } from './shared';
import type { GameHost, MiniGameResult } from './types';

/**
 * Trade and weights: a working balance.
 *
 * The beam is a small physics simulation — a damped spring — so it swings and
 * settles the way a real pan balance does, rather than snapping between three
 * states. The player sets a quantity on the right pan with the period's own
 * weights, then loads goods on the left until the beam hangs level.
 *
 * What it teaches is the weights themselves. The Harappan series 1, 2, 4, 8, 16,
 * 32, 64 can make any whole number with the fewest pieces in exactly one way;
 * the Mesopotamian and Vijayanagara sets do not, and the "fewest weights"
 * count (which is the only thing the score looks at) shows why a binary series
 * is such an efficient standard.
 */

type Good = TradeChallenge['config']['goods'][number];

const SVG_NS = 'http://www.w3.org/2000/svg';
const PIVOT = { x: 300, y: 92 };
const ARM = 168;
const MAX_ANGLE = 0.34;

/** Fewest weights that sum to `target`, by dynamic programming. Null if it cannot be made. */
export function fewestWeights(weights: readonly number[], target: number): number | null {
  const best: Array<number | null> = new Array(target + 1).fill(null);
  best[0] = 0;
  for (let t = 1; t <= target; t++) {
    for (const w of weights) {
      if (w > t) continue;
      const prev = best[t - w];
      if (prev !== null && prev !== undefined && (best[t] === null || (best[t] as number) > prev + 1)) best[t] = prev + 1;
    }
  }
  return best[target] ?? null;
}

function svgEl<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}): SVGElementTagNameMap[K] {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

export function runTrade(challenge: TradeChallenge, host: GameHost): Promise<MiniGameResult> {
  return new Promise((resolve) => {
    const { goods, weights, target } = challenge.config;
    const minWeights = fewestWeights(weights, target);

    /** Goods on the left pan, in the order added. */
    const left: Good[] = [];
    /** Weights on the right pan, in the order added. */
    const right: number[] = [];
    let solved = false;

    const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
    const leftMass = (): number => sum(left.map((g) => g.unitMass));
    const rightMass = (): number => sum(right);

    host.setStatus('Put weights on the right pan, then load goods on the left until the beam hangs level.');

    // ------------------------------------------------------------- the scene

    const wrap = el('div', 'tr-wrap');
    const goal = el('div', 'tr-goal');
    goal.append(el('span', 'tr-goal-label', 'Deliver exactly'), el('b', 'tr-goal-value', String(target)));
    const readout = el('div', 'tr-readout');
    const leftRead = el('span', 'tr-read', 'Goods 0');
    const rightRead = el('span', 'tr-read', 'Weights 0');
    readout.append(leftRead, rightRead);

    const svg = svgEl('svg', { viewBox: '0 0 600 330', class: 'tr-svg' });
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'A balance with goods on the left and weights on the right');

    // Stand.
    svg.append(
      svgEl('rect', { x: 292, y: PIVOT.y, width: 16, height: 220, rx: 4, class: 'tr-stand' }),
      svgEl('path', { d: 'M 235 312 L 365 312 L 335 290 L 265 290 Z', class: 'tr-base' }),
    );
    const beam = svgEl('g');
    beam.append(svgEl('rect', { x: PIVOT.x - ARM - 14, y: PIVOT.y - 6, width: (ARM + 14) * 2, height: 12, rx: 6, class: 'tr-beam' }));
    const levelMark = svgEl('rect', { x: 296, y: 56, width: 8, height: 26, rx: 3, class: 'tr-needle' });
    svg.appendChild(levelMark);

    const stringsL = svgEl('path', { class: 'tr-string' });
    const stringsR = svgEl('path', { class: 'tr-string' });
    const panL = svgEl('g', { class: 'tr-pan' });
    const panR = svgEl('g', { class: 'tr-pan' });
    for (const pan of [panL, panR]) pan.appendChild(svgEl('path', { d: 'M -78 0 Q 0 36 78 0 Z', class: 'tr-dish' }));
    const loadL = svgEl('g');
    const loadR = svgEl('g');
    panL.appendChild(loadL);
    panR.appendChild(loadR);
    svg.append(stringsL, stringsR, panL, panR, beam, svgEl('circle', { cx: PIVOT.x, cy: PIVOT.y, r: 9, class: 'tr-pivot' }));
    // The pivot cap goes over the beam; re-append to keep draw order right.
    svg.appendChild(svg.querySelector('.tr-pivot') as Element);

    // ------------------------------------------------------------- palettes

    const palettes = el('div', 'tr-palettes');
    const goodsBox = el('div', 'tr-palette');
    goodsBox.append(el('h4', undefined, 'Goods — onto the left pan'));
    const goodsRow = el('div', 'tr-chips');
    for (const g of goods) {
      const b = el('button', 'tr-chip') as HTMLButtonElement;
      b.type = 'button';
      b.append(el('span', 'tr-chip-glyph', g.glyph), el('span', 'tr-chip-text', g.label), el('b', 'tr-chip-mass', `× ${g.unitMass}`));
      b.addEventListener('click', () => addGood(g));
      goodsRow.appendChild(b);
    }
    goodsBox.appendChild(goodsRow);

    const weightsBox = el('div', 'tr-palette');
    weightsBox.append(el('h4', undefined, 'Weights — onto the right pan'));
    const weightsRow = el('div', 'tr-chips');
    for (const w of weights) {
      const b = el('button', 'tr-weight') as HTMLButtonElement;
      b.type = 'button';
      b.textContent = String(w);
      b.setAttribute('aria-label', `Add a weight of ${w}`);
      b.addEventListener('click', () => addWeight(w));
      weightsRow.appendChild(b);
    }
    weightsBox.appendChild(weightsRow);
    palettes.append(goodsBox, weightsBox);

    wrap.append(goal, svg, readout, palettes);
    host.area.appendChild(wrap);

    const clear = button('Clear both pans', 'btn btn-ghost');
    clear.addEventListener('click', () => {
      if (solved) return;
      left.length = 0;
      right.length = 0;
      audio.click();
      renderLoads();
    });
    host.foot.appendChild(clear);

    // --------------------------------------------------------------- actions

    function addGood(g: Good): void {
      if (solved || left.length >= 60) return;
      left.push(g);
      audio.pluck(520 + Math.min(left.length, 20) * 8, 0.08);
      renderLoads();
    }
    function addWeight(w: number): void {
      if (solved || right.length >= 14) return;
      right.push(w);
      audio.arrowHit(true);
      renderLoads();
    }

    /** Draw whatever is on each pan, each item clickable to take it off again. */
    function renderLoads(): void {
      loadL.replaceChildren();
      loadR.replaceChildren();

      const tokens = left.length;
      const size = tokens <= 10 ? 24 : tokens <= 24 ? 17 : 13;
      const perRow = Math.max(4, Math.floor(130 / (size * 0.95)));
      left.forEach((g, i) => {
        const col = i % perRow;
        const rowIdx = Math.floor(i / perRow);
        const x = (col - (Math.min(perRow, tokens) - 1) / 2) * size * 0.95;
        const y = -6 - rowIdx * size * 0.92;
        const t = svgEl('text', { x, y, 'font-size': size, 'text-anchor': 'middle', class: 'tr-token' });
        t.textContent = g.glyph;
        t.addEventListener('click', () => {
          if (solved) return;
          left.splice(i, 1);
          audio.click();
          renderLoads();
        });
        loadL.appendChild(t);
      });

      // Weights are drawn as little stone cubes with their number, stacked in rows of three.
      right.forEach((w, i) => {
        const col = i % 3;
        const rowIdx = Math.floor(i / 3);
        const inRow = Math.min(3, right.length - rowIdx * 3);
        const x = (col - (inRow - 1) / 2) * 38;
        const y = -26 - rowIdx * 30;
        const g = svgEl('g', { transform: `translate(${x} ${y})`, class: 'tr-cube' });
        g.append(svgEl('rect', { x: -16, y: 0, width: 32, height: 24, rx: 3, class: 'tr-cube-face' }));
        g.append(svgEl('path', { d: 'M -16 0 L -10 -7 L 22 -7 L 16 0 Z', class: 'tr-cube-top' }));
        const label = svgEl('text', { x: 0, y: 17, 'text-anchor': 'middle', 'font-size': 14, class: 'tr-cube-num' });
        label.textContent = String(w);
        g.appendChild(label);
        g.addEventListener('click', () => {
          if (solved) return;
          right.splice(i, 1);
          audio.click();
          renderLoads();
        });
        loadR.appendChild(g);
      });

      leftRead.textContent = `Goods ${leftMass()}`;
      rightRead.textContent = `Weights ${rightMass()}`;
      evaluate();
    }

    // ---------------------------------------------------------------- physics

    let angle = 0;
    let velocity = 0;
    let settledFor = 0;
    let lastSide = 0;

    function targetAngle(): number {
      const diff = leftMass() - rightMass();
      // A little overshoot is visible for any imbalance; a big one tops out at the stops.
      const scale = Math.max(6, target * 0.35);
      return clamp((diff / scale) * 0.18, -MAX_ANGLE, MAX_ANGLE);
    }

    function draw(): void {
      // SVG rotation is clockwise-positive; a heavier left side (angle > 0) drops the left end.
      beam.setAttribute('transform', `rotate(${(-angle * 180) / Math.PI} ${PIVOT.x} ${PIVOT.y})`);
      // Left end drops when angle > 0.
      const lx = PIVOT.x - Math.cos(angle) * ARM;
      const ly = PIVOT.y + Math.sin(angle) * ARM;
      const rx = PIVOT.x + Math.cos(angle) * ARM;
      const ry = PIVOT.y - Math.sin(angle) * ARM;
      const drop = 96;
      panL.setAttribute('transform', `translate(${lx} ${ly + drop})`);
      panR.setAttribute('transform', `translate(${rx} ${ry + drop})`);
      stringsL.setAttribute('d', `M ${lx} ${ly} L ${lx - 70} ${ly + drop} M ${lx} ${ly} L ${lx + 70} ${ly + drop}`);
      stringsR.setAttribute('d', `M ${rx} ${ry} L ${rx - 70} ${ry + drop} M ${rx} ${ry} L ${rx + 70} ${ry + drop}`);
      levelMark.setAttribute('transform', `rotate(${(-angle * 180) / Math.PI} ${PIVOT.x} ${PIVOT.y})`);
    }

    animate(wrap, (dt) => {
      if (host.closed) return false;
      const snap = reducedMotion() ? targetAngle() : null;
      if (snap !== null) {
        angle = snap;
        velocity = 0;
      } else {
        // Damped spring toward the angle the weights ask for, in fixed small steps so a slow
        // frame never makes the beam unstable or the settle-time depend on the frame rate.
        const h = 1 / 120;
        for (let t = dt; t > 1e-6; t -= h) {
          const step = Math.min(h, t);
          velocity += (targetAngle() - angle) * 70 * step;
          velocity *= Math.exp(-4.2 * step);
          angle += velocity * step;
        }
      }
      const side = Math.sign(angle) * (Math.abs(angle) > 0.02 ? 1 : 0);
      if (side !== lastSide && lastSide !== 0 && side !== 0) audio.hover();
      lastSide = side;
      draw();

      // Balanced and settled for a beat: that is a delivery.
      const level = Math.abs(angle) < 0.012 && Math.abs(velocity) < 0.03;
      settledFor = level && leftMass() === rightMass() && leftMass() > 0 ? settledFor + dt : 0;
      if (!solved && settledFor > 0.55 && rightMass() === target) finish();
      return true;
    }, 0.25);

    // ------------------------------------------------------------ evaluating

    function evaluate(): void {
      const l = leftMass();
      const r = rightMass();
      if (right.length === 0) host.setStatus(`Choose weights that total ${target} for the right pan.`);
      else if (r !== target) {
        host.setStatus(r > target ? `The weights total ${r} — that is over ${target}. Take one off.` : `The weights total ${r}. You need ${target}.`);
      } else if (l < r) host.setStatus(`The weights are right (${target}). Add goods until the beam hangs level — ${r - l} more to go.`);
      else if (l > r) host.setStatus(`Too much on the left by ${l - r}. Click a token to take it off.`);
      else host.setStatus('Level. Hold still…');
    }
    evaluate();

    function finish(): void {
      solved = true;
      wrap.classList.add('solved');
      audio.success(5);
      const used = right.length;
      const extra = minWeights === null ? 0 : Math.max(0, used - minWeights);
      host.setStatus('Perfectly level. That is a fair weight.');
      window.setTimeout(
        () =>
          resolve({
            passed: true,
            score: clamp(100 - 15 * extra, 40, 100),
            stats: [
              `${used} weight${used === 1 ? '' : 's'} used`,
              minWeights !== null ? (extra === 0 ? 'The fewest possible' : `${minWeights} would have done it`) : 'Balanced',
            ],
          }),
        reducedMotion() ? 200 : 1100,
      );
    }

    renderLoads();
  });
}
