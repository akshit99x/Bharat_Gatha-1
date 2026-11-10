import * as THREE from 'three';
import { Noise2D, clamp, clamp01, lerp, smoothstep } from '../core/Noise';
import { ZONES, getZone } from '../content/zones';
import type { Zone } from '../content/types';
import { terrainMaterial, mixColor } from './Materials';

/**
 * The island.
 *
 * The continent is not a noise field with a coastline carved out of it; it is
 * grown from the zones themselves. Every zone contributes a blob of land, and
 * an explicit list of land bridges joins the ones that should be walkable
 * neighbours. Two zones get no bridge at all, which is what makes Sumer and
 * Lanka genuine islands — and one gets a *shoal* bridge that stops just below
 * sea level, which is how Adam's Bridge appears in the world without anybody
 * modelling it.
 *
 * Heights are baked into a grid once, then sampled bilinearly. That guarantees
 * the player stands on exactly the surface that is drawn, which is the one
 * thing a terrain sampler must never get wrong.
 */

export const WORLD_SIZE = 3600;
export const WORLD_HALF = WORLD_SIZE / 2;
export const SEA_LEVEL = 0;
const SEABED = -36;
const GRID_CELLS = 384;
const GRID_VERTS = GRID_CELLS + 1;
const CELL_SIZE = WORLD_SIZE / GRID_CELLS;

/** Zones joined by walkable land. */
const LAND_BRIDGES: ReadonlyArray<readonly [string, string, number]> = [
  ['sindhu', 'kurukshetra', 165],
  ['kurukshetra', 'kosala', 165],
  ['kurukshetra', 'agra', 155],
  ['agra', 'magadha', 155],
  ['agra', 'maratha', 150],
  ['agra', 'hampi', 140],
  ['maratha', 'hampi', 150],
  ['hampi', 'chola', 150],
  ['chola', 'konark', 145],
  ['magadha', 'konark', 145],
  ['kosala', 'magadha', 150],
  ['sindhu', 'maratha', 145],
];

/**
 * Shoal chains: land that never quite reaches the surface. The height is capped
 * just under sea level, so you get a line of sandbanks and reef showing at the
 * crests — walkable in places, swimmable between.
 */
const SHOALS: ReadonlyArray<readonly [string, string, number]> = [['chola', 'setu-lanka', 62]];

/** Per-biome relief amplitude, in metres. */
const HILLINESS: Record<string, number> = {
  hillGhats: 84,
  deccanBoulder: 40,
  desertFringe: 22,
  coastalDune: 14,
  riverPlain: 10,
  gangeticPlain: 9,
  dryPlains: 12,
  sal_forest: 16,
  coastalPalm: 11,
  tropicalIsland: 26,
  mesopotamianDelta: 7,
};

interface Bridge {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  width: number;
  cap: number;
}

export interface TerrainSample {
  height: number;
  /** 0 = open sea, 1 = solid interior. */
  land: number;
  /** Steepness, 0 = flat, 1 = cliff. */
  slope: number;
}

export class Terrain {
  readonly mesh: THREE.Mesh;
  readonly heights: Float32Array;

  private readonly noise: Noise2D;
  private readonly warp: Noise2D;
  private readonly bridges: Bridge[] = [];
  private readonly zones: Zone[];

  constructor(seed: string) {
    this.noise = new Noise2D(`${seed}:terrain`);
    this.warp = new Noise2D(`${seed}:warp`);
    this.zones = ZONES;

    for (const list of [LAND_BRIDGES, SHOALS]) {
      const cap = list === SHOALS ? 0.46 : 1;
      for (const [a, b, width] of list) {
        const za = getZone(a);
        const zb = getZone(b);
        if (!za || !zb) {
          console.warn(`[Terrain] bridge references unknown zone: ${a} → ${b}`);
          continue;
        }
        this.bridges.push({ ax: za.center[0], az: za.center[1], bx: zb.center[0], bz: zb.center[1], width, cap });
      }
    }

    this.heights = new Float32Array(GRID_VERTS * GRID_VERTS);
    this.bake();
    this.mesh = this.buildMesh();
  }

  // ------------------------------------------------------------------ sampling

  /** Ground height at a world position, bilinearly interpolated from the grid. */
  heightAt(x: number, z: number): number {
    const gx = (x + WORLD_HALF) / CELL_SIZE;
    const gz = (z + WORLD_HALF) / CELL_SIZE;
    const ix = Math.floor(gx);
    const iz = Math.floor(gz);
    if (ix < 0 || iz < 0 || ix >= GRID_CELLS || iz >= GRID_CELLS) return SEABED;
    const fx = gx - ix;
    const fz = gz - iz;
    const h = this.heights;
    const i00 = iz * GRID_VERTS + ix;
    const h00 = h[i00] as number;
    const h10 = h[i00 + 1] as number;
    const h01 = h[i00 + GRID_VERTS] as number;
    const h11 = h[i00 + GRID_VERTS + 1] as number;
    return lerp(lerp(h00, h10, fx), lerp(h01, h11, fx), fz);
  }

