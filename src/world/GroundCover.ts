import * as THREE from 'three';
import { Rng } from '../core/Rng';
import { shaderTime } from './Materials';
import type { CollisionWorld } from './Collision';
import type { Terrain } from './Terrain';
import { SEA_LEVEL } from './Terrain';
import { zoneAt } from '../content/zones';

/**
 * Grass and wildflowers underfoot.
 *
 * A few thousand tufts live in a disc around the player and are *recycled*: a slice of them is
 * checked every frame, and any that has fallen out of the disc (or that landed somewhere bare) is
 * respawned somewhere new inside it. Nothing is rebuilt in one go, so walking costs the same as
 * standing still, and the field is as dense in front of you as behind. Tufts keep off water, steep
 * ground, bare desert, and the footprint of anything built.
 *
 * One draw call for grass and three for flowers. The sway is in the vertex shader, driven by the
 * same clock as the foliage on the trees, and tufts shrink to nothing at the edge of the disc so
 * nothing pops.
 */

const RADIUS = 62;
const GRASS_COUNT = 9000;
const FLOWER_COUNT = 520; // per colour
const SLICE = 520;

/** A tuft of tapered blades fanned around a point. Both faces are authored so lighting stays upward. */
function tuftGeometry(): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  const blades = 6;
  for (let b = 0; b < blades; b++) {
    const a = (b / blades) * Math.PI * 2 + b * 0.5;
    const lean = 0.16 + (b % 3) * 0.07;
    const w = 0.07 + (b % 2) * 0.025;
    const h = 0.42 + (b % 3) * 0.16;
    const dx = Math.cos(a);
    const dz = Math.sin(a);
    const px = -dz;
    const pz = dx;
    const r0 = 0.05 + (b % 2) * 0.04;
    // base-left, base-right, mid-left, mid-right, tip
    const pts: Array<[number, number, number]> = [
      [dx * r0 - px * w, 0, dz * r0 - pz * w],
      [dx * r0 + px * w, 0, dz * r0 + pz * w],
      [dx * (r0 + lean * 0.4) - px * w * 0.7, h * 0.55, dz * (r0 + lean * 0.4) - pz * w * 0.7],
      [dx * (r0 + lean * 0.4) + px * w * 0.7, h * 0.55, dz * (r0 + lean * 0.4) + pz * w * 0.7],
      [dx * (r0 + lean), h, dz * (r0 + lean)],
    ];
    const shade = [0.5, 0.5, 0.82, 0.82, 1.18];
    const tris = [
      [0, 1, 2],
      [1, 3, 2],
      [2, 3, 4],
    ];
    for (const t of tris) {
      for (const order of [t, [t[0], t[2], t[1]]] as number[][]) {
        for (const i of order) {
          const p = pts[i as number] as [number, number, number];
          pos.push(p[0], p[1], p[2]);
          const s = shade[i as number] as number;
          col.push(s, s, s);
          nrm.push(0, 1, 0);
        }
      }
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}

/** A thin stem with a small bloom on top, in one colour. */
function flowerGeometry(head: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  const stem = new THREE.CylinderGeometry(0.008, 0.012, 0.42, 3, 1);
  stem.translate(0, 0.21, 0);
  paint(stem, 0x4d7a35);
  parts.push(stem);
  const bloom = new THREE.IcosahedronGeometry(0.07, 0);
  bloom.scale(1, 0.55, 1);
  bloom.translate(0, 0.44, 0);
  paint(bloom, head);
  parts.push(bloom);
  const centre = new THREE.IcosahedronGeometry(0.03, 0);
  centre.translate(0, 0.465, 0);
  paint(centre, 0xf2c14e);
  parts.push(centre);
  return merge(parts);
}

function paint(g: THREE.BufferGeometry, hex: number): void {
  const c = new THREE.Color(hex);
  const n = g.getAttribute('position').count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = c.r;
    arr[i * 3 + 1] = c.g;
    arr[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
}

function merge(list: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const col: number[] = [];
  const nrm: number[] = [];
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0;
    pos.push(...(g.getAttribute('position').array as ArrayLike<number> as number[]));
    col.push(...(g.getAttribute('color').array as ArrayLike<number> as number[]));
    nrm.push(...(g.getAttribute('normal').array as ArrayLike<number> as number[]));
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return out;
}

function coverMaterial(sway: number): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0, side: THREE.FrontSide });
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = shaderTime;
    shader.uniforms.uSway = { value: sway };
    shader.uniforms.uFadeFrom = { value: RADIUS * 0.62 };
    shader.uniforms.uFadeTo = { value: RADIUS * 0.97 };
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uTime;
uniform float uSway;
uniform float uFadeFrom;
uniform float uFadeTo;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
{
  vec3 origin = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  // Tufts shrink away toward the edge of the disc around the player.
  float fade = 1.0 - smoothstep(uFadeFrom, uFadeTo, distance(origin.xz, cameraPosition.xz));
  float h = max(transformed.y, 0.0);
  // A slow gust that rolls across the field, and a quicker shiver on top.
  float gust = sin(uTime * 0.9 + origin.x * 0.045 + origin.z * 0.03) * 0.5 + 0.5;
  float shiver = sin(uTime * 2.7 + origin.x * 0.9 + origin.z * 0.7);
  float bend = (0.35 + gust * 0.9) * uSway * h * h + shiver * 0.03 * h * uSway;
  transformed.x += bend;
  transformed.z += bend * 0.55;
  transformed *= fade;
}`,
      );
  };
  return m;
}

const GREEN = new THREE.Color(0x5f8a3a);
const STRAW = new THREE.Color(0xb7a368);
const DRY = new Set<string>(['desertFringe', 'dryPlains', 'mesopotamianDelta', 'deccanBoulder', 'coastalDune']);

export class GroundCover {
  readonly group = new THREE.Group();
  private readonly grass: THREE.InstancedMesh;
  private readonly flowers: THREE.InstancedMesh[] = [];
  private readonly rng: Rng;
  private readonly pos: Float32Array; // x, y, z of every instance (grass then each flower mesh)
  private readonly alive: Uint8Array;
  private cursor = 0;
  private primed = false;
  private readonly last = new THREE.Vector3(1e9, 0, 1e9);
  private readonly m4 = new THREE.Matrix4();
  private readonly q = new THREE.Quaternion();
  private readonly s = new THREE.Vector3();
  private readonly p = new THREE.Vector3();
  private readonly e = new THREE.Euler();
  private readonly c = new THREE.Color();
  private readonly total: number;
  private readonly grassCount: number;
  private readonly flowerCount: number;

  constructor(
    private readonly terrain: Terrain,
    private readonly collision: CollisionWorld,
    seed: string,
    density = 1,
  ) {
    this.group.name = 'ground-cover';
    this.rng = new Rng(`${seed}:cover`);
    this.grassCount = Math.round(GRASS_COUNT * density);
    this.flowerCount = Math.round(FLOWER_COUNT * density);

    this.grass = new THREE.InstancedMesh(tuftGeometry(), coverMaterial(1), this.grassCount);
    this.grass.frustumCulled = false;
    this.grass.castShadow = false;
    this.grass.receiveShadow = false;
    this.grass.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.grass.count = this.grassCount;
    this.group.add(this.grass);

    for (const head of [0xf08a24, 0xf6f1e4, 0xc2579f]) {
      const m = new THREE.InstancedMesh(flowerGeometry(head), coverMaterial(0.45), this.flowerCount);
      m.frustumCulled = false;
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.flowers.push(m);
      this.group.add(m);
    }
    this.total = this.grassCount + this.flowerCount * 3;
    this.pos = new Float32Array(this.total * 3);
    this.alive = new Uint8Array(this.total);
    this.hideAll();
  }

  private hideAll(): void {
    this.s.set(0, 0, 0);
    this.m4.compose(this.p.set(0, -500, 0), this.q.identity(), this.s);
    for (let i = 0; i < this.total; i++) {
      this.alive[i] = 0;
      this.mesh(i).setMatrixAt(this.local(i), this.m4);
    }
    this.grass.instanceMatrix.needsUpdate = true;
    for (const f of this.flowers) f.instanceMatrix.needsUpdate = true;
  }

  private mesh(i: number): THREE.InstancedMesh {
    if (i < this.grassCount) return this.grass;
    return this.flowers[Math.floor((i - this.grassCount) / this.flowerCount)] as THREE.InstancedMesh;
  }

  private local(i: number): number {
    return i < this.grassCount ? i : (i - this.grassCount) % this.flowerCount;
  }

  /** Try to place instance `i` somewhere inside the disc around (fx, fz). */
  private respawn(i: number, fx: number, fz: number): void {
    const isFlower = i >= this.grassCount;
    for (let attempt = 0; attempt < 3; attempt++) {
      const a = this.rng.next() * Math.PI * 2;
      const r = Math.sqrt(this.rng.next()) * RADIUS * 0.98;
      const x = fx + Math.cos(a) * r;
      const z = fz + Math.sin(a) * r;
      const y = this.terrain.heightAt(x, z);
      if (y < SEA_LEVEL + 2.3) continue;
      if (this.terrain.slopeAt(x, z) > 0.3) continue;
      const zone = zoneAt(x, z);
      const dry = DRY.has(zone?.biome ?? '');
      // Bare country keeps most of its bare ground; flowers want the green places.
      if (dry && (isFlower || this.rng.next() < 0.7)) continue;
      // Not through a floor or a wall: skip anything inside a built footprint.
      if (this.collision.supportAt(x, z, y + 40, 0.45) !== null) continue;

      const k = this.local(i);
      const mesh = this.mesh(i);
      const size = isFlower ? 0.8 + this.rng.next() * 0.6 : 0.65 + this.rng.next() * 0.95;
      this.e.set(0, this.rng.next() * Math.PI * 2, 0);
      this.q.setFromEuler(this.e);
      this.s.set(size * (0.85 + this.rng.next() * 0.4), size * (0.8 + this.rng.next() * 0.7), size * (0.85 + this.rng.next() * 0.4));
      this.m4.compose(this.p.set(x, y - 0.02, z), this.q, this.s);
      mesh.setMatrixAt(k, this.m4);
      if (!isFlower) {
        // Grow out of the ground's own colour, a little greener (or, in dry country, a little more
        // straw), and different for every tuft, so the field belongs to the land under it.
        const base = this.c.setHex(this.terrain.surfaceColorAt(x, z));
        base.lerp(dry ? STRAW : GREEN, dry ? 0.12 : 0.4);
        base.multiplyScalar(0.8 + this.rng.next() * 0.45);
        base.offsetHSL((this.rng.next() - 0.5) * 0.03, 0, 0);
        this.grass.setColorAt(k, base);
        if (this.grass.instanceColor) this.grass.instanceColor.needsUpdate = true;
      }
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      this.alive[i] = 1;
      mesh.instanceMatrix.needsUpdate = true;
      return;
    }
    // Nowhere suitable this time. Hide it and let a later pass try again.
    if (this.alive[i]) {
      this.s.set(0, 0, 0);
      this.m4.compose(this.p.set(0, -500, 0), this.q.identity(), this.s);
      this.mesh(i).setMatrixAt(this.local(i), this.m4);
      this.mesh(i).instanceMatrix.needsUpdate = true;
    }
    this.alive[i] = 0;
    this.pos[i * 3] = fx + 1e6;
  }

  /** Keep the field around `focus`. Cheap: a fixed slice of instances is looked at per frame. */
  update(focus: THREE.Vector3): void {
    const moved = Math.hypot(focus.x - this.last.x, focus.z - this.last.z);
    if (!this.primed || moved > RADIUS * 1.5) {
      // First frame or a teleport: fill the whole disc at once.
      for (let i = 0; i < this.total; i++) this.respawn(i, focus.x, focus.z);
      this.primed = true;
      this.last.copy(focus);
      return;
    }
    this.last.copy(focus);
    // Recycle quickly enough that a sprinting player outruns nothing.
    const slice = moved > 0.05 ? SLICE * 2 : SLICE;
    for (let n = 0; n < slice; n++) {
      const i = this.cursor;
      this.cursor = (this.cursor + 1) % this.total;
      const dx = this.pos[i * 3] - focus.x;
      const dz = this.pos[i * 3 + 2] - focus.z;
      if (!this.alive[i] || dx * dx + dz * dz > RADIUS * RADIUS) this.respawn(i, focus.x, focus.z);
    }
  }

  /** Thin the field on a slow machine (1 = full). Only the first N instances are drawn. */
  setLevel(level: number): void {
    const f = Math.max(0.25, Math.min(1, level));
    this.grass.count = Math.floor(this.grassCount * f);
    for (const m of this.flowers) m.count = Math.floor(this.flowerCount * f);
  }

  dispose(): void {
    for (const m of [this.grass, ...this.flowers]) {
      m.geometry.dispose();
      (m.material as THREE.Material).dispose();
      m.dispose();
    }
  }
}
