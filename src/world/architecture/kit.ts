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
}

export interface Marker {
  name: string;
  pos: [number, number, number];
}

export interface BuildResult {
  geometry: THREE.BufferGeometry;
  colliders: Collider[];
  markers: Marker[];
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
    this.push(geo, at, color, place, place.collide ?? true, [r * 2, height, r * 2]);
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
    this.push(geo, at, color, place, place.collide ?? false, [radius * 2, radius * 2, radius * 2]);
    return this;
  }

  /** Hemispherical dome — stupa anda, Mughal half-domes. */
  dome(radius: number, at: readonly [number, number, number], color: number, place: Placement & { segments?: number; squash?: number } = {}): this {
    const seg = place.segments ?? 16;
    const geo = new THREE.SphereGeometry(radius, seg, Math.max(5, seg >> 1), 0, Math.PI * 2, 0, Math.PI / 2);
    if (place.squash && place.squash !== 1) geo.scale(1, place.squash, 1);
    const h = radius * (place.squash ?? 1);
    this.push(geo, at, color, place, place.collide ?? true, [radius * 2, h, radius * 2]);
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
      this.addBoxCollider(
        [at[0] - maxR, at[1] + minY, at[2] - maxR],
        [at[0] + maxR, at[1] + maxY, at[2] + maxR],
        place.inset ?? 0,
      );
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
      this.addBoxCollider([at[0] + minX, at[1] + minY, at[2] - hz], [at[0] + maxX, at[1] + maxY, at[2] + hz], place.inset ?? 0);
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

  /** A flight of steps climbing in +X. */
  steps(
    at: readonly [number, number, number],
    count: number,
    rise: number,
    run: number,
    width: number,
    color: number,
    place: Placement = {},
  ): this {
    for (let i = 0; i < count; i++) {
      this.box(
        [run, rise * (i + 1), width],
        [at[0] + i * run, at[1] + (rise * (i + 1)) / 2, at[2]],
        color,
        { ...place, collide: false },
      );
    }
    // The collider has to be something the player can actually climb. Each visible step becomes a
    // solid block whose top matches it; a step taller than the player's step-up (about 0.68 m) is
    // sliced into low risers inside its own footprint, so a tall stair still reads as a stair to the
    // eye but walks like a ramp. (This used to be one slab only 0.6 of a step high, which let people
    // walk straight through the stairs and then stopped them dead at the wall above.)
    if (rise > 0) {
      const slices = Math.max(1, Math.ceil(rise / 0.55));
      for (let i = 0; i < count; i++) {
        for (let j = 0; j < slices; j++) {
          const x0 = at[0] + (i - 0.5) * run + (j * run) / slices;
          const x1 = x0 + run / slices;
          const top = at[1] + rise * i + (rise * (j + 1)) / slices;
          this.addBoxCollider([x0, at[1], at[2] - width / 2], [x1, top, at[2] + width / 2], 0);
        }
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
  ): void {
    this.pushRaw(geo, at, color, place);
    if (collide) {
      // Rotated pieces get an enclosing AABB — a slight overestimate, which is
      // the right trade: you never fall through a wall, you just stop a little early.
      const rot = place.rotY ?? 0;
      const c = Math.abs(Math.cos(rot));
      const s = Math.abs(Math.sin(rot));
      const hx = (size[0] * c + size[2] * s) / 2;
      const hz = (size[0] * s + size[2] * c) / 2;
      const hy = size[1] / 2;
      this.addBoxCollider([at[0] - hx, at[1] - hy, at[2] - hz], [at[0] + hx, at[1] + hy, at[2] + hz], place.inset ?? 0);
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
      return { geometry: new THREE.BufferGeometry(), colliders: [], markers: this.markers, height: 0, radius: 0 };
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
