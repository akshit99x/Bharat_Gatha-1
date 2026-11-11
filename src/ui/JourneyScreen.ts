import type { Profile } from '../core/Save';
import { audio } from '../core/Audio';
import { ZONES } from '../content/zones';
import type { Zone } from '../content/types';
import { getChapter } from '../content/story';
import { WORLD_HALF, WORLD_SIZE } from '../world/Terrain';
import { allProgress, journeyNext, stateOf, type ChapterProgress, type JourneyState } from '../story/Progress';
import { buildPanel, button, closeOverlay, el, mountOverlay } from './overlay';

/**
 * The Journey: the island map, the roadmap, and how to play, in one screen.
 *
 *  - **Map.** The whole island, drawn from the same terrain as the world, with
 *    the route through the eleven chapters laid across it, every region coloured
 *    by how far you have got, the landing terraces you can travel to, and you.
 *    Click a region for its detail and its next step.
 *  - **Roadmap.** The route as a timeline of cards, with a banner at the top that
 *    says the single most useful thing to do now.
 *  - **How to play.** What the game is, the controls, how a chapter is played, and
 *    what the marks on nameplates mean.
 */

export interface JourneyDeps {
  profile(): Profile;
  island(): HTMLCanvasElement;
  player(): { x: number; z: number; yaw: number };
  pads(): Array<{ zoneId: string; x: number; z: number }>;
  controls: ReadonlyArray<readonly [string, readonly string[]]>;
  travel(zoneId: string): void;
  seal(zoneId: string): void;
  gatha(): void;
}

export type JourneyTab = 'map' | 'roadmap' | 'guide';

const MAP = 640;

const STATE_COLOUR: Record<JourneyState, string> = {
  unvisited: '#7d8190',
  inProgress: '#ff9d4d',
  sealed: '#5fd0c2',
  restored: '#ffd97a',
};

const STATE_LABEL: Record<JourneyState, string> = {
  unvisited: 'Not yet visited',
  inProgress: 'In progress',
  sealed: 'Sealed — panel waiting',
  restored: 'Panel restored',
};

export class JourneyScreen {
  constructor(private readonly deps: JourneyDeps) {}

  present(tab: JourneyTab = 'map', select?: string): void {
    let current: JourneyTab = tab;
    let selected: string | null = select ?? null;
    let stopMap: (() => void) | null = null;

    const { panel, body, foot } = buildPanel({ title: 'The Journey', subtitle: '', width: 'wide', closable: true, onClose: () => close() });
    panel.classList.add('jr-panel');
    const subtitle = panel.querySelector('.ph-sub') as HTMLElement | null;

    // Every way out of this screen goes through here, so the key handler and the map loop always stop.
    const onKey = (e: KeyboardEvent): void => {
      const tabKeys: Record<string, JourneyTab> = { '1': 'map', '2': 'roadmap', '3': 'guide' };
      const t = tabKeys[e.key];
      if (t && current !== t) {
        e.stopPropagation();
        current = t;
        render();
      }
    };
    const close = (): void => {
      window.removeEventListener('keydown', onKey, true);
      stopMap?.();
      closeOverlay();
    };

    const render = (): void => {
      stopMap?.();
      stopMap = null;
      body.replaceChildren();
      foot.replaceChildren();

      const all = allProgress(this.deps.profile());
      const restored = all.filter((p) => p.restored).length;
      if (subtitle) subtitle.textContent = `${restored} of ${ZONES.length} panels restored · ${all.filter((p) => p.discovered).length} regions discovered`;

      const tabs = el('div', 'jr-tabs');
      const mk = (id: JourneyTab, label: string, key: string): void => {
        const b = el('button', id === current ? 'jr-tab active' : 'jr-tab') as HTMLButtonElement;
        b.type = 'button';
        b.append(el('span', undefined, label), el('kbd', undefined, key));
        b.addEventListener('click', () => {
          audio.click();
          current = id;
          render();
        });
        tabs.appendChild(b);
      };
      mk('map', 'Map', '1');
      mk('roadmap', 'Roadmap', '2');
      mk('guide', 'How to play', '3');
      body.appendChild(tabs);

      if (current === 'map') stopMap = this.renderMap(body, all, selected, (id) => {
        selected = id;
        render();
      }, close);
      else if (current === 'roadmap') this.renderRoadmap(body, all, (id) => {
        selected = id;
        current = 'map';
        render();
      }, close);
      else this.renderGuide(body);

      const hint = el('span', undefined, 'M map · J codex · K the Gatha · F1 this guide');
      const done = button('Close', 'btn btn-primary');
      done.addEventListener('click', close);
      foot.append(hint, done);
    };

    window.addEventListener('keydown', onKey, true);
    mountOverlay('journey', panel, { onEscape: close });
    render();
  }

