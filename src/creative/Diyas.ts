import * as THREE from 'three';
import { ZONES } from '../content/zones';
import type { World } from '../world/World';
import { SEA_LEVEL } from '../world/Terrain';

/**
 * Deepa-daan: little clay lamps floating on the water off each region's landing terrace.
 *
 * A few float there from the start. When a region's panel of the Gatha is restored, a flotilla is set on the
 * water from the shore and drifts slowly out, and stays: a region the player has finished is ringed with
 * lights. Lamps are cheap (one instanced mesh for the bowls, one point cloud for the flames per region) and
 * only regions near the player are animated.
 */

const BASE_LAMPS = 7;
const RELEASED_LAMPS = 26;
const ANIMATE_RANGE = 520;

interface Lamp {
  /** Where it was set on the water. */
  sx: number;
  sz: number;
  x: number;
  z: number;
  /** Where it drifts towards (released lamps), and how far along it is (0..1). */
  tx: number;
  tz: number;
  t: number;
  phase: number;
}

interface Field {
  zoneId: string;
  shore: THREE.Vector2;
  /** Unit vector from the shore out to sea. */
  out: THREE.Vector2;
  lamps: Lamp[];
  bowls: THREE.InstancedMesh;
  flames: THREE.Points;
  halos: THREE.Points;
  capacity: number;
}

let flameTex: THREE.Texture | null = null;
function flameTexture(): THREE.Texture {
  if (flameTex) return flameTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 36, 0, 32, 36, 30);
    g.addColorStop(0, 'rgba(255,250,220,1)');
    g.addColorStop(0.25, 'rgba(255,200,90,0.9)');
    g.addColorStop(0.6, 'rgba(255,130,40,0.25)');
    g.addColorStop(1, 'rgba(255,120,30,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  flameTex = new THREE.CanvasTexture(c);
  flameTex.colorSpace = THREE.SRGBColorSpace;
  return flameTex;
}

