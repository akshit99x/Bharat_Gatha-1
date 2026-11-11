import type { Zone } from '../content/types';
import { bus, type ToastKind } from '../core/EventBus';

/**
 * The in-world HUD.
 *
 * Thin wrapper over the DOM already present in index.html — no framework, no
 * virtual DOM, because this updates every frame and the cheapest thing you can
 * do per frame is write to a cached element's style.
 */

function toRoman(n: number): string {
  const table: Array<[number, string]> = [
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];
  let out = '';
  for (const [v, sym] of table) while (n >= v) {
    out += sym;
    n -= v;
  }
  return out;
}

export type CrosshairMode = 'idle' | 'interact' | 'scan' | 'bow' | 'hidden';

export interface CompassPoi {
  /** World-space direction from the player, in radians (atan2(dx, dz)). */
  bearing: number;
  label: string;
  distance: number;
}

interface ToastEntry {
  el: HTMLElement;
  timer: number;
}

export class Hud {
  private readonly root: HTMLElement;
  private readonly crosshair: HTMLElement;
  private readonly compassStrip: HTMLElement;
  private readonly banner: HTMLElement;
  private readonly bannerEra: HTMLElement;
  private readonly bannerChapter: HTMLElement;
  private readonly bannerLocal: HTMLElement;
  private readonly bannerStory: HTMLElement;
  private readonly bannerName: HTMLElement;
  private readonly bannerSub: HTMLElement;
  private readonly objectivePanel: HTMLElement;
  private readonly objectiveChapter: HTMLElement;
  private readonly objectiveProgress: HTMLElement;
  private readonly objectiveList: HTMLElement;
  private heartsBox: HTMLElement | null = null;
  private readonly nextCard: HTMLElement;
  private readonly nextTitle: HTMLElement;
  private readonly nextHow: HTMLElement;
  private readonly nextDist: HTMLElement;
  private readonly interactPrompt: HTMLElement;
  private readonly interactLabel: HTMLElement;
  private readonly interactKey: HTMLElement | null;
  private readonly scanReadout: HTMLElement;
  private readonly scanBar: HTMLElement;
  private readonly scanLabel: HTMLElement;
  private readonly toastHost: HTMLElement;
  private readonly vidyaBox: HTMLElement;
  private readonly vidyaValue: HTMLElement;
  private readonly toolbelt: HTMLElement;
  private readonly flightHint: HTMLElement;

  private readonly toasts: ToastEntry[] = [];
  private bannerTimer = 0;
  private lastVidya = 0;
  private cardinalCache: HTMLElement[] = [];
  private poiElements: HTMLElement[] = [];

  constructor() {
    this.root = must('hud');
    this.crosshair = must('crosshair');
    this.compassStrip = must('compass-strip');
    this.banner = must('zone-banner');
    this.bannerEra = query(this.banner, '.zb-era');
    this.bannerChapter = query(this.banner, '.zb-chapter');
    this.bannerLocal = query(this.banner, '.zb-local');
    this.bannerStory = query(this.banner, '.zb-story');
    this.bannerName = query(this.banner, '.zb-name');
    this.bannerSub = query(this.banner, '.zb-sub');
    this.objectivePanel = must('objective-panel');
    this.objectiveChapter = query(this.objectivePanel, '.op-chapter');
    this.objectiveProgress = query(this.objectivePanel, '.op-progress');
    this.objectiveList = query(this.objectivePanel, '.op-list');
    this.nextCard = query(this.objectivePanel, '.op-next');
    this.nextTitle = query(this.objectivePanel, '.opn-title');
    this.nextHow = query(this.objectivePanel, '.opn-how');
    this.nextDist = query(this.objectivePanel, '.opn-dist');
    this.interactPrompt = must('interact-prompt');
    this.interactLabel = query(this.interactPrompt, '.ip-label');
    this.interactKey = this.interactPrompt.querySelector('kbd');
    this.scanReadout = must('scan-readout');
    this.scanBar = query(this.scanReadout, '.sr-bar i');
    this.scanLabel = query(this.scanReadout, '.sr-label');
    this.toastHost = must('toasts');
    this.vidyaBox = query(must('statusbar'), '.sb-vidya');
    this.vidyaValue = query(this.vidyaBox, '.sb-value');
    this.toolbelt = must('toolbelt');
    this.flightHint = must('flight-hint');

    this.buildCompass();
    bus.on('toast', (payload) => this.toast(payload.kind, payload.title, payload.body, payload.icon, payload.ttl));
  }

  show(): void {
    this.root.hidden = false;
  }

  hide(): void {
    this.root.hidden = true;
  }

  // -------------------------------------------------------------- crosshair

  setCrosshair(mode: CrosshairMode): void {
    if (this.crosshair.dataset.mode !== mode) this.crosshair.dataset.mode = mode;
  }

  // ---------------------------------------------------------------- compass

