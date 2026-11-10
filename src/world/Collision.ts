import type { Collider } from './architecture/kit';

/**
 * Collision against the built world.
 *
 * Everything the player can bump into is an axis-aligned box, kept in a flat
 * array and indexed by a uniform spatial hash. There is no physics engine here
 * on purpose: a vertical cylinder resolved against AABBs, plus a step-up rule,
 * gives a predictable first-person feel and costs almost nothing, which matters
 * because this has to run on a school laptop.
 */

const CELL = 40;

export interface Box {
  /** Enclosing axis-aligned bounds. For an oriented box these are the broad-phase bounds only. */
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  /**
   * Set when the box was rotated by something other than a quarter-turn. The footprint is then an
   * oriented rectangle: centre, half extents and the sine/cosine of its yaw. The player collides
   * with that, not with the (larger) enclosing box, so a building turned 30 degrees has no invisible
   * corners.
   */
  obb?: { cx: number; cz: number; hx: number; hz: number; c: number; s: number };
}

export interface ResolveResult {
  x: number;
  y: number;
  z: number;
  /** Highest surface the player is standing on, or null if nothing below. */
  supportY: number | null;
  /** True if a horizontal push-out happened this step. */
  blocked: boolean;
}

export class CollisionWorld {
  private readonly boxes: Box[] = [];
  private readonly cells = new Map<number, number[]>();

  get count(): number {
    return this.boxes.length;
  }

