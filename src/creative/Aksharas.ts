import * as THREE from 'three';
import { AKSHARAS, type Akshara } from '../content/aksharas';
import { getZone } from '../content/zones';
import { audio } from '../core/Audio';
import type { World } from '../world/World';
import { medallionCanvas } from './glyphArt';

/**
 * The aksharas in the world: a letter on a small gold-rimmed medallion, floating at chest height somewhere
 * near a monument, with a soft glow and a few drifting sparks. Walk into one to collect it.
 *
 * They are meant to be found by looking, not by following a marker: there is no map pin. Coming within
 * about twenty-five metres plays a faint shimmer, once per approach, so a player who is close knows to look
 * around.
 */

const COLLECT_RADIUS = 1.9;
const SHIMMER_RADIUS = 26;
const DRAW_DISTANCE = 240;
const SPARKS = 14;

interface Live {
  akshara: Akshara;
  group: THREE.Group;
  medal: THREE.Sprite;
  glow: THREE.Sprite;
  sparks: THREE.Points;
  sparkPhase: Float32Array;
  base: THREE.Vector3;
  phase: number;
  /** Seconds since it was collected, or -1 while it waits. */
  leaving: number;
  near: boolean;
}

let glowTexture: THREE.Texture | null = null;
function glow(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,226,150,0.95)');
    g.addColorStop(0.35, 'rgba(255,190,80,0.35)');
    g.addColorStop(1, 'rgba(255,170,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

/** Where an akshara floats: beside the monument it names, on clear ground. */
export function aksharaSpot(world: World, a: Akshara): THREE.Vector3 | null {
  const zone = getZone(a.zoneId);
  if (!zone) return null;
  const spec = zone.landmarks[a.near % zone.landmarks.length];
  const placed = spec ? world.landmarks.find((l) => l.id === spec.id) : undefined;
  if (!placed) return null;
  const x = placed.position.x + Math.cos(a.angle) * a.distance;
  const z = placed.position.z + Math.sin(a.angle) * a.distance;
  const p = world.standPoint(x, z, 40);
  return new THREE.Vector3(p.x, p.y + 1.35, p.z);
}

export class Aksharas {
  readonly group = new THREE.Group();
  private readonly live: Live[] = [];

  constructor(world: World, collected: readonly string[]) {
    this.group.name = 'aksharas';
    const have = new Set(collected);
    for (const a of AKSHARAS) {
      if (have.has(a.id)) continue;
      const spot = aksharaSpot(world, a);
      if (spot) this.live.push(this.build(a, spot));
    }
  }

  /** How many are still out in the world. */
  get remaining(): number {
    return this.live.filter((l) => l.leaving < 0).length;
  }

  private build(a: Akshara, at: THREE.Vector3): Live {
    const group = new THREE.Group();
    group.position.copy(at);

    const tex = new THREE.CanvasTexture(medallionCanvas(a));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const medal = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
    medal.scale.setScalar(0.95);
    medal.renderOrder = 3;

    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: glow(), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0.85 }),
    );
    halo.scale.setScalar(2.8);
    halo.renderOrder = 2;

    const positions = new Float32Array(SPARKS * 3);
    const sparkPhase = new Float32Array(SPARKS);
    for (let i = 0; i < SPARKS; i++) sparkPhase[i] = Math.random() * Math.PI * 2;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const sparks = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ color: 0xffd98a, map: glow(), size: 0.16, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    sparks.frustumCulled = false;

    group.add(halo, medal, sparks);
    this.group.add(group);
    return { akshara: a, group, medal, glow: halo, sparks, sparkPhase, base: at.clone(), phase: Math.random() * 10, leaving: -1, near: false };
  }

  /** Animate, and return the akshara the player has just walked into, if any. */
  update(dt: number, elapsed: number, player: THREE.Vector3): Akshara | null {
    let found: Akshara | null = null;
    for (let i = this.live.length - 1; i >= 0; i--) {
      const l = this.live[i] as Live;
      const dx = player.x - l.base.x;
      const dz = player.z - l.base.z;
      const d = Math.hypot(dx, dz);

      if (l.leaving >= 0) {
        // Collected: rise, spin, brighten, fade.
        l.leaving += dt;
        const t = Math.min(1, l.leaving / 1.4);
        l.group.position.y = l.base.y + t * t * 6;
        l.medal.material.rotation += dt * 6 * (1 - t);
        l.medal.scale.setScalar(0.95 + t * 0.9);
        l.glow.scale.setScalar(2.8 + t * 5);
        l.medal.material.opacity = 1 - t;
        l.glow.material.opacity = 0.85 * (1 - t);
        (l.sparks.material as THREE.PointsMaterial).opacity = 0.9 * (1 - t);
        if (t >= 1) {
          this.group.remove(l.group);
          l.medal.material.map?.dispose();
          l.medal.material.dispose();
          l.glow.material.dispose();
          l.sparks.geometry.dispose();
          (l.sparks.material as THREE.Material).dispose();
          this.live.splice(i, 1);
        }
        continue;
      }

      const visible = d < DRAW_DISTANCE;
      l.group.visible = visible;
      if (!visible) continue;

      const bob = Math.sin(elapsed * 1.6 + l.phase) * 0.14;
      l.group.position.y = l.base.y + bob;
      l.medal.material.rotation = Math.sin(elapsed * 0.9 + l.phase) * 0.18;
      l.glow.material.opacity = 0.6 + Math.sin(elapsed * 2.4 + l.phase) * 0.2;

      // Sparks drift up in a loose spiral and loop.
      const pos = l.sparks.geometry.getAttribute('position') as THREE.BufferAttribute;
      for (let s = 0; s < SPARKS; s++) {
        const p = (l.sparkPhase[s] as number) + elapsed * 0.35;
        const life = p % 1 < 0 ? (p % 1) + 1 : p % 1;
        const ang = (l.sparkPhase[s] as number) * 3 + elapsed * 0.8;
        const r = 0.45 + 0.25 * Math.sin(ang * 1.7);
        pos.setXYZ(s, Math.cos(ang) * r, -0.6 + life * 1.8, Math.sin(ang) * r);
      }
      pos.needsUpdate = true;

      // A faint shimmer as you come near, once per approach.
      if (d < SHIMMER_RADIUS && !l.near) {
        l.near = true;
        const base = 880;
        [1, 1.25, 1.5].forEach((m, k) => setTimeout(() => audio.pluck(base * m, 0.05), k * 120));
      } else if (d > SHIMMER_RADIUS * 1.4) {
        l.near = false;
      }

      const dy = Math.abs(player.y + 1 - l.base.y);
      if (!found && d < COLLECT_RADIUS && dy < 2.6) {
        l.leaving = 0;
        found = l.akshara;
        const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
        notes.forEach((hz, k) => setTimeout(() => audio.pluck(hz, 0.16), k * 90));
      }
    }
    return found;
  }

  /** Where each uncollected akshara is, for tests and debugging. */
  positions(): Array<{ id: string; zoneId: string; position: THREE.Vector3 }> {
    return this.live.filter((l) => l.leaving < 0).map((l) => ({ id: l.akshara.id, zoneId: l.akshara.zoneId, position: l.base.clone() }));
  }
}
