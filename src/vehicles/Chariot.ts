import * as THREE from 'three';
import { Kit } from '../world/architecture/kit';
import { stoneMaterial, shade } from '../world/Materials';
import { WOOD } from '../world/architecture/props';
import type { Terrain } from '../world/Terrain';
import { SEA_LEVEL } from '../world/Terrain';
import type { CollisionWorld } from '../world/Collision';
import type { Rng } from '../core/Rng';
import { audio } from '../core/Audio';

/**
 * A rideable chariot — the fast-travel-on-the-ground answer.
 *
 * Handling is deliberately simple: speed along a heading, steering that scales
 * with speed so it cannot pivot on the spot, and the body pitched and rolled to
 * the ground normal. There is no suspension model because at this scale nobody
 * would see one, and a chariot that is predictable to drive beats a chariot
 * that is accurately simulated.
 */

const MAX_SPEED = 21;
const REVERSE_SPEED = 7;
const ACCEL = 15;
const BRAKE = 30;
const DRAG = 2.4;
const TURN_RATE = 1.45;
const BODY_RADIUS = 2.0;
const WHEEL_RADIUS = 1.05;
const WATER_DRAG = 0.22;
/**
 * The parts are modelled at a comfortable working scale and then shrunk to
 * life size: a chariot wheel is about a metre and a half across, not three.
 */
const SCALE = 0.75;
/** Height of the deck above the ground, in world units. */
export const CHARIOT_DECK_HEIGHT = 1.34 * SCALE + 0.1;

export interface ChariotInput {
  throttle: number; // -1 .. 1
  steer: number; // -1 .. 1
  handbrake: boolean;
}

export class Chariot {
  readonly id: string;
  readonly zoneId: string;
  readonly group = new THREE.Group();
  readonly position = new THREE.Vector3();
  /** Where the rider stands, updated every frame. */
  readonly riderPosition = new THREE.Vector3();

  yaw = 0;
  speed = 0;
  mounted = false;

  private readonly terrain: Terrain;
  private readonly collision: CollisionWorld;
  private readonly wheelL: THREE.Mesh;
  private readonly wheelR: THREE.Mesh;
  private readonly horses: THREE.Group;
  private wheelSpin = 0;
  private gallop = 0;
  private hoofAccumulator = 0;
  private bodyPitch = 0;
  private bodyRoll = 0;

  constructor(
    id: string,
    zoneId: string,
    x: number,
    z: number,
    yaw: number,
    terrain: Terrain,
    collision: CollisionWorld,
    stone: number,
    rng: Rng,
  ) {
    this.id = id;
    this.zoneId = zoneId;
    this.terrain = terrain;
    this.collision = collision;
    this.yaw = yaw;

    const parts = buildChariotParts(stone, rng);

    const body = new THREE.Mesh(parts.body, stoneMaterial());
    body.castShadow = true;
    this.group.add(body);

    this.wheelL = new THREE.Mesh(parts.wheel, stoneMaterial());
    this.wheelR = new THREE.Mesh(parts.wheel, stoneMaterial());
    this.wheelL.position.set(-1.6, WHEEL_RADIUS, 0);
    this.wheelR.position.set(1.6, WHEEL_RADIUS, 0);
    this.wheelL.castShadow = true;
    this.wheelR.castShadow = true;
    this.group.add(this.wheelL, this.wheelR);

    this.horses = new THREE.Group();
    const horseMesh = new THREE.Mesh(parts.horses, stoneMaterial());
    horseMesh.castShadow = true;
    this.horses.add(horseMesh);
    this.horses.position.set(0, 0, 5.6);
    this.group.add(this.horses);

    this.group.scale.setScalar(SCALE);
    this.position.set(x, terrain.heightAt(x, z), z);
    this.group.position.copy(this.position);
    // The model is built facing local +Z (prow, horses, standard). A group turned
    // by plain `yaw` sends local +Z to (+sin, +cos) — the exact opposite of
    // forward(), which is (-sin, -cos). Hence the half turn: without it the team
    // is harnessed to the back of the cart, facing the driver.
    this.group.rotation.y = yaw + Math.PI;
    this.updateRider();
  }

  get isInWater(): boolean {
    return this.position.y < SEA_LEVEL + 0.4;
  }