  // -------------------------------------------------------------------- map

  private renderMap(
    into: HTMLElement,
    all: ChapterProgress[],
    selected: string | null,
    select: (zoneId: string | null) => void,
    close: () => void,
  ): () => void {
    const layout = el('div', 'jr-map-layout');
    const stage = el('div', 'jr-map-stage');
    const canvas = el('canvas', 'jr-canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = MAP * dpr;
    canvas.height = MAP * dpr;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', 'Map of the island with the eleven chapters');
    const tip = el('div', 'jr-tip');
    tip.hidden = true;
    const legend = el('div', 'jr-legend');
    for (const s of ['unvisited', 'inProgress', 'sealed', 'restored'] as const) {
      const item = el('span');
      const dot = el('i');
      dot.style.background = STATE_COLOUR[s];
      item.append(dot, STATE_LABEL[s]);
      legend.appendChild(item);
    }
    const trav = el('span');
    trav.append(el('i', 'tri'), 'Landing terrace');
    legend.appendChild(trav);
    stage.append(canvas, tip);
    stage.append(legend);

    const side = el('aside', 'jr-side');
    layout.append(stage, side);
    into.appendChild(layout);

    const profile = this.deps.profile();
    const byZone = new Map(all.map((p) => [p.zone.id, p]));
    const pads = this.deps.pads();
    let hover: string | null = null;
    let sel = selected;

    // --- projection: world (x, z) to canvas pixels; north is -z, at the top.
    const px = (x: number): number => ((x + WORLD_HALF) / WORLD_SIZE) * MAP;
    const py = (z: number): number => ((z + WORLD_HALF) / WORLD_SIZE) * MAP;
    const discR = (z: Zone): number => (z.radius / WORLD_SIZE) * MAP * 0.5;

    const zoneAtPoint = (cx: number, cy: number): string | null => {
      let best: string | null = null;
      let bestD = Infinity;
      for (const z of ZONES) {
        const d = Math.hypot(cx - px(z.center[0]), cy - py(z.center[1]));
        if (d < Math.max(22, discR(z) + 6) && d < bestD) {
          best = z.id;
          bestD = d;
        }
      }
      return best;
    };

    const logical = (e: MouseEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * MAP, y: ((e.clientY - r.top) / r.height) * MAP };
    };

    canvas.addEventListener('pointermove', (e) => {
      const p = logical(e);
      const id = zoneAtPoint(p.x, p.y);
      if (id !== hover) {
        hover = id;
        canvas.style.cursor = id ? 'pointer' : 'default';
        if (id) {
          const pr = byZone.get(id) as ChapterProgress;
          tip.hidden = false;
          tip.replaceChildren(el('b', undefined, `${pr.zone.chapter}. ${pr.zone.name}`), el('small', undefined, `${STATE_LABEL[stateOf(pr)]} · ${Math.round(pr.fraction * 100)}%`));
        } else tip.hidden = true;
      }
      if (id) {
        const r = stage.getBoundingClientRect();
        tip.style.left = `${e.clientX - r.left + 14}px`;
        tip.style.top = `${e.clientY - r.top + 14}px`;
      }
    });
    canvas.addEventListener('pointerleave', () => {
      hover = null;
      tip.hidden = true;
    });
    canvas.addEventListener('click', (e) => {
      const p = logical(e);
      const id = zoneAtPoint(p.x, p.y);
      audio.click();
      if (id) {
        sel = id;
        select(id);
      }
    });

    // --- drawing
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const island = this.deps.island();
    let raf = 0;
    let stopped = false;

    const draw = (t: number): void => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, MAP, MAP);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(island, 0, 0, MAP, MAP);