  /** Surface normal, from central differences on the baked grid. */
  normalAt(x: number, z: number, out = new THREE.Vector3()): THREE.Vector3 {
    const d = CELL_SIZE;
    const hl = this.heightAt(x - d, z);
    const hr = this.heightAt(x + d, z);
    const hd = this.heightAt(x, z - d);
    const hu = this.heightAt(x, z + d);
    return out.set(hl - hr, 2 * d, hd - hu).normalize();
  }

  /** Steepness in 0..1. */
  slopeAt(x: number, z: number): number {
    const n = this.normalAt(x, z, _n);
    return clamp01(1 - n.y);
  }

  sample(x: number, z: number): TerrainSample {
    return { height: this.heightAt(x, z), land: this.landMask(x, z), slope: this.slopeAt(x, z) };
  }

  /** True if this spot is dry land a player can stand on. */
  isLand(x: number, z: number): boolean {
    return this.heightAt(x, z) > SEA_LEVEL + 0.4;
  }

  /**
   * Walk outward from a point to find dry, reasonably flat ground. Used when
   * placing monuments, NPCs and the player so nothing ends up in the sea or on
   * a cliff face.
   */
  findGround(x: number, z: number, searchRadius = 80): { x: number; z: number; y: number } {
    let best = { x, z, y: this.heightAt(x, z), score: -Infinity };
    const rings = 6;
    const perRing = 10;
    for (let r = 0; r <= rings; r++) {
      const radius = (searchRadius * r) / rings;
      const samples = r === 0 ? 1 : perRing;
      for (let i = 0; i < samples; i++) {
        const a = (i / samples) * Math.PI * 2 + r * 0.7;
        const sx = x + Math.cos(a) * radius;
        const sz = z + Math.sin(a) * radius;
        const y = this.heightAt(sx, sz);
        if (y <= SEA_LEVEL + 0.6) continue;
        // Prefer flat ground close to the requested spot.
        const score = -this.slopeAt(sx, sz) * 40 - radius * 0.05;
        if (score > best.score) best = { x: sx, z: sz, y, score };
      }
      if (best.score > -1 && r >= 1) break;
    }
    return { x: best.x, z: best.z, y: best.y };
  }

  // -------------------------------------------------------------------- baking

  /** Land coverage at a point, 0..1, from zone blobs plus bridges. */
  landMask(x: number, z: number): number {
    // Warp the sampling position so coastlines are ragged rather than circular.
    const wobble = this.warp.fbm(x * 0.0021, z * 0.0021, 3) * 58 + this.warp.fbm(x * 0.0075, z * 0.0075, 2) * 16;

    let land = 0;
    for (const zone of this.zones) {
      const d = Math.hypot(x - zone.center[0], z - zone.center[1]) + wobble;
      const v = smoothstep(zone.radius * 1.15, zone.radius * 0.6, d);
      if (v > land) land = v;
      if (land >= 1) return 1;
    }

    for (const b of this.bridges) {
      const d = distanceToSegment(x, z, b.ax, b.az, b.bx, b.bz) + wobble * 0.55;
      const v = smoothstep(b.width * 1.05, b.width * 0.4, d) * b.cap;
      if (v > land) land = v;
    }

    return clamp01(land);
  }

  /** Terrain elevation above sea level for fully-inland points. */
  private elevation(x: number, z: number): number {
    const broad = 16 + this.noise.fbm(x * 0.00055, z * 0.00055, 5) * 24;
    const hilliness = this.hillinessAt(x, z);
    const ridges = this.noise.ridged(x * 0.0017, z * 0.0017, 4) * hilliness;
    const detail = this.noise.fbm(x * 0.0062, z * 0.0062, 3) * 2.6;
    return broad + ridges + detail;
  }

  /** Blend the per-biome relief amplitude between nearby zones. */
  private hillinessAt(x: number, z: number): number {
    let total = 0;
    let weight = 0;
    for (const zone of this.zones) {
      const d = Math.hypot(x - zone.center[0], z - zone.center[1]);
      const w = 1 / (1 + Math.pow(d / Math.max(120, zone.radius), 3));
      total += (HILLINESS[zone.biome] ?? 14) * w;
      weight += w;
    }
    return weight > 0 ? total / weight : 14;
  }

  private rawHeight(x: number, z: number): number {
    const land = this.landMask(x, z);
    // Shelve the seabed so the coast drops away gradually instead of as a wall.
    const shore = smoothstep(0, 0.52, land);
    let h = lerp(SEABED, 1.5, shore);
    if (land > 0.5) {
      const inland = smoothstep(0.5, 0.78, land);
      h = lerp(h, this.elevation(x, z), inland);
    }

    // Zone plateaus: flatten the ground the monuments stand on, but keep a
    // little variation so it does not read as a car park.
    for (const zone of this.zones) {
      const d = Math.hypot(x - zone.center[0], z - zone.center[1]);
      const w = smoothstep(zone.radius * 1.0, zone.radius * 0.45, d);
      if (w <= 0.001) continue;
      const local = zone.plateau + this.noise.fbm(x * 0.0085, z * 0.0085, 3) * 3.2;
      h = lerp(h, local, w * 0.94);
    }

    return h;
  }

