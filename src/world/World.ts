import * as THREE from 'three';

import { Terrain, SEA_LEVEL } from './Terrain';
import { Sky } from './Sky';
import { Water } from './Water';
import { GroundCover } from './GroundCover';
import { Birds } from './Birds';
import { Vegetation, defaultVegetationOptions, type ExclusionCircle } from './Vegetation';
import { CollisionWorld } from './Collision';
import { buildLandmark } from './architecture';
import { Kit } from './architecture/kit';
import { stoneMaterial, glowMaterial, shade, shaderTime } from './Materials';
import { Rng } from '../core/Rng';
import { Chariot } from '../vehicles/Chariot';
import { Atmosphere } from './Atmosphere';
import { NpcActor, type ActorEnv } from './NpcActor';
import { ZONES, zoneAt, worldPos } from '../content/zones';
import type { Landmark, Zone, ChallengeSpec, NpcSpec } from '../content/types';
import type { Plaque } from '../content/story';
import { getChapter } from '../content/story';

/**
 * The world.
 *
 * Builds the island, then walks the content data and places every monument,
 * challenge marker and NPC on it. Nothing here knows what a quiz is or what a
 * challenge does — it only knows where things are and what you can bump into.
 */

export interface PlacedLandmark {
  id: string;
  name: string;
  /** The kind of structure it is; also decides what it sounds like. */
  kind: string;
  zoneId: string;
  codexId?: string;
  scanSeconds: number;
  signposted: boolean;
  /** World position of the base. */
  position: THREE.Vector3;
  /** Centre of the bounding sphere used for look-at detection. */
  focus: THREE.Vector3;
  radius: number;
  height: number;
}

export type InteractableKind = 'challenge' | 'npc' | 'pad' | 'plaque';

export interface Interactable {
  id: string;
  kind: InteractableKind;
  zoneId: string;
  label: string;
  position: THREE.Vector3;
  /** How close the player must be. */
  reach: number;
  challenge?: ChallengeSpec;
  npc?: NpcSpec;
  plaque?: Plaque;
  /** For pads: the zone this pad belongs to. */
  padZone?: string;
}

/** What the HUD needs to label a person: who, where, and how far. */
export interface NpcView {
  npc: NpcSpec;
  zoneId: string;
  /** World position of the top of their head. */
  head: THREE.Vector3;
  distance: number;
}

interface NpcEntry {
  spec: NpcSpec;
  zoneId: string;
  interactable: Interactable;
  staticMesh: THREE.Mesh;
  ring: THREE.Mesh;
  ringBobber: Bobber;
  yaw: number;
  robe: number;
  pos: THREE.Vector3;
  actor: NpcActor | null;
}

export interface WorldOptions {
  seed: string;
  shadows: boolean;
  /** Scale the vegetation budget — lower it on weak hardware. */
  floraScale?: number;
}

interface Bobber {
  mesh: THREE.Object3D;
  baseY: number;
  speed: number;
  phase: number;
  spin: number;
}

export class World {
  readonly terrain: Terrain;
  readonly sky: Sky;
  readonly water: Water;
  readonly vegetation: Vegetation;
  readonly collision = new CollisionWorld();
  /** Ambient dust and pollen; follows the camera. */
  readonly atmosphere = new Atmosphere();
  private readonly groundCover: GroundCover;
  private readonly birds: Birds;
  readonly group = new THREE.Group();

  readonly landmarks: PlacedLandmark[] = [];
  /** Which colliders belong to which landmark (for checking that monuments do not sit inside each other). */
  readonly colliderRanges: Array<{ landmarkId: string; from: number; to: number }> = [];
  /** Every staircase's top step and the point just past it. */
  readonly stairs: Array<{ landmarkId: string; top: THREE.Vector3; beyond: THREE.Vector3 }> = [];
  readonly interactables: Interactable[] = [];
  readonly chariots: Chariot[] = [];

  private readonly bobbers: Bobber[] = [];
  private readonly npcEntries: NpcEntry[] = [];
  /** The people near the player this frame, for nameplates. */
  npcView: NpcView[] = [];
  /** Called when someone speaks aloud: a greeting, or a remark to nobody. */
  onNpcSay: ((npc: NpcSpec, text: string, greeting: boolean) => void) | null = null;
  /** One-shot effects, advanced each frame; return true when finished. */
  private readonly effects: Array<(dt: number) => boolean> = [];
  /** The Dhundh clinging to each uncorrected plaque, so it can be lifted. */
  private readonly plaqueHaze = new Map<string, { group: THREE.Group; bobber: Bobber }>();
  private readonly monumentMeshes: THREE.Mesh[] = [];
  private readonly personGeometries = new Map<number, THREE.BufferGeometry>();