      // A vignette and a soft grid, so it reads as a chart rather than a screenshot.
      const v = ctx.createRadialGradient(MAP / 2, MAP / 2, MAP * 0.32, MAP / 2, MAP / 2, MAP * 0.72);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(8,10,20,0.55)');
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, MAP, MAP);
      ctx.strokeStyle = 'rgba(255,255,255,0.05)';
      ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        ctx.beginPath();
        ctx.moveTo((MAP / 8) * i, 0);
        ctx.lineTo((MAP / 8) * i, MAP);
        ctx.moveTo(0, (MAP / 8) * i);
        ctx.lineTo(MAP, (MAP / 8) * i);
        ctx.stroke();
      }

      drawRoute(t);
      for (const z of ZONES) drawZone(z, t);
      for (const pad of pads) drawPad(pad);
      drawPlayer(t);
      drawCompass();
    };

    const drawRoute = (t: number): void => {
      // The guided path through the chapters, 1 to 11. Done legs are solid gold; the live one marches.
      for (let i = 0; i < ZONES.length - 1; i++) {
        const a = ZONES[i] as Zone;
        const b = ZONES[i + 1] as Zone;
        const ax = px(a.center[0]);
        const ay = py(a.center[1]);
        const bx = px(b.center[0]);
        const by = py(b.center[1]);
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        // Bow each leg a little so the route reads as a voyage, not a ruler line.
        const nx = -(by - ay);
        const ny = bx - ax;
        const len = Math.hypot(nx, ny) || 1;
        const cx = mx + (nx / len) * len * 0.12;
        const cy = my + (ny / len) * len * 0.12;
        const done = byZone.get(a.id)?.restored === true;
        const live = !done && byZone.get(a.id)?.discovered === true;

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = done ? 3 : 2;
        ctx.strokeStyle = done ? 'rgba(255,217,122,0.95)' : live ? 'rgba(255,157,77,0.9)' : 'rgba(255,255,255,0.35)';
        if (!done) {
          ctx.setLineDash([7, 7]);
          ctx.lineDashOffset = live ? -t * 0.02 : 0;
        }
        ctx.shadowColor = 'rgba(0,0,0,0.6)';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.quadraticCurveTo(cx, cy, bx, by);
        ctx.stroke();
        ctx.restore();

        // An arrowhead near the end of the leg.
        const tt = 0.78;
        const qx = (1 - tt) * (1 - tt) * ax + 2 * (1 - tt) * tt * cx + tt * tt * bx;
        const qy = (1 - tt) * (1 - tt) * ay + 2 * (1 - tt) * tt * cy + tt * tt * by;
        const dx = 2 * (1 - tt) * (cx - ax) + 2 * tt * (bx - cx);
        const dy = 2 * (1 - tt) * (cy - ay) + 2 * tt * (by - cy);
        const ang = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(qx, qy);
        ctx.rotate(ang);
        ctx.fillStyle = done ? '#ffd97a' : 'rgba(255,255,255,0.6)';
        ctx.beginPath();
        ctx.moveTo(6, 0);
        ctx.lineTo(-4, -4);
        ctx.lineTo(-4, 4);
        ctx.fill();
        ctx.restore();
      }
    };

    const drawZone = (z: Zone, t: number): void => {
      const pr = byZone.get(z.id) as ChapterProgress;
      const state = stateOf(pr);
      const x = px(z.center[0]);
      const y = py(z.center[1]);
      const r = discR(z);
      const col = STATE_COLOUR[state];
      const active = sel === z.id;
      const hot = hover === z.id;

      // The region itself: a soft disc, brighter the further through it you are.
      ctx.save();
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, hexA(col, state === 'unvisited' ? 0.12 : 0.28));
      g.addColorStop(1, hexA(col, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();

      // A progress ring around the numbered badge.
      const br = 17;
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, br + 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = col;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(x, y, br + 2, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.001, pr.fraction));
      ctx.stroke();

      ctx.fillStyle = state === 'unvisited' ? '#2b2e3a' : '#1a1422';
      ctx.beginPath();
      ctx.arc(x, y, br - 1, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = state === 'unvisited' ? '#b8bccb' : '#fff3d6';
      ctx.font = '700 15px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(z.chapter), x, y + 1);

      if (state === 'restored') {
        ctx.fillStyle = '#ffd97a';
        ctx.font = '700 11px sans-serif';
        ctx.fillText('✦', x + 15, y - 15);
      }

      if (active || hot) {
        ctx.strokeStyle = active ? '#ffffff' : 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.lineDashOffset = -t * 0.02;
        ctx.beginPath();
        ctx.arc(x, y, br + 11, 0, Math.PI * 2);
        ctx.stroke();
      }

      // The name, on a plate so it is readable over any terrain.
      ctx.setLineDash([]);
      ctx.font = '600 12px Mukta, sans-serif';
      const label = z.name.length > 20 ? `${z.name.slice(0, 19)}…` : z.name;
      const w = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(14,12,22,0.78)';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y + br + 8, w, 18, 5);
      ctx.fill();
      ctx.fillStyle = state === 'unvisited' ? '#b8bccb' : '#f3e7cf';
      ctx.fillText(label, x, y + br + 17.5);
      ctx.restore();
    };

    const drawPad = (pad: { zoneId: string; x: number; z: number }): void => {
      const pr = byZone.get(pad.zoneId);
      if (!pr?.discovered) return;
      const x = px(pad.x);
      const y = py(pad.z);
      ctx.save();
      ctx.fillStyle = '#ffd97a';
      ctx.strokeStyle = 'rgba(20,10,4,0.8)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, y - 6);
      ctx.lineTo(x + 5.5, y + 4);
      ctx.lineTo(x - 5.5, y + 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const drawPlayer = (t: number): void => {
      const p = this.deps.player();
      const x = px(p.x);
      const y = py(p.z);
      ctx.save();
      const pulse = (Math.sin(t * 0.004) + 1) / 2;
      ctx.strokeStyle = `rgba(255,255,255,${0.5 - pulse * 0.4})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, 9 + pulse * 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.translate(x, y);
      // yaw 0 faces -z in this game, which is up the map.
      ctx.rotate(-p.yaw + Math.PI);
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#1b1422';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(7, 8);
      ctx.lineTo(0, 4);
      ctx.lineTo(-7, 8);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    const drawCompass = (): void => {
      ctx.save();
      ctx.translate(MAP - 40, 42);
      ctx.strokeStyle = 'rgba(243,231,207,0.8)';
      ctx.fillStyle = 'rgba(243,231,207,0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 18);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = '#ffd97a';
      ctx.beginPath();
      ctx.moveTo(0, -18);
      ctx.lineTo(5, 0);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(243,231,207,0.95)';
      ctx.font = '700 11px Cinzel, serif';
      ctx.textAlign = 'center';
      ctx.fillText('N', 0, -26);
      ctx.restore();
    };

    const frame = (t: number): void => {
      if (stopped || !canvas.isConnected) return;
      draw(t);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    // --- side panel
    this.renderZonePanel(side, sel ? (byZone.get(sel) ?? null) : null, profile, select, close);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
    };
  }

  private renderZonePanel(
    side: HTMLElement,
    pr: ChapterProgress | null,
    profile: Profile,
    select: (id: string | null) => void,
    close: () => void,
  ): void {
    side.replaceChildren();
    if (!pr) {
      const next = journeyNext(profile);
      const card = el('div', 'jr-next');
      card.append(el('h4', undefined, 'Your next step'), el('p', undefined, next.text));
      if (next.zone) {
        const go = button(`Show ${next.zone.name}`, 'btn btn-primary');
        go.addEventListener('click', () => select((next.zone as Zone).id));
        card.appendChild(go);
      }
      side.append(
        card,
        el('p', 'jr-hint', 'Click a region on the map to see what is there, how far you are, and what to do next. The dashed line is the route through the chapters; a solid gold leg means that chapter’s panel is restored.'),
      );
      const list = el('ol', 'jr-chapters');
      for (const p of allProgress(profile)) {
        const li = el('li', stateOf(p));
        const b = el('button') as HTMLButtonElement;
        b.type = 'button';
        b.append(el('span', 'jr-ch-no', String(p.zone.chapter)), el('span', 'jr-ch-name', p.zone.name), el('span', 'jr-ch-pct', `${Math.round(p.fraction * 100)}%`));
        b.addEventListener('click', () => select(p.zone.id));
        li.appendChild(b);
        list.appendChild(li);
      }
      side.appendChild(list);
      return;
    }

    const zone = pr.zone;
    const chapter = getChapter(zone.id);
    const state = stateOf(pr);

    const back = button('← All regions', 'btn btn-ghost jr-back');
    back.addEventListener('click', () => select(null));
    const head = el('div', 'jr-zone-head');
    head.dataset.state = state;
    head.append(
      el('div', 'jr-zone-chapter', `Chapter ${zone.chapter}`),
      el('h3', undefined, zone.name),
      el('div', 'jr-zone-local', zone.nameLocal),
      el('div', 'jr-zone-era', zone.era),
    );
    if (chapter) head.appendChild(el('div', 'jr-zone-story', `“${chapter.title}”`));
    head.appendChild(el('p', 'jr-zone-tag', zone.tagline));

    const bars = el('div', 'jr-bars');
    const row = (label: string, done: number, total: number): void => {
      const r = el('div', 'jr-bar');
      const fill = el('i');
      fill.style.width = `${total > 0 ? Math.round((done / total) * 100) : 0}%`;
      const track = el('span', 'jr-track');
      track.appendChild(fill);
      r.append(el('span', 'jr-bar-label', label), track, el('span', 'jr-bar-num', `${done}/${total}`));
      if (done >= total && total > 0) r.classList.add('full');
      bars.appendChild(r);
    };
    row('Monuments scanned', pr.scanned, pr.scanTotal);
    row('People met', pr.met, pr.metTotal);
    row('Challenges', pr.challenges, pr.challengeTotal);
    row('Plaques corrected', pr.plaques, pr.plaqueTotal);
    row('Trail', pr.trail, pr.trailTotal);

    const flags = el('div', 'jr-flags');
    flags.append(flag('Chapter sealed', pr.sealed), flag('Panel restored', pr.restored));

    const next = el('div', 'jr-next');
    next.append(el('h4', undefined, 'Next step here'), el('p', undefined, pr.next));

    const actions = el('div', 'jr-actions');
    if (pr.discovered) {
      const go = button('Travel to the terrace', 'btn btn-primary');
      go.addEventListener('click', () => {
        close();
        this.deps.travel(zone.id);
      });
      actions.appendChild(go);
    }
    if (pr.challenges >= pr.sealRequires && !pr.restored) {
      const seal = button(pr.sealed ? 'Retake the assessment' : 'Take the chapter assessment', 'btn btn-ghost');
      seal.addEventListener('click', () => {
        close();
        this.deps.seal(zone.id);
      });
      actions.appendChild(seal);
    }
    if (pr.sealed) {
      const gatha = button(pr.restored ? 'See the panel' : 'Restore the panel', 'btn btn-ghost');
      gatha.addEventListener('click', () => {
        close();
        this.deps.gatha();
      });
      actions.appendChild(gatha);
    }
    side.append(back, head, bars, flags, next, actions);
  }

  // ---------------------------------------------------------------- roadmap

  private renderRoadmap(into: HTMLElement, all: ChapterProgress[], showOnMap: (id: string) => void, close: () => void): void {
    const profile = this.deps.profile();
    const next = journeyNext(profile);
    const restored = all.filter((p) => p.restored).length;

    const banner = el('div', 'jr-banner');
    const ring = el('div', 'jr-ring');
    ring.style.setProperty('--p', String(restored / ZONES.length));
    ring.append(el('b', undefined, `${restored}`), el('small', undefined, `of ${ZONES.length}`));
    const text = el('div');
    text.append(el('h4', undefined, 'Your next step'), el('p', undefined, next.text));
    if (next.zone) {
      const go = button(`Show ${next.zone.name} on the map`, 'btn btn-primary');
      go.addEventListener('click', () => showOnMap((next.zone as Zone).id));
      text.appendChild(go);
    }
    banner.append(ring, text);

    const sabha = el('div', 'jr-late');
    const late = (label: string, done: boolean, locked: boolean): void => {
      const s = el('span', done ? 'done' : locked ? 'locked' : 'open', `${done ? '✓' : locked ? '🔒' : '○'} ${label}`);
      sabha.appendChild(s);
    };
    late('Restore 3 panels', restored >= 3, false);
    late('The Sabha of Sources', profile.story.sabhaDone, restored < 3);
    late('Restore all 11 panels', restored >= ZONES.length, false);
    late('The Twelfth Panel', profile.story.twelfth !== null, !profile.story.sabhaDone);

    const line = el('ol', 'jr-timeline');
    for (const p of all) {
      const state = stateOf(p);
      const li = el('li', state);
      const node = el('span', 'jr-node', state === 'restored' ? '✦' : String(p.zone.chapter));
      const card = el('div', 'jr-card');
      const chapter = getChapter(p.zone.id);

      const head = el('div', 'jr-card-head');
      const titles = el('div');
      titles.append(el('b', undefined, p.zone.name), el('small', undefined, `${p.zone.era}${chapter ? ` · “${chapter.title}”` : ''}`));
      const badge = el('span', 'jr-badge', STATE_LABEL[state]);
      badge.dataset.state = state;
      head.append(titles, badge);

      const chips = el('div', 'jr-chips');
      const chip = (label: string, d: number, t: number): void => {
        const c = el('span', d >= t && t > 0 ? 'full' : '', `${label} ${d}/${t}`);
        chips.appendChild(c);
      };
      chip('Monuments', p.scanned, p.scanTotal);
      chip('Challenges', p.challenges, p.challengeTotal);
      chip('Plaques', p.plaques, p.plaqueTotal);
      chip('Trail', p.trail, p.trailTotal);

      const nextLine = el('p', 'jr-card-next');
      nextLine.append(el('b', undefined, state === 'restored' ? 'Done. ' : 'Next: '), p.next);

      const actions = el('div', 'jr-card-actions');
      const map = button('On the map', 'btn btn-ghost');
      map.addEventListener('click', () => showOnMap(p.zone.id));
      actions.appendChild(map);
      if (p.discovered) {
        const go = button('Travel', 'btn btn-ghost');
        go.addEventListener('click', () => {
          close();
          this.deps.travel(p.zone.id);
        });
        actions.appendChild(go);
      }
      card.append(head, chips, nextLine, actions);
      li.append(node, card);
      line.appendChild(li);
    }
    into.append(banner, sabha, line);
  }

  // ------------------------------------------------------------------ guide

  private renderGuide(into: HTMLElement): void {
    const profile = this.deps.profile();
    const wrap = el('div', 'jr-guide');

    const section = (title: string): HTMLElement => {
      const s = el('section', 'jr-sec');
      s.appendChild(el('h3', undefined, title));
      wrap.appendChild(s);
      return s;
    };

    // The idea, in four sentences.
    const idea = section('What this is');
    idea.append(
      el('p', undefined, 'The island holds the Gatha, a scroll of eleven painted panels, one for each era. A haze called the Dhundh is clouding it: it either gilds the past into a fairy-tale, or erases it into a shrug.'),
      el('p', undefined, 'You walk each region, look at the evidence, and ask of every claim: how do we know that? Do that well enough and the panel comes back.'),
    );

    // First steps, ticking themselves off.
    const steps = section('Your first steps');
    const story = profile.story;
    const done = (cond: boolean): boolean => cond;
    const list = el('ol', 'jr-steps');
    const step = (ok: boolean, title: string, how: string): void => {
      const li = el('li', ok ? 'done' : '');
      li.append(el('span', 'jr-tick', ok ? '✓' : '○'));
      const t = el('div');
      t.append(el('b', undefined, title), el('small', undefined, how));
      li.appendChild(t);
      list.appendChild(li);
    };
    step(done(Object.values(profile.zones).some((z) => z.discovered)), 'Land somewhere', 'Press Space to drop from the vimana. Any region will do.');
    step(done(profile.stats.landmarksScanned > 0), 'Scan a monument', 'Look at a big building and hold the right mouse button. It adds an entry to the codex.');
    step(done(story.met.length > 0), 'Speak with someone', 'Walk up to a person and press E. Look for nameplates: ★ carries the chapter, 🧭 is your next stop, ❗ is new.');
    step(done(profile.codex.length > 0), 'Read the codex', 'Press J. Every entry says what kind of evidence it rests on.');
    step(done(profile.stats.challengesDone > 0), 'Play a challenge', 'Find a glowing post and press E. Each is a small game; none can be failed for good.');
    step(done(Object.values(story.plaques).some((p) => p.done)), 'Correct a plaque', 'A grey-hazed stone beside a monument. Read its evidence in the codex first, then judge its claim.');
    step(done(Object.values(profile.zones).some((z) => z.sealed)), 'Seal a chapter', 'Complete enough challenges, open this map, and take the chapter assessment.');
    step(done(story.panels.length > 0), 'Restore a panel', 'After sealing, Maitri asks one question and the panel returns. Press K to see it.');
    steps.appendChild(list);

    // Controls.
    const keys = section('Controls');
    const grid = el('div', 'key-grid');
    for (const [action, ks] of this.deps.controls) {
      const row = el('div', 'key-row');
      row.appendChild(el('span', undefined, action));
      const wrapKeys = el('span', 'keys');
      for (const k of ks) {
        const kbd = document.createElement('kbd');
        kbd.textContent = k;
        wrapKeys.appendChild(kbd);
      }
      row.appendChild(wrapKeys);
      grid.appendChild(row);
    }
    keys.appendChild(grid);

    // How a chapter goes.
    const loop = section('How a chapter goes');
    const flow = el('ol', 'jr-flow');
    for (const [t, d] of [
      ['Explore', 'Scan the monuments. Each unlocks codex entries that say what is known and how.'],
      ['Meet the people', 'Speak with everyone. They know things a monument cannot say. A trail links three of them.'],
      ['Play the challenges', 'Sequencing, matching, building, weighing, patterns, archery, gathering: each teaches one skill of the period.'],
      ['Correct the plaques', 'Three claims per region, each under the wrong label. Judge where the honest version belongs.'],
      ['Seal the chapter', 'A short assessment once enough challenges are done. Nothing is deducted for a wrong answer.'],
      ['Restore the panel', 'Maitri’s one question. Then the panel hangs on the Gatha, and the haze lifts from the region.'],
    ] as const) {
      const li = el('li');
      li.append(el('b', undefined, t), el('span', undefined, d));
      flow.appendChild(li);
    }
    loop.appendChild(flow);

    // The marks.
    const marks = section('Reading a nameplate');
    const mark = el('div', 'jr-marks');
    for (const [icon, label] of [
      ['★', 'Carries this chapter’s story: hear them out'],
      ['🧭', 'The next stop on a trail'],
      ['❗', 'Someone you have not spoken to'],
      ['✓', 'You have spoken'],
    ] as const) {
      const m = el('div');
      m.append(el('span', 'jr-mark', icon), el('span', undefined, label));
      mark.appendChild(m);
    }
    marks.appendChild(mark);

    // Honest history.
    const evidence = section('The four kinds of evidence');
    const ev = el('div', 'jr-ev');
    for (const [src, name, note] of [
      ['archaeology', 'Archaeology', 'Dug up: buildings, tools, inscriptions, coins.'],
      ['text', 'Written source', 'A dated text or inscription says so.'],
      ['epic', 'Epic tradition', 'Cultural truth, not a dig report, and none the less for it.'],
      ['debate', 'Debated', 'Historians genuinely disagree. Both readings are shown.'],
    ] as const) {
      const e = el('div');
      const badge = el('span', 'src-badge', name);
      badge.dataset.src = src;
      e.append(badge, el('span', undefined, note));
      ev.appendChild(e);
    }
    evidence.append(ev, el('p', 'jr-small', 'Plaques add two more answers: “Overstated” (a true core stretched too far) and “No evidence” (nothing supports it).'));

    const tips = section('Good to know');
    const tl = el('ul', 'jr-tips');
    for (const t of [
      'Nothing is ever deducted. A wrong answer explains itself; the score only changes how much Vidya you earn.',
      'Wandering is fine. You can drop into any region first and the story still works.',
      'The map’s “Travel to the terrace” button takes you to any region you have found, and the landing terraces in the world do too.',
      'The pause menu (Esc) has Shadows, voices, music and sound sliders, and exports your learning record.',
      'Every region has its own music, tuned to its place and time. Turn the volume up and listen.',
    ]) tl.appendChild(el('li', undefined, t));
    tips.appendChild(tl);

    into.appendChild(wrap);
  }
}

// ----------------------------------------------------------------- helpers

function flag(label: string, on: boolean): HTMLElement {
  const f = el('span', on ? 'on' : '', `${on ? '✓' : '○'} ${label}`);
  return f;
}

function hexA(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}
