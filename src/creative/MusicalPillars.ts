import * as THREE from 'three';
import type { Collider } from '../world/architecture/kit';
import { masonryMaterial } from '../world/Materials';
import type { World } from '../world/World';
import { audio } from '../core/Audio';

/**
 * The Sangita Mandapa: a small open hall of ringing pillars beside Hampi's Stone Chariot.
 *
 * At the Vittala temple the pillars of the halls are clusters of slender colonettes cut from the same
 * granite as the column, and tapping them gives clear notes. (Visitors may no longer tap the real ones,
 * to protect them.) Here there are seven, tuned Sa to Ni, and the player strikes them with E. Three melodies
 * are waiting to be found: the scale up, the scale down, and a phrase in raga Durga.
 */

const SARGAM = ['Sa', 'Re', 'Ga', 'Ma', 'Pa', 'Dha', 'Ni'] as const;
/** Just intonation over Sa, the way a tanpura player would tune. */
const RATIOS = [1, 9 / 8, 5 / 4, 4 / 3, 3 / 2, 5 / 3, 15 / 8];
const SA_HZ = 277.18;
const SPACING = 2.1;
const PLINTH_H = 0.6;
const STRIKE_REACH = 2.6;

export interface Melody {
  id: string;
  name: string;
  /** Pillar indices, 0 = Sa. */
  notes: readonly number[];
  note: string;
}

export const MELODIES: readonly Melody[] = [
  { id: 'arohana', name: 'Arohana', notes: [0, 1, 2, 3, 4, 5, 6], note: 'The ascent: every note of the scale, climbing.' },
  { id: 'avarohana', name: 'Avarohana', notes: [6, 5, 4, 3, 2, 1, 0], note: 'The descent: the same notes, coming home to Sa.' },
  {
    id: 'durga',
    name: 'A phrase in raga Durga',
    notes: [0, 1, 3, 4, 5, 4, 3, 1, 0],
    note: 'Sa Re Ma Pa Dha, and back. Durga leaves out Ga and Ni, and that absence is its colour. The music you hear in Vijayanagara is built on the same five notes.',
  },
];

interface Pillar {
  index: number;
  world: THREE.Vector3;
  ring: THREE.Mesh;
  glow: number;
}

function paint(geo: THREE.BufferGeometry, color: number, jitter = 0.05): THREE.BufferGeometry {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const n = g.getAttribute('position').count;
  const c = new THREE.Color(color);
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i += 3) {
    const k = 1 + (Math.random() - 0.5) * jitter;
    for (let j = 0; j < 3 && i + j < n; j++) {
      arr[(i + j) * 3] = c.r * k;
      arr[(i + j) * 3 + 1] = c.g * k;
      arr[(i + j) * 3 + 2] = c.b * k;
    }
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  g.computeVertexNormals();
  return g;
}

function labelSprite(text: string): THREE.Sprite {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.font = '600 40px Georgia, serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(40,24,10,0.55)';
    ctx.fillText(text, 66, 34);
    ctx.fillStyle = '#ffd98a';
    ctx.fillText(text, 64, 32);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  s.scale.set(0.8, 0.4, 1);
  return s;
}

export class MusicalPillars {
  readonly group = new THREE.Group();
  readonly origin = new THREE.Vector3();
  private readonly pillars: Pillar[] = [];
  private history: number[] = [];
  private introduced = false;
  /** Called when a melody is completed. */
  onMelody: (m: Melody) => void = () => {};

  /** `avoid`: places the hall must keep clear of (haze columns, people, challenges, hidden letters). */
  constructor(world: World, avoid: readonly THREE.Vector3[] = []) {
    const anchor = world.landmarks.find((l) => l.id === 'hampi-chariot');
    if (!anchor) return;
    const spot = this.findSpot(world, anchor.position, avoid);
    if (!spot) return;
    const { x, z, y, rot } = spot;
    this.origin.set(x, y, z);
    this.group.position.set(x, y, z);
    this.group.rotation.y = rot;
    this.build();
    world.collision.addPlaced(this.colliders(), x, y, z, rot);
    this.group.updateMatrixWorld(true);
    for (const p of this.pillars) p.ring.getWorldPosition(p.world);
  }