  /** Add a world-space box. */
  add(minX: number, minY: number, minZ: number, maxX: number, maxY: number, maxZ: number): void {
    // Reject degenerate boxes — they only cost time.
    if (maxX - minX < 0.02 || maxY - minY < 0.02 || maxZ - minZ < 0.02) return;
    const index = this.boxes.length;
    this.boxes.push({ minX, minY, minZ, maxX, maxY, maxZ });
    const x0 = Math.floor(minX / CELL);
    const x1 = Math.floor(maxX / CELL);
    const z0 = Math.floor(minZ / CELL);
    const z1 = Math.floor(maxZ / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const key = hashCell(cx, cz);
        let bucket = this.cells.get(key);
        if (!bucket) {
          bucket = [];
          this.cells.set(key, bucket);
        }
        bucket.push(index);
      }
    }
  }

  /**
   * Add local-space colliders from a built monument, transformed by the
   * monument's placement. Rotation is applied to the box corners and the
   * enclosing AABB is kept — a slight overestimate, deliberately chosen so the
   * player never clips through a rotated wall.
   */
  addPlaced(colliders: readonly Collider[], originX: number, originY: number, originZ: number, rotY = 0, scale = 1): void {
    const c = Math.cos(rotY);
    const s = Math.sin(rotY);
    // A quarter-turn keeps boxes axis-aligned, so the enclosing box is exact and no OBB is needed.
    const oriented = Math.abs(s * c) > 0.002;
    for (const box of colliders) {
      const [lx0, ly0, lz0] = box.min;
      const [lx1, ly1, lz1] = box.max;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      for (const px of [lx0, lx1]) {
        for (const pz of [lz0, lz1]) {
          const sx = px * scale;
          const sz = pz * scale;
          const rx = sx * c + sz * s;
          const rz = -sx * s + sz * c;
          if (rx < minX) minX = rx;
          if (rx > maxX) maxX = rx;
          if (rz < minZ) minZ = rz;
          if (rz > maxZ) maxZ = rz;
        }
      }
      const index = this.boxes.length;
      this.add(
        originX + minX,
        originY + ly0 * scale,
        originZ + minZ,
        originX + maxX,
        originY + ly1 * scale,
        originZ + maxZ,
      );
      // `add` rejects degenerate boxes; only decorate the one it actually stored.
      if (oriented && this.boxes.length > index) {
        const mx = ((lx0 + lx1) / 2) * scale;
        const mz = ((lz0 + lz1) / 2) * scale;
        const stored = this.boxes[index] as Box;
        stored.obb = {
          cx: originX + mx * c + mz * s,
          cz: originZ - mx * s + mz * c,
          hx: Math.abs(lx1 - lx0) * 0.5 * scale,
          hz: Math.abs(lz1 - lz0) * 0.5 * scale,
          c,
          s,
        };
      }
    }
  }

  /** Candidate boxes near a point. */
  private candidates(x: number, z: number, radius: number, out: number[]): number[] {
    out.length = 0;
    const x0 = Math.floor((x - radius) / CELL);
    const x1 = Math.floor((x + radius) / CELL);
    const z0 = Math.floor((z - radius) / CELL);
    const z1 = Math.floor((z + radius) / CELL);
    for (let cx = x0; cx <= x1; cx++) {
      for (let cz = z0; cz <= z1; cz++) {
        const bucket = this.cells.get(hashCell(cx, cz));
        if (!bucket) continue;
        for (const i of bucket) if (!out.includes(i)) out.push(i);
      }
    }
    return out;
  }

  private readonly scratch: number[] = [];

  /**
   * Push a vertical cylinder out of any box it overlaps, and report the highest
   * surface under it.
   *
   * `stepHeight` is the ledge the player can walk straight up — boxes whose top
   * is within it become ground rather than walls, which is what makes stairs,
   * plinths and temple platforms feel right without any stair-specific code.
   */
  resolve(x: number, y: number, z: number, radius: number, height: number, stepHeight = 0.65): ResolveResult {
    const ids = this.candidates(x, z, radius + 1, this.scratch);
    let supportY: number | null = null;
    let blocked = false;
    let px = x;
    let pz = z;

    // Pass 1 — ground / step surfaces under the feet.
    for (const i of ids) {
      const b = this.boxes[i] as Box;
      if (b.maxY > y + stepHeight) continue;
      if (b.maxY < y - 2.2) continue;
      if (!overlapsBox(px, pz, radius, b)) continue;
      if (supportY === null || b.maxY > supportY) supportY = b.maxY;
    }

    // Pass 2 — walls. Two iterations so corners resolve cleanly.
    const feet = supportY !== null ? Math.max(y, supportY) : y;
    for (let pass = 0; pass < 2; pass++) {
      for (const i of ids) {
        const b = this.boxes[i] as Box;
        if (b.maxY <= feet + stepHeight) continue;
        if (b.minY >= feet + height) continue;

        // Work in the box's own frame, so a rotated building is a rectangle and not its bounding box.
        const o = b.obb;
        let x0 = b.minX;
        let x1 = b.maxX;
        let z0 = b.minZ;
        let z1 = b.maxZ;
        let qx = px;
        let qz = pz;
        if (o) {
          const ox = px - o.cx;
          const oz = pz - o.cz;
          qx = ox * o.c - oz * o.s;
          qz = ox * o.s + oz * o.c;
          x0 = -o.hx;
          x1 = o.hx;
          z0 = -o.hz;
          z1 = o.hz;
        }
        const cx = clamp(qx, x0, x1);
        const cz = clamp(qz, z0, z1);
        const dx = qx - cx;
        const dz = qz - cz;
        const dist = Math.hypot(dx, dz);
        let pushX = 0;
        let pushZ = 0;

        if (dist > 1e-6) {
          if (dist >= radius) continue;
          const push = radius - dist;
          pushX = (dx / dist) * push;
          pushZ = (dz / dist) * push;
        } else {
          // Centre is inside the box — eject along the shallowest face.
          const left = qx - x0;
          const right = x1 - qx;
          const back = qz - z0;
          const front = z1 - qz;
          const min = Math.min(left, right, back, front);
          if (min === left) pushX = x0 - radius - qx;
          else if (min === right) pushX = x1 + radius - qx;
          else if (min === back) pushZ = z0 - radius - qz;
          else pushZ = z1 + radius - qz;
        }
        if (o) {
          // Back to world space.
          px += pushX * o.c + pushZ * o.s;
          pz += -pushX * o.s + pushZ * o.c;
        } else {
          px += pushX;
          pz += pushZ;
        }
        blocked = true;
      }
    }

    return { x: px, y, z: pz, supportY, blocked };
  }

  /** Highest box top beneath a point, within a small horizontal tolerance. */
  supportAt(x: number, z: number, y: number, radius = 0.4): number | null {
    const ids = this.candidates(x, z, radius + 1, this.scratch);
    let best: number | null = null;
    for (const i of ids) {
      const b = this.boxes[i] as Box;
      if (b.maxY > y + 0.1) continue;
      if (!overlapsBox(x, z, radius, b)) continue;
      if (best === null || b.maxY > best) best = b.maxY;
    }
    return best;
  }

  /**
   * Ray against the boxes (slab method). Used by the bow and by the
   * interaction probe so arrows stop on walls instead of flying through them.
   */
  raycast(
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number,
    maxDist: number,
  ): { distance: number; box: Box } | null {
    // March the spatial hash in coarse steps — plenty for arrows and probes.
    const step = CELL * 0.75;
    let best: { distance: number; box: Box } | null = null;
    const seen = new Set<number>();
    for (let t = 0; t <= maxDist + step; t += step) {
      const sx = ox + dx * t;
      const sz = oz + dz * t;
      const ids = this.candidates(sx, sz, CELL, this.scratch);
      for (const i of ids) {
        if (seen.has(i)) continue;
        seen.add(i);
        const b = this.boxes[i] as Box;
        const hit = raySlab(ox, oy, oz, dx, dy, dz, b, maxDist);
        if (hit !== null && (best === null || hit < best.distance)) best = { distance: hit, box: b };
      }
      if (best && best.distance < t) break;
    }
    return best;
  }

  clear(): void {
    this.boxes.length = 0;
    this.cells.clear();
  }
}

