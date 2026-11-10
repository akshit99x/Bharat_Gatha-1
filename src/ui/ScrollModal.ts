import { SOURCE_LABEL } from '../content/types';
import { getZone } from '../content/zones';
import { CHAPTERS, KEEPERS, MOTIF_LABEL, TOTAL_PLAQUES, VERDICT_LABEL, type ChapterStory, type Motif } from '../content/story';
import type { Zone } from '../content/types';
import type { StoryEngine } from '../story/StoryEngine';
import { findNpc } from '../story/StoryEngine';
import { drawPanel, revealPanel } from './panelArt';
import { buildPanel, button, closeOverlay, el, mountOverlay } from './overlay';

/**
 * The Gatha, as the player sees it: eleven panels, restored or clouded, the
 * three threads they carry, the people each one remembers, and — once the Sabha
 * is settled — the Keeper's Log.
 */

export interface ScrollActions {
  /** Close the scroll and run this chapter's restoration conversation. */
  restore(zoneId: string): void;
  sabha(): void;
  twelfth(): void;
  playerName(): string;
}

type View = { kind: 'panels' } | { kind: 'detail'; zoneId: string } | { kind: 'log' };

export class ScrollModal {
  constructor(
    private readonly story: StoryEngine,
    private readonly actions: ScrollActions,
  ) {}

  /** `reveal` plays the haze-lifting animation on `openOn`, for a panel that has just been restored. */
  present(openOn?: string, reveal = false): void {
    const { panel, body, foot } = buildPanel({
      title: 'The Gatha',
      subtitle: '',
      width: 'wide',
      closable: true,
      onClose: () => closeOverlay(),
    });
    const subtitle = panel.querySelector('.ph-sub') as HTMLElement | null;

    let view: View = openOn ? { kind: 'detail', zoneId: openOn } : { kind: 'panels' };
    let pendingReveal = reveal && openOn !== undefined;

    const render = (): void => {
      const restored = this.story.panelsRestored();
      const plaques = this.story.totalPlaquesDone();
      if (subtitle) subtitle.textContent = `${restored} of ${CHAPTERS.length} panels restored · ${plaques} of ${TOTAL_PLAQUES} plaques corrected`;

      body.replaceChildren();
      foot.replaceChildren();

      const tabs = el('div', 'sc-tabs');
      const tab = (label: string, target: View['kind'], active: boolean): HTMLButtonElement => {
        const b = el('button', active ? 'sc-tab active' : 'sc-tab') as HTMLButtonElement;
        b.type = 'button';
        b.textContent = label;
        b.addEventListener('click', () => {
          view = target === 'log' ? { kind: 'log' } : { kind: 'panels' };
          render();
        });
        return b;
      };
      tabs.append(tab('Panels', 'panels', view.kind !== 'log'), tab('Keeper’s Log', 'log', view.kind === 'log'));
      body.appendChild(tabs);

      if (view.kind === 'panels') this.renderGallery(body, (zoneId) => {
        view = { kind: 'detail', zoneId };
        render();
      });
      else if (view.kind === 'detail') {
        const animate = pendingReveal;
        pendingReveal = false;
        this.renderDetail(body, view.zoneId, () => {
          view = { kind: 'panels' };
          render();
        }, animate);
      }
      else this.renderLog(body);

      // Footer: the two late-game doors, then close.
      if (this.story.sabhaUnlocked() && !this.story.state.sabhaDone) {
        const b = button('Convene the Sabha', 'btn btn-primary');
        b.addEventListener('click', () => {
          closeOverlay();
          this.actions.sabha();
        });
        foot.appendChild(b);
      } else if (!this.story.sabhaUnlocked()) {
        foot.appendChild(el('span', undefined, 'Restore three panels to convene the Sabha of Sources.'));
      }
      if (this.story.twelfthUnlocked()) {
        const b = button(this.story.state.twelfth ? 'Rewrite the Twelfth Panel' : 'Write the Twelfth Panel', 'btn btn-primary');
        b.addEventListener('click', () => {
          closeOverlay();
          this.actions.twelfth();
        });
        foot.appendChild(b);
      }
      const close = button('Close', 'btn btn-ghost');
      close.addEventListener('click', () => closeOverlay());
      foot.appendChild(close);
    };

    mountOverlay('scroll', panel, { onEscape: () => closeOverlay() });
    render();
  }

  // ----------------------------------------------------------------- gallery

  private renderGallery(into: HTMLElement, open: (zoneId: string) => void): void {
    const intro = el(
      'p',
      'sc-intro',
      'Eleven panels, one scroll. A panel comes back when its chapter is sealed. The coloured cords on a restored panel are the threads it carries: water, writing and measure.',
    );
    const grid = el('div', 'sc-grid');
    for (const chapter of CHAPTERS) {
      const zone = getZone(chapter.zoneId);
      if (!zone) continue;
      const restored = this.story.panelRestored(zone.id);
      const card = el('button', restored ? 'sc-card restored' : 'sc-card') as HTMLButtonElement;
      card.type = 'button';
      const canvas = el('canvas', 'sc-canvas');
      drawPanel(canvas, chapter.panel, zone, { restored, lit: restored ? chapter.panel.threads : [] });
      const label = el('div', 'sc-label');
      label.append(el('span', 'sc-no', String(zone.chapter)), el('b', undefined, restored ? chapter.panel.title : chapter.title));
      const sub = el('small', undefined, restored ? zone.name : this.progressText(zone, chapter));
      card.append(canvas, label, sub);
      card.addEventListener('click', () => open(zone.id));
      grid.appendChild(card);
    }
    into.append(intro, grid);
  }