  constructor(scene: THREE.Scene, opts: WorldOptions) {
    this.group.name = 'world';
    scene.add(this.group);

    this.terrain = new Terrain(opts.seed);
    this.group.add(this.terrain.mesh);

    this.sky = new Sky(opts.shadows);
    this.sky.addTo(scene);

    this.water = new Water(this.terrain);
    this.group.add(this.water.mesh);
    this.group.add(this.atmosphere.points);

    // Monuments first — vegetation needs to know where not to grow.
    const exclusions: ExclusionCircle[] = [];
    for (const zone of ZONES) {
      for (const landmark of zone.landmarks) {
        const placed = this.placeLandmark(zone, landmark, opts.seed);
        if (placed) {
          exclusions.push({ x: placed.position.x, z: placed.position.z, radius: Math.max(14, placed.radius * 1.25) });
        }
      }
      for (const challenge of zone.challenges) this.placeChallengeMarker(zone, challenge);
      for (const npc of zone.npcs) this.placeNpc(zone, npc, opts.seed);
      for (const plaque of getChapter(zone.id)?.plaques ?? []) this.placePlaque(zone, plaque, opts.seed);
    }

    this.spawnChariots(opts.seed);

    const floraOpts = defaultVegetationOptions(opts.seed);
    const scale = opts.floraScale ?? 1;
    floraOpts.trees = Math.round(floraOpts.trees * scale);
    floraOpts.rocks = Math.round(floraOpts.rocks * scale);
    this.vegetation = new Vegetation(this.terrain, exclusions, floraOpts);
    this.group.add(this.vegetation.group);

    this.groundCover = new GroundCover(this.terrain, this.collision, opts.seed, scale);
    this.group.add(this.groundCover.group);

    this.birds = new Birds(this.terrain);
    this.group.add(this.birds.mesh);
  }

  // ----------------------------------------------------------------- placement

  private placeLandmark(zone: Zone, landmark: Landmark, seed: string): PlacedLandmark | null {
    const [wx, wz] = worldPos(zone, landmark.offset);
    const built = buildLandmark(landmark.kind, landmark.opts, zone.palette, `${seed}:${landmark.id}`);
    if (!built.geometry.getAttribute('position')) return null;

    // Sit the monument on the ground. Shoreline structures are allowed to go
    // below sea level — a dock basin is supposed to hold water.
    const waterTolerant = landmark.kind === 'lothalDock' || landmark.kind === 'harbour' || landmark.kind === 'ramSetu' || landmark.kind === 'dhow';
    let y = this.terrain.heightAt(wx, wz);
    let x = wx;
    let z = wz;
    if (!waterTolerant && y < SEA_LEVEL + 0.8) {
      const found = this.terrain.findGround(wx, wz, 120);
      x = found.x;
      z = found.z;
      y = found.y;
    }
    if (landmark.kind === 'dhow' || landmark.kind === 'ramSetu') y = SEA_LEVEL;
    // Built on top of something already placed (a tower on a fort's summit): stand on its highest terrace.
    if (landmark.stack) {
      const tops = this.collision.columnAt(x, z).filter((b) => b.span >= 10).map((b) => b.maxY);
      if (tops.length > 0) y = Math.max(y, ...tops);
    }

    const rotY = THREE.MathUtils.degToRad(landmark.rotation ?? 0);
    const scale = landmark.scale ?? 1;

    const mesh = new THREE.Mesh(built.geometry, stoneMaterial());
    mesh.name = `landmark:${landmark.id}`;
    mesh.position.set(x, y, z);
    mesh.rotation.y = rotY;
    mesh.scale.setScalar(scale);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.matrixAutoUpdate = false;
    mesh.updateMatrix();
    this.group.add(mesh);
    this.monumentMeshes.push(mesh);

    const firstCollider = this.collision.count;
    this.collision.addPlaced(built.colliders, x, y, z, rotY, scale);
    this.colliderRanges.push({ landmarkId: landmark.id, from: firstCollider, to: this.collision.count });

    // Staircases, in world space: the top step and the spot just beyond it (used to verify they connect).
    {
      const c = Math.cos(rotY);
      const s = Math.sin(rotY);
      const toWorld = (p: readonly [number, number, number]): THREE.Vector3 =>
        new THREE.Vector3(x + (p[0] * c + p[2] * s) * scale, y + p[1] * scale, z + (-p[0] * s + p[2] * c) * scale);
      const tops = built.markers.filter((m) => m.name === 'stair:top');
      const beyonds = built.markers.filter((m) => m.name === 'stair:beyond');
      tops.forEach((t, i) => {
        const b = beyonds[i];
        if (b) this.stairs.push({ landmarkId: landmark.id, top: toWorld(t.pos), beyond: toWorld(b.pos) });
      });
    }

    const placed: PlacedLandmark = {
      id: landmark.id,
      name: landmark.name,
      kind: landmark.kind,
      zoneId: zone.id,
      codexId: landmark.codexId,
      scanSeconds: landmark.scanSeconds ?? 2.5,
      signposted: landmark.signposted ?? false,
      position: new THREE.Vector3(x, y, z),
      focus: new THREE.Vector3(x, y + built.height * scale * 0.5, z),
      radius: Math.max(6, built.radius * scale),
      height: built.height * scale,
    };
    this.landmarks.push(placed);

    // The landing terraces double as fast-travel points.
    if (landmark.kind === 'vimanaPad') {
      this.interactables.push({
        id: `pad:${zone.id}`,
        kind: 'pad',
        zoneId: zone.id,
        label: `Vimana terrace — ${zone.name}`,
        position: new THREE.Vector3(x, y + 1.8, z),
        reach: 7,
        padZone: zone.id,
      });
    }

    return placed;
  }

