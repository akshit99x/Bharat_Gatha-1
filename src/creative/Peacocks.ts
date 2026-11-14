import * as THREE from 'three';
import { audio } from '../core/Audio';
import type { World } from '../world/World';

/**
 * Peacocks. A few wander near Ayodhya's forest, Agra's charbagh and Hampi's fields, pecking and pausing.
 * Come close and one may raise its train into a full fan of eyespots, shiver it, and call.
 */

const HOMES: ReadonlyArray<readonly [string, number]> = [
  ['kosala-ashram', 3],
  ['kosala-panchavati', 2],
  ['agra-charbagh', 3],
  ['hampi-village', 2],
];
const RANGE = 260;
const WANDER = 16;

interface Bird {
  root: THREE.Group;
  neck: THREE.Group;
  fan: THREE.Mesh;
  home: THREE.Vector3;
  target: THREE.Vector3;
  /** 0 folded, 1 fully raised. */
  open: number;
  /** Seconds left of the display, or 0. */
  showing: number;
  wait: number;
  phase: number;
  cooldown: number;
}

let fanTex: THREE.Texture | null = null;
function fanTexture(): THREE.Texture {
  if (fanTex) return fanTex;
  const W = 512, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (ctx) {
    // The train: bronze-green feathers radiating from the base, scattered with eyespots.
    const cx = W / 2, cy = H;
    const g = ctx.createRadialGradient(cx, cy, 10, cx, cy, H);
    g.addColorStop(0, '#2c6b3f');
    g.addColorStop(0.6, '#3f7f3a');
    g.addColorStop(1, '#8a8a2c');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, H, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(200,220,120,0.35)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 70; i++) {
      const a = Math.PI + (i / 69) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + Math.cos(a) * H, cy + Math.sin(a) * H);
      ctx.stroke();
    }
    const eye = (x: number, y: number, s: number): void => {
      for (const [r, col] of [
        [1, '#c9a227'],
        [0.78, '#2a8a6a'],
        [0.55, '#1d5fa8'],
        [0.32, '#0c1f4a'],
      ] as Array<[number, string]>) {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(x, y, s * r, s * r * 1.25, 0, 0, Math.PI * 2);
        ctx.fill();
      }
    };
    for (const [ring, count, size] of [
      [0.95, 15, 13],
      [0.78, 12, 12],
      [0.6, 9, 11],
      [0.42, 6, 9],
    ] as Array<[number, number, number]>) {
      for (let i = 0; i < count; i++) {
        const a = Math.PI + ((i + 0.5) / count) * Math.PI;
        eye(cx + Math.cos(a) * H * ring, cy + Math.sin(a) * H * ring, size);
      }
    }
  }
  fanTex = new THREE.CanvasTexture(c);
  fanTex.colorSpace = THREE.SRGBColorSpace;
  return fanTex;
}

function buildBird(): Pick<Bird, 'root' | 'neck' | 'fan'> {
  const root = new THREE.Group();
  const blue = new THREE.MeshStandardMaterial({ color: 0x1d4fa6, roughness: 0.35, metalness: 0.25 });
  const green = new THREE.MeshStandardMaterial({ color: 0x2f6b3a, roughness: 0.5, metalness: 0.15 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xd9cfb4, roughness: 0.8 });
  const leg = new THREE.MeshStandardMaterial({ color: 0x8b7d6b, roughness: 0.9 });

  const body = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), blue);
  body.scale.set(0.9, 0.85, 1.35);
  body.position.y = 0.55;
  root.add(body);
  // The folded train trails behind and down.
  const train = new THREE.Mesh(new THREE.ConeGeometry(0.16, 1.3, 8), green);
  train.rotation.x = -Math.PI / 2 - 0.12;
  train.position.set(0, 0.48, -0.85);
  root.add(train);
  for (const side of [-1, 1]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.015, 0.4, 5), leg);
    l.position.set(side * 0.07, 0.2, 0.02);
    root.add(l);
  }
  const neck = new THREE.Group();
  neck.position.set(0, 0.62, 0.22);
  const n = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.075, 0.42, 8), blue);
  n.position.y = 0.18;
  n.rotation.x = 0.25;
  neck.add(n);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.065, 10, 8), blue);
  head.position.set(0, 0.4, 0.07);
  neck.add(head);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.08, 6), ivory);
  beak.rotation.x = Math.PI / 2;
  beak.position.set(0, 0.39, 0.15);
  neck.add(beak);
  // The crest: a little fan of bare shafts tipped with blue.
  for (let k = -2; k <= 2; k++) {
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 3), ivory);
    shaft.position.set(k * 0.012, 0.5, 0.05);
    shaft.rotation.z = k * 0.18;
    neck.add(shaft);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), blue);
    tip.position.set(k * 0.024, 0.56, 0.05);
    neck.add(tip);
  }
  root.add(neck);
  // The display fan, folded to nothing until it is raised.
  const fan = new THREE.Mesh(
    new THREE.CircleGeometry(1.25, 40, 0, Math.PI),
    new THREE.MeshStandardMaterial({ map: fanTexture(), side: THREE.DoubleSide, roughness: 0.4, metalness: 0.2, transparent: true }),
  );
  fan.position.set(0, 0.5, -0.28);
  fan.scale.set(0.001, 0.001, 1);
  fan.rotation.x = -0.18;
  root.add(fan);
  root.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) o.castShadow = true;
  });
  return { root, neck, fan };
}

