import { audio } from '../core/Audio';
import type { ChallengeSpec } from '../content/types';
import { buildPanel, button, closeOverlay, el, mountOverlay } from '../ui/overlay';
import type { GameHost, MiniGameResult } from './types';
import { runSequence } from './Sequence';
import { runScriptMatch } from './ScriptMatch';
import { runAssembly } from './Assembly';
import { runTrade } from './Trade';
import { runPattern } from './Pattern';
import { runArchery } from './Archery';
import { runCollect } from './Collect';

/**
 * The mini-game manager.
 *
 * Opens a shell around a challenge, hands the area to the right runner, shows a
 * result card, and offers another round if the last one was not passed. Returns
 * the final result, or null if the player left without finishing.
 */

const KIND_LABEL: Record<ChallengeSpec['kind'], string> = {
  archery: 'Archery',
  assembly: 'Assembly',
  pattern: 'Pattern',
  scriptMatch: 'Script matching',
  trade: 'Trade and weights',
  sequence: 'Sequencing',
  collect: 'Gathering',
  dialogue: 'Conversation',
};

type Runner = (challenge: ChallengeSpec, host: GameHost) => Promise<MiniGameResult>;

const RUNNERS: Partial<Record<ChallengeSpec['kind'], Runner>> = {
  sequence: runSequence as Runner,
  scriptMatch: runScriptMatch as Runner,
  assembly: runAssembly as Runner,
  trade: runTrade as Runner,
  pattern: runPattern as Runner,
  archery: runArchery as Runner,
  collect: runCollect as Runner,
};

export class MiniGames {
  /** True if this kind has a playable game. Anything else falls back to the brief-and-quiz flow. */
  has(kind: ChallengeSpec['kind']): boolean {
    return RUNNERS[kind] !== undefined;
  }

  run(challenge: ChallengeSpec): Promise<MiniGameResult | null> {
    const runner = RUNNERS[challenge.kind];
    if (!runner) return Promise.resolve(null);

    return new Promise((resolve) => {
      let closed = false;
      const disposers: Array<() => void> = [];
      const dispose = (): void => {
        for (const d of disposers.splice(0)) d();
      };
      const leave = (result: MiniGameResult | null): void => {
        if (closed) return;
        closed = true;
        dispose();
        closeOverlay();
        resolve(result);
      };

      const { panel, body, foot } = buildPanel({
        title: challenge.name,
        subtitle: KIND_LABEL[challenge.kind],
        width: 'wide',
        closable: true,
        onClose: () => leave(null),
      });
      panel.classList.add('mg-panel');

      // The brief, with the hint a click away. Never shown as a wall of text.
      const brief = el('div', 'mg-brief');
      const task = el('p', 'mg-task', challenge.brief);
      const status = el('p', 'mg-status');
      const hintText = hintFor(challenge);
      brief.append(task, status);
      if (hintText) {
        const hint = el('p', 'mg-hint', hintText);
        hint.hidden = true;
        const toggle = button('Need a hint?', 'btn btn-ghost mg-hint-btn');
        toggle.addEventListener('click', () => {
          hint.hidden = !hint.hidden;
          toggle.textContent = hint.hidden ? 'Need a hint?' : 'Hide hint';
          audio.click();
        });
        brief.append(toggle, hint);
      }
      const area = el('div', 'mg-area');
      body.append(brief, area);

      const host: GameHost = {
        area,
        foot,
        setStatus: (text) => {
          status.textContent = text;
        },
        onDispose: (fn) => disposers.push(fn),
        get closed() {
          return closed;
        },
      };

      const round = async (): Promise<void> => {
        for (;;) {
          area.replaceChildren();
          foot.replaceChildren();
          status.textContent = '';
          dispose();
          const result = await runner(challenge, host);
          if (closed) return;
          const again = await showResult(challenge, result, area, foot);
          if (closed) return;
          if (result.passed || !again) return leave(result);
        }
      };
      void round();

      mountOverlay('minigame', panel, { onEscape: () => leave(null) });
    });
  }
}

/** The hint text, when the challenge's config carries one. */
function hintFor(challenge: ChallengeSpec): string | null {
  const cfg = challenge.config as { hint?: string };
  return typeof cfg.hint === 'string' ? cfg.hint : null;
}

/** The note the config carries about why the activity matters, shown once it is done. */
function noteFor(challenge: ChallengeSpec): string | null {
  const cfg = challenge.config as { note?: string };
  return typeof cfg.note === 'string' ? cfg.note : null;
}

/**
 * Show how the round went. Resolves true to play again (only offered when the
 * round was not passed), false to carry on.
 */
function showResult(challenge: ChallengeSpec, result: MiniGameResult, area: HTMLElement, foot: HTMLElement): Promise<boolean> {
  return new Promise((resolve) => {
    area.replaceChildren();
    foot.replaceChildren();

    const card = el('div', result.passed ? 'mg-result good' : 'mg-result');
    card.append(el('div', 'mg-result-mark', result.passed ? '✓' : '↻'));
    card.append(el('h3', undefined, result.passed ? 'Done' : 'Not quite — have another go'));
    if (result.stats.length > 0) {
      const stats = el('ul', 'mg-stats');
      for (const s of result.stats) stats.appendChild(el('li', undefined, s));
      card.appendChild(stats);
    }
    if (result.passed) {
      card.append(el('h4', undefined, 'What this teaches'), el('p', undefined, challenge.teaches));
      const note = noteFor(challenge);
      if (note) card.append(el('h4', undefined, 'Worth knowing'), el('p', undefined, note));
    }
    area.appendChild(card);

    if (result.passed) audio.success(4);
    else audio.failure();

    if (result.passed) {
      const go = button('Continue', 'btn btn-primary');
      go.addEventListener('click', () => resolve(false));
      foot.appendChild(go);
      go.focus();
    } else {
      const retry = button('Try again', 'btn btn-primary');
      retry.addEventListener('click', () => resolve(true));
      const leave = button('Leave it for now', 'btn btn-ghost');
      leave.addEventListener('click', () => resolve(false));
      foot.append(leave, retry);
      retry.focus();
    }
  });
}