  /** A carved post with a floating marker, placed where a challenge starts. */
  /**
   * Where a person or a post should stand for a spot chosen on the map.
   *
   * On the ground if the ground there is clear. If the spot is inside something built, then on top of it
   * when it is a broad platform (a fort's terrace, a temple plinth), and otherwise at the nearest clear
   * place beside it. Without this, anyone whose spot fell inside a mound or a hall was buried in it.
   */
  private standPoint(wx: number, wz: number, search: number): { x: number; y: number; z: number } {
    const ground = this.terrain.findGround(wx, wz, search);
    const tryAt = (x: number, z: number): number | null => {
      const y0 = this.terrain.heightAt(x, z);
      if (y0 < SEA_LEVEL + 0.4) return null;
      const column = this.collision.columnAt(x, z);
      const clear = (y: number): boolean => !column.some((b) => b.minY < y + 1.9 && b.maxY > y + 0.12);
      if (clear(y0)) return y0;
      // The lowest broad platform with headroom: its terrace, not the roof of the keep above it.
      const tops = column
        .filter((b) => b.span >= 10 && b.maxY > y0)
        .map((b) => b.maxY)
        .sort((a, b) => a - b);
      for (const t of tops) if (clear(t)) return t;
      return null;
    };
    const here = tryAt(ground.x, ground.z);
    if (here !== null) return { x: ground.x, y: here, z: ground.z };
    for (let r = 2; r <= 24; r += 2) {
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + r * 0.7;
        const x = ground.x + Math.cos(a) * r;
        const z = ground.z + Math.sin(a) * r;
        const y = tryAt(x, z);
        if (y !== null) return { x, y, z };
      }
    }
    return ground;
  }

  private placeChallengeMarker(zone: Zone, challenge: ChallengeSpec): void {
    const [wx, wz] = worldPos(zone, challenge.offset);
    const ground = this.standPoint(wx, wz, 70);
    const stone = zone.palette.stone;

    const kit = new Kit();
    kit.cylinder(0.9, 1.3, 0.5, [0, 0.25, 0], shade(stone, 0.9), { segments: 12 });
    kit.cylinder(0.42, 0.52, 3.0, [0, 1.8, 0], shade(stone, 1.06), { segments: 10 });
    kit.box([1.3, 0.9, 0.35], [0, 3.5, 0], shade(stone, 1.12), { collide: false });
    // A small lotus bracket, so the posts read as made rather than dropped in.
    kit.ring(6, 0.62, (px, pz, a) => {
      kit.prism(
        [
          [-0.26, 0],
          [0.26, 0],
          [0, 0.5],
        ],
        0.14,
        [px, 0.5, pz],
        shade(stone, 1.14),
        { rotY: -a + Math.PI / 2, collide: false },
      );
    });
    const built = kit.build();

    const mesh = new THREE.Mesh(built.geometry, stoneMaterial());
    mesh.name = `challenge:${challenge.id}`;
    mesh.position.set(ground.x, ground.y, ground.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.collision.addPlaced(built.colliders, ground.x, ground.y, ground.z);

    // Floating glow diamond.
    const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), glowMaterial(0xffd97a, 0.7));
    glow.position.set(ground.x, ground.y + 4.9, ground.z);
    glow.name = `challenge-glow:${challenge.id}`;
    this.group.add(glow);
    this.bobbers.push({ mesh: glow, baseY: glow.position.y, speed: 1.4, phase: Math.random() * 6.28, spin: 0.9 });

    this.interactables.push({
      id: `challenge:${challenge.id}`,
      kind: 'challenge',
      zoneId: zone.id,
      label: challenge.prompt ?? challenge.name,
      position: new THREE.Vector3(ground.x, ground.y + 1.4, ground.z),
      reach: 5.5,
      challenge,
    });
  }

  /**
   * A person. Far away they are one merged mesh; close up the director swaps in
   * an articulated NpcActor (see `updateNpcs`). Either way they are somebody you
   * can talk to, so the interactable follows them around if they wander.
   */
  private placeNpc(zone: Zone, npc: NpcSpec, seed: string): void {
    let [wx, wz] = worldPos(zone, npc.offset);
    // Never stand a person on top of a challenge post: E would not know which you meant.
    for (const it of this.interactables) {
      if (it.kind !== 'challenge') continue;
      const dx = wx - it.position.x;
      const dz = wz - it.position.z;
      const d = Math.hypot(dx, dz);
      if (d < 3) {
        const k = d < 0.01 ? 1 : 3.4 / d;
        wx = it.position.x + (d < 0.01 ? 3.4 : dx * k);
        wz = it.position.z + (d < 0.01 ? 0 : dz * k);
      }
    }
    const ground = this.standPoint(wx, wz, 60);
    const color = npc.color ?? 0xb08a5a;

    let geo = this.personGeometries.get(color);
    if (!geo) {
      geo = buildPerson(color, new Rng(`${seed}:person:${color}`));
      this.personGeometries.set(color, geo);
    }

    const rng = new Rng(`${seed}:npc:${npc.id}`);
    const yaw = rng.range(0, Math.PI * 2);
    const mesh = new THREE.Mesh(geo, stoneMaterial());
    mesh.name = `npc:${npc.id}`;
    mesh.position.set(ground.x, ground.y, ground.z);
    mesh.rotation.y = yaw;
    mesh.castShadow = true;
    this.group.add(mesh);

    // People who stay at their post are solid. Walkers are not: a wall that does not move cannot follow them.
    const stays = !WALKERS.test(`${npc.role} ${npc.name}`);
    if (stays) this.collision.add(ground.x - 0.4, ground.y, ground.z - 0.4, ground.x + 0.4, ground.y + 1.8, ground.z + 0.4);

    const glow = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 18), glowMaterial(0x7fd4c8, 0.55));
    glow.rotation.x = Math.PI / 2;
    glow.position.set(ground.x, ground.y + 2.45, ground.z);
    this.group.add(glow);
    const ringBobber: Bobber = { mesh: glow, baseY: glow.position.y, speed: 1.0, phase: rng.range(0, 6.28), spin: 0.5 };
    this.bobbers.push(ringBobber);

    const interactable: Interactable = {
      id: `npc:${npc.id}`,
      kind: 'npc',
      zoneId: zone.id,
      label: `Speak with ${npc.name}`,
      position: new THREE.Vector3(ground.x, ground.y + 1.2, ground.z),
      reach: 4.5,
      npc,
    };
    this.interactables.push(interactable);
    this.npcEntries.push({
      spec: npc,
      zoneId: zone.id,
      interactable,
      staticMesh: mesh,
      ring: glow,
      ringBobber,
      yaw,
      robe: color,
      pos: new THREE.Vector3(ground.x, ground.y, ground.z),
      actor: null,
    });
  }

  /**
   * Bring the people to life.
   *
   * Everyone within sixty metres of the player is an animated actor; further out
   * they are a frozen mesh. Actors turn to face the player, wave when first met,
   * do the work their role implies, and — for the few who walk — wander near
   * their post. Whoever is in conversation (`talking`) keeps facing the player.
   */
  private updateNpcs(dt: number, focus: THREE.Vector3, talking: string | null): void {
    const env = this.actorEnv();
    const view: NpcView[] = [];
    for (const e of this.npcEntries) {
      const dx = e.pos.x - focus.x;
      const dz = e.pos.z - focus.z;
      const dist = Math.hypot(dx, dz);

      if (!e.actor && dist < 60) {
        const actor = new NpcActor(e.spec, e.pos.x, e.pos.y, e.pos.z, e.yaw, e.robe);
        this.group.add(actor.root);
        e.staticMesh.visible = false;
        e.actor = actor;
      } else if (e.actor && dist > 82) {
        // Hand back to the cheap mesh, wherever they have wandered to.
        e.pos.copy(e.actor.position);
        e.yaw = e.actor.yaw;
        e.staticMesh.position.copy(e.pos);
        e.staticMesh.rotation.y = e.yaw;
        e.staticMesh.visible = true;
        this.group.remove(e.actor.root);
        e.actor.dispose();
        e.actor = null;
      }

      if (e.actor) {
        const said = e.actor.update(dt, env, focus, talking === e.spec.id);
        e.pos.copy(e.actor.position);
        e.yaw = e.actor.yaw;
        if (said && this.onNpcSay) this.onNpcSay(e.spec, said, !e.actor.hasGreeted || said.length < 30);
        e.interactable.position.set(e.pos.x, e.pos.y + 1.2, e.pos.z);
        // The glow ring floats over whoever it belongs to.
        e.ring.position.x = e.pos.x;
        e.ring.position.z = e.pos.z;
        e.ringBobber.baseY = e.pos.y + 2.45;
      }
      if (dist < 24) view.push({ npc: e.spec, zoneId: e.zoneId, head: new THREE.Vector3(e.pos.x, e.pos.y + 2.25, e.pos.z), distance: dist });
    }
    view.sort((a, b) => a.distance - b.distance);
    this.npcView = view;
  }

  private actorEnvCache: ActorEnv | null = null;

  private actorEnv(): ActorEnv {
    this.actorEnvCache ??= {
      groundAt: (x, z) => this.terrain.heightAt(x, z),
      resolve: (x, y, z) => {
        const r = this.collision.resolve(x, y, z, 0.35, 1.7);
        return { x: r.x, z: r.z };
      },
      seaLevel: SEA_LEVEL,
    };
    return this.actorEnvCache;
  }

  /**
   * A weathered stele beside a monument, wrapped in grey haze until the claim
   * on it has been corrected. It stands off the monument by that monument's own
   * radius, on a bearing fixed by the plaque id, so two plaques never pile up.
   */
  private placePlaque(zone: Zone, plaque: Plaque, seed: string): void {
    const near = this.landmarks.find((l) => l.id === plaque.near);
    if (!near) return;
    const rng = new Rng(`${seed}:plaque:${plaque.id}`);
    // Pick a spot on dry ground that is clear of everything else we have placed: some monuments stand
    // on a shore, and a stele in the sea (or on top of a person) is no use to anybody.
    let angle = rng.range(0, Math.PI * 2);
    let dist = near.radius + rng.range(9, 15);
    let ground = this.terrain.findGround(near.position.x + Math.cos(angle) * dist, near.position.z + Math.sin(angle) * dist, 60);
    for (let tries = 0; tries < 24; tries++) {
      const dry = ground.y > SEA_LEVEL + 0.8;
      const clear = this.interactables.every((it) => Math.hypot(it.position.x - ground.x, it.position.z - ground.z) > 3);
      if (dry && clear) break;
      angle += 2.4; // the golden angle, so successive tries spread round the monument
      dist = near.radius + 9 + (tries % 6) * 2.5;
      ground = this.terrain.findGround(near.position.x + Math.cos(angle) * dist, near.position.z + Math.sin(angle) * dist, 60);
    }
    const stone = zone.palette.stone;

    const kit = new Kit();
    kit.box([2.6, 0.5, 1.4], [0, 0.25, 0], shade(stone, 0.82));
    kit.box([1.7, 2.7, 0.42], [0, 1.85, 0], shade(stone, 0.96));
    kit.prism(
      [
        [-0.85, 0],
        [0.85, 0],
        [0, 0.7],
      ],
      0.42,
      [0, 3.2, 0],
      shade(stone, 1.08),
      { collide: false },
    );
    // A pale panel on the face, where the claim would be painted.
    kit.box([1.25, 1.4, 0.06], [0, 1.95, 0.24], shade(stone, 1.3), { collide: false });
    const built = kit.build();

    const mesh = new THREE.Mesh(built.geometry, stoneMaterial());
    mesh.name = `plaque:${plaque.id}`;
    mesh.position.set(ground.x, ground.y, ground.z);
    // Face the monument it stands beside.
    mesh.rotation.y = Math.atan2(near.position.x - ground.x, near.position.z - ground.z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.group.add(mesh);
    this.collision.addPlaced(built.colliders, ground.x, ground.y, ground.z, mesh.rotation.y);

    // The haze: three soft grey spheres that drift. Not additive — the Dhundh
    // dulls things, it does not glow.
    const haze = new THREE.Group();
    const hazeMat = new THREE.MeshBasicMaterial({ color: 0x8a8e9a, transparent: true, opacity: 0.38, depthWrite: false, toneMapped: false });
    for (const [x, y, z, r] of [
      [0, 0, 0, 2.3],
      [-0.9, 0.7, 0.5, 1.7],
      [1.0, -0.5, 0.3, 1.5],
    ] as const) {
      const blob = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 9), hazeMat);
      blob.position.set(x, y, z);
      haze.add(blob);
    }
    haze.position.set(ground.x, ground.y + 2.1, ground.z);
    haze.name = `plaque-haze:${plaque.id}`;
    this.group.add(haze);
    const bobber: Bobber = { mesh: haze, baseY: haze.position.y, speed: 0.7, phase: rng.range(0, 6.28), spin: 0.25 };
    this.bobbers.push(bobber);
    this.plaqueHaze.set(plaque.id, { group: haze, bobber });

    this.interactables.push({
      id: `plaque:${plaque.id}`,
      kind: 'plaque',
      zoneId: zone.id,
      label: 'Read the plaque',
      position: new THREE.Vector3(ground.x, ground.y + 1.8, ground.z),
      reach: 5,
      plaque,
    });
  }

  /** Lift the haze from a plaque once its claim has been corrected. Safe to call twice. */
  setPlaqueCleared(plaqueId: string, instant = false): void {
    const entry = this.plaqueHaze.get(plaqueId);
    if (!entry) return;
    this.plaqueHaze.delete(plaqueId);
    this.dissolveHaze(entry.group, entry.bobber, instant);

    const it = this.interactables.find((i) => i.id === `plaque:${plaqueId}`);
    if (it) {
      it.label = 'Reread the plaque';
      // A small gold diamond, the same language as a completed challenge post.
      const glow = new THREE.Mesh(new THREE.OctahedronGeometry(0.4, 0), glowMaterial(0xffd97a, 0.7));
      glow.position.set(it.position.x, it.position.y + 2.4, it.position.z);
      this.group.add(glow);
      this.bobbers.push({ mesh: glow, baseY: glow.position.y, speed: 1.2, phase: 0, spin: 0.8 });
    }
  }

  /**
   * The haze does not vanish: it swells, thins and drifts upward over about two
   * seconds while a ring of gold light spreads outward from the stele, so the
   * correction reads as something that happened.
   */
  private dissolveHaze(group: THREE.Group, bobber: Bobber, instant: boolean): void {
    const DURATION = 2.2;
    const blobs = group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh);
    const material = blobs[0]?.material as THREE.MeshBasicMaterial | undefined;
    const startOpacity = material?.opacity ?? 0.38;
    const origin = group.position.clone();

    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffd97a,
      transparent: true,
      opacity: 0.9,
      depthWrite: false,
      toneMapped: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.05, 6, 40), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.set(origin.x, origin.y - 1.6, origin.z);
    this.group.add(ring);

    let t = 0;
    this.effects.push((dt) => {
      t += dt;
      const k = Math.min(1, t / DURATION);
      const ease = k * k * (3 - 2 * k);
      if (material) material.opacity = startOpacity * (1 - ease);
      group.scale.setScalar(1 + ease * 0.9);
      bobber.baseY = origin.y + ease * 2.4;
      ring.scale.setScalar(0.5 + ease * 7);
      ringMat.opacity = 0.9 * (1 - ease);
      if (k < 1) return false;

      this.group.remove(group);
      this.group.remove(ring);
      for (const b of blobs) b.geometry.dispose();
      material?.dispose();
      ring.geometry.dispose();
      ringMat.dispose();
      const at = this.bobbers.indexOf(bobber);
      if (at >= 0) this.bobbers.splice(at, 1);
      return true;
    });
    // Plaques already corrected in an earlier session just start clear.
    if (instant) this.effects.pop()?.(DURATION);
  }

  /**
   * Park chariots where a player would look for one: by the landing terrace, and
   * by a gate, bazaar or village on the other side of each region.
   */
  private spawnChariots(seed: string): void {
    const rng = new Rng(`${seed}:chariots`);
    const PREFERRED = new Set(['vimanaPad', 'cityGate', 'bazaarStreet', 'villageCluster', 'harbour', 'hermitage']);

    for (const zone of ZONES) {
      const candidates = zone.landmarks.filter((l) => PREFERRED.has(l.kind));
      const chosen = candidates.length >= 2 ? rng.sample(candidates, 2) : zone.landmarks.slice(0, 2);

      chosen.forEach((landmark, index) => {
        const placed = this.landmarks.find((l) => l.id === landmark.id);
        const base = placed
          ? { x: placed.position.x, z: placed.position.z, radius: placed.radius }
          : { x: zone.center[0], z: zone.center[1], radius: 20 };

        // Stand off from the monument so the chariot is not inside it.
        const angle = rng.range(0, Math.PI * 2);
        const dist = base.radius + rng.range(10, 20);
        const spot = this.terrain.findGround(base.x + Math.cos(angle) * dist, base.z + Math.sin(angle) * dist, 70);

        const chariot = new Chariot(
          `${zone.id}-chariot-${index}`,
          zone.id,
          spot.x,
          spot.z,
          rng.range(0, Math.PI * 2),
          this.terrain,
          this.collision,
          zone.palette.stone,
          rng,
        );
        this.chariots.push(chariot);
        this.group.add(chariot.group);
      });
    }
  }

  /** Closest chariot within reach, for mounting. */
  nearestChariot(point: THREE.Vector3, maxDistance = 5.5): Chariot | null {
    let best: Chariot | null = null;
    let bestD = maxDistance;
    for (const c of this.chariots) {
      const d = Math.hypot(c.position.x - point.x, c.position.z - point.z);
      if (d < bestD) {
        bestD = d;
        best = c;
      }
    }
    return best;
  }

  // ------------------------------------------------------------------ queries

  /** Terrain height only. */
  heightAt(x: number, z: number): number {
    return this.terrain.heightAt(x, z);
  }

  /** Highest walkable surface: terrain, or a building floor above it. */
  groundAt(x: number, z: number, fromY: number): number {
    const terrain = this.terrain.heightAt(x, z);
    const built = this.collision.supportAt(x, z, fromY + 0.3, 0.45);
    return built !== null && built > terrain ? built : terrain;
  }

  zoneAt(x: number, z: number): Zone | null {
    return zoneAt(x, z);
  }

  /** Nearest interactable within reach of a point. */
  nearestInteractable(point: THREE.Vector3): Interactable | null {
    let best: Interactable | null = null;
    let bestD = Infinity;
    for (const it of this.interactables) {
      const d = it.position.distanceTo(point);
      if (d <= it.reach && d < bestD) {
        best = it;
        bestD = d;
      }
    }
    return best;
  }

  /**
   * Which landmark is the player looking at?
   *
   * Tests the view ray against each nearby landmark's bounding sphere. A proper
   * raycast against the merged meshes would be more accurate and much slower,
   * and would make scanning a thin pillar infuriating.
   */
  landmarkInSights(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance = 140): PlacedLandmark | null {
    let best: PlacedLandmark | null = null;
    let bestScore = Infinity;
    for (const lm of this.landmarks) {
      if (!lm.codexId) continue;
      const toward = _v1.subVectors(lm.focus, origin);
      const dist = toward.length();
      if (dist > maxDistance) continue;
      const along = toward.dot(direction);
      if (along <= 0) continue;
      // Perpendicular miss distance from the ray to the landmark centre.
      const miss = Math.sqrt(Math.max(0, dist * dist - along * along));
      const tolerance = Math.max(5, lm.radius * 0.85);
      if (miss > tolerance) continue;
      const score = miss / tolerance + dist / maxDistance;
      if (score < bestScore) {
        bestScore = score;
        best = lm;
      }
    }
    return best;
  }

  /** The pad the player starts beside, in the first chapter's zone. */
  spawnPoint(): THREE.Vector3 {
    const first = ZONES[0] as Zone;
    const pad = this.interactables.find((i) => i.kind === 'pad' && i.padZone === first.id);
    const base = pad ? pad.position : new THREE.Vector3(first.center[0], 0, first.center[1] + 30);
    const ground = this.terrain.findGround(base.x, base.z + 12, 60);
    return new THREE.Vector3(ground.x, ground.y + 2, ground.z);
  }

  padFor(zoneId: string): Interactable | undefined {
    return this.interactables.find((i) => i.kind === 'pad' && i.padZone === zoneId);
  }

  /** Called by the game when frame time suffers: grass is the cheapest thing to thin. */
  setDetail(level: number): void {
    this.groundCover.setLevel(level);
  }

  // ------------------------------------------------------------------- update

  update(dt: number, camera: THREE.Camera, elapsed: number, focus?: THREE.Vector3, talking: string | null = null): void {
    shaderTime.value = elapsed;
    this.sky.update(dt, camera.position, elapsed);
    this.water.update(elapsed, this.sky.sun.position.clone().sub(camera.position).normalize(), this.sky.sun.color, this.sky.fog.color);
    for (const b of this.bobbers) {
      b.mesh.position.y = b.baseY + Math.sin(elapsed * b.speed + b.phase) * 0.3;
      b.mesh.rotation.y += dt * b.spin;
    }
    this.updateNpcs(dt, focus ?? camera.position, talking);
    this.groundCover.update(focus ?? camera.position);
    this.birds.update(focus ?? camera.position, elapsed);

    // Low sun, more glow in the air.
    const sunDir = _v1.copy(this.sky.sun.position).sub(camera.position).normalize();
    const warmth = THREE.MathUtils.clamp(1 - sunDir.y * 1.5, 0, 1);
    this.atmosphere.update(dt, elapsed, camera.position, this.sky.sun.color, warmth);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      if (this.effects[i]?.(dt)) this.effects.splice(i, 1);
    }
    // The ridden chariot is driven by the player; the rest just settle.
    for (const c of this.chariots) {
      if (!c.mounted) c.update(dt, null);
    }
  }

  get stats(): { monuments: number; colliders: number; flora: number; interactables: number; chariots: number } {
    return {
      monuments: this.monumentMeshes.length,
      colliders: this.collision.count,
      flora: this.vegetation.instanceCount,
      interactables: this.interactables.length,
      chariots: this.chariots.length,
    };
  }

  dispose(): void {
    for (const c of this.chariots) c.dispose();
    this.chariots.length = 0;
    for (const mesh of this.monumentMeshes) mesh.geometry.dispose();
    for (const geo of this.personGeometries.values()) geo.dispose();
    this.personGeometries.clear();
    this.atmosphere.dispose();
    this.groundCover.dispose();
    this.birds.dispose();
    this.vegetation.dispose();
    this.water.dispose();
    this.sky.dispose();
    this.terrain.dispose();
    this.group.clear();
    this.collision.clear();
  }
}

