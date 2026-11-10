import type { DialogueNode } from '../content/types';
import { audio } from '../core/Audio';
import { voice, type SpeechHandle } from '../core/Voice';
import { el } from './overlay';

/**
 * The conversation box.
 *
 * Dialogue challenges are the game's main vehicle for ethics and
 * historiography — Vibhishana's choice, Ashoka after Kalinga, the Gita, the
 * three witnesses at Hampi. The box deliberately does not punish a "wrong"
 * answer: choices marked `wise` earn a note explaining why they are the better
 * reading, and the conversation continues either way, because an argument you
 * are allowed to lose teaches more than one you can fail.
 */

export interface DialogueOutcome {
  /** Vidya accumulated from nodes reached. */
  vidya: number;
  /** Codex entries unlocked along the way. */
  unlocks: string[];
  /** How many of the chosen options were marked as the better reading. */
  wiseChoices: number;
  choicesMade: number;
  /** True if the conversation reached a terminal node rather than being closed. */
  completed: boolean;
}

export interface Speaker {
  name: string;
  role: string;
  icon: string;
}

export class DialogueBox {
  private root: HTMLElement | null = null;
  private keyHandler: ((e: KeyboardEvent) => void) | null = null;
  private speech: SpeechHandle | null = null;

  get isOpen(): boolean {
    return this.root !== null;
  }

  run(speaker: Speaker, nodes: readonly DialogueNode[]): Promise<DialogueOutcome> {
    return new Promise((resolve) => {
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const outcome: DialogueOutcome = { vidya: 0, unlocks: [], wiseChoices: 0, choicesMade: 0, completed: false };

      const box = el('div', 'dialogue');
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-live', 'polite');
      document.body.appendChild(box);
      this.root = box;

      const head = el('div', 'dl-head');
      const avatar = el('div', 'dl-avatar', speaker.icon);
      const names = el('div');
      names.append(el('div', 'dl-name', speaker.name), el('div', 'dl-role', speaker.role));
      head.append(avatar, names);

      const text = el('p', 'dl-text');
      const choicesWrap = el('div', 'dl-choices');
      const nextHint = el('div', 'dl-next');

      box.append(head, text, choicesWrap, nextHint);

      let current: DialogueNode | null = nodes[0] ?? null;
      let pendingAdvance: (() => void) | null = null;

      const finish = (completed: boolean): void => {
        outcome.completed = completed;
        this.close();
        resolve(outcome);
      };

      const profile = voice.profileForSpeaker(speaker.name);
      const say = (line: string): void => {
        this.speech?.cancel();
        this.speech = voice.speak(line, profile);
      };

      const show = (node: DialogueNode): void => {
        current = node;
        pendingAdvance = null;

        if (node.vidya) outcome.vidya += node.vidya;
        for (const id of node.unlocks ?? []) if (!outcome.unlocks.includes(id)) outcome.unlocks.push(id);

        text.textContent = node.text;
        say(node.text);
        choicesWrap.replaceChildren();
        nextHint.textContent = '';

        if (node.choices && node.choices.length > 0) {
          node.choices.forEach((choice, i) => {
            const b = el('button', 'dl-choice') as HTMLButtonElement;
            b.type = 'button';
            b.append(el('span', undefined, String(i + 1)), el('span', undefined, choice.label));
            b.addEventListener('mouseenter', () => audio.hover());
            b.addEventListener('click', () => {
              audio.click();
              outcome.choicesMade++;
              if (choice.wise) {
                outcome.wiseChoices++;
                audio.pluck(392, 0.16);
              }

              // Show the immediate reply and the note, then continue.
              const parts: string[] = [];
              if (choice.reply) parts.push(choice.reply);
              if (choice.note) parts.push(`— ${choice.note}`);
              if (parts.length > 0) {
                text.textContent = parts.join('  ');
                if (choice.reply) say(choice.reply);
                choicesWrap.replaceChildren();
                nextHint.textContent = 'Press Enter to continue';
                pendingAdvance = () => goTo(choice.goto ?? node.goto ?? node.next ?? null);
              } else {
                goTo(choice.goto ?? node.goto ?? node.next ?? null);
              }
            });
            choicesWrap.appendChild(b);
          });
          return;
        }

        if (node.end) {
          nextHint.textContent = 'Press Enter to close';
          pendingAdvance = () => finish(true);
          return;
        }

        const next = node.goto ?? node.next ?? null;
        nextHint.textContent = 'Press Enter to continue';
        pendingAdvance = () => goTo(next);
      };

      const goTo = (id: string | null): void => {
        if (!id) {
          finish(true);
          return;
        }
        const node = byId.get(id);
        if (!node) {
          console.warn(`[Dialogue] missing node "${id}"`);
          finish(true);
          return;
        }
        show(node);
      };

      this.keyHandler = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          // Stop here, or the same press also reaches the game and opens the
          // pause menu behind the conversation we just closed.
          event.preventDefault();
          event.stopPropagation();
          finish(false);
          return;
        }
        if (event.key === 'Enter' || event.key === ' ') {
          if (pendingAdvance) {
            event.preventDefault();
            event.stopPropagation();
            const advance = pendingAdvance;
            pendingAdvance = null;
            advance();
          }
          return;
        }
        const n = Number(event.key);
        if (Number.isInteger(n) && n >= 1 && n <= 9) {
          const buttons = choicesWrap.querySelectorAll<HTMLButtonElement>('.dl-choice');
          buttons[n - 1]?.click();
        }
      };
      window.addEventListener('keydown', this.keyHandler, true);

      if (current) show(current);
      else finish(false);
    });
  }

  private close(): void {
    this.speech?.cancel();
    this.speech = null;
    if (this.keyHandler) {
      window.removeEventListener('keydown', this.keyHandler, true);
      this.keyHandler = null;
    }
    this.root?.remove();
    this.root = null;
  }
}
