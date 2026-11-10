import { audio } from '../core/Audio';
import type { PatternChallenge } from '../content/types';
import { button, el } from '../ui/overlay';
import { clamp, reducedMotion } from './shared';
import { expectedDesign } from './symmetry';
import type { GameHost, MiniGameResult } from './types';

/**
 * Pattern: complete a design under a symmetry.
 *
 * The cells you are given are locked; the rest of the design is whatever those
 * cells imply once the symmetry is applied. Painting is the whole interaction —
 * drag across cells to paint, right-click or the eraser to clear — and the
 * check says how many cells are wrong without saying which of the missing ones
 * is missing. A finished design then proves its own symmetry: a rotational one
 * turns a full circle and looks the same at every quarter, a mirrored one flips.
 */

type Symmetry = PatternChallenge['config']['symmetry'];

const hex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`;

export function runPattern(challenge: PatternChallenge, host: GameHost): Promise<MiniGameResult> {
  return new Promise((resolve) => {
    const { gridSize: n, palette, given, symmetry } = challenge.config;
    const { cells: expected } = expectedDesign(challenge.config);
    const locked = new Set(given.map(([x, y]) => `${x},${y}`));

    /** What is painted now, including the locked cells. */
    const painted = new Map<string, number>();
    for (const [x, y, c] of given) painted.set(`${x},${y}`, c);

    let colour = 0;
    let checks = 0;
    let solved = false;
    let guides = false;

    const SYMMETRY_WORDS: Record<Symmetry, string> = {
      mirror: 'Every cell must be matched by its reflection across the vertical line.',
      fourfold: 'Every cell must be matched in all four quadrants, reflected across both lines.',
      rotational: 'Every cell must be matched at each quarter-turn about the centre.',
    };
    host.setStatus(`${SYMMETRY_WORDS[symmetry]} Paint the cells the symmetry demands.`);

    const wrap = el('div', 'pt-wrap');
    const stage = el('div', 'pt-stage');
    const grid = el('div', 'pt-grid');
    grid.setAttribute('role', 'grid');
    grid.style.setProperty('--n', String(n));
    const guideEl = el('div', 'pt-guides');
    guideEl.dataset.sym = symmetry;
    stage.append(grid, guideEl);

    const side = el('div', 'pt-side');
    const swatches = el('div', 'pt-swatches');
    side.append(el('h4', undefined, 'Colours'), swatches);

    const cellEls = new Map<string, HTMLButtonElement>();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const key = `${x},${y}`;
        const cell = el('button', 'pt-cell') as HTMLButtonElement;
        cell.type = 'button';
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.tabIndex = x === 0 && y === 0 ? 0 : -1;
        cell.setAttribute('aria-label', `Row ${y + 1}, column ${x + 1}`);
        if (locked.has(key)) cell.classList.add('locked');
        cellEls.set(key, cell);
        grid.appendChild(cell);
      }
    }

    const swatchEls: HTMLButtonElement[] = [];
    palette.forEach((c, i) => {
      const b = el('button', 'pt-swatch') as HTMLButtonElement;
      b.type = 'button';
      b.style.background = hex(c);
      b.setAttribute('aria-label', `Colour ${i + 1}`);
      b.append(el('span', 'pt-swatch-key', String(i + 1)));
      b.addEventListener('click', () => choose(i));
      swatchEls.push(b);
      swatches.appendChild(b);
    });
    const eraser = el('button', 'pt-swatch pt-eraser') as HTMLButtonElement;
    eraser.type = 'button';
    eraser.textContent = '⌫';
    eraser.setAttribute('aria-label', 'Eraser');
    eraser.addEventListener('click', () => choose(-1));
    swatches.appendChild(eraser);

    const guideToggle = button('Show the lines of symmetry', 'btn btn-ghost pt-guide-btn');
    guideToggle.addEventListener('click', () => {
      guides = !guides;
      guideEl.classList.toggle('on', guides);
      guideToggle.textContent = guides ? 'Hide the lines of symmetry' : 'Show the lines of symmetry';
      audio.click();
    });
    side.appendChild(guideToggle);

    wrap.append(stage, side);
    host.area.appendChild(wrap);

    function choose(i: number): void {
      colour = i;
      swatchEls.forEach((b, j) => b.classList.toggle('on', j === i));
      eraser.classList.toggle('on', i === -1);
      audio.click();
    }
    choose(0);

    // -------------------------------------------------------------- painting

    function paint(x: number, y: number, erase: boolean): void {
      const key = `${x},${y}`;
      if (solved || locked.has(key)) return;
      const cell = cellEls.get(key) as HTMLElement;
      if (erase || colour === -1) painted.delete(key);
      else painted.set(key, colour);
      renderCell(key);
      cell.classList.remove('wrong');
      audio.hover();
    }

    function renderCell(key: string): void {
      const cell = cellEls.get(key) as HTMLElement;
      const c = painted.get(key);
      cell.style.background = c === undefined ? '' : hex(palette[c] as number);
      cell.classList.toggle('filled', c !== undefined);
    }
    for (const key of cellEls.keys()) renderCell(key);

    let drawing = false;
    let erasing = false;
    grid.addEventListener('contextmenu', (e) => e.preventDefault());
    grid.addEventListener('pointerdown', (e) => {
      const cell = (e.target as HTMLElement).closest('.pt-cell') as HTMLElement | null;
      if (!cell) return;
      e.preventDefault();
      drawing = true;
      erasing = e.button === 2;
      grid.setPointerCapture(e.pointerId);
      paint(Number(cell.dataset.x), Number(cell.dataset.y), erasing);
    });
    grid.addEventListener('pointermove', (e) => {
      if (!drawing) return;
      const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.pt-cell') as HTMLElement | null;
      if (under) paint(Number(under.dataset.x), Number(under.dataset.y), erasing);
    });
    const stop = (): void => {
      drawing = false;
    };
    grid.addEventListener('pointerup', stop);
    grid.addEventListener('pointercancel', stop);

    // Keyboard: arrows move, Space paints, Delete clears, 1–9 choose a colour.
    grid.addEventListener('keydown', (e) => {
      const cell = (e.target as HTMLElement).closest('.pt-cell') as HTMLElement | null;
      if (!cell) return;
      let x = Number(cell.dataset.x);
      let y = Number(cell.dataset.y);
      const digit = Number(e.key);
      if (Number.isInteger(digit) && digit >= 1 && digit <= palette.length) {
        e.stopPropagation();
        choose(digit - 1);
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        paint(x, y, false);
        return;
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        paint(x, y, true);
        return;
      }
      const move: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      const d = move[e.key];
      if (!d) return;
      e.preventDefault();
      x = clamp(x + d[0], 0, n - 1);
      y = clamp(y + d[1], 0, n - 1);
      for (const c of cellEls.values()) c.tabIndex = -1;
      const next = cellEls.get(`${x},${y}`) as HTMLButtonElement;
      next.tabIndex = 0;
      next.focus();
    });

    // ----------------------------------------------------------------- check

    const check = button('Check the pattern', 'btn btn-primary');
    check.addEventListener('click', () => {
      if (solved) return;
      checks++;
      for (const c of cellEls.values()) c.classList.remove('wrong');

      let wrong = 0;
      let missing = 0;
      for (let y = 0; y < n; y++) {
        for (let x = 0; x < n; x++) {
          const key = `${x},${y}`;
          const want = expected.get(key);
          const have = painted.get(key);
          if (want === have) continue;
          if (have !== undefined) {
            wrong++;
            cellEls.get(key)?.classList.add('wrong');
          } else missing++;
        }
      }
      if (wrong === 0 && missing === 0) return solve();
      audio.failure();
      const parts: string[] = [];
      if (wrong > 0) parts.push(`${wrong} painted cell${wrong === 1 ? ' is' : 's are'} wrong (outlined in red)`);
      if (missing > 0) parts.push(`${missing} cell${missing === 1 ? ' is' : 's are'} still empty that the symmetry needs`);
      host.setStatus(`${parts.join(', and ')}. Nothing is lost — fix them and check again.`);
    });
    const clearBtn = button('Clear my cells', 'btn btn-ghost');
    clearBtn.addEventListener('click', () => {
      if (solved) return;
      for (const key of [...painted.keys()]) if (!locked.has(key)) painted.delete(key);
      for (const key of cellEls.keys()) {
        renderCell(key);
        cellEls.get(key)?.classList.remove('wrong');
      }
      audio.click();
    });
    host.foot.append(clearBtn, check);

    // ----------------------------------------------------------------- solve

    function solve(): void {
      solved = true;
      host.setStatus(
        symmetry === 'rotational' ? 'Complete. Watch it turn: it looks the same at every quarter.' : 'Complete. Watch it flip: it looks the same reflected.',
      );
      audio.success(5);

      // A wave of light from the centre outward, then the design proves its symmetry.
      const centre = (n - 1) / 2;
      for (const [key, cell] of cellEls) {
        const [x, y] = key.split(',').map(Number) as [number, number];
        const d = Math.hypot(x - centre, y - centre);
        cell.style.animationDelay = `${reducedMotion() ? 0 : d * 90}ms`;
        cell.classList.add('wave');
      }
      const after = reducedMotion() ? 0 : (centre * 1.45 * 90) + 500;
      window.setTimeout(() => {
        if (!reducedMotion()) {
          grid.classList.add(symmetry === 'rotational' ? 'spin' : 'flip');
        }
        window.setTimeout(
          () =>
            resolve({
              passed: true,
              score: clamp(100 - 12 * (checks - 1), 40, 100),
              stats: [checks === 1 ? 'Right on the first check' : `Got it on check ${checks}`],
            }),
          reducedMotion() ? 200 : 2600,
        );
      }, after);
    }
  });
}
