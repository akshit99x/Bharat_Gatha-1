import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * The building kit.
 *
 * Every monument in the game is assembled from these primitives into ONE merged
 * vertex-coloured geometry, so a whole temple costs a single draw call. The two
 * most useful primitives are `lathe` (a profile revolved around the Y axis —
 * which is exactly how a shikhara, a stupa dome, an amalaka or a kalasha is
 * described in the silpa texts) and `prism` (a 2D outline extruded), which
 * together cover most of Indian architectural form.
 *
 * Colliders are accumulated as axis-aligned boxes in local space. The world
 * transforms them when it places the building.
 */

export interface Collider {
  min: [number, number, number];
  max: [number, number, number];
  /** Yaw of the box about its own centre, for pieces turned at an angle. Absent means axis-aligned. */
  rotY?: number;
  /** The footprint is the circle inscribed in the box (columns, drums, domes, round platforms). */
  round?: boolean;
  /** Its top is curved (a dome, a boulder): solid, but not a place to stand a person or a post. */
  curved?: boolean;
}

/** Which way a flight of steps climbs. */
export type Facing = 'x+' | 'x-' | 'z+' | 'z-';

export interface Marker {
  name: string;
  pos: [number, number, number];
}

/** A rectangle of ground to cut away because the structure goes below it (x/z bounds, and the floor's y). */
export interface Pit {
  min: [number, number];
  max: [number, number];
  floor: number;
}

export interface BuildResult {
  geometry: THREE.BufferGeometry;
  colliders: Collider[];
  markers: Marker[];
  pits: Pit[];
  /** Approximate overall height, used for labels and scan ranging. */
  height: number;
  /** Approximate horizontal radius, used for culling and map pins. */
  radius: number;
}

export interface Placement {
  /** Y rotation in radians. */
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  /** Add an AABB collider for this piece. Defaults differ per primitive. */
  collide?: boolean;
  /** Shrink the collider inwards so doorways stay walkable. */
  inset?: number;
}

const DIRS: Record<Facing, [number, number]> = { 'x+': [1, 0], 'x-': [-1, 0], 'z+': [0, 1], 'z-': [0, -1] };

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _one = new THREE.Vector3(1, 1, 1);
const _color = new THREE.Color();

export class Kit {
  private readonly parts: THREE.BufferGeometry[] = [];
  private readonly boxes: Collider[] = [];
  readonly markers: Marker[] = [];
  readonly pits: Pit[] = [];

  private maxY = 0;
  private maxR = 0;

  // ------------------------------------------------------------- primitives

  /** A rectangular block. Collides by default. */
  box(
    size: readonly [number, number, number],
    at: readonly [number, number, number],
    color: number,
    place: Placement = {},
  ): this {
    const geo = new THREE.BoxGeometry(size[0], size[1], size[2]);
    this.push(geo, at, color, place, place.collide ?? true, size);
    return this;
  }

  /** A thin horizontal slab — floors, plinth courses, lintels. */
  slab(
    size: readonly [number, number],
    at: readonly [number, number, number],
    thickness: number,
    color: number,
    place: Placement = {},
  ): this {
    return this.box([size[0], thickness, size[1]], at, color, { ...place, collide: place.collide ?? true });
  }