/** The sea's swell at a point: the same three wave trains as the water's vertex shader (Water.ts). */
function swell(x: number, z: number, t: number): number {
  const px = x;
  const py = -z; // the sea plane is laid flat, so its local y runs along world -z
  return Math.sin(px * 0.013 + t * 0.9) * 0.55 + Math.sin(py * 0.017 - t * 0.7) * 0.42 + Math.sin((px + py) * 0.031 + t * 1.45) * 0.22;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3(1, 1, 1);
const _e = new THREE.Euler();

export class Diyas {
  readonly group = new THREE.Group();
  private readonly fields = new Map<string, Field>();

  constructor(
    private readonly world: World,
    restored: readonly string[],
  ) {
    this.group.name = 'diyas';
    const bowlGeo = new THREE.CylinderGeometry(0.3, 0.16, 0.16, 12, 1, false);
    const bowlMat = new THREE.MeshStandardMaterial({ color: 0x9a4a2a, roughness: 0.9, side: THREE.DoubleSide });
    for (const zone of ZONES) {
      const pad = world.padFor(zone.id);
      if (!pad) continue;
      const shore = this.findShore(pad.position.x, pad.position.z);
      if (!shore) continue;
      const capacity = BASE_LAMPS + RELEASED_LAMPS;
      const bowls = new THREE.InstancedMesh(bowlGeo, bowlMat, capacity);
      bowls.count = 0;
      bowls.frustumCulled = false;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3));
      geo.setDrawRange(0, 0);
      // A bright core that reads even on sunlit water, and a soft additive halo around it.
      const flames = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ map: flameTexture(), color: 0xfff1c4, size: 1.1, transparent: true, depthWrite: false, toneMapped: false }),
      );
      flames.frustumCulled = false;
      flames.renderOrder = 7;
      const halos = new THREE.Points(
        geo,
        new THREE.PointsMaterial({ map: flameTexture(), color: 0xffa040, size: 4.2, transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }),
      );
      halos.frustumCulled = false;
      halos.renderOrder = 6;
      this.group.add(bowls, halos, flames);
      const field: Field = { zoneId: zone.id, shore: shore.at, out: shore.out, lamps: [], bowls, flames, halos, capacity };
      this.fields.set(zone.id, field);
      for (let i = 0; i < BASE_LAMPS; i++) this.addLamp(field, true);
      if (restored.includes(zone.id)) for (let i = 0; i < RELEASED_LAMPS; i++) this.addLamp(field, true);
    }
  }

  /** The nearest stretch of open water to the terrace, and which way is out to sea. */
  private findShore(px: number, pz: number): { at: THREE.Vector2; out: THREE.Vector2 } | null {
    let best: { at: THREE.Vector2; out: THREE.Vector2; d: number } | null = null;
    for (let k = 0; k < 32; k++) {
      const a = (k / 32) * Math.PI * 2;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      for (let d = 10; d < 520; d += 6) {
        const h = this.world.heightAt(px + dx * d, pz + dz * d);
        if (h < SEA_LEVEL - 0.5) {
          // Make sure it is real open water, not a puddle: a little further out must be deeper still.
          const h2 = this.world.heightAt(px + dx * (d + 24), pz + dz * (d + 24));
          if (h2 < SEA_LEVEL - 1 && (!best || d < best.d)) best = { at: new THREE.Vector2(px + dx * d, pz + dz * d), out: new THREE.Vector2(dx, dz), d };
          break;
        }
      }
    }
    return best ? { at: best.at, out: best.out } : null;
  }

  private addLamp(field: Field, settled: boolean): void {
    if (field.lamps.length >= field.capacity) return;
    const side = new THREE.Vector2(-field.out.y, field.out.x);
    const lateral = (Math.random() - 0.5) * 40;
    const depth = 6 + Math.random() * 26;
    let tx = field.shore.x + field.out.x * depth + side.x * lateral;
    let tz = field.shore.y + field.out.y * depth + side.y * lateral;
    // Keep lamps on water.
    for (let tries = 0; tries < 6 && this.world.heightAt(tx, tz) > SEA_LEVEL - 0.3; tries++) {
      tx += field.out.x * 6;
      tz += field.out.y * 6;
    }
    const sx = field.shore.x + side.x * lateral * 0.2;
    const sz = field.shore.y + side.y * lateral * 0.2;
    field.lamps.push({ sx, sz, x: settled ? tx : sx, z: settled ? tz : sz, tx, tz, t: settled ? 1 : -Math.random() * 6, phase: Math.random() * 10 });
  }

  /** A panel was restored: set a flotilla on the water. */
  release(zoneId: string): void {
    const field = this.fields.get(zoneId);
    if (!field) return;
    for (let i = 0; i < RELEASED_LAMPS; i++) this.addLamp(field, false);
  }

  /** Where a region's lamps gather, for tests and for pointing the camera at them. */
  shoreOf(zoneId: string): THREE.Vector3 | null {
    const f = this.fields.get(zoneId);
    if (!f) return null;
    return new THREE.Vector3(f.shore.x + f.out.x * 18, SEA_LEVEL, f.shore.y + f.out.y * 18);
  }

  update(dt: number, elapsed: number, player: THREE.Vector3): void {
    for (const f of this.fields.values()) {
      const near = Math.hypot(player.x - f.shore.x, player.z - f.shore.y) < ANIMATE_RANGE;
      f.bowls.visible = near;
      f.flames.visible = near;
      f.halos.visible = near;
      if (!near) continue;
      const pos = f.flames.geometry.getAttribute('position') as THREE.BufferAttribute;
      let n = 0;
      for (const l of f.lamps) {
        if (l.t < 1) {
          l.t += dt / 22;
          if (l.t < 0) continue; // waiting its turn at the water's edge
          const e = 1 - (1 - Math.min(1, l.t)) ** 3;
          l.x = l.sx + (l.tx - l.sx) * e;
          l.z = l.sz + (l.tz - l.sz) * e;
        }
        // Drift and bob on the swell.
        const wx = l.x + Math.sin(elapsed * 0.13 + l.phase) * 0.8;
        const wz = l.z + Math.cos(elapsed * 0.11 + l.phase * 1.3) * 0.8;
        const y = SEA_LEVEL + swell(wx, wz, elapsed) + 0.1 + Math.sin(elapsed * 1.3 + l.phase) * 0.04;
        _e.set(Math.sin(elapsed * 1.1 + l.phase) * 0.08, 0, Math.cos(elapsed * 0.9 + l.phase) * 0.08);
        _q.setFromEuler(_e);
        _p.set(wx, y, wz);
        _m.compose(_p, _q, _s);
        f.bowls.setMatrixAt(n, _m);
        const flicker = Math.sin(elapsed * 9 + l.phase * 7) * 0.02;
        pos.setXYZ(n, wx, y + 0.32 + flicker, wz);
        n++;
      }
      f.bowls.count = n;
      f.bowls.instanceMatrix.needsUpdate = true;
      f.flames.geometry.setDrawRange(0, n);
      pos.needsUpdate = true;
      (f.flames.material as THREE.PointsMaterial).size = 1.1 + Math.sin(elapsed * 7.3) * 0.08;
      (f.halos.material as THREE.PointsMaterial).opacity = 0.42 + Math.sin(elapsed * 3.1) * 0.06;
    }
  }
}