  /** Forward unit vector, matching the player's yaw convention. */
  forward(out = new THREE.Vector3()): THREE.Vector3 {
    return out.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  mount(): void {
    this.mounted = true;
    audio.pluck(196, 0.22);
  }

  dismount(): void {
    this.mounted = false;
    this.speed *= 0.3;
  }

  /** A spot beside the chariot to step off onto. */
  dismountPoint(out = new THREE.Vector3()): THREE.Vector3 {
    const right = _v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    out.copy(this.position).addScaledVector(right, 2.6);
    out.y = this.terrain.heightAt(out.x, out.z);
    return out;
  }

  update(dt: number, input: ChariotInput | null): void {
    if (input) {
      if (input.handbrake) {
        this.speed = approach(this.speed, 0, BRAKE * 1.6 * dt);
      } else if (input.throttle > 0) {
        this.speed = approach(this.speed, MAX_SPEED * input.throttle, ACCEL * dt);
      } else if (input.throttle < 0) {
        // Brake first, then reverse.
        this.speed = this.speed > 0.5 ? approach(this.speed, 0, BRAKE * dt) : approach(this.speed, -REVERSE_SPEED, ACCEL * 0.6 * dt);
      } else {
        this.speed = approach(this.speed, 0, DRAG * dt);
      }

      // Steering authority grows with speed, so it cannot spin on the spot.
      const grip = Math.min(1, Math.abs(this.speed) / 7);
      const direction = this.speed >= 0 ? 1 : -1;
      this.yaw -= input.steer * TURN_RATE * grip * direction * dt;
    } else {
      this.speed = approach(this.speed, 0, DRAG * 2 * dt);
    }

    if (this.isInWater) this.speed *= Math.pow(WATER_DRAG, dt);

    if (Math.abs(this.speed) > 0.01) {
      const fwd = this.forward(_f);
      const nx = this.position.x + fwd.x * this.speed * dt;
      const nz = this.position.z + fwd.z * this.speed * dt;

      // Push out of buildings, then judge the hit by how much forward progress
      // actually survived. Grazing a wall and sliding along it should cost
      // almost nothing; driving straight into one should stop you. Penalising
      // every frame of contact equally is what makes vehicles stick to walls.
      const r = this.collision.resolve(nx, this.position.y, nz, BODY_RADIUS * SCALE, 2.2, 0.9);
      if (r.blocked) {
        const intended = this.speed * dt;
        const achieved = (r.x - this.position.x) * fwd.x + (r.z - this.position.z) * fwd.z;
        const progress = Math.abs(intended) > 1e-5 ? achieved / intended : 1;
        if (progress < 0.4) {
          this.speed *= 0.35;
          audio.footstep(false);
        }
      }
      this.position.x = r.x;
      this.position.z = r.z;

      this.wheelSpin -= (this.speed * dt) / WHEEL_RADIUS;
      this.gallop += dt * (3 + Math.abs(this.speed) * 0.55);

      // Hoofbeats, paced by distance so they stay in step with the gallop.
      this.hoofAccumulator += Math.abs(this.speed) * dt;
      if (this.hoofAccumulator > 3.2) {
        this.hoofAccumulator = 0;
        audio.footstep(true);
      }
    }

    // Sit on the ground, and tilt to it.
    const groundY = this.terrain.heightAt(this.position.x, this.position.z);
    this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, Math.min(1, dt * 12));

    const ahead = 2.4;
    const fwd = this.forward(_f);
    const hFront = this.terrain.heightAt(this.position.x + fwd.x * ahead, this.position.z + fwd.z * ahead);
    const hBack = this.terrain.heightAt(this.position.x - fwd.x * ahead, this.position.z - fwd.z * ahead);
    const right = _v.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const hRight = this.terrain.heightAt(this.position.x + right.x * 1.3, this.position.z + right.z * 1.3);
    const hLeft = this.terrain.heightAt(this.position.x - right.x * 1.3, this.position.z - right.z * 1.3);

    this.bodyPitch = THREE.MathUtils.lerp(this.bodyPitch, Math.atan2(hBack - hFront, ahead * 2), Math.min(1, dt * 7));
    this.bodyRoll = THREE.MathUtils.lerp(this.bodyRoll, Math.atan2(hLeft - hRight, 2.6), Math.min(1, dt * 7));

    this.group.position.copy(this.position);
    this.group.rotation.order = 'YXZ';
    this.group.rotation.y = this.yaw + Math.PI;
    // Pitch is unaffected by the half turn: a Y rotation leaves the nose's
    // vertical component alone. Roll is not — the half turn swaps which side of
    // the model is the world's right — so it inverts.
    this.group.rotation.x = this.bodyPitch;
    this.group.rotation.z = -this.bodyRoll;

    this.wheelL.rotation.x = this.wheelSpin;
    this.wheelR.rotation.x = this.wheelSpin;
    // Horses rise and fall with the gallop, and lean into the pull.
    const bob = Math.abs(this.speed) > 0.5 ? Math.abs(Math.sin(this.gallop)) * 0.28 : 0;
    this.horses.position.y = bob;
    this.horses.rotation.x = -bob * 0.25;

    this.updateRider();
  }

