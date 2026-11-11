import { el } from './overlay';

/**
 * First steps: a short, gentle coach for someone who has never played.
 *
 * Five small tasks, one at a time, each ticked off by actually doing it: look around, walk, reach the gold
 * marker, scan something, open the map. It watches the game rather than asking for confirmation, waits while
 * dialogue or a menu is open, and can be skipped at any moment. It shows once; finishing or skipping it
 * remembers that in this browser.
 */

const DONE_KEY = 'bharat-gatha:coach-done';

export interface CoachFrame {
  /** True when the player is on the ground and free to act (not flying, in a menu or in a conversation). */
  active: boolean;
  yaw: number;
  /** Metres walked in total. */
  walked: number;
  /** Metres to the gold marker, or null when there is none. */
  markerDistance: number | null;
}

type Signal = 'scan' | 'map';

interface Step {
  id: string;
  title: string;
  hint: string;
  keys: string[];
  /** True once done, given the progress made since the step began. */
  done: (f: CoachFrame, base: { yaw: number; walked: number; signals: Set<Signal> }, state: { yawTravel: number }) => boolean;
}

const STEPS: Step[] = [
  {
    id: 'look',
    title: 'Look around',
    hint: 'Move the mouse to turn the camera.',
    keys: ['Mouse'],
    done: (_f, _b, s) => s.yawTravel > 1.1,
  },
  {
    id: 'walk',
    title: 'Walk forward',
    hint: 'Hold W to walk, and Shift to run.',
    keys: ['W', 'A', 'S', 'D'],
    done: (f, b) => f.walked - b.walked > 10,
  },
  {
    id: 'marker',
    title: 'Follow the gold marker',
    hint: 'The diamond floats over your next step. Walk up to it.',
    keys: ['◆'],
    // No marker (the player turned it off) means nothing to follow, so do not hold them here.
    done: (f) => f.markerDistance === null || f.markerDistance < 16,
  },
  {
    id: 'scan',
    title: 'Scan a monument',
    hint: 'Look at a monument and hold the right mouse button until the bar fills.',
    keys: ['Right mouse (hold)'],
    done: (_f, b) => b.signals.has('scan'),
  },
  {
    id: 'map',
    title: 'Open your map',
    hint: 'The map, the roadmap and what to do next are all one key away.',
    keys: ['M'],
    done: (_f, b) => b.signals.has('map'),
  },
];

export function coachFinished(): boolean {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

function remember(): void {
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* fine: it will simply offer itself again */
  }
}

export class Coach {
  private readonly root = el('aside', 'coach');
  private readonly tag = el('span', 'coach-tag');
  private readonly title = el('b', 'coach-title');
  private readonly hint = el('p', 'coach-hint');
  private readonly keys = el('div', 'coach-keys');
  private readonly dots = el('div', 'coach-dots');
  private readonly skip = el('button', 'coach-skip', 'Skip tutorial') as HTMLButtonElement;

  private running = false;
  private index = 0;
  private flash = 0;
  private lastYaw = 0;
  private yawTravel = 0;
  private base = { yaw: 0, walked: 0, signals: new Set<Signal>() };
  private seeded = false;

  constructor(parent: HTMLElement) {
    this.skip.type = 'button';
    const head = el('div', 'coach-head');
    head.append(this.tag, this.dots);
    this.root.append(head, this.title, this.hint, this.keys, this.skip);
    this.root.hidden = true;
    this.root.setAttribute('aria-live', 'polite');
    parent.append(this.root);
    this.skip.addEventListener('click', () => this.stop(true));
  }

  /** Begin, unless the player has been through it before. */
  start(force = false): void {
    if (this.running) return;
    if (!force && coachFinished()) return;
    this.running = true;
    this.index = 0;
    this.seeded = false;
    this.yawTravel = 0;
    this.base.signals.clear();
    this.render();
  }

  get isRunning(): boolean {
    return this.running;
  }

  /** Something the coach cannot see for itself happened. */
  notify(signal: Signal): void {
    if (this.running) this.base.signals.add(signal);
  }

  private stop(done: boolean): void {
    this.running = false;
    this.root.hidden = true;
    if (done) remember();
  }

  private render(): void {
    const step = STEPS[this.index] as Step;
    this.root.hidden = false;
    this.root.classList.remove('ok');
    this.tag.textContent = `First steps · ${this.index + 1} of ${STEPS.length}`;
    this.title.textContent = step.title;
    this.hint.textContent = step.hint;
    this.keys.replaceChildren(
      ...step.keys.map((k) => {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        return kbd;
      }),
    );
    this.dots.replaceChildren(
      ...STEPS.map((_, i) => {
        const d = el('i');
        if (i < this.index) d.className = 'done';
        else if (i === this.index) d.className = 'now';
        return d;
      }),
    );
    // Each step starts counting from where the player is now.
    this.seeded = false;
    this.yawTravel = 0;
    this.base.signals.delete('scan');
    this.base.signals.delete('map');
  }

  update(dt: number, f: CoachFrame): void {
    if (!this.running) return;
    // Hidden, not stopped, while a conversation or menu has the player's attention.
    this.root.classList.toggle('away', !f.active);
    if (!f.active) {
      this.lastYaw = f.yaw;
      return;
    }
    if (!this.seeded) {
      this.base.yaw = f.yaw;
      this.base.walked = f.walked;
      this.lastYaw = f.yaw;
      this.seeded = true;
    }
    let dy = f.yaw - this.lastYaw;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    this.yawTravel += Math.abs(dy);
    this.lastYaw = f.yaw;

    // A short pause on the tick, so completing something is seen.
    if (this.flash > 0) {
      this.flash -= dt;
      if (this.flash <= 0) {
        if (this.index < STEPS.length - 1) {
          this.index++;
          this.render();
        } else this.finish();
      }
      return;
    }
    const step = STEPS[this.index] as Step;
    if (step.done(f, this.base, { yawTravel: this.yawTravel })) {
      this.root.classList.add('ok');
      this.flash = 0.9;
    }
  }

  private finish(): void {
    this.tag.textContent = 'First steps · done';
    this.title.textContent = 'You’ve got the basics';
    this.hint.textContent = 'The Next step card on the right will keep guiding you. Press F1 any time for the full guide.';
    this.keys.replaceChildren();
    this.dots.replaceChildren(...STEPS.map(() => Object.assign(el('i'), { className: 'done' })));
    this.root.classList.add('ok');
    remember();
    this.running = false;
    window.setTimeout(() => {
      this.root.hidden = true;
    }, 6500);
  }
}