  /** A clear, fairly level patch near the chariot, with the hall facing it. */
  private findSpot(world: World, centre: THREE.Vector3, avoid: readonly THREE.Vector3[]): { x: number; y: number; z: number; rot: number } | null {
    const halfW = 8.5;
    const halfD = 4;
    for (const dist of [30, 36, 42, 26, 50, 58]) {
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2 + 0.3;
        const x = centre.x + Math.cos(a) * dist;
        const z = centre.z + Math.sin(a) * dist;
        if (avoid.some((p) => Math.hypot(p.x - x, p.z - z) < 18)) continue;
        const rot = Math.atan2(centre.x - x, centre.z - z);
        const c = Math.cos(rot);
        const s = Math.sin(rot);
        let lo = Infinity;
        let hi = -Infinity;
        let ok = true;
        for (let i = -2; i <= 2 && ok; i++) {
          for (let j = -1; j <= 1 && ok; j++) {
            const lx = (i / 2) * halfW;
            const lz = j * halfD;
            const wx = x + lx * c + lz * s;
            const wz = z - lx * s + lz * c;
            const h = world.heightAt(wx, wz);
            if (h < 0.6) ok = false;
            lo = Math.min(lo, h);
            hi = Math.max(hi, h);
            if (world.collision.columnAt(wx, wz).some((b) => b.maxY > h + 0.2)) ok = false;
          }
        }
        if (ok && hi - lo < 1.6) return { x, y: hi, z, rot };
      }
    }
    return null;
  }

  private build(): void {
    const mat = masonryMaterial();
    const granite = 0xb7a587;
    const add = (geo: THREE.BufferGeometry, x: number, y: number, z: number, color = granite): THREE.Mesh => {
      const m = new THREE.Mesh(paint(geo, color), mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.receiveShadow = true;
      this.group.add(m);
      return m;
    };
    const width = SPACING * 6 + 3.4;
    // Plinth, sunk into the ground so slopes never show its underside, with a moulded edge.
    add(new THREE.BoxGeometry(width, PLINTH_H + 2.5, 7.2), 0, PLINTH_H - (PLINTH_H + 2.5) / 2, -1.2, 0xa8977a);
    add(new THREE.BoxGeometry(width + 0.3, 0.16, 7.5), 0, PLINTH_H - 0.08, -1.2, 0x9c8b70);
    // Front row: the seven ringing pillars. Back row: plain square columns.
    const H = 3.6;
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * SPACING;
      add(new THREE.BoxGeometry(0.7, 0.35, 0.7), x, PLINTH_H + 0.17, 0);
      add(new THREE.BoxGeometry(0.42, H, 0.42), x, PLINTH_H + H / 2, 0);
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
        add(new THREE.CylinderGeometry(0.075, 0.085, H - 0.5, 8), x + Math.cos(a) * 0.36, PLINTH_H + 0.35 + (H - 0.5) / 2, Math.sin(a) * 0.36, 0xc2b192);
      }
      add(new THREE.BoxGeometry(0.95, 0.3, 0.95), x, PLINTH_H + H - 0.1, 0);
      // A thin ring of light that pulses when the pillar sounds.
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.62, 0.035, 6, 32),
        new THREE.MeshBasicMaterial({ color: 0xffcf6a, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(x, PLINTH_H + 1.4, 0);
      this.group.add(ring);
      const label = labelSprite(SARGAM[i] as string);
      label.position.set(x, PLINTH_H + 0.62, 0.75);
      this.group.add(label);
      this.pillars.push({ index: i, world: new THREE.Vector3(), ring, glow: 0 });

      add(new THREE.BoxGeometry(0.5, H, 0.5), x, PLINTH_H + H / 2, -3.6, 0xae9d80);
    }
    // Roof: a flat slab with a deep overhanging eave, the way Vijayanagara halls are roofed.
    add(new THREE.BoxGeometry(width + 0.6, 0.35, 6.4), 0, PLINTH_H + H + 0.22, -1.8, 0xa29174);
    add(new THREE.BoxGeometry(width + 1.4, 0.16, 7.3), 0, PLINTH_H + H + 0.02, -1.8, 0x95846a);
    add(new THREE.BoxGeometry(width - 1, 0.5, 4.6), 0, PLINTH_H + H + 0.62, -1.8, 0xa8977a);
  }

  private colliders(): Collider[] {
    const width = SPACING * 6 + 3.4;
    const out: Collider[] = [
      { min: [-width / 2, -2.5, -4.8], max: [width / 2, PLINTH_H, 2.4] },
      { min: [-(width + 1.4) / 2, PLINTH_H + 3.6 - 0.06, -5.45], max: [(width + 1.4) / 2, PLINTH_H + 3.6 + 0.9, 1.85] },
    ];
    for (let i = 0; i < 7; i++) {
      const x = (i - 3) * SPACING;
      out.push({ min: [x - 0.5, PLINTH_H, -0.5], max: [x + 0.5, PLINTH_H + 3.6, 0.5] });
      out.push({ min: [x - 0.25, PLINTH_H, -3.85], max: [x + 0.25, PLINTH_H + 3.6, -3.35] });
    }
    return out;
  }

  get built(): boolean {
    return this.pillars.length > 0;
  }

  /** The pillar within reach, if any (the nearest one). */
  nearest(player: THREE.Vector3): Pillar | null {
    let best: Pillar | null = null;
    let bestD = STRIKE_REACH;
    for (const p of this.pillars) {
      const d = Math.hypot(player.x - p.world.x, player.z - p.world.z);
      if (d < bestD && Math.abs(player.y + 1 - p.world.y) < 2.4) {
        bestD = d;
        best = p;
      }
    }
    return best;
  }

  promptFor(p: Pillar): string {
    return `Strike the pillar · ${SARGAM[p.index]}`;
  }

  /** True the first time the player comes within reach, so the game can explain the hall once. */
  firstVisit(player: THREE.Vector3): boolean {
    if (this.introduced || !this.built) return false;
    if (player.distanceTo(this.origin) < 9) {
      this.introduced = true;
      return true;
    }
    return false;
  }

  strike(p: Pillar): void {
    audio.stoneNote(SA_HZ * (RATIOS[p.index] as number));
    p.glow = 1;
    this.history.push(p.index);
    if (this.history.length > 12) this.history.shift();
    for (const m of MELODIES) {
      const tail = this.history.slice(-m.notes.length);
      if (tail.length === m.notes.length && tail.every((v, i) => v === m.notes[i])) {
        this.history = [];
        this.onMelody(m);
        break;
      }
    }
  }

  update(dt: number): void {
    for (const p of this.pillars) {
      if (p.glow <= 0) continue;
      p.glow = Math.max(0, p.glow - dt * 1.4);
      const mat = p.ring.material as THREE.MeshBasicMaterial;
      mat.opacity = p.glow * 0.9;
      p.ring.scale.setScalar(1 + (1 - p.glow) * 0.8);
      p.ring.position.y = PLINTH_H + 1.4 + (1 - p.glow) * 1.2;
    }
  }
}

export { SARGAM };