  private updateRider(): void {
    const fwd = this.forward(_f);
    this.riderPosition.set(this.position.x - fwd.x * 0.35, this.position.y, this.position.z - fwd.z * 0.35);
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
  }
}

/** Body, one wheel, and the pair of horses, as three separate geometries. */
function buildChariotParts(stone: number, rng: Rng): {
  body: THREE.BufferGeometry;
  wheel: THREE.BufferGeometry;
  horses: THREE.BufferGeometry;
} {
  // --- car body: platform, curved front screen, side rails, pole and yoke.
  const b = new Kit();
  b.box([3.3, 0.35, 2.7], [0, 1.15, 0], WOOD, { collide: false });
  b.box([3.3, 0.18, 2.7], [0, 1.34, 0], shade(WOOD, 1.18), { collide: false });
  b.prism(
    [
      [-1.65, 0],
      [1.65, 0],
      [1.65, 1.35],
      [0.85, 1.85],
      [-0.85, 1.85],
      [-1.65, 1.35],
    ],
    0.22,
    [0, 1.3, 1.3],
    shade(stone, 1.05),
    { collide: false },
  );
  for (const side of [-1, 1]) {
    b.box([0.16, 0.9, 2.7], [side * 1.6, 1.85, 0], WOOD, { collide: false });
    b.box([0.2, 0.2, 2.7], [side * 1.6, 2.3, 0], shade(WOOD, 1.25), { collide: false });
  }
  // Axle, pole and yoke.
  b.cylinder(0.14, 0.14, 3.6, [0, 1.05, 0], 0x3a2b1c, { segments: 6, rotZ: Math.PI / 2, collide: false });
  b.box([0.22, 0.22, 5.6], [0, 1.1, 2.9], WOOD, { collide: false });
  b.box([2.9, 0.2, 0.2], [0, 1.35, 5.3], WOOD, { collide: false });
  // A standard on a staff — every chariot in the epics carries one.
  b.cylinder(0.08, 0.1, 3.2, [1.3, 3.4, -0.9], WOOD, { segments: 5, collide: false });
  b.box([0.08, 1.0, 1.3], [1.3, 4.5, -1.4], 0xd4702a, { collide: false });

  // --- wheel, built in the XZ plane so rotation.x spins it.
  const w = new Kit();
  w.torus(WHEEL_RADIUS, 0.12, [0, 0, 0], 0x4e3a26, { rotY: Math.PI / 2, segments: 18, collide: false });
  for (let i = 0; i < 8; i++) {
    w.box([0.09, WHEEL_RADIUS * 1.95, 0.09], [0, 0, 0], 0x5c4530, {
      rotY: Math.PI / 2,
      rotZ: (i / 8) * Math.PI,
      collide: false,
    });
  }
  w.cylinder(0.2, 0.2, 0.42, [0, 0, 0], 0x3a2b1c, { segments: 8, rotZ: Math.PI / 2, collide: false });

  // --- a pair of horses in harness.
  const h = new Kit();
  for (const side of [-1, 1]) {
    const hx = side * 1.1;
    const coat = side < 0 ? shade(0x6b513a, rng.range(0.9, 1.1)) : shade(0x8a6b4a, rng.range(0.9, 1.1));
    h.box([1.1, 1.5, 3.0], [hx, 2.1, 0], coat, { collide: false });
    h.box([0.85, 1.0, 1.15], [hx, 2.95, 1.75], coat, { collide: false });
    h.box([0.5, 0.5, 1.0], [hx, 2.6, 2.5], coat, { rotX: -0.25, collide: false });
    // Mane and tail.
    h.box([0.1, 0.55, 1.1], [hx, 3.3, 1.1], 0x2e2219, { collide: false });
    h.box([0.12, 0.85, 0.3], [hx, 2.5, -1.6], 0x2e2219, { rotX: 0.5, collide: false });
    for (const [lx, lz] of [
      [-0.35, -1.0],
      [0.35, -1.0],
      [-0.35, 1.0],
      [0.35, 1.0],
    ] as Array<[number, number]>) {
      h.box([0.26, 1.5, 0.26], [hx + lx, 0.75, lz], shade(coat, 0.85), { collide: false });
    }
    // Harness strap back to the yoke.
    h.box([0.1, 0.1, 1.4], [hx, 2.4, -1.9], 0x4a3524, { collide: false });
  }

  return { body: b.build().geometry, wheel: w.build().geometry, horses: h.build().geometry };
}

function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

const _f = new THREE.Vector3();
const _v = new THREE.Vector3();