  private buildCompass(): void {
    const marks: Array<[number, string, boolean]> = [
      [0, 'N', true],
      [45, 'NE', false],
      [90, 'E', true],
      [135, 'SE', false],
      [180, 'S', true],
      [225, 'SW', false],
      [270, 'W', true],
      [315, 'NW', false],
    ];
    this.cardinalCache = marks.map(([deg, label, cardinal]) => {
      const span = document.createElement('span');
      span.textContent = label;
      if (cardinal) span.className = 'card';
      span.dataset.deg = String(deg);
      this.compassStrip.appendChild(span);
      return span;
    });
  }

  /**
   * Update the compass strip. `yaw` is the player's heading in radians, where 0
   * is +Z (north in this world).
   */
  updateCompass(yaw: number, pois: CompassPoi[]): void {
    const headingDeg = ((-yaw * 180) / Math.PI + 360) % 360;
    const pixelsPerDegree = 2.6;

    for (const el of this.cardinalCache) {
      const deg = Number(el.dataset.deg);
      const offset = shortestAngle(deg - headingDeg);
      if (Math.abs(offset) > 70) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.style.left = `calc(50% + ${offset * pixelsPerDegree}px)`;
      el.style.opacity = String(1 - Math.abs(offset) / 90);
    }

    // Reuse POI elements across frames rather than rebuilding the DOM.
    while (this.poiElements.length < pois.length) {
      const span = document.createElement('span');
      span.className = 'poi';
      this.compassStrip.appendChild(span);
      this.poiElements.push(span);
    }
    for (let i = 0; i < this.poiElements.length; i++) {
      const el = this.poiElements[i] as HTMLElement;
      const poi = pois[i];
      if (!poi) {
        el.style.display = 'none';
        continue;
      }
      const deg = ((-poi.bearing * 180) / Math.PI + 360) % 360;
      const offset = shortestAngle(deg - headingDeg);
      if (Math.abs(offset) > 55) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      el.textContent = `${poi.label} · ${Math.round(poi.distance)}m`;
      el.style.left = `calc(50% + ${offset * pixelsPerDegree}px)`;
      el.style.opacity = String(0.9 - Math.abs(offset) / 90);
    }
  }

  // ------------------------------------------------------------ zone banner