const _v1 = new THREE.Vector3();

/** A low-poly standing person: robe, torso, head, arms. */
/** Roles that wander rather than stand at a post. Kept in step with the wander table in NpcActor. */
const WALKERS = /child|water.?carrier/i;

function buildPerson(color: number, rng: Rng): THREE.BufferGeometry {
  const kit = new Kit();
  const skin = 0x8a5f3c;
  const robe = color;

  // Robe, flaring slightly at the hem.
  kit.lathe(
    [
      [0.42, 0],
      [0.36, 0.5],
      [0.3, 1.0],
      [0.28, 1.15],
    ],
    [0, 0, 0],
    shade(robe, 0.95),
    { segments: 9, collide: false },
  );
  kit.box([0.52, 0.56, 0.3], [0, 1.4, 0], robe, { collide: false });
  // Shoulders and arms.
  for (const side of [-1, 1]) {
    kit.box([0.14, 0.52, 0.16], [side * 0.32, 1.38, 0.02], shade(robe, 1.06), {
      rotZ: side * rng.range(0.05, 0.16),
      collide: false,
    });
    kit.sphere(0.09, [side * 0.34, 1.1, 0.04], skin, { segments: 6, collide: false });
  }
  // Neck and head.
  kit.cylinder(0.08, 0.09, 0.12, [0, 1.73, 0], skin, { segments: 6, collide: false });
  kit.sphere(0.165, [0, 1.9, 0], skin, { segments: 9, collide: false });
  // A wrapped cloth on the head, which also reads as hair at distance.
  kit.dome(0.175, [0, 1.88, 0], shade(robe, 1.14), { segments: 9, squash: 0.8, collide: false });

  const built = kit.build();
  return built.geometry;
}