/** Does a circle of `radius` at (x, z) touch the box's footprint — oriented if it has one? */
function overlapsBox(x: number, z: number, radius: number, b: Box): boolean {
  const o = b.obb;
  if (!o) return overlapsXZ(x, z, radius, b);
  const ox = x - o.cx;
  const oz = z - o.cz;
  const qx = ox * o.c - oz * o.s;
  const qz = ox * o.s + oz * o.c;
  const dx = qx - clamp(qx, -o.hx, o.hx);
  const dz = qz - clamp(qz, -o.hz, o.hz);
  return dx * dx + dz * dz <= radius * radius;
}

function overlapsXZ(x: number, z: number, radius: number, b: Box): boolean {
  const cx = clamp(x, b.minX, b.maxX);
  const cz = clamp(z, b.minZ, b.maxZ);
  const dx = x - cx;
  const dz = z - cz;
  return dx * dx + dz * dz <= radius * radius;
}

function raySlab(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  b: Box,
  maxDist: number,
): number | null {
  let tmin = 0;
  let tmax = maxDist;
  let o = [ox, oy, oz];
  let d = [dx, dy, dz];
  let lo = [b.minX, b.minY, b.minZ];
  let hi = [b.maxX, b.maxY, b.maxZ];
  const ob = b.obb;
  if (ob) {
    // Into the box's own frame, so rays stop on the walls you can see, not on the enclosing box.
    const rx = ox - ob.cx;
    const rz = oz - ob.cz;
    o = [rx * ob.c - rz * ob.s, oy, rx * ob.s + rz * ob.c];
    d = [dx * ob.c - dz * ob.s, dy, dx * ob.s + dz * ob.c];
    lo = [-ob.hx, b.minY, -ob.hz];
    hi = [ob.hx, b.maxY, ob.hz];
  }
  for (let a = 0; a < 3; a++) {
    const da = d[a] as number;
    const oa = o[a] as number;
    const l = lo[a] as number;
    const h = hi[a] as number;
    if (Math.abs(da) < 1e-8) {
      if (oa < l || oa > h) return null;
      continue;
    }
    const inv = 1 / da;
    let t1 = (l - oa) * inv;
    let t2 = (h - oa) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    if (t1 > tmin) tmin = t1;
    if (t2 < tmax) tmax = t2;
    if (tmin > tmax) return null;
  }
  return tmin;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function hashCell(cx: number, cz: number): number {
  // Pack two signed cell coordinates into one integer key.
  return ((cx & 0xffff) << 16) | (cz & 0xffff);
}
