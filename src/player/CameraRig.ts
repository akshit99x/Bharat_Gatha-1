import * as THREE from 'three';
import type { CollisionWorld } from '../world/Collision';
import type { Terrain } from '../world/Terrain';
import { SEA_LEVEL } from '../world/Terrain';

/**
 * Third-person camera.
 *
 * The camera orbits a pivot at the character's head, offset over the right
 * shoulder, and the crosshair stays dead centre — so the direction the camera
 * looks is still the direction you aim and interact, and all the first-person
 * code (scanning, the interaction probe) keeps working unchanged.
 *
 * Two details do most of the work for feel:
 *  - the boom shortens *instantly* when something gets between camera and
 *    character, and extends back slowly, so you never see through a wall but
 *    the camera does not snap out in doorways;
 *  - the pivot is damped, not the orientation, so looking around stays exact
 *    while the body movement is smoothed.
 */

export type CameraMode = 'third' | 'first';

const DEFAULT_DISTANCE = 5.8;
const AIM_DISTANCE = 2.9;
const DEFAULT_SHOULDER = 0.95;
const AIM_SHOULDER = 0.62;
const MIN_DISTANCE = 0.9;
const CAMERA_RADIUS = 0.3;

export class CameraRig {
  mode: CameraMode = 'third';

  private readonly camera: THREE.PerspectiveCamera;
  private readonly collision: CollisionWorld;
  private readonly terrain: Terrain;

  private readonly pivot = new THREE.Vector3();
  private readonly smoothedPivot = new THREE.Vector3();
  private readonly desired = new THREE.Vector3();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();

  private boom = DEFAULT_DISTANCE;
  private targetBoom = DEFAULT_DISTANCE;
  private shoulder = DEFAULT_SHOULDER;
  private initialised = false;

  /** Extra distance applied by vehicles, which need a wider view. */
  extraDistance = 0;
  /** Extra pivot height, for riding something taller than you are. */
  extraHeight = 0;

  constructor(camera: THREE.PerspectiveCamera, collision: CollisionWorld, terrain: Terrain) {
    this.camera = camera;
    this.collision = collision;
    this.terrain = terrain;
  }

  toggle(): CameraMode {
    this.mode = this.mode === 'third' ? 'first' : 'third';
    this.initialised = false;
    return this.mode;
  }

  /** Snap the smoothing to the current position — after a teleport. */
  reset(): void {
    this.initialised = false;
  }

  /**
   * @param feet      world position of the character's feet
   * @param eyeHeight how far above the feet the head sits
   * @param yaw/pitch where the player is looking
   * @param aiming    pull in for a closer, steadier view
   */
  update(
    dt: number,
    feet: THREE.Vector3,
    eyeHeight: number,
    yaw: number,
    pitch: number,
    roll: number,
    aiming: boolean,
  ): void {
    // Orientation is never smoothed: mouse-look has to feel direct.
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.x = pitch;
    this.camera.rotation.y = yaw;
    this.camera.rotation.z = roll;

    const cp = Math.cos(pitch);
    this.forward.set(-Math.sin(yaw) * cp, Math.sin(pitch), -Math.cos(yaw) * cp);
    this.right.set(Math.cos(yaw), 0, -Math.sin(yaw));

    this.pivot.set(feet.x, feet.y + eyeHeight + this.extraHeight, feet.z);

    if (this.mode === 'first') {
      this.camera.position.copy(this.pivot);
      this.initialised = false;
      return;
    }

    if (!this.initialised) {
      this.smoothedPivot.copy(this.pivot);
      this.boom = DEFAULT_DISTANCE + this.extraDistance;
      this.initialised = true;
    } else {
      // Damp the pivot, not the camera, so stairs and slopes do not jolt.
      this.smoothedPivot.lerp(this.pivot, Math.min(1, dt * 14));
    }

    this.targetBoom = (aiming ? AIM_DISTANCE : DEFAULT_DISTANCE) + this.extraDistance;
    this.shoulder = aiming ? AIM_SHOULDER : DEFAULT_SHOULDER;

    const origin = _o.copy(this.smoothedPivot).addScaledVector(this.right, this.shoulder);

    // How far back can we actually go before hitting something?
    let allowed = this.targetBoom;
    const hit = this.collision.raycast(
      origin.x,
      origin.y,
      origin.z,
      -this.forward.x,
      -this.forward.y,
      -this.forward.z,
      this.targetBoom + CAMERA_RADIUS,
    );
    if (hit) allowed = Math.max(MIN_DISTANCE, hit.distance - CAMERA_RADIUS);

    // The ground blocks the camera too: march back along the boom and stop short of any hillside, so
    // climbing a slope never puts the lens inside the hill.
    const samples = 12;
    for (let i = 1; i <= samples; i++) {
      const d = (allowed * i) / samples;
      const sx = origin.x - this.forward.x * d;
      const sz = origin.z - this.forward.z * d;
      const sy = origin.y - this.forward.y * d;
      const floor = Math.max(this.terrain.heightAt(sx, sz), SEA_LEVEL - 1.5) + 0.35;
      if (sy < floor && d > MIN_DISTANCE) {
        allowed = Math.max(MIN_DISTANCE, (allowed * (i - 1)) / samples);
        break;
      }
    }

    // Snap in immediately, ease out slowly.
    if (allowed < this.boom) this.boom = allowed;
    else this.boom = THREE.MathUtils.lerp(this.boom, allowed, Math.min(1, dt * 4.5));

    this.desired.copy(origin).addScaledVector(this.forward, -this.boom);

    // Never let the camera sink into the ground or under the sea surface.
    const groundY = Math.max(this.terrain.heightAt(this.desired.x, this.desired.z), SEA_LEVEL - 1.5);
    if (this.desired.y < groundY + 0.45) this.desired.y = groundY + 0.45;

    this.camera.position.copy(this.desired);
  }

  /** How much of the screen the character occupies — used to fade it when very close. */
  get distance(): number {
    return this.boom;
  }
}

const _o = new THREE.Vector3();
