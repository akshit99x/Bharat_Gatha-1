import { ZONES } from '../content/zones';
import { ALL_PLAQUES } from '../content/story';
import { audio } from '../core/Audio';
import { buildPanel, button, closeOverlay, el, mountOverlay } from './overlay';

/**
 * The guide: what the game is, what you do in it, how to move, and how not to get lost.
 *
 * It is one pager, used in three places: on the title screen before the first click, from the pause menu,
 * and on F1. Numbers are counted from the game's own content, so the guide cannot drift out of date.
 * Everything here is written for someone who has never seen the game and is about to play it.
 */

const SEEN_KEY = 'bharat-gatha:intro-seen';

export function hasSeenIntro(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markSeen(): void {
  try {
    localStorage.setItem(SEEN_KEY, '1');
  } catch {
    /* private window: the guide simply offers itself again next time */
  }
}

interface Page {
  icon: string;
  title: string;
  lead: string;
  build: (body: HTMLElement) => void;
}

function keys(...caps: string[]): HTMLElement {
  const wrap = el('span', 'htp-keys');
  caps.forEach((cap, i) => {
    if (i > 0 && cap !== '+' && caps[i - 1] !== '+') wrap.append(' ');
    if (cap === '+') {
      wrap.append(el('span', 'htp-plus', '+'));
      return;
    }
    const k = document.createElement('kbd');
    k.textContent = cap;
    wrap.append(k);
  });
  return wrap;
}

function para(text: string): HTMLElement {
  return el('p', 'htp-p', text);
}

function stat(value: string | number, label: string): HTMLElement {
  const s = el('div', 'htp-stat');
  s.append(el('b', undefined, String(value)), el('span', undefined, label));
  return s;
}

function stepCard(n: number | string, title: string, text: string, tail?: HTMLElement): HTMLElement {
  const card = el('div', 'htp-step');
  card.append(el('span', 'htp-n', String(n)));
  const copy = el('div');
  copy.append(el('b', undefined, title), el('p', undefined, text));
  if (tail) copy.append(tail);
  card.append(copy);
  return card;
}

function pages(): Page[] {
  const landmarks = ZONES.reduce((n, z) => n + z.landmarks.length, 0);
  const people = ZONES.reduce((n, z) => n + z.npcs.length, 0);
  const challenges = ZONES.reduce((n, z) => n + z.challenges.length, 0);

  return [
    {
      icon: '📜',
      title: 'Welcome, Gathak',
      lead: 'You are about to land on a painted scroll.',
      build: (body) => {
        body.append(
          para(
            'Bharat Gatha is an open-world game about Indian history. The island you are about to land on is a scroll, the Gatha, and each region of it is one era: from the planned cities of the Indus to the hill forts of the Marathas.',
          ),
          para(
            'Most of the scroll is painted clearly. Some of it is covered in a grey haze called the Dhundh. The Dhundh does one thing to a story: it makes it simple, either a fairy tale or a shrug. It cannot survive one question: how do we know that?',
          ),
          para(
            'You are the Gathak, the one who reads. Your job is to walk through each era, look at what the evidence really says, and lift the haze. Maitri, keeper of the Gatha, will guide you.',
          ),
        );
        const stats = el('div', 'htp-stats');
        stats.append(
          stat(ZONES.length, 'eras'),
          stat(landmarks, 'monuments'),
          stat(people, 'people to meet'),
          stat(challenges, 'challenges'),
          stat(ALL_PLAQUES.length, 'claims to check'),
        );
        body.append(stats);
        body.append(para('There is no way to lose and nothing is taken away for a wrong answer. A wrong answer is explained, and you try again.'));
      },
    },
    {
      icon: '🧭',
      title: 'What you do',
      lead: 'Each region works the same way. Six things, in roughly this order.',
      build: (body) => {
        const list = el('div', 'htp-steps');
        list.append(
          stepCard(1, 'Explore', 'Walk, run and ride chariots across the island. Every region has its own look, its own sounds and its own music.'),
          stepCard(2, 'Scan monuments', 'Hold the right mouse button while looking at a monument. The Pramana lens scans it and adds a codex entry that explains how we know what we know about it.', keys('Right mouse (hold)')),
          stepCard(3, 'Talk to people', 'Walk up to someone and press E. People with a gold ★ nameplate carry the chapter’s story.', keys('E')),
          stepCard(4, 'Play the challenges', 'Glowing posts start short games: building, trading, archery, reading scripts, sorting events in order and more. They teach by doing.'),
          stepCard(5, 'Correct the plaques', 'Weathered plaques wrapped in haze repeat popular claims. Read the codex evidence they need, then say where the honest version of the claim belongs.'),
          stepCard(6, 'Seal the chapter, restore the panel', 'Take the chapter assessment, then open the Gatha and restore its painted panel. Restore enough panels and the Sabha of Sources opens: the finale.', keys('K')),
        );
        body.append(list);
      },
    },
    {
      icon: '⌨️',
      title: 'Controls',
      lead: 'Keyboard and mouse. The game plays best with both.',
      build: (body) => {
        const groups: Array<[string, Array<[string, HTMLElement]>]> = [
          [
            'Move',
            [
              ['Walk', keys('W', 'A', 'S', 'D')],
              ['Run', keys('Shift')],
              ['Crouch', keys('Ctrl')],
              ['Jump (and hop onto low ledges just by walking at them)', keys('Space')],
              ['Look around', keys('Mouse')],
              ['Switch between over-the-shoulder and first person', keys('V')],
            ],
          ],
          [
            'Do things',
            [
              ['Talk, read, start a challenge, press a button', keys('E')],
              ['Scan a monument', keys('Right mouse (hold)')],
              ['Get on or off a chariot', keys('R')],
              ['Drive a chariot', keys('W', 'S', 'A', 'D')],
              ['Answer a question', keys('1', '2', '3', '4')],
              ['Continue or skip a line of speech', keys('Enter')],
            ],
          ],
          [
            'Menus',
            [
              ['Map, roadmap and what to do next', keys('M')],
              ['Codex: everything you have scanned', keys('J')],
              ['The Gatha: your scroll, plaques and story', keys('K')],
              ['This guide', keys('F1')],
              ['Pause, settings, volume', keys('Esc')],
            ],
          ],
        ];
        for (const [name, rows] of groups) {
          body.append(el('h4', 'htp-h', name));
          const grid = el('div', 'htp-keyrows');
          for (const [label, cap] of rows) {
            const row = el('div', 'htp-keyrow');
            row.append(el('span', undefined, label), cap);
            grid.append(row);
          }
          body.append(grid);
        }
      },
    },
    {
      icon: '🚀',
      title: 'Your first ten minutes',
      lead: 'Follow these and you will not be lost.',
      build: (body) => {
        const list = el('div', 'htp-steps');
        list.append(
          stepCard(1, 'Board the Pushpaka Vimana', 'The title screen’s big button starts a short flight over the whole island, so you can see where everything is before you choose.'),
          stepCard(2, 'Drop where you like', 'Press Space to leap out. Gentle descent is on by default, so the glider opens by itself and falling never hurts. Any region is a fine place to start, and the first chapter is the Indus cities.', keys('Space')),
          stepCard(3, 'Listen to Maitri', 'Lines appear at the bottom and are read aloud. Press Enter to finish a line, and again to move on.', keys('Enter')),
          stepCard(4, 'Follow the gold marker', 'A gold diamond floats over the next thing to do, with its distance. The “Next step” card at the top right says what it is and how to do it. A short First steps coach also walks you through the basics.'),
          stepCard(5, 'Do it, then look again', 'Scan the monument, talk to the person, start the challenge. When you finish, the marker moves on to the next thing.'),
          stepCard(6, 'Press M whenever you are unsure', 'It shows your map, every chapter’s roadmap, and exactly what to do next.', keys('M')),
        );
        body.append(list);
      },
    },
    {
      icon: '🗺️',
      title: 'Finding your way',
      lead: 'Four things always tell you where to go.',
      build: (body) => {
        const list = el('div', 'htp-steps');
        list.append(
          stepCard('◆', 'The gold marker', 'In the world, over the next thing to do. If it is off screen, an arrow at the edge of the screen points toward it. Press T to hide or show it.', keys('T')),
          stepCard('▤', 'The Next step card', 'Top right, above the chapter checklist: what to do now, how to do it, and how far away it is. It changes as you finish things.'),
          stepCard('◎', 'The minimap and compass', 'The minimap, top right: gold diamonds are monuments, orange are challenges, teal are people, and the legend under it says the rest. The compass strip across the top shows places ahead of you.'),
          stepCard('M', 'The Journey screen', 'Three tabs. Map: the whole island, where you have been, and fast travel to any landing terrace you have discovered. Roadmap: all eleven chapters and what each still needs. Guide: your first steps, ticked off as you do them.', keys('M')),
        );
        body.append(list);
        body.append(para('Lost completely? Open the map, choose a region you have discovered, and travel there. Nothing is ever missed: everything stays where it is until you come back.'));
      },
    },
    {
      icon: '✨',
      title: 'Good to know',
      lead: 'A few things that make it easier.',
      build: (body) => {
        const list = el('div', 'htp-steps');
        list.append(
          stepCard('✦', 'Vidya', 'Points for learning. You earn them by scanning, talking, playing and getting claims right. They are never taken away, and there is no timer.'),
          stepCard('💾', 'It saves itself', 'Your progress is stored in this browser as you play. “Continue journey” on the title screen picks up where you stopped.'),
          stepCard('🔊', 'Headphones help', 'Every region has its own music and its own sounds of place: water at stepwells, bells at temples, surf at harbours. People speak their lines aloud; Settings lets you change the voice, the volume, or turn speech off.'),
          stepCard('♿', 'Comfort and access', 'Press Esc for the menu and settings: dyslexia-friendly text, high contrast, head movement, mouse sensitivity, shadows and more. If the game runs slowly, turn off Cinematic lighting.'),
          stepCard('🎓', 'Wrong answers teach', 'Every answer is explained. A claim you judge wrongly comes back once with the evidence set out.'),
        );
        body.append(list);
      },
    },
  ];
}

export interface HowToPlayOptions {
  /** Shown from the title screen: the last page offers to start the game. */
  fromTitle?: boolean;
  onStart?: () => void;
  onClose?: () => void;
  startPage?: number;
}

/** Open the guide. Esc or ✕ closes it. */
export function presentHowToPlay(opts: HowToPlayOptions = {}): void {
  const all = pages();
  let index = Math.max(0, Math.min(all.length - 1, opts.startPage ?? 0));

  const { panel, body, foot } = buildPanel({
    title: 'How to play',
    subtitle: 'Bharat Gatha in five minutes',
    width: 'normal',
    closable: true,
    onClose: () => finish(false),
  });
  panel.classList.add('htp');

  const stage = el('div', 'htp-stage');
  body.append(stage);

  const dots = el('div', 'htp-dots');
  dots.setAttribute('role', 'tablist');
  const back = button('Back', 'btn btn-ghost');
  const next = button('Next', 'btn btn-primary');
  foot.append(back, dots, next);

  const finish = (start: boolean): void => {
    markSeen();
    closeOverlay();
    if (start) opts.onStart?.();
    else opts.onClose?.();
  };

  const render = (): void => {
    const page = all[index] as Page;
    stage.replaceChildren();
    const head = el('div', 'htp-head');
    head.append(el('span', 'htp-icon', page.icon));
    const titles = el('div');
    titles.append(el('h3', undefined, page.title), el('p', 'htp-lead', page.lead));
    head.append(titles);
    const content = el('div', 'htp-content');
    page.build(content);
    stage.append(head, content);
    stage.scrollTop = 0;
    body.scrollTop = 0;
    stage.classList.remove('htp-in');
    void stage.offsetWidth;
    stage.classList.add('htp-in');

    dots.replaceChildren(
      ...all.map((p, i) => {
        const d = el('button', 'htp-dot') as HTMLButtonElement;
        d.type = 'button';
        d.setAttribute('role', 'tab');
        d.setAttribute('aria-label', `Page ${i + 1}: ${p.title}`);
        d.setAttribute('aria-selected', String(i === index));
        d.addEventListener('click', () => {
          index = i;
          audio.click();
          render();
        });
        return d;
      }),
    );

    back.disabled = index === 0;
    const last = index === all.length - 1;
    next.textContent = last ? (opts.fromTitle ? 'Board the Pushpaka Vimana' : 'Got it') : 'Next';
  };

  back.addEventListener('click', () => {
    if (index > 0) index--;
    audio.click();
    render();
  });
  next.addEventListener('click', () => {
    audio.click();
    if (index < all.length - 1) {
      index++;
      render();
    } else finish(!!opts.fromTitle);
  });

  // Arrow keys turn the pages; Esc closes (handled by the overlay).
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === 'PageDown') {
      if (index < all.length - 1) {
        index++;
        render();
      }
      e.preventDefault();
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'PageUp') {
      if (index > 0) {
        index--;
        render();
      }
      e.preventDefault();
    }
  };
  panel.addEventListener('keydown', onKey);

  render();
  mountOverlay('howto', panel, { onEscape: () => finish(false) });
  next.focus();
}
