import { audio } from '../core/Audio';
import { SOURCE_LABEL } from '../content/types';
import { VERDICT_GLOSS, VERDICT_LABEL, VERDICT_ORDER, type Plaque, type PlaqueVerdict } from '../content/story';
import type { StoryEngine } from '../story/StoryEngine';
import { MAITRI } from '../story/StoryEngine';
import { buildPanel, button, closeOverlay, el, mountOverlay } from './overlay';
import { getZone } from '../content/zones';

/**
 * Reading a plaque.
 *
 * The player has to have read the evidence before they can judge, which turns
 * the codex from a reward screen into a reference they actually consult. A wrong
 * answer is never punished: the plaque stays, Maitri says what to look at, and
 * the player may try again. It is counted, quietly, so the Sabha can lean on
 * whatever the player found hardest.
 */

const MASK_LABEL = { gilder: 'The Gilder', eraser: 'The Eraser' } as const;
const MASK_NOTE = {
  gilder: 'a story too good, or too tidy, to check',
  eraser: 'a dismissal too quick to check',
} as const;

export type PlaqueOutcome = 'cleared' | 'closed';

export class PlaqueModal {
  constructor(private readonly story: StoryEngine) {}

  present(plaque: Plaque): Promise<PlaqueOutcome> {
    return new Promise((resolve) => {
      const zone = getZone(plaque.zoneId);
      const alreadyDone = this.story.plaqueDone(plaque.id);
      let cleared = alreadyDone;

      let detach = (): void => undefined;
      const finish = (): void => {
        detach();
        closeOverlay();
        resolve(cleared ? 'cleared' : 'closed');
      };

      const { panel, body, foot } = buildPanel({
        title: alreadyDone ? 'A plaque, cleared' : 'A plaque, clouded by the Dhundh',
        subtitle: zone ? `${zone.name} · ${MASK_LABEL[plaque.mask]} is speaking` : undefined,
        closable: true,
        onClose: finish,
      });

      // The claim.
      const claimBox = el('blockquote', 'pq-claim');
      claimBox.dataset.mask = plaque.mask;
      if (alreadyDone) claimBox.dataset.cleared = 'true';
      claimBox.append(el('p', undefined, `“${plaque.claim}”`));
      const meta = el('div', 'pq-meta');
      const label = el('span', 'src-badge', plaque.shown === 'none' ? 'No evidence label' : SOURCE_LABEL[plaque.shown]);
      if (plaque.shown !== 'none') label.dataset.src = plaque.shown;
      meta.append(el('span', undefined, 'The plaque wears the label'), label, el('span', 'pq-mask', MASK_NOTE[plaque.mask]));
      claimBox.appendChild(meta);

      // The evidence the player must have read.
      const evidenceHead = el('h3', 'pq-h', 'Read the evidence');
      const evidence = el('ul', 'pq-evidence');
      const renderEvidence = (): void => {
        evidence.replaceChildren(
          ...this.story.evidence(plaque).map((row) => {
            const li = el('li', row.known ? 'known' : 'missing');
            li.append(el('span', 'pq-tick', row.known ? '✓' : '○'));
            const text = el('span', 'pq-etext');
            text.append(el('b', undefined, row.title));
            if (row.known) {
              const badge = el('span', 'src-badge', SOURCE_LABEL[row.source]);
              badge.dataset.src = row.source;
              text.append(' ', badge);
            } else {
              text.append(el('small', undefined, row.whereToFind));
            }
            li.appendChild(text);
            return li;
          }),
        );
      };
      renderEvidence();

      // The question and the answers.
      const ask = el('h3', 'pq-h', plaque.ask ?? 'Where does the honest version of this claim belong?');
      const options = el('div', 'pq-options');
      const feedback = el('div', 'pq-feedback');
      feedback.hidden = true;

      const buttons: HTMLButtonElement[] = [];
      const canJudge = this.story.canJudge(plaque);

      const lockAll = (): void => buttons.forEach((b) => (b.disabled = true));

      const answer = (verdict: PlaqueVerdict): void => {
        if (cleared) return;
        const result = this.story.resolvePlaque(plaque, verdict);
        feedback.hidden = false;
        feedback.replaceChildren();
        if (result.correct) {
          cleared = true;
          audio.success(4);
          feedback.dataset.state = 'good';
          feedback.append(el('b', undefined, `Yes — ${VERDICT_LABEL[verdict]}.`));
          for (const para of plaque.correction.split('\n')) feedback.append(el('p', undefined, para));
          feedback.append(el('small', undefined, `The haze lifts. +${result.vidya} Vidya.`));
          lockAll();
          for (const b of buttons) {
            if (b.dataset.verdict === verdict) b.dataset.state = 'correct';
            else delete b.dataset.state;
          }
          claimBox.dataset.cleared = 'true';
          closeBtn.textContent = 'Lift the haze';
          closeBtn.classList.remove('btn-ghost');
          closeBtn.classList.add('btn-primary');
          closeBtn.focus();
        } else {
          audio.pluck(165, 0.14);
          feedback.dataset.state = 'try';
          const tries = this.story.plaqueTries(plaque.id);
          feedback.append(el('b', undefined, 'Not quite — and nothing is lost. Look again.'));
          feedback.append(el('p', undefined, plaque.nudge?.[verdict] ?? 'Go back to the evidence above. What does it actually say about this claim?'));
          if (tries >= 2) {
            const first = this.story.evidence(plaque)[0];
            if (first) {
              feedback.append(el('small', undefined, `Hint: “${first.title}” is filed under ${SOURCE_LABEL[first.source]}.`));
            }
          }
          for (const b of buttons) if (b.dataset.verdict === verdict) b.dataset.state = 'wrong';
        }
      };

      VERDICT_ORDER.forEach((verdict, i) => {
        const b = el('button', 'pq-opt') as HTMLButtonElement;
        b.type = 'button';
        b.dataset.verdict = verdict;
        b.append(el('span', 'pq-key', String(i + 1)));
        const t = el('span', 'pq-otext');
        t.append(el('b', undefined, VERDICT_LABEL[verdict]), el('small', undefined, VERDICT_GLOSS[verdict]));
        b.appendChild(t);
        b.disabled = !canJudge || alreadyDone;
        b.addEventListener('click', () => answer(verdict));
        buttons.push(b);
        options.appendChild(b);
      });

      body.append(claimBox, evidenceHead, evidence);
      if (alreadyDone) {
        const done = el('div', 'pq-feedback');
        done.dataset.state = 'good';
        done.append(el('b', undefined, `${VERDICT_LABEL[plaque.verdict]} — already corrected.`));
        for (const para of plaque.correction.split('\n')) done.append(el('p', undefined, para));
        body.append(done);
      } else {
        body.append(ask, options, feedback);
        if (!canJudge) {
          const gate = el('div', 'pq-gate');
          gate.append(
            el('b', undefined, `${MAITRI.name}: `),
            'You have not seen all the evidence yet. Find the entries marked ○, then come back. I will not guess for you — and neither should you.',
          );
          body.appendChild(gate);
        }
      }

      const closeBtn = button(alreadyDone ? 'Close' : 'Leave it for now', 'btn btn-ghost');
      closeBtn.addEventListener('click', finish);
      foot.append(el('span', undefined, 'Hold right mouse on any monument to record its evidence.'), closeBtn);

      const keys = (e: KeyboardEvent): void => {
        const n = Number(e.key);
        if (Number.isInteger(n) && n >= 1 && n <= VERDICT_ORDER.length) buttons[n - 1]?.click();
      };
      window.addEventListener('keydown', keys);
      detach = () => window.removeEventListener('keydown', keys);
      mountOverlay('plaque', panel, { onEscape: finish });
    });
  }
}
