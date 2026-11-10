import { audio } from '../core/Audio';
import type { CollectChallenge } from '../content/types';
import { el } from '../ui/overlay';
import { clamp, reducedMotion, sparkle } from './shared';
import type { GameHost, MiniGameResult } from './types';

/**
 * Gathering: tell the real from the look-alike.
 *
 * A meadow of plants, each labelled by name only. Pick the genuine ones into
 * the basket. A look-alike goes back with the reason it is wrong — toxic,
 * inert — because that reason is the lesson: classical texts spend so many
 * verses on identification precisely because the wrong plant can hurt.
 */

/** The label up to the dash — the name, without the clue after it. */
const nameOf = (label: string): string => label.split(/\s[—–-]\s/)[0] ?? label;
/** What follows the dash, if anything: why a decoy is a decoy. */
const reasonOf = (label: string): string | null => {
  const parts = label.split(/\s[—–-]\s/);
  return parts.length > 1 ? parts.slice(1).join(' — ') : null;
};

export function runCollect(challenge: CollectChallenge, host: GameHost): Promise<MiniGameResult> {
  return new Promise((resolve) => {
    const { items, need } = challenge.config;
    const taken = new Set<string>();
    let mistakes = 0;
    let done = false;

    host.setStatus(`Gather the ${need} genuine medicinal plants. Some of what grows here only looks right.`);

    const scene = el('div', 'co-scene');
    const field = el('div', 'co-field');
    const basket = el('div', 'co-basket');
    const slots: HTMLElement[] = [];
    basket.append(el('span', 'co-basket-label', 'Your basket'));
    for (let i = 0; i < need; i++) {
      const slot = el('span', 'co-slot');
      slots.push(slot);
      basket.appendChild(slot);
    }
    scene.append(field, basket);
    host.area.appendChild(scene);

    // Positions come from the world layout; map them onto the meadow with a margin.
    const xs = items.map((i) => i.pos[0]);
    const zs = items.map((i) => i.pos[2]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [z0, z1] = [Math.min(...zs), Math.max(...zs)];
    const place = (v: number, lo: number, hi: number): number => 8 + ((v - lo) / Math.max(1, hi - lo)) * 84;

    const plantEls = new Map<string, HTMLButtonElement>();
    items.forEach((item, i) => {
      const b = el('button', 'co-plant') as HTMLButtonElement;
      b.type = 'button';
      b.style.left = `${place(item.pos[0], x0, x1)}%`;
      b.style.top = `${place(item.pos[2], z0, z1)}%`;
      b.style.animationDelay = `${(i * 0.37) % 2.4}s`;
      b.append(el('span', 'co-glyph', item.glyph), el('span', 'co-name', nameOf(item.label)));
      b.addEventListener('click', () => pick(item.id, b));
      plantEls.set(item.id, b);
      field.appendChild(b);
    });

    function pick(id: string, node: HTMLButtonElement): void {
      if (done || taken.has(id)) return;
      const item = items.find((i) => i.id === id);
      if (!item) return;

      if (item.decoy) {
        mistakes++;
        audio.failure();
        node.classList.remove('shake');
        void node.offsetWidth;
        node.classList.add('shake', 'rejected');
        const why = reasonOf(item.label);
        host.setStatus(`${nameOf(item.label)}${why ? `: ${why}` : ' is a look-alike'}. Leave it where it grows.`);
        window.setTimeout(() => node.classList.remove('rejected'), 1600);
        return;
      }

      taken.add(id);
      audio.success(3);
      const slot = slots[taken.size - 1] as HTMLElement;
      // Fly the plant into its basket slot.
      const from = node.getBoundingClientRect();
      const to = slot.getBoundingClientRect();
      const s0 = scene.getBoundingClientRect();
      sparkle(scene, from.left - s0.left + from.width / 2, from.top - s0.top + from.height / 2, '#76bb5a');
      const glyph = node.querySelector('.co-glyph') as HTMLElement;
      slot.textContent = glyph.textContent;
      slot.classList.add('full', 'arrive');
      slot.title = nameOf(item.label);
      if (!reducedMotion()) {
        node.style.transition = 'transform 0.5s cubic-bezier(0.5,0,0.2,1), opacity 0.5s';
        node.style.transform = `translate(${to.left - from.left}px, ${to.top - from.top}px) scale(0.4)`;
        node.style.opacity = '0';
      } else node.style.display = 'none';
      node.disabled = true;
      host.setStatus(`${nameOf(item.label)} — genuine. ${taken.size} of ${need} gathered.`);

      if (taken.size >= need) {
        done = true;
        window.setTimeout(
          () =>
            resolve({
              passed: true,
              score: clamp(100 - 12 * mistakes, 40, 100),
              stats: [mistakes === 0 ? 'Not one look-alike picked' : `${mistakes} look-alike${mistakes === 1 ? '' : 's'} picked and put back`, `${need} genuine plants gathered`],
            }),
          reducedMotion() ? 200 : 1000,
        );
      }
    }
  });
}
