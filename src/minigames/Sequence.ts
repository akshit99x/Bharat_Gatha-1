import { audio } from '../core/Audio';
import type { SequenceChallenge } from '../content/types';
import { button, el } from '../ui/overlay';
import { clamp, reducedMotion, shuffledNotSolved, sparkle } from './shared';
import type { GameHost, MiniGameResult } from './types';

/**
 * Sequencing.
 *
 * Drag the cards into chronological order. Checking tells you how many are in
 * the right place — never which, so it has to be reasoned out, not brute-forced
 * — and nothing is lost for being wrong. On success the timeline unfolds, each
 * card revealing its date and the one-line detail, because the detail is the
 * point: the order is only worth getting right if you then know why.
 */

type Item = SequenceChallenge['config']['items'][number];

const GAP = 10;

export function runSequence(challenge: SequenceChallenge, host: GameHost): Promise<MiniGameResult> {
  return new Promise((resolve) => {
    const correct = challenge.config.items;
    let order: Item[] = shuffledNotSolved(correct, challenge.id, (a, b) => a.id === b.id);
    let attempts = 0;
    let solved = false;
    let grabbed: string | null = null;

    host.setStatus('Drag the cards — or focus one, press Space, and use the arrow keys — into the order they happened.');

    const list = el('div', 'sq-list');
    list.setAttribute('role', 'list');
    host.area.appendChild(list);

    const cards = new Map<string, HTMLElement>();
    for (const item of correct) {
      const card = el('div', 'sq-card');
      card.setAttribute('role', 'listitem');
      card.tabIndex = 0;
      card.dataset.id = item.id;

      const num = el('span', 'sq-num');
      const body = el('div', 'sq-body');
      const label = el('div', 'sq-label', item.label);
      const when = el('div', 'sq-when', item.when);
      const detail = el('div', 'sq-detail', item.detail);
      body.append(label, when, detail);

      const grip = el('span', 'sq-grip', '⋮⋮');
      grip.setAttribute('aria-hidden', 'true');
      const arrows = el('div', 'sq-arrows');
      const up = button('▲', 'sq-arrow');
      const down = button('▼', 'sq-arrow');
      up.setAttribute('aria-label', `Move “${item.label}” earlier`);
      down.setAttribute('aria-label', `Move “${item.label}” later`);
      up.addEventListener('click', () => move(item.id, -1));
      down.addEventListener('click', () => move(item.id, 1));
      arrows.append(up, down);

      card.append(num, grip, body, arrows);
      cards.set(item.id, card);
      list.appendChild(card);
      bindDrag(card, item.id);
      bindKeys(card, item.id);
    }

    // ---------------------------------------------------------------- layout

    /** Stack the cards in `order`, animating anything that moved. `skip` is the card under the pointer. */
    function layout(skip?: string): void {
      let y = 0;
      order.forEach((item, i) => {
        const card = cards.get(item.id) as HTMLElement;
        (card.querySelector('.sq-num') as HTMLElement).textContent = String(i + 1);
        if (item.id !== skip) card.style.transform = `translateY(${y}px)`;
        card.dataset.slot = String(i);
        y += card.offsetHeight + GAP;
      });
      list.style.height = `${Math.max(0, y - GAP)}px`;
    }
    const onResize = (): void => layout();
    window.addEventListener('resize', onResize);
    host.onDispose(() => window.removeEventListener('resize', onResize));
    requestAnimationFrame(() => layout());

    function move(id: string, by: number): void {
      if (solved) return;
      const from = order.findIndex((o) => o.id === id);
      const to = clamp(from + by, 0, order.length - 1);
      if (from === to) return;
      const [item] = order.splice(from, 1);
      order.splice(to, 0, item as Item);
      clearMarks();
      layout();
      audio.click();
      (cards.get(id) as HTMLElement).focus({ preventScroll: true });
    }

    // ------------------------------------------------------------------ drag

    function bindDrag(card: HTMLElement, id: string): void {
      card.addEventListener('pointerdown', (e) => {
        if (solved || (e.target as HTMLElement).closest('.sq-arrow')) return;
        e.preventDefault();
        card.setPointerCapture(e.pointerId);
        const box = card.getBoundingClientRect();
        const listBox = list.getBoundingClientRect();
        const grabY = e.clientY - box.top;
        card.classList.add('dragging');
        card.style.transition = 'none';
        audio.hover();
        clearMarks();

        const onMove = (ev: PointerEvent): void => {
          const y = clamp(ev.clientY - listBox.top - grabY, -8, list.offsetHeight - card.offsetHeight + 8);
          card.style.transform = `translateY(${y}px) scale(1.02)`;
          // Where would it land? Compare its centre with the others' centres.
          const centre = y + card.offsetHeight / 2;
          const others = order.filter((o) => o.id !== id);
          let slot = 0;
          let acc = 0;
          for (const o of others) {
            const h = (cards.get(o.id) as HTMLElement).offsetHeight;
            if (centre > acc + h / 2) slot++;
            acc += h + GAP;
          }
          const from = order.findIndex((o) => o.id === id);
          if (slot !== from) {
            const [item] = order.splice(from, 1);
            order.splice(slot, 0, item as Item);
            layout(id);
            audio.hover();
          }
        };
        const onUp = (): void => {
          card.releasePointerCapture(e.pointerId);
          card.removeEventListener('pointermove', onMove);
          card.removeEventListener('pointerup', onUp);
          card.removeEventListener('pointercancel', onUp);
          card.classList.remove('dragging');
          card.style.transition = '';
          layout();
          audio.click();
        };
        card.addEventListener('pointermove', onMove);
        card.addEventListener('pointerup', onUp);
        card.addEventListener('pointercancel', onUp);
      });
    }

    function bindKeys(card: HTMLElement, id: string): void {
      card.addEventListener('keydown', (e) => {
        if (solved) return;
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          e.stopPropagation();
          grabbed = grabbed === id ? null : id;
          card.classList.toggle('grabbed', grabbed === id);
          if (grabbed === id) host.setStatus('Picked up. Arrow keys move it; Space puts it down.');
          else host.setStatus('Put down. Check the order when you are ready.');
          return;
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          if (grabbed === id || e.shiftKey) {
            e.preventDefault();
            move(id, e.key === 'ArrowUp' ? -1 : 1);
          }
        }
      });
    }

    // ----------------------------------------------------------------- check

    function clearMarks(): void {
      for (const card of cards.values()) card.classList.remove('right', 'wrong');
    }

    const check = button('Check the order', 'btn btn-primary');
    check.addEventListener('click', () => {
      if (solved) return;
      attempts++;
      let right = 0;
      order.forEach((item, i) => {
        const card = cards.get(item.id) as HTMLElement;
        const ok = correct[i]?.id === item.id;
        card.classList.toggle('right', ok);
        card.classList.toggle('wrong', !ok);
        if (ok) right++;
      });
      if (right === order.length) return solve();
      audio.failure();
      host.setStatus(`${right} of ${order.length} are in the right place. Nothing is lost — move the others and check again.`);
    });
    host.foot.appendChild(check);

    // ----------------------------------------------------------------- solve

    function solve(): void {
      solved = true;
      host.setStatus('That is the order. Read what happened at each step.');
      audio.success(5);
      list.classList.add('solved');

      // Unfold the timeline: each card opens to show its date and detail, one after another.
      order.forEach((item, i) => {
        const card = cards.get(item.id) as HTMLElement;
        window.setTimeout(
          () => {
            card.classList.remove('wrong');
            card.classList.add('right', 'open');
            layout();
            const box = card.getBoundingClientRect();
            const host0 = list.getBoundingClientRect();
            sparkle(list, box.left - host0.left + 26, box.top - host0.top + 24);
            audio.pluck(330 + i * 55, 0.14);
          },
          reducedMotion() ? 0 : 260 + i * 240,
        );
      });

      const wait = reducedMotion() ? 0 : 260 + order.length * 240 + 300;
      window.setTimeout(() => {
        host.foot.replaceChildren();
        const done = button('Continue', 'btn btn-primary');
        done.addEventListener('click', () =>
          resolve({
            passed: true,
            score: clamp(100 - 12 * (attempts - 1), 40, 100),
            stats: [attempts === 1 ? 'Right on the first check' : `Got it on check ${attempts}`],
          }),
        );
        host.foot.appendChild(done);
        done.focus();
      }, wait);
    }
  });
}