export class Peacocks {
  readonly group = new THREE.Group();
  private readonly birds: Bird[] = [];

  constructor(private readonly world: World) {
    this.group.name = 'peacocks';
    let seed = 11;
    const rnd = (): number => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (const [id, n] of HOMES) {
      const lm = world.landmarks.find((l) => l.id === id);
      if (!lm) continue;
      for (let i = 0; i < n; i++) {
        const a = rnd() * Math.PI * 2;
        const p = world.standPoint(lm.position.x + Math.cos(a) * (12 + rnd() * 10), lm.position.z + Math.sin(a) * (12 + rnd() * 10), 30);
        const b = buildBird();
        b.root.position.set(p.x, p.y, p.z);
        b.root.rotation.y = rnd() * Math.PI * 2;
        this.group.add(b.root);
        const home = new THREE.Vector3(p.x, p.y, p.z);
        this.birds.push({ ...b, home, target: home.clone(), open: 0, showing: 0, wait: rnd() * 4, phase: rnd() * 10, cooldown: 4 + rnd() * 10 });
      }
    }
  }

  private pickTarget(b: Bird): void {
    for (let tries = 0; tries < 5; tries++) {
      const a = Math.random() * Math.PI * 2;
      const d = Math.random() * WANDER;
      const x = b.home.x + Math.cos(a) * d;
      const z = b.home.z + Math.sin(a) * d;
      const h = this.world.heightAt(x, z);
      if (h < 0.5) continue;
      if (this.world.collision.columnAt(x, z).some((box) => box.maxY > h + 0.3 && box.minY < h + 1.2)) continue;
      b.target.set(x, h, z);
      return;
    }
  }

  update(dt: number, elapsed: number, player: THREE.Vector3): void {
    for (const b of this.birds) {
      const dist = b.root.position.distanceTo(player);
      b.root.visible = dist < RANGE;
      if (!b.root.visible) continue;
      b.cooldown -= dt;

      if (b.showing > 0) {
        // Displaying: stand, face the onlooker, raise and shiver the train.
        b.showing -= dt;
        b.open = Math.min(1, b.open + dt * 1.4);
        const want = Math.atan2(player.x - b.root.position.x, player.z - b.root.position.z);
        b.root.rotation.y += Math.atan2(Math.sin(want - b.root.rotation.y), Math.cos(want - b.root.rotation.y)) * Math.min(1, dt * 2);
        b.fan.rotation.z = Math.sin(elapsed * 38) * 0.012 * b.open;
      } else {
        b.open = Math.max(0, b.open - dt * 0.9);
        // Wander: walk to a spot, peck about, pick another.
        const to = new THREE.Vector3(b.target.x - b.root.position.x, 0, b.target.z - b.root.position.z);
        const d = to.length();
        if (d > 0.3) {
          const heading = Math.atan2(to.x, to.z);
          b.root.rotation.y += Math.atan2(Math.sin(heading - b.root.rotation.y), Math.cos(heading - b.root.rotation.y)) * Math.min(1, dt * 3);
          const step = Math.min(d, dt * 0.7);
          b.root.position.x += Math.sin(b.root.rotation.y) * step;
          b.root.position.z += Math.cos(b.root.rotation.y) * step;
          b.root.position.y = this.world.groundAt(b.root.position.x, b.root.position.z, b.root.position.y + 1);
          b.neck.rotation.x = Math.sin(elapsed * 9 + b.phase) * 0.12;
        } else {
          b.wait -= dt;
          // Peck at the ground now and then.
          b.neck.rotation.x = Math.max(0, Math.sin(elapsed * 2.2 + b.phase)) * 1.1;
          if (b.wait <= 0) {
            b.wait = 2 + Math.random() * 5;
            this.pickTarget(b);
          }
        }
        // Someone close and quiet: show off.
        if (dist < 11 && b.cooldown <= 0 && Math.random() < dt * 0.6) {
          b.showing = 7;
          b.cooldown = 30 + Math.random() * 20;
          b.neck.rotation.x = -0.15;
          audio.peacock();
        }
      }
      const s = b.open < 0.001 ? 0.001 : b.open;
      b.fan.scale.set(s, s, 1);
      b.fan.position.y = 0.5 + b.open * 0.25;
    }
  }

  /** Where the birds are, for tests. */
  positions(): THREE.Vector3[] {
    return this.birds.map((b) => b.root.position.clone());
  }

  /** Make every bird display now (for screenshots and tests). */
  displayAll(): void {
    for (const b of this.birds) {
      b.showing = 8;
      b.cooldown = 30;
    }
  }
}
