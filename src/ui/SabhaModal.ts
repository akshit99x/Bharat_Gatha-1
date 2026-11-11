import { audio } from '../core/Audio';
import { voice } from '../core/Voice';
import { SABHA_CLOSING as CLOSING, SABHA_OPENING as OPENING } from '../content/story/sabha';
import { MOTIF_LABEL, VERDICT_GLOSS, VERDICT_LABEL, VERDICT_ORDER, type Plaque } from '../content/story';
import type { StoryEngine } from '../story/StoryEngine';
import { EKARUPA, MAITRI } from '../story/StoryEngine';
import { getZone } from '../content/zones';
import { drawBraid } from './panelArt';
import { buildPanel, button, closeOverlay, el, mountOverlay } from './overlay';

/**
 * The Sabha of Sources.
 *
 * Ekarupa makes the claims it has been making all along, one per restored
 * chapter, and the player cross-examines each. The claims it presses are the
 * ones the player found hardest, so the finale leans on their own gaps — but it
 * is pitched as Ekarupa knowing where they are soft, never as a test. A claim
 * missed is explained by the chapter's own witness and comes back once; nothing
 * is deducted, and every claim is settled by the end.
 */

interface QueueItem {
  plaque: Plaque;
  attempts: number;
}

export class SabhaModal {
  constructor(private readonly story: StoryEngine) {}

