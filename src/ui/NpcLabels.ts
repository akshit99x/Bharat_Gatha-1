import * as THREE from 'three';
import { el } from './overlay';
import type { NpcView } from '../world/World';

/**
 * Nameplates over people.
 *
 * Anyone near enough gets a small plate with their name, their trade and a mark
 * for what they matter for: a star for the person who carries the chapter, a
 * compass for the next stop on a trail, a bang for somebody you have not spoken
 * to, a tick for someone you have. When somebody mutters a remark or waves hello,
 * it appears as a speech bubble over their head. The plates are DOM, projected
 * each frame, so the text is crisp and costs the 3D scene nothing.
 */

export type NpcMark = 'anchor' | 'trail' | 'new' | 'met';

const MARK_ICON: Record<NpcMark, string> = { anchor: '★', trail: '🧭', new: '❗', met: '✓' };
const MARK_TITLE: Record<NpcMark, string> = {
  anchor: 'Carries this chapter’s story',
  trail: 'Next stop on a trail',
  new: 'Not yet spoken to',
  met: 'You have spoken',
};

interface Plate {
  root: HTMLElement;
  bubble: HTMLElement;
  mark: HTMLElement;
  bubbleTimer: number;
}

const MAX_PLATES = 6;
const SHOW = 17;
const _v = new THREE.Vector3();

export class NpcLabels {
  private readonly host = el('div', 'npc-labels');
  private readonly plates = new Map<string, Plate>();
  /** Remarks that arrive before their plate exists. */
  private readonly pending = new Map<string, string>();

  constructor() {
    this.host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(this.host);
  }

  /** Put a speech bubble over someone. */
  bark(npcId: string, text: string): void {
    const plate = this.plates.get(npcId);
    if (!plate) {
      this.pending.set(npcId, text);
      return;
    }
    this.show(plate, text);
  }

  private show(plate: Plate, text: string): void {
    plate.bubble.textContent = text;
    plate.bubble.classList.add('on');
    window.clearTimeout(plate.bubbleTimer);
    plate.bubbleTimer = window.setTimeout(() => plate.bubble.classList.remove('on'), Math.min(7000, 2600 + text.length * 55));
  }

  setVisible(visible: boolean): void {
    this.host.hidden = !visible;
  }

  update(view: readonly NpcView[], camera: THREE.Camera, mark: (id: string) => NpcMark, width: number, height: number): void {
    const wanted = new Set<string>();
    let shown = 0;
    for (const v of view) {
      if (shown >= MAX_PLATES || v.distance > SHOW) break;
      _v.copy(v.head).project(camera);
      if (_v.z > 1 || _v.z < -1 || Math.abs(_v.x) > 1.1 || Math.abs(_v.y) > 1.1) continue;
      shown++;
      const id = v.npc.id;
      wanted.add(id);

      let plate = this.plates.get(id);
      if (!plate) {
        plate = this.build(v);
        this.plates.set(id, plate);
        this.host.appendChild(plate.root);
        const said = this.pending.get(id);
        if (said) {
          this.show(plate, said);
          this.pending.delete(id);
        }
      }
      const m = mark(id);
      if (plate.root.dataset.mark !== m) {
        plate.root.dataset.mark = m;
        plate.mark.textContent = MARK_ICON[m];
        plate.mark.title = MARK_TITLE[m];
      }
      const x = (_v.x * 0.5 + 0.5) * width;
      const y = (-_v.y * 0.5 + 0.5) * height;
      // Fade out toward the edge of range, and shrink a little with distance.
      const fade = Math.max(0, Math.min(1, (SHOW - v.distance) / 5));
      const scale = 1.05 - Math.min(0.35, v.distance / 55);
      plate.root.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
      plate.root.style.opacity = String(fade);
    }
    for (const [id, plate] of this.plates) {
      if (!wanted.has(id)) {
        plate.root.remove();
        window.clearTimeout(plate.bubbleTimer);
        this.plates.delete(id);
      }
    }
  }

  private build(v: NpcView): Plate {
    const root = el('div', 'npc-plate');
    const bubble = el('div', 'npc-bubble');
    const card = el('div', 'npc-card');
    const icon = el('span', 'npc-icon', v.npc.icon);
    const text = el('div', 'npc-text');
    text.append(el('b', 'npc-name', v.npc.name), el('small', 'npc-role', v.npc.role));
    const mark = el('span', 'npc-mark');
    card.append(icon, text, mark);
    root.append(bubble, card);
    return { root, bubble, mark, bubbleTimer: 0 };
  }
}