  private progressText(zone: Zone, chapter: ChapterStory): string {
    if (!this.story.state.firstZone && !this.story.totalPlaquesDone() && !this.story.state.met.length) return 'Clouded — not yet visited';
    const { done, total } = this.story.plaquesDone(zone.id);
    if (this.story.restorable(zone.id)) return 'Sealed — ready to restore';
    return `Clouded · ${done}/${total} plaques · ${chapter.trail.title}`;
  }

  // ------------------------------------------------------------------ detail

  private renderDetail(into: HTMLElement, zoneId: string, back: () => void, animate = false): void {
    const chapter = CHAPTERS.find((c) => c.zoneId === zoneId);
    const zone = getZone(zoneId);
    if (!chapter || !zone) return;
    const restored = this.story.panelRestored(zoneId);

    const backBtn = button('← All panels', 'btn btn-ghost sc-back');
    backBtn.addEventListener('click', back);

    const wrap = el('div', 'sc-detail');
    const canvas = el('canvas', 'sc-big');
    if (restored && animate) {
      drawPanel(canvas, chapter.panel, zone, { restored: false, lit: chapter.panel.threads, threadProgress: 0 });
      void revealPanel(canvas, chapter.panel, zone, chapter.panel.threads);
    } else {
      drawPanel(canvas, chapter.panel, zone, { restored, lit: restored ? chapter.panel.threads : [] });
    }

    const text = el('div', 'sc-text');
    text.appendChild(el('h3', undefined, restored ? chapter.panel.title : `Chapter ${zone.chapter} · ${chapter.title}`));
    text.appendChild(el('div', 'sc-zone', `${zone.name} · ${zone.era}`));

    if (restored) {
      text.appendChild(el('p', undefined, chapter.panel.caption));
      text.appendChild(el('p', 'sc-detail-note', `◆ ${chapter.panel.detail}`));
      const threads = el('div', 'sc-threads');
      for (const m of chapter.panel.threads) threads.appendChild(threadChip(m));
      text.appendChild(threads);

      const maker = el('div', 'sc-maker');
      const badge = el('span', 'src-badge', SOURCE_LABEL[chapter.maker.source]);
      badge.dataset.src = chapter.maker.source;
      maker.append(el('h4', undefined, 'Remembered'), el('b', undefined, chapter.maker.who), ' ', badge, el('p', undefined, chapter.maker.record));
      text.appendChild(maker);
    } else {
      text.appendChild(el('p', undefined, 'This panel is still under the Dhundh. Correct the plaques, hear the people of the region, and seal the chapter to bring it back.'));
      if (this.story.restorable(zoneId)) {
        const go = button('Restore this panel', 'btn btn-primary');
        go.addEventListener('click', () => {
          closeOverlay();
          this.actions.restore(zoneId);
        });
        text.appendChild(go);
      }
    }

    // Plaques and trail progress, for both states.
    const list = el('ul', 'sc-list');
    for (const p of chapter.plaques) {
      const done = this.story.plaqueDone(p.id);
      const li = el('li', done ? 'done' : '');
      li.append(el('span', 'sc-tick', done ? '✓' : '○'), el('span', undefined, done ? `${VERDICT_LABEL[p.verdict]}: “${trim(p.claim, 78)}”` : `“${trim(p.claim, 78)}”`));
      list.appendChild(li);
    }
    const anchor = findNpc(chapter.anchorNpcId);
    const stops = chapter.trail.stops.length;
    const at = Math.min(stops, this.story.trailProgress(chapter.trail.id));
    const trailLi = el('li', at >= stops ? 'done' : '');
    trailLi.append(el('span', 'sc-tick', at >= stops ? '✓' : '○'), el('span', undefined, `${chapter.trail.title} — ${at}/${stops}. ${chapter.trail.brief}`));
    list.appendChild(trailLi);
    if (anchor) {
      const heard = this.story.state.met.includes(anchor.id);
      const li = el('li', heard ? 'done' : '');
      li.append(el('span', 'sc-tick', heard ? '✓' : '○'), el('span', undefined, `Hear ${anchor.name} out — ${anchor.role}`));
      list.appendChild(li);
    }
    text.appendChild(list);

    wrap.append(canvas, text);
    into.append(backBtn, wrap);
  }

  // --------------------------------------------------------------------- log

  private renderLog(into: HTMLElement): void {
    const sealed = !this.story.state.sabhaDone;
    if (sealed) {
      into.appendChild(
        el(
          'p',
          'sc-intro',
          'The log is sealed. Maitri keeps it, and will show it to you once the Sabha of Sources has been settled. Until then, here is only the first line:',
        ),
      );
      const first = el('ol', 'sc-log');
      first.appendChild(el('li', undefined, KEEPERS[0] ?? ''));
      into.appendChild(first);
      return;
    }
    into.appendChild(
      el(
        'p',
        'sc-intro',
        'The job of keeping the Gatha has never been done by anyone special. It has been done by ordinary people who asked good questions. These are the forty-one who came before Maitri. The forty-second line is yours.',
      ),
    );
    const log = el('ol', 'sc-log');
    for (const line of KEEPERS) log.appendChild(el('li', undefined, line));
    const you = el('li', 'you', `${this.actions.playerName()} — the forty-second Keeper`);
    log.appendChild(you);
    into.appendChild(log);
  }
}

function threadChip(m: Motif): HTMLElement {
  const info = MOTIF_LABEL[m];
  const chip = el('span', 'sc-thread');
  chip.dataset.motif = m;
  chip.append(`${info.glyph} ${info.name}`);
  chip.title = info.gloss;
  return chip;
}

function trim(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}