  private bake(): void {
    for (let iz = 0; iz < GRID_VERTS; iz++) {
      const z = -WORLD_HALF + iz * CELL_SIZE;
      for (let ix = 0; ix < GRID_VERTS; ix++) {
        const x = -WORLD_HALF + ix * CELL_SIZE;
        this.heights[iz * GRID_VERTS + ix] = this.rawHeight(x, z);
      }
    }
  }

  // --------------------------------------------------------------------- mesh

  private buildMesh(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, GRID_CELLS, GRID_CELLS);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.getAttribute('position') as THREE.BufferAttribute;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      // PlaneGeometry's vertex order matches our grid, so read it directly.
      const ix = i % GRID_VERTS;
      const iz = Math.floor(i / GRID_VERTS);
      const y = this.heights[iz * GRID_VERTS + ix] as number;
      pos.setY(i, y);
      c.setHex(this.colorAt(x, z, y, ix, iz));
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.deleteAttribute('uv');
    geo.computeVertexNormals();
    geo.computeBoundingSphere();

    const mesh = new THREE.Mesh(geo, terrainMaterial());
    mesh.name = 'terrain';
    mesh.receiveShadow = true;
    mesh.castShadow = false;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    return mesh;
  }

  /** Vertex colour: biome palette, modulated by height, slope and a little noise. */
  private colorAt(x: number, z: number, y: number, ix: number, iz: number): number {
    const palette = this.blendedPalette(x, z);

    if (y < SEA_LEVEL - 1.5) {
      // Submerged: darken towards deep water.
      const depth = clamp01((SEA_LEVEL - y) / 26);
      return mixColor(0x6f6a52, 0x1b2a33, depth);
    }
    if (y < SEA_LEVEL + 2.4) {
      // Beach / shoal crest.
      return mixColor(0xd9c79a, palette.ground, clamp01((y - SEA_LEVEL) / 2.4) * 0.45);
    }

    // Slope from the baked grid, cheap version using neighbours.
    const hx = this.gridAt(ix + 1, iz) - this.gridAt(ix - 1, iz);
    const hz = this.gridAt(ix, iz + 1) - this.gridAt(ix, iz - 1);
    const steep = clamp01(Math.hypot(hx, hz) / (CELL_SIZE * 1.5));

    const patch = this.noise.fbm(x * 0.009, z * 0.009, 2) * 0.5 + 0.5;
    let col = mixColor(palette.ground, palette.foliage, clamp01(patch * 1.25 - 0.15));
    col = mixColor(col, palette.rock, steep * 0.92);

    // High ground loses vegetation.
    const alt = clamp01((y - 55) / 90);
    col = mixColor(col, palette.rock, alt * 0.6);
    return col;
  }

  /** The colour of the ground at a point, for anything that grows out of it. */
  surfaceColorAt(x: number, z: number): number {
    const ix = Math.floor((x + WORLD_HALF) / CELL_SIZE);
    const iz = Math.floor((z + WORLD_HALF) / CELL_SIZE);
    return this.colorAt(x, z, this.heightAt(x, z), ix, iz);
  }

  private gridAt(ix: number, iz: number): number {
    const cx = clamp(ix, 0, GRID_VERTS - 1);
    const cz = clamp(iz, 0, GRID_VERTS - 1);
    return this.heights[cz * GRID_VERTS + cx] as number;
  }

  /** Inverse-distance blend of zone palettes, so biomes fade into each other. */
  private blendedPalette(x: number, z: number): { ground: number; rock: number; foliage: number } {
    let bestA: Zone | null = null;
    let bestB: Zone | null = null;
    let dA = Infinity;
    let dB = Infinity;
    for (const zone of this.zones) {
      const d = Math.hypot(x - zone.center[0], z - zone.center[1]);
      if (d < dA) {
        dB = dA;
        bestB = bestA;
        dA = d;
        bestA = zone;
      } else if (d < dB) {
        dB = d;
        bestB = zone;
      }
    }
    if (!bestA) return { ground: 0x8a8a5a, rock: 0x8f8470, foliage: 0x4a7a3a };
    if (!bestB) return bestA.palette;
    const t = clamp01(dA / Math.max(1, dA + dB)) * 0.9;
    return {
      ground: mixColor(bestA.palette.ground, bestB.palette.ground, t),
      rock: mixColor(bestA.palette.rock, bestB.palette.rock, t),
      foliage: mixColor(bestA.palette.foliage, bestB.palette.foliage, t),
    };
  }

  dispose(): void {
    this.mesh.geometry.dispose();
  }
}

const _n = new THREE.Vector3();

function distanceToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const lenSq = dx * dx + dz * dz;
  if (lenSq < 1e-6) return Math.hypot(px - ax, pz - az);
  let t = ((px - ax) * dx + (pz - az) * dz) / lenSq;
  t = clamp01(t);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
