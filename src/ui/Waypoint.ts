import * as THREE from 'three';

/**
 * The gold marker: a diamond floating over the next thing to do, with a few words and the distance.
 *
 * When the target is on screen the diamond sits over it. When it is behind you or off to a side, the
 * diamond slides to the edge of the screen with an arrow pointing the way, so "where do I go?" always has
 * an answer without opening a map. It is plain DOM, projected from the 3D position each frame.
 */

const MARGIN_X = 54;
const MARGIN_TOP = 86; // clear of the compass strip
const MARGIN_BOTTOM = 110; // clear of the status bar

export interface WaypointTarget {
  position: THREE.Vector3;
  label: string;
}

export class Waypoint {
  private readonly root = document.createElement('div');
  private readonly marker = document.createElement('div');
  private readonly arrow = document.createElement('i');
  private readonly label = document.createElement('span');
  private readonly distance = document.createElement('span');
  private readonly text = document.createElement('div');
  private target: WaypointTarget | null = null;
  private enabled = true;
  private visible = true;
  private lastLabel = '';
  private lastDistance = '';
  private readonly v = new THREE.Vector3();

  constructor(parent: HTMLElement) {
    this.root.className = 'waypoint';
    this.root.setAttribute('aria-hidden', 'true');
    this.marker.className = 'wp-marker';
    const diamond = document.createElement('b');
    diamond.className = 'wp-diamond';
    this.text.className = 'wp-text';
    this.label.className = 'wp-label';
    this.distance.className = 'wp-dist';
    this.text.append(this.label, this.distance);
    this.arrow.className = 'wp-arrow';
    this.marker.append(this.arrow, diamond, this.text);
    this.root.append(this.marker);
    parent.append(this.root);
    this.root.hidden = true;
  }

  set(target: WaypointTarget | null): void {
    this.target = target;
    if (!target) this.root.hidden = true;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.root.hidden = true;
  }

  /** Hide while a dialogue or overlay is up. */
  setVisible(v: boolean): void {
    this.visible = v;
    if (!v) this.root.hidden = true;
  }

  /** Project and place. Returns the distance to the target in metres, or null with no target. */
  update(camera: THREE.PerspectiveCamera, width: number, height: number, from: THREE.Vector3): number | null {
    const t = this.target;
    if (!t) return null;
    const dist = Math.hypot(t.position.x - from.x, t.position.z - from.z);
    if (!this.enabled || !this.visible) {
      this.root.hidden = true;
      return dist;
    }
    this.root.hidden = false;

    // Camera space: three.js cameras look down -Z, so z > 0 is behind us.
    this.v.copy(t.position).applyMatrix4(camera.matrixWorldInverse);
    const behind = this.v.z > 0;
    this.v.copy(t.position).project(camera);
    let x = (this.v.x * 0.5 + 0.5) * width;
    let y = (-this.v.y * 0.5 + 0.5) * height;
    if (behind) {
      // Mirror it, so the arrow points the way you would turn, then pin it to the screen edge.
      x = width - x;
      y = height - y;
    }

    const minX = MARGIN_X;
    const maxX = width - MARGIN_X;
    const minY = MARGIN_TOP;
    const maxY = height - MARGIN_BOTTOM;
    const onScreen = !behind && x >= minX && x <= maxX && y >= minY && y <= maxY;

    let angle = 0;
    if (!onScreen) {
      const cx = width / 2;
      const cy = height / 2;
      let dx = x - cx;
      let dy = y - cy;
      if (behind && Math.abs(dx) < 1 && Math.abs(dy) < 1) dy = 1;
      // Scale the direction until it touches the padded rectangle.
      const sx = dx === 0 ? Infinity : (dx > 0 ? maxX - cx : minX - cx) / dx;
      const sy = dy === 0 ? Infinity : (dy > 0 ? maxY - cy : minY - cy) / dy;
      const k = Math.min(sx, sy);
      angle = Math.atan2(dy, dx);
      x = cx + dx * k;
      y = cy + dy * k;
      dx = 0;
      dy = 0;
    }

    const near = onScreen && dist < 12;
    this.marker.classList.toggle('edge', !onScreen);
    this.marker.classList.toggle('near', near);
    this.marker.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    this.arrow.style.transform = `rotate(${(angle + Math.PI / 2).toFixed(3)}rad)`;

    if (t.label !== this.lastLabel) {
      this.label.textContent = t.label;
      this.lastLabel = t.label;
    }
    const d = dist >= 1000 ? `${(dist / 1000).toFixed(1)} km` : `${Math.round(dist / 5) * 5 || Math.round(dist)} m`;
    if (d !== this.lastDistance) {
      this.distance.textContent = d;
      this.lastDistance = d;
    }
    // Keep the words on screen even when the diamond is pinned to an edge.
    const half = (this.text.offsetWidth || 160) / 2;
    const lo = 10 + half;
    const hi = width - 10 - half;
    const shift = x < lo ? lo - x : x > hi ? hi - x : 0;
    this.text.style.transform = `translateX(calc(-50% + ${shift.toFixed(1)}px))`;
    return dist;
  }
}
