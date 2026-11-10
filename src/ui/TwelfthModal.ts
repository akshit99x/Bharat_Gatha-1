import { audio } from '../core/Audio';
import { getCodex } from '../content/codex';
import { SOURCE_LABEL } from '../content/types';
import type { CodexEntry } from '../content/types';
import type { StoryEngine } from '../story/StoryEngine';
import { MAITRI } from '../story/StoryEngine';
import { buildPanel, button, closeOverlay, el, mountOverlay } from './overlay';

/**
 * The Twelfth Panel.
 *
 * The last panel of the Gatha is blank, and the player writes it: three things
 * they are sure of, one they hold on tradition, one they still do not know, and
 * one name they want remembered. It is built from ids only, saved into the
 * profile, and therefore included in the learning-record export — which makes it
 * a teacher-facing artefact made of the student's own choices.
 *
 * The "still open" slot is the game's thesis in a button: an honest unknown is
 * a result, not a failure.
 */

export class TwelfthModal {
  constructor(
    private readonly story: StoryEngine,
    private readonly playerName: () => string,
  ) {}

  present(): Promise<void> {
    return new Promise((resolve) => {
      const options = this.story.twelfthOptions();
      const existing = this.story.state.twelfth;

      const sure = new Set<string>(existing?.sure ?? []);
      let tradition = existing?.tradition ?? '';
      let open = existing?.open ?? '';
      let remembered = existing?.remembered ?? '';

      const { panel, body, foot } = buildPanel({
        title: 'The Twelfth Panel',
        subtitle: 'The one that is blank. Yours.',
        width: 'wide',
        closable: true,
        onClose: () => finish(),
      });
      const finish = (): void => {
        closeOverlay();
        resolve();
      };

      const save = button('Hang it on the scroll', 'btn btn-primary');
      const refresh = (): void => {
        save.disabled = sure.size === 0 && !tradition && !open && !remembered;
      };

      const section = (title: string, hint: string): HTMLElement => {
        const wrap = el('section', 'tw-section');
        wrap.append(el('h3', undefined, title), el('p', 'tw-hint', hint));
        return wrap;
      };

      const chip = (entry: CodexEntry, active: boolean, onClick: () => void): HTMLButtonElement => {
        const b = el('button', active ? 'tw-chip active' : 'tw-chip') as HTMLButtonElement;
        b.type = 'button';
        const badge = el('span', 'src-badge', SOURCE_LABEL[entry.source]);
        badge.dataset.src = entry.source;
        b.append(el('span', undefined, entry.title), badge);
        b.addEventListener('click', () => {
          audio.click();
          onClick();
        });
        return b;
      };

      const empty = (text: string): HTMLElement => el('p', 'tw-empty', text);

      const renderAll = (): void => {
        body.replaceChildren();

        const s1 = section('Three things I am sure of', 'Choose up to three entries resting on a dig or a written source.');
        const row1 = el('div', 'tw-chips');
        if (options.sure.length === 0) row1.appendChild(empty('Record some archaeology or written-source entries first.'));
        for (const e of options.sure) {
          row1.appendChild(
            chip(e, sure.has(e.id), () => {
              if (sure.has(e.id)) sure.delete(e.id);
              else if (sure.size < 3) sure.add(e.id);
              renderAll();
            }),
          );
        }
        s1.appendChild(row1);

        const s2 = section('One thing I hold on tradition', 'An epic-tradition entry. Cultural truth, not a dig report — and none the less for it.');
        const row2 = el('div', 'tw-chips');
        if (options.tradition.length === 0) row2.appendChild(empty('You have not recorded an epic entry yet. Visit the epic chapters.'));
        for (const e of options.tradition) {
          row2.appendChild(chip(e, tradition === e.id, () => {
            tradition = tradition === e.id ? '' : e.id;
            renderAll();
          }));
        }
        s2.appendChild(row2);

        const s3 = section('One thing I still do not know', 'A debated entry. An honest unknown is a result, not a failure.');
        const row3 = el('div', 'tw-chips');
        if (options.open.length === 0) row3.appendChild(empty('You have not recorded a debated entry yet.'));
        for (const e of options.open) {
          row3.appendChild(chip(e, open === e.id, () => {
            open = open === e.id ? '' : e.id;
            renderAll();
          }));
        }
        s3.appendChild(row3);

        const s4 = section('A name I want remembered', 'One of the people the scroll remembers.');
        const row4 = el('div', 'tw-chips');
        if (options.remembered.length === 0) row4.appendChild(empty('Restore a panel to meet the people it remembers.'));
        for (const { zone, story } of options.remembered) {
          const b = el('button', remembered === zone.id ? 'tw-chip active' : 'tw-chip') as HTMLButtonElement;
          b.type = 'button';
          b.append(el('span', undefined, story.maker.who), el('small', undefined, zone.name));
          b.addEventListener('click', () => {
            audio.click();
            remembered = remembered === zone.id ? '' : zone.id;
            renderAll();
          });
          row4.appendChild(b);
        }
        s4.appendChild(row4);

        body.append(s1, s2, s3, s4);
        refresh();
      };

      save.addEventListener('click', () => {
        this.story.writeTwelfth({ sure: [...sure], tradition, open, remembered });
        audio.bell();
        showResult();
      });

      const showResult = (): void => {
        const ending = this.story.ending();
        const written = this.story.state.twelfth;
        body.replaceChildren();
        foot.replaceChildren();

        const card = el('article', 'tw-card');
        card.append(el('h3', undefined, `${this.playerName()}’s panel`));
        const line = (label: string, items: string[]): void => {
          if (items.length === 0) return;
          const row = el('div', 'tw-row');
          row.append(el('span', 'tw-label', label), el('span', 'tw-items', items.join(' · ')));
          card.appendChild(row);
        };
        line('Sure of', (written?.sure ?? []).map((id) => getCodex(id)?.title ?? id));
        line('On tradition', written?.tradition ? [getCodex(written.tradition)?.title ?? written.tradition] : []);
        line('Still open', written?.open ? [getCodex(written.open)?.title ?? written.open] : []);
        const name = options.remembered.find((r) => r.zone.id === written?.remembered);
        line('Remembered', name ? [name.story.maker.who] : []);
        body.appendChild(card);

        const end = el('div', 'sb-stage');
        end.dataset.who = 'maitri';
        end.append(el('div', 'sb-name', `${MAITRI.icon} ${MAITRI.name}`), el('b', 'tw-ending', ending.title), el('p', 'sb-line', ending.body));
        body.appendChild(end);
        body.appendChild(
          el(
            'p',
            'sb-note',
            'This panel is part of your learning record. Esc → Export learning record will include it, in your own choices. The Gatha is never finished; open the scroll and read the Keeper’s Log.',
          ),
        );
        const done = button('Close', 'btn btn-primary');
        done.addEventListener('click', finish);
        foot.append(done);
        done.focus();
      };

      const cancel = button('Not yet', 'btn btn-ghost');
      cancel.addEventListener('click', finish);
      foot.append(cancel, save);

      mountOverlay('twelfth', panel, { onEscape: finish });
      renderAll();
    });
  }
}