  present(): Promise<'settled' | 'closed'> {
    return new Promise((resolve) => {
      let outcome: 'settled' | 'closed' = 'closed';
      let detach = (): void => undefined;
      const { panel, body, foot } = buildPanel({
        title: 'The Sabha of Sources',
        subtitle: 'Ekarupa is not a monster. It is a very persuasive habit.',
        width: 'wide',
        closable: true,
        onClose: () => close(),
      });
      const close = (): void => {
        detach();
        voice.cancel();
        closeOverlay();
        resolve(outcome);
      };

      const queue: QueueItem[] = this.story
        .sabhaClaims()
        .filter((p) => !this.story.sabhaSettled(p.id))
        .map((plaque) => ({ plaque, attempts: 0 }));
      const total = queue.length;
      let firstTry = 0;

      // ------------------------------------------------------------ opening
      const showOpening = (): void => {
        body.replaceChildren();
        foot.replaceChildren();
        const stage = el('div', 'sb-stage');
        stage.dataset.who = 'ekarupa';
        stage.append(el('div', 'sb-name', `${EKARUPA.icon} ${EKARUPA.name}`));
        for (const line of OPENING) stage.append(el('p', 'sb-line', line));
        voice.speak(OPENING.join(' '), voice.profileForSpeaker('Ekarupa'));
        body.appendChild(stage);
        body.appendChild(
          el('p', 'sb-note', total === 0 ? 'Every claim has already been settled.' : `${total} claim${total === 1 ? '' : 's'}, drawn from the panels you have restored.`),
        );
        const go = button(total === 0 ? 'Hear the closing' : 'Hear its claims', 'btn btn-primary');
        go.addEventListener('click', () => (total === 0 ? showClosing() : showClaim()));
        const later = button('Not yet', 'btn btn-ghost');
        later.addEventListener('click', close);
        foot.append(later, go);
        go.focus();
      };

      // -------------------------------------------------------------- claim
      const showClaim = (): void => {
        const item = queue[0];
        if (!item) {
          showClosing();
          return;
        }
        const { plaque } = item;
        const zone = getZone(plaque.zoneId);
        body.replaceChildren();
        foot.replaceChildren();

        const progress = el('div', 'sb-progress', `Claim ${total - queue.length + 1} of ${total}${item.attempts > 0 ? ' — back again' : ''}`);
        const stage = el('div', 'sb-stage');
        stage.dataset.who = 'ekarupa';
        stage.dataset.mask = plaque.mask;
        stage.append(
          el('div', 'sb-name', `${EKARUPA.icon} ${EKARUPA.name} — ${plaque.mask === 'gilder' ? 'the Gilder' : 'the Eraser'}`),
          el('p', 'sb-claim', `“${plaque.claim}”`),
        );
        if (zone) stage.append(el('small', 'sb-from', `From ${zone.name}.`));

        voice.speak(plaque.claim, voice.profileForSpeaker('Ekarupa'));
        const ask = el('h3', 'pq-h', plaque.ask ?? 'Where does the honest version of this claim belong?');
        const options = el('div', 'pq-options');
        const result = el('div', 'sb-result');
        result.hidden = true;

        const buttons: HTMLButtonElement[] = [];
        VERDICT_ORDER.forEach((verdict, i) => {
          const b = el('button', 'pq-opt') as HTMLButtonElement;
          b.type = 'button';
          b.dataset.verdict = verdict;
          b.append(el('span', 'pq-key', String(i + 1)));
          const t = el('span', 'pq-otext');
          t.append(el('b', undefined, VERDICT_LABEL[verdict]), el('small', undefined, VERDICT_GLOSS[verdict]));
          b.appendChild(t);
          b.addEventListener('click', () => answer(verdict));
          buttons.push(b);
          options.appendChild(b);
        });

        const next = button('Next', 'btn btn-primary');
        next.hidden = true;

        const answer = (verdict: (typeof VERDICT_ORDER)[number]): void => {
          item.attempts++;
          const correct = verdict === plaque.verdict;
          for (const b of buttons) {
            b.disabled = true;
            if (b.dataset.verdict === plaque.verdict) b.dataset.state = 'correct';
            else if (b.dataset.verdict === verdict) b.dataset.state = 'wrong';
          }
          // Settled when right, or when it has had its second turn.
          const settled = correct || item.attempts >= 2;
          if (correct && item.attempts === 1) firstTry++;
          if (settled) {
            this.story.settleClaim(plaque.id);
            queue.shift();
          } else {
            queue.push(queue.shift() as QueueItem);
          }
          if (correct) audio.success(3);
          else audio.click();

          result.hidden = false;
          result.dataset.state = correct ? 'good' : 'try';
          result.replaceChildren(
            el('b', undefined, correct ? `Settled — ${VERDICT_LABEL[plaque.verdict]}.` : `Ekarupa takes the round. The answer was ${VERDICT_LABEL[plaque.verdict]}.`),
          );
          result.append(el('p', undefined, plaque.correction));
          const witness = this.story.witnessFor(plaque.zoneId);
          if (witness) {
            voice.speak(witness.text, voice.profileForSpeaker(witness.speaker.name));
            const w = el('div', 'sb-witness');
            w.append(el('b', undefined, `${witness.speaker.icon} ${witness.speaker.name}, called as a witness`), el('p', undefined, `“${witness.text}”`));
            result.appendChild(w);
          }
          if (!correct && !settled) result.append(el('small', undefined, 'This claim will come back once more. Nothing is lost.'));
          next.hidden = false;
          next.focus();
        };
        next.addEventListener('click', () => (queue.length > 0 ? showClaim() : showClosing()));

        body.append(progress, stage, ask, options, result);
        const leave = button('Leave the Sabha', 'btn btn-ghost');
        leave.addEventListener('click', close);
        foot.append(leave, next);
      };

      // ------------------------------------------------------------ closing
      const showClosing = (): void => {
        body.replaceChildren();
        foot.replaceChildren();
        const stage = el('div', 'sb-stage');
        stage.dataset.who = 'maitri';
        stage.append(el('div', 'sb-name', `${MAITRI.icon} ${MAITRI.name}`), el('p', 'sb-line', CLOSING));
        voice.speak(CLOSING, voice.profileForSpeaker('Maitri'));
        const canvas = el('canvas', 'sb-braid');
        body.append(stage, canvas);

        const threads = el('div', 'sc-threads');
        for (const m of ['water', 'writing', 'measure'] as const) {
          const chip = el('span', 'sc-thread', `${MOTIF_LABEL[m].glyph} ${MOTIF_LABEL[m].name}`);
          chip.dataset.motif = m;
          chip.title = MOTIF_LABEL[m].gloss;
          threads.appendChild(chip);
        }
        const tally = el(
          'p',
          'sb-note',
          total > 0
            ? `${firstTry} of ${total} claims settled on the first try. The rest were settled with a witness — which is how most of history gets settled anyway.`
            : 'Every claim was settled.',
        );
        body.append(threads, tally);

        // Tangled to braided over a couple of seconds.
        const start = performance.now();
        const frame = (now: number): void => {
          if (!canvas.isConnected) return;
          const t = Math.min(1, (now - start) / 2600);
          drawBraid(canvas, 1 - t * t * (3 - 2 * t));
          if (t < 1) requestAnimationFrame(frame);
        };
        requestAnimationFrame(frame);

        this.story.finishSabha();
        outcome = 'settled';
        audio.bell();
        const done = button('Close', 'btn btn-primary');
        done.addEventListener('click', close);
        foot.append(done);
        done.focus();
      };

      const keys = (e: KeyboardEvent): void => {
        const n = Number(e.key);
        if (!Number.isInteger(n) || n < 1 || n > VERDICT_ORDER.length) return;
        const target = body.querySelectorAll<HTMLButtonElement>('.pq-opt')[n - 1];
        if (target && !target.disabled) target.click();
      };
      window.addEventListener('keydown', keys);
      detach = () => window.removeEventListener('keydown', keys);

      mountOverlay('sabha', panel, { onEscape: close });
      showOpening();
    });
  }
}