  cylinder(
    radiusTop: number,
    radiusBottom: number,
    height: number,
    at: readonly [number, number, number],
    color: number,
    place: Placement & { segments?: number; open?: boolean } = {},
  ): this {
    const seg = place.segments ?? 12;
    const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, seg, 1, place.open ?? false);
    const r = Math.max(radiusTop, radiusBottom);
    this.push(geo, at, color, place, place.collide ?? true, [r * 2, height, r * 2], true);
    return this;
  }

  cone(radius: number, height: number, at: readonly [number, number, number], color: number, place: Placement & { segments?: number } = {}): this {
    const geo = new THREE.ConeGeometry(radius, height, place.segments ?? 10);
    this.push(geo, at, color, place, place.collide ?? false, [radius * 2, height, radius * 2]);
    return this;
  }

  sphere(radius: number, at: readonly [number, number, number], color: number, place: Placement & { segments?: number } = {}): this {
    const seg = place.segments ?? 12;
    const geo = new THREE.SphereGeometry(radius, seg, Math.max(6, seg >> 1));
    this.push(geo, at, color, place, place.collide ?? false, [radius * 2, radius * 2, radius * 2], true, true);
    return this;
  }

  /** Hemispherical dome — stupa anda, Mughal half-domes. */
  dome(radius: number, at: readonly [number, number, number], color: number, place: Placement & { segments?: number; squash?: number } = {}): this {
    const seg = place.segments ?? 16;
    const geo = new THREE.SphereGeometry(radius, seg, Math.max(5, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
    if (place.squash && place.squash !== 1) geo.scale(1, place.squash, 1);
    const h = radius * (place.squash ?? 1);
    this.push(geo, at, color, place, place.collide ?? true, [radius * 2, h, radius * 2], true, true);
    return this;
  }

  torus(radius: number, tube: number, at: readonly [number, number, number], color: number, place: Placement & { segments?: number } = {}): this {
    const seg = place.segments ?? 16;
    const geo = new THREE.TorusGeometry(radius, tube, 6, seg);
    this.push(geo, at, color, place, place.collide ?? false, [(radius + tube) * 2, tube * 2, (radius + tube) * 2]);
    return this;
  }

  /**
   * Revolve a 2D profile of [radius, height] pairs around the Y axis.
   * This is the single most useful primitive here: shikharas, vimana storeys,
   * amalakas, kalashas, onion domes and ziggurat silhouettes are all profiles.
   */
  lathe(
    profile: ReadonlyArray<readonly [number, number]>,
    at: readonly [number, number, number],
    color: number,
    place: Placement & { segments?: number } = {},
  ): this {
    const pts = profile.map(([r, y]) => new THREE.Vector2(Math.max(0.0001, r), y));
    const geo = new THREE.LatheGeometry(pts, place.segments ?? 16);
    let maxR = 0;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [r, y] of profile) {
      maxR = Math.max(maxR, r);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    // Lathe geometry is already positioned by its profile Y values, so the
    // collider must be built around that, not around the centre.
    this.pushRaw(geo, at, color, place);
    if (place.collide ?? true) {
      // Turned on a lathe, so round; and its top is a finial or a curve, not a floor.
      const r = maxR - Math.max(0, place.inset ?? 0);
      this.boxes.push({ min: [at[0] - r, at[1] + minY, at[2] - r], max: [at[0] + r, at[1] + maxY, at[2] + r], round: true, curved: true });
    }
    this.track(at[1] + maxY, Math.hypot(at[0], at[2]) + maxR);
    return this;
  }

  /**
   * Extrude a 2D outline (in the XY plane) along Z. The outline must be convex
   * or at least fan-triangulable from its first vertex — true for every shape
   * used here (wedges, trapezoidal gateway profiles, chariot bodies).
   */
  prism(
    outline: ReadonlyArray<readonly [number, number]>,
    depth: number,
    at: readonly [number, number, number],
    color: number,
    place: Placement = {},
  ): this {
    const n = outline.length;
    if (n < 3) return this;
    const hz = depth / 2;
    const positions: number[] = [];
    const push = (x: number, y: number, z: number) => positions.push(x, y, z);

    // Front and back faces (fan from vertex 0).
    for (let i = 1; i < n - 1; i++) {
      const a = outline[0] as readonly [number, number];
      const b = outline[i] as readonly [number, number];
      const c = outline[i + 1] as readonly [number, number];
      push(a[0], a[1], hz);
      push(b[0], b[1], hz);
      push(c[0], c[1], hz);
      push(a[0], a[1], -hz);
      push(c[0], c[1], -hz);
      push(b[0], b[1], -hz);
    }
    // Sides.
    for (let i = 0; i < n; i++) {
      const a = outline[i] as readonly [number, number];
      const b = outline[(i + 1) % n] as readonly [number, number];
      push(a[0], a[1], hz);
      push(a[0], a[1], -hz);
      push(b[0], b[1], hz);
      push(b[0], b[1], -hz);
      push(b[0], b[1], hz);
      push(a[0], a[1], -hz);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const [x, y] of outline) {
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    this.pushRaw(geo, at, color, place);
    if (place.collide ?? true) {
      // Follow the outline in horizontal bands, so a wedge is a slope of low blocks and not a solid
      // bounding box with an invisible wall over its thin end.
      const rot = place.rotY ?? 0;
      const c = Math.cos(rot);
      const sn = Math.sin(rot);
      const inset = Math.max(0, place.inset ?? 0);
      const bands = Math.max(1, Math.min(14, Math.ceil((maxY - minY) / 1.2)));
      for (let k = 0; k < bands; k++) {
        const y0 = minY + ((maxY - minY) * k) / bands;
        const y1 = minY + ((maxY - minY) * (k + 1)) / bands;
        // Where the outline is at least this band's floor high: its x-extent at the band's base.
        const probe = y0 + (y1 - y0) * 0.02;
        let x0 = Infinity;
        let x1 = -Infinity;
        for (let i = 0; i < n; i++) {
          const a = outline[i] as readonly [number, number];
          const b = outline[(i + 1) % n] as readonly [number, number];
          if ((a[1] - probe) * (b[1] - probe) > 0) continue;
          const t = Math.abs(b[1] - a[1]) < 1e-9 ? 0 : (probe - a[1]) / (b[1] - a[1]);
          const x = a[0] + (b[0] - a[0]) * Math.max(0, Math.min(1, t));
          x0 = Math.min(x0, x);
          x1 = Math.max(x1, x);
          if (Math.abs(b[1] - a[1]) < 1e-9) {
            x0 = Math.min(x0, a[0], b[0]);
            x1 = Math.max(x1, a[0], b[0]);
          }
        }
        if (!(x1 - x0 > 0.05)) continue;
        const mid = (x0 + x1) / 2;
        const half = (x1 - x0) / 2 - inset;
        // The band's centre, turned with the piece about its anchor.
        const cx = at[0] + mid * c;
        const cz = at[2] - mid * sn;
        const col: Collider = { min: [cx - half, at[1] + minY, cz - (hz - inset)], max: [cx + half, at[1] + y1, cz + (hz - inset)] };
        if (Math.abs(sn * c) > 0.002) col.rotY = rot;
        else if (Math.abs(sn) > 0.7) {
          col.min = [cx - (hz - inset), at[1] + minY, cz - half];
          col.max = [cx + (hz - inset), at[1] + y1, cz + half];
        }
        this.boxes.push(col);
      }
    }
    this.track(at[1] + maxY, Math.hypot(at[0], at[2]) + Math.max(Math.abs(minX), Math.abs(maxX), hz));
    return this;
  }

  /** A flat quad, used for banners, water surfaces and ground patches. */
  plane(
    size: readonly [number, number],
    at: readonly [number, number, number],
    color: number,
    place: Placement & { flat?: boolean } = {},
  ): this {
    const geo = new THREE.PlaneGeometry(size[0], size[1]);
    if (place.flat ?? true) geo.rotateX(-Math.PI / 2);
    this.push(geo, at, color, place, place.collide ?? false, [size[0], 0.05, size[1]]);
    return this;
  }

  // ------------------------------------------------------------- composites

  /** A wall between two points on the ground plane. */
  wall(
    from: readonly [number, number],
    to: readonly [number, number],
    height: number,
    thickness: number,
    color: number,
    baseY = 0,
    place: Placement = {},
  ): this {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const len = Math.hypot(dx, dz);
    if (len < 0.01) return this;
    const cx = (from[0] + to[0]) / 2;
    const cz = (from[1] + to[1]) / 2;
    return this.box([len, height, thickness], [cx, baseY + height / 2, cz], color, {
      ...place,
      rotY: Math.atan2(dz, dx) * -1,
      collide: place.collide ?? true,
    });
  }

  /** Column with a base, shaft and bracket capital — the South Indian idiom. */
  pillar(
    at: readonly [number, number],
    height: number,
    radius: number,
    color: number,
    baseY = 0,
    opts: { square?: boolean; capital?: boolean } = {},
  ): this {
    const [x, z] = at;
    if (opts.square) {
      this.box([radius * 2.1, height, radius * 2.1], [x, baseY + height / 2, z], color);
    } else {
      this.box([radius * 2.4, radius * 0.7, radius * 2.4], [x, baseY + radius * 0.35, z], color);
      this.cylinder(radius, radius * 1.1, height, [x, baseY + height / 2, z], color, { segments: 8 });
    }
    if (opts.capital ?? true) {
      this.box([radius * 2.8, radius * 0.5, radius * 2.8], [x, baseY + height + radius * 0.25, z], color, { collide: false });
      // Corbelled brackets, splaying outward.
      this.prism(
        [
          [-radius * 2.2, 0],
          [radius * 2.2, 0],
          [radius * 1.1, radius * 0.8],
          [-radius * 1.1, radius * 0.8],
        ],
        radius * 1.4,
        [x, baseY + height + radius * 0.5, z],
        color,
        { collide: false },
      );
    }
    return this;
  }

  /**
   * A flight of steps. `at` is the centre of the lowest step at its foot; the flight climbs `count` steps
   * of `rise` in the `facing` direction, each `run` deep and `width` across. A negative `rise` means the
   * flight goes *down* in that direction from `at` (steps to the water), and is built as the same stair
   * seen from the other end.
   *
   * The collider is a real staircase: each visible step is a solid block whose top matches it, and a step
   * taller than the player can walk up is sliced into low risers inside its own footprint.
   */
  steps(
    at: readonly [number, number, number],
    count: number,
    rise: number,
    run: number,
    width: number,
    color: number,
    place: Placement = {},
    facing: Facing = 'x+',
  ): this {
    if (rise < 0) {
      const opposite: Record<Facing, Facing> = { 'x+': 'x-', 'x-': 'x+', 'z+': 'z-', 'z-': 'z+' };
      const [fx, fz] = DIRS[facing];
      const far = (count - 1) * run;
      return this.steps([at[0] + fx * far, at[1] + rise * count, at[2] + fz * far], count, -rise, run, width, color, place, opposite[facing]);
    }
    const [dx, dz] = DIRS[facing];
    const alongX = dx !== 0;
    /** A block from the flight's base up to `top`, covering [a, b] metres along the climb. */
    const span = (a: number, b: number): { min: [number, number]; max: [number, number]; mid: [number, number]; size: [number, number] } => {
      const c0 = [at[0] + dx * a, at[2] + dz * a];
      const c1 = [at[0] + dx * b, at[2] + dz * b];
      const half = width / 2;
      const minX = alongX ? Math.min(c0[0] as number, c1[0] as number) : at[0] - half;
      const maxX = alongX ? Math.max(c0[0] as number, c1[0] as number) : at[0] + half;
      const minZ = alongX ? at[2] - half : Math.min(c0[1] as number, c1[1] as number);
      const maxZ = alongX ? at[2] + half : Math.max(c0[1] as number, c1[1] as number);
      return { min: [minX, minZ], max: [maxX, maxZ], mid: [(minX + maxX) / 2, (minZ + maxZ) / 2], size: [maxX - minX, maxZ - minZ] };
    };

    for (let i = 0; i < count; i++) {
      const s = span((i - 0.5) * run, (i + 0.5) * run);
      const h = rise * (i + 1);
      this.box([s.size[0], h, s.size[1]], [s.mid[0], at[1] + h / 2, s.mid[1]], color, { ...place, rotY: 0, collide: false });
    }

    // Where the flight tops out, and a point just past it: the world checks there is floor to step onto.
    const topY = at[1] + rise * count;
    const last = (count - 1) * run;
    this.marker('stair:top', [at[0] + dx * last, topY, at[2] + dz * last]);
    this.marker('stair:beyond', [at[0] + dx * (last + run / 2 + 1.2), topY, at[2] + dz * (last + run / 2 + 1.2)]);

    const slices = Math.max(1, Math.ceil(rise / 0.55));
    for (let i = 0; i < count; i++) {
      for (let j = 0; j < slices; j++) {
        const s = span((i - 0.5) * run + (j * run) / slices, (i - 0.5) * run + ((j + 1) * run) / slices);
        const top = at[1] + rise * i + (rise * (j + 1)) / slices;
        this.addBoxCollider([s.min[0], at[1], s.min[1]], [s.max[0], top, s.max[1]], 0);
      }
    }
    return this;
  }

  /** A post-and-rail stone railing (vedika) along a line. */
  railing(
    from: readonly [number, number],
    to: readonly [number, number],
    height: number,
    color: number,
    baseY = 0,
    spacing = 2.2,
  ): this {
    const dx = to[0] - from[0];
    const dz = to[1] - from[1];
    const len = Math.hypot(dx, dz);
    const n = Math.max(2, Math.round(len / spacing));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      this.box([0.35, height, 0.35], [from[0] + dx * t, baseY + height / 2, from[1] + dz * t], color, { collide: false });
    }
    for (const frac of [0.35, 0.72]) {
      this.wall(from, to, height * 0.16, 0.2, color, baseY + height * frac, { collide: false });
    }
    this.addBoxCollider(
      [Math.min(from[0], to[0]) - 0.3, baseY, Math.min(from[1], to[1]) - 0.3],
      [Math.max(from[0], to[0]) + 0.3, baseY + height, Math.max(from[1], to[1]) + 0.3],
      0,
    );
    return this;
  }

  /** A pyramidal or hipped roof over a rectangular footprint. */
  roof(size: readonly [number, number], at: readonly [number, number, number], height: number, color: number, overhang = 0.6): this {
    const w = size[0] / 2 + overhang;
    const d = size[1] / 2 + overhang;
    const positions: number[] = [];
    const apex: [number, number, number] = [0, height, 0];
    const corners: Array<[number, number, number]> = [
      [-w, 0, -d],
      [w, 0, -d],
      [w, 0, d],
      [-w, 0, d],
    ];
    for (let i = 0; i < 4; i++) {
      const a = corners[i] as [number, number, number];
      const b = corners[(i + 1) % 4] as [number, number, number];
      positions.push(a[0], a[1], a[2], b[0], b[1], b[2], apex[0], apex[1], apex[2]);
    }
    // Underside, so it is not see-through from below.
    positions.push(
      corners[0]![0], 0, corners[0]![2],
      corners[2]![0], 0, corners[2]![2],
      corners[1]![0], 0, corners[1]![2],
      corners[0]![0], 0, corners[0]![2],
      corners[3]![0], 0, corners[3]![2],
      corners[2]![0], 0, corners[2]![2],
    );
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    this.pushRaw(geo, at, color, {});
    this.track(at[1] + height, Math.hypot(at[0], at[2]) + Math.max(w, d));
    return this;
  }

  /**
   * A corbelled opening: two jambs and a stepped head. Pre-arcuate Indian
   * architecture spans openings this way rather than with a true arch.
   */
  corbelGate(
    at: readonly [number, number, number],
    width: number,
    height: number,
    depth: number,
    color: number,
    place: Placement = {},
  ): this {
    const jamb = Math.max(0.6, width * 0.22);
    const rotY = place.rotY ?? 0;
    const local = (lx: number, ly: number): [number, number, number] => {
      const c = Math.cos(rotY);
      const s = Math.sin(rotY);
      return [at[0] + lx * c, at[1] + ly, at[2] - lx * s];
    };
    this.box([jamb, height, depth], local(-(width / 2 + jamb / 2), height / 2), color, { rotY });
    this.box([jamb, height, depth], local(width / 2 + jamb / 2, height / 2), color, { rotY });
    // Stepped corbel head.
    const courses = 3;
    for (let i = 0; i < courses; i++) {
      const t = (i + 1) / (courses + 1);
      const span = width * (1 - t * 0.55) + jamb * 2;
      this.box([span, height * 0.09, depth * 1.04], local(0, height + height * 0.09 * (i + 0.5)), color, {
        rotY,
        collide: false,
      });
    }
    this.box([width + jamb * 2, height * 0.16, depth * 1.1], local(0, height + height * 0.27 + height * 0.08), color, {
      rotY,
      collide: false,
    });
    return this;
  }

  /** Arrange `count` items evenly around a circle, calling back with position and angle. */
  ring(count: number, radius: number, fn: (x: number, z: number, angle: number, index: number) => void, phase = 0): this {
    for (let i = 0; i < count; i++) {
      const a = phase + (i / count) * Math.PI * 2;
      fn(Math.cos(a) * radius, Math.sin(a) * radius, a, i);
    }
    return this;
  }

  /** Lay items along a line. */
  along(
    from: readonly [number, number],
    to: readonly [number, number],
    count: number,
    fn: (x: number, z: number, t: number, index: number) => void,
  ): this {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 0.5 : i / (count - 1);
      fn(from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, t, i);
    }
    return this;
  }

  // ----------------------------------------------------------------- extras

  /** Cut the ground away over a rectangle: for tanks, wells and baths that go below ground level. */
  pit(min: readonly [number, number], max: readonly [number, number], floor: number): this {
    this.pits.push({ min: [min[0], min[1]], max: [max[0], max[1]], floor });
    return this;
  }

  marker(name: string, pos: readonly [number, number, number]): this {
    this.markers.push({ name, pos: [pos[0], pos[1], pos[2]] });
    return this;
  }

  /** Add a collider without any visible geometry — invisible walls, ramps. */
  blocker(min: readonly [number, number, number], max: readonly [number, number, number]): this {
    this.addBoxCollider(min, max, 0);
    return this;
  }

  // -------------------------------------------------------------- internals

  private push(
    geo: THREE.BufferGeometry,
    at: readonly [number, number, number],
    color: number,
    place: Placement,
    collide: boolean,
    size: readonly [number, number, number],
    round = false,
    curved = false,
  ): void {
    this.pushRaw(geo, at, color, place);
    if (collide) {
      const rot = place.rotY ?? 0;
      const hy = size[1] / 2;
      const inset = Math.max(0, place.inset ?? 0);
      if (round && size[0] >= 2) {
        // Something round collides as a circle, not as its bounding square: no invisible corners.
        const h = size[0] / 2 - inset;
        const c: Collider = { min: [at[0] - h, at[1] - hy, at[2] - h], max: [at[0] + h, at[1] + hy, at[2] + h], round: true };
        if (curved) c.curved = true;
        this.boxes.push(c);
      } else {
        // The box as it stands, with its own yaw: the world collides against the turned rectangle.
        const hx = size[0] / 2 - inset;
        const hz = size[2] / 2 - inset;
        const c: Collider = { min: [at[0] - hx, at[1] - hy, at[2] - hz], max: [at[0] + hx, at[1] + hy, at[2] + hz] };
        if (Math.abs(Math.sin(rot) * Math.cos(rot)) > 0.002) c.rotY = rot;
        else if (Math.abs(Math.sin(rot)) > 0.7) {
          // A quarter turn: still axis-aligned, with the sides swapped.
          c.min = [at[0] - hz, at[1] - hy, at[2] - hx];
          c.max = [at[0] + hz, at[1] + hy, at[2] + hx];
        }
        this.boxes.push(c);
      }
    }
    this.track(at[1] + size[1] / 2, Math.hypot(at[0], at[2]) + Math.max(size[0], size[2]) / 2);
  }

  private pushRaw(geo: THREE.BufferGeometry, at: readonly [number, number, number], color: number, place: Placement): void {
    _e.set(place.rotX ?? 0, place.rotY ?? 0, place.rotZ ?? 0);
    _q.setFromEuler(_e);
    _v.set(at[0], at[1], at[2]);
    _m.compose(_v, _q, _one);
    geo.applyMatrix4(_m);

    const count = geo.getAttribute('position').count;
    _color.setHex(color);
    const colors = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      colors[i * 3] = _color.r;
      colors[i * 3 + 1] = _color.g;
      colors[i * 3 + 2] = _color.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    // Merging requires a consistent attribute set across all inputs.
    geo.deleteAttribute('uv');
    this.parts.push(geo);
  }

  private addBoxCollider(min: readonly [number, number, number], max: readonly [number, number, number], inset: number): void {
    const i = Math.max(0, inset);
    this.boxes.push({
      min: [min[0] + i, min[1], min[2] + i],
      max: [max[0] - i, max[1], max[2] - i],
    });
  }

  private track(top: number, radius: number): void {
    if (top > this.maxY) this.maxY = top;
    if (radius > this.maxR) this.maxR = radius;
  }

  build(): BuildResult {
    if (this.parts.length === 0) {
      return { geometry: new THREE.BufferGeometry(), colliders: [], markers: this.markers, pits: this.pits, height: 0, radius: 0 };
    }
    // mergeGeometries needs every input to agree on indexed-ness.
    const normalised = this.parts.map((g) => (g.index ? g.toNonIndexed() : g));
    const merged = mergeGeometries(normalised, false);
    for (const g of this.parts) g.dispose();
    const geometry = merged ?? new THREE.BufferGeometry();
    geometry.computeBoundingSphere();
    geometry.computeBoundingBox();
    return {
      geometry,
      colliders: this.boxes,
      markers: this.markers,
      pits: this.pits,
      height: this.maxY,
      radius: this.maxR,
    };
  }
}

/** Convenience: build a result from a function that fills a Kit. */
export function buildWith(fn: (k: Kit) => void): BuildResult {
  const kit = new Kit();
  fn(kit);
  return kit.build();
}