  /**
   * The chapter title card. The first time a region is discovered it is a small
   * cinematic: letterbox bars slide in and the card holds longer. Coming back
   * is a quieter, shorter card with no bars.
   */
  announceZone(zone: Zone, opts: { storyTitle?: string; first?: boolean } = {}): void {
    this.bannerChapter.textContent = `Chapter ${toRoman(zone.chapter)}`;
    this.bannerName.textContent = zone.name;
    this.bannerLocal.textContent = zone.nameLocal;
    this.bannerStory.textContent = opts.storyTitle ? `“${opts.storyTitle}”` : '';
    this.bannerStory.hidden = !opts.storyTitle;
    this.bannerEra.textContent = zone.era;
    this.bannerSub.textContent = opts.first ? zone.tagline : '';
    this.bannerSub.hidden = !opts.first;

    // Restart the entrance animation each time.
    this.banner.classList.remove('show', 'first');
    void this.banner.offsetWidth;
    this.banner.classList.add('show');
    this.banner.classList.toggle('first', opts.first === true);
    document.body.classList.toggle('cinematic', opts.first === true);

    const hold = opts.first ? 7200 : 4200;
    window.clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => {
      this.banner.classList.remove('show');
      document.body.classList.remove('cinematic');
    }, hold);
  }

  // ------------------------------------------------------------- objectives

  setObjectives(chapterLabel: string, items: Array<{ text: string; done: boolean; active?: boolean }>): void {
    this.objectiveChapter.textContent = chapterLabel;
    const done = items.filter((i) => i.done).length;
    this.objectiveProgress.textContent = `${done} / ${items.length}`;
    this.objectiveList.replaceChildren(
      ...items.map((item) => {
        const li = document.createElement('li');
        li.textContent = item.text;
        if (item.done) li.classList.add('done');
        else if (item.active) li.classList.add('active');
        return li;
      }),
    );
  }

  /** The "next step" card above the checklist. Pass null to hide it. */
  setNext(next: { title: string; how: string } | null): void {
    this.nextCard.hidden = next === null;
    if (!next) return;
    if (this.nextTitle.textContent !== next.title) this.nextTitle.textContent = next.title;
    if (this.nextHow.textContent !== next.how) this.nextHow.textContent = next.how;
  }

  setNextDistance(metres: number | null): void {
    const text = metres === null ? '' : metres >= 1000 ? `${(metres / 1000).toFixed(1)} km away` : `${Math.round(metres / 5) * 5 || Math.round(metres)} m away`;
    if (this.nextDist.textContent !== text) this.nextDist.textContent = text;
  }

  dimObjectives(dim: boolean): void {
    this.objectivePanel.classList.toggle('dim', dim);
  }

  // ----------------------------------------------------------- interactions

  /** The prompt near the crosshair. `key` is the key cap shown before the label (E unless told otherwise). */
  setInteractPrompt(label: string | null, key = 'E'): void {
    if (label === null) {
      this.interactPrompt.hidden = true;
      return;
    }
    if (this.interactLabel.textContent !== label) this.interactLabel.textContent = label;
    if (this.interactKey && this.interactKey.textContent !== key) this.interactKey.textContent = key;
    this.interactPrompt.hidden = false;
  }

  setScan(progress: number | null, label = 'Scanning'): void {
    if (progress === null) {
      this.scanReadout.hidden = true;
      return;
    }
    this.scanReadout.hidden = false;
    this.scanBar.style.width = `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%`;
    this.scanLabel.textContent = label;
  }

  setFlightHint(html: string | null): void {
    if (html === null) {
      this.flightHint.hidden = true;
      return;
    }
    this.flightHint.hidden = false;
    this.flightHint.innerHTML = html;
  }

  // ----------------------------------------------------------------- status

  /** Hearts, shown beside the Vidya counter while fighting or hurt. */
  setHearts(hearts: number, max: number, show: boolean): void {
    if (!this.heartsBox) {
      this.heartsBox = document.createElement('div');
      this.heartsBox.className = 'sb-hearts';
      this.heartsBox.setAttribute('aria-label', 'Strength');
      this.vidyaBox.after(this.heartsBox);
    }
    this.heartsBox.hidden = !show;
    const key = `${hearts}/${max}`;
    if (this.heartsBox.dataset.v === key) return;
    const lost = this.heartsBox.dataset.v ? Number(this.heartsBox.dataset.v.split('/')[0]) > hearts : false;
    this.heartsBox.dataset.v = key;
    this.heartsBox.replaceChildren(
      ...Array.from({ length: max }, (_, i) => {
        const h = document.createElement('i');
        if (i >= hearts) h.className = 'empty';
        return h;
      }),
    );
    if (lost) {
      this.heartsBox.classList.remove('hit');
      void this.heartsBox.offsetWidth;
      this.heartsBox.classList.add('hit');
    }
  }

  setVidya(value: number): void {
    const rounded = Math.round(value);
    if (rounded === this.lastVidya) return;
    this.lastVidya = rounded;
    this.vidyaValue.textContent = String(rounded);
    this.vidyaBox.classList.remove('bump');
    // Force a reflow so the animation restarts on consecutive gains.
    void this.vidyaBox.offsetWidth;
    this.vidyaBox.classList.add('bump');
  }

  setToolbelt(tools: Array<{ key: string; icon: string; name: string; locked?: boolean }>, activeIndex: number): void {
    this.toolbelt.replaceChildren(
      ...tools.map((tool, i) => {
        const slot = document.createElement('div');
        slot.className = 'tool-slot';
        if (i === activeIndex) slot.classList.add('active');
        if (tool.locked) slot.classList.add('locked');
        slot.title = tool.name;
        const key = document.createElement('span');
        key.className = 'ts-key';
        key.textContent = tool.key;
        const icon = document.createElement('span');
        icon.textContent = tool.icon;
        slot.append(key, icon);
        return slot;
      }),
    );
  }

  // ----------------------------------------------------------------- toasts

  toast(kind: ToastKind, title: string, body?: string, icon?: string, ttl = 5000): void {
    const el = document.createElement('div');
    el.className = 'toast';
    el.dataset.kind = kind;

    const iconEl = document.createElement('div');
    iconEl.className = 'toast-icon';
    iconEl.textContent = icon ?? defaultIcon(kind);

    const textWrap = document.createElement('div');
    const titleEl = document.createElement('div');
    titleEl.className = 'toast-title';
    titleEl.textContent = title;
    textWrap.appendChild(titleEl);
    if (body) {
      const bodyEl = document.createElement('div');
      bodyEl.className = 'toast-body';
      bodyEl.textContent = body;
      textWrap.appendChild(bodyEl);
    }

    el.append(iconEl, textWrap);
    this.toastHost.appendChild(el);

    const entry: ToastEntry = {
      el,
      timer: window.setTimeout(() => this.dismiss(entry), ttl),
    };
    this.toasts.push(entry);

    // Never let toasts fill the screen.
    while (this.toasts.length > 4) {
      const oldest = this.toasts.shift();
      if (oldest) this.dismiss(oldest, true);
    }
  }

  private dismiss(entry: ToastEntry, immediate = false): void {
    window.clearTimeout(entry.timer);
    const index = this.toasts.indexOf(entry);
    if (index >= 0) this.toasts.splice(index, 1);
    if (immediate) {
      entry.el.remove();
      return;
    }
    entry.el.classList.add('leaving');
    window.setTimeout(() => entry.el.remove(), 300);
  }
}

function must(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`[Hud] missing element #${id}`);
  return el;
}

function query(root: HTMLElement, selector: string): HTMLElement {
  const el = root.querySelector<HTMLElement>(selector);
  if (!el) throw new Error(`[Hud] missing element ${selector}`);
  return el;
}

function shortestAngle(deg: number): number {
  let d = ((deg + 180) % 360) - 180;
  if (d < -180) d += 360;
  return d;
}

function defaultIcon(kind: ToastKind): string {
  switch (kind) {
    case 'good':
      return '✓';
    case 'bad':
      return '✕';
    case 'codex':
      return '📖';
    case 'vidya':
      return '✦';
    default:
      return 'ℹ';
  }
}
