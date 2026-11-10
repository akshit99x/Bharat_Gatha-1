import * as THREE from 'three';
import type { Input } from '../core/Input';
import type { World } from '../world/World';
import type { Settings } from '../core/Save';
import { SEA_LEVEL, WORLD_HALF } from '../world/Terrain';
import { audio } from '../core/Audio';
import { clamp } from '../core/Noise';
import { PlayerAvatar, type AvatarPose } from './PlayerAvatar';
import { CameraRig, type CameraMode } from './CameraRig';

/**
 * First-person movement.
 *
 * A vertical cylinder with gravity, resolved against the collision world, plus
 * a small state machine for the opening descent: you ride the Pushpaka Vimana
 * across the island, drop when you choose, fall, then glide down on a canopy.
 * That sequence exists for a reason beyond spectacle — it shows the whole map
 * and every era in it before the player has to choose where to start.
 */

export type PlayerState = 'vimana' | 'freefall' | 'glide' | 'ground' | 'swim';

const EYE_HEIGHT = 1.68;
const CROUCH_EYE = 1.02;
const RADIUS = 0.42;
const BODY_HEIGHT = 1.8;
const CROUCH_HEIGHT = 1.15;

const WALK_SPEED = 5.4;
const RUN_SPEED = 9.6;
const CROUCH_SPEED = 2.5;
const SWIM_SPEED = 3.6;
const ACCEL_GROUND = 52;
const ACCEL_AIR = 9;
const FRICTION = 11;

const GRAVITY = -22;
const JUMP_SPEED = 7.4;
const STEP_HEIGHT = 0.68;
/** The tallest ledge the player will hop onto by themselves when walking at it. */
const VAULT_HEIGHT = 1.12;

const FREEFALL_GRAVITY = -36;
const FREEFALL_TERMINAL = -62;
const FREEFALL_STEER = 34;
const FREEFALL_MAX_HORIZONTAL = 30;

const GLIDE_DESCENT = -7.0;
const GLIDE_SPEED = 25;
const GLIDE_TURN = 1.5;

const PITCH_LIMIT = Math.PI / 2 - 0.02;

export interface VimanaRide {
  from: THREE.Vector3;
  to: THREE.Vector3;
  /** Seconds for the full crossing. */
  duration: number;
}

export class PlayerController {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();

  yaw = 0;
  pitch = 0;
  state: PlayerState = 'ground';

  /** Which way the character's body is facing — follows movement, not the camera. */
  bodyYaw = 0;

  readonly avatar = new PlayerAvatar();
  readonly rig: CameraRig;

  /** Set while riding a chariot; the vehicle drives position and facing. */
  vehicle: { position: THREE.Vector3; yaw: number; deckHeight: number } | null = null;

  /** Metres walked, for the report card. */
  distanceWalked = 0;
  /** Set while the glider canopy is deployed, so the HUD can show it. */
  gliderOpen = false;

  private readonly camera: THREE.PerspectiveCamera;
  private readonly world: World;
  private readonly input: Input;
  private settings: Settings;

  private crouching = false;
  private grounded = false;
  private coyote = 0;
  private bobPhase = 0;
  private bobAmount = 0;
  private stepAccumulator = 0;
  private roll = 0;
  private baseFov: number;
  private fovTarget: number;
  private landingShake = 0;
  private windCooldown = 0;
  /** What the camera and avatar show: the real height, eased, so stepping up a stair is not a jolt. */
  private visualY = 0;
  private vaultCooldown = 0;

  private ride: VimanaRide | null = null;
  private rideTime = 0;
  /**
   * The click that starts the game is still in the input buffer on the first
   * frame of the ride, so ignore drop input briefly or the player is thrown out
   * of the vimana before they have seen anything.
   */
  private rideGrace = 0;
  readonly ridePosition = new THREE.Vector3();

  private readonly forwardVec = new THREE.Vector3();
  private readonly rightVec = new THREE.Vector3();
  private readonly wish = new THREE.Vector3();

  constructor(camera: THREE.PerspectiveCamera, world: World, input: Input, settings: Settings) {
    this.camera = camera;
    this.world = world;
    this.input = input;
    this.settings = settings;
    this.baseFov = camera.fov;
    this.fovTarget = camera.fov;
    this.rig = new CameraRig(camera, world.collision, world.terrain);
  }

  /** Swap between over-the-shoulder and first person. */
  toggleCamera(): CameraMode {
    const mode = this.rig.toggle();
    this.avatar.setVisible(mode === 'third');
    return mode;
  }

  get cameraMode(): CameraMode {
    return this.rig.mode;
  }

  applySettings(settings: Settings): void {
    this.settings = settings;
    this.input.sensitivity = settings.mouseSensitivity;
    this.input.invertY = settings.invertY;
  }

  // -------------------------------------------------------------- lifecycle

  /** Put the player on the ground at a position, facing a target. */
  placeAt(position: THREE.Vector3, lookAt?: THREE.Vector3): void {
    this.position.copy(position);
    this.velocity.set(0, 0, 0);
    this.state = 'ground';
    this.gliderOpen = false;
    this.ride = null;
    if (lookAt) {
      this.yaw = PlayerController.yawTowards(lookAt.x - position.x, lookAt.z - position.z);
      this.pitch = 0;
    }
    this.bodyYaw = this.yaw;
    this.rig.reset();
    this.syncCamera(0);
  }

  /** Begin the opening descent. */
  startRide(ride: VimanaRide): void {
    this.ride = ride;
    this.rideTime = 0;
    this.rideGrace = 2.0;
    // The mouse-down of the click that started the game is still buffered.
    this.input.endFrame();
    this.state = 'vimana';
    this.gliderOpen = false;
    this.velocity.set(0, 0, 0);
    this.ridePosition.copy(ride.from);
    this.position.copy(ride.from);
    this.rig.reset();
    // Face along the flight path so the island is in view from the first frame.
    const dir = ride.to.clone().sub(ride.from).normalize();
    this.yaw = PlayerController.yawTowards(dir.x, dir.z);
    this.pitch = -0.35;
    audio.conch();
    this.syncCamera(0);
  }

  /** Leave the vimana. Safe to call repeatedly; only the first one counts. */
  jumpOff(): void {
    if (this.state !== 'vimana') return;
    this.state = 'freefall';
    // Inherit the vimana's forward momentum, which is what makes the drop read.
    const ride = this.ride;
    if (ride) {
      const dir = ride.to.clone().sub(ride.from).normalize();
      const speed = ride.from.distanceTo(ride.to) / ride.duration;
      this.velocity.copy(dir).multiplyScalar(speed * 0.8);
      this.velocity.y = -2;
    }
    audio.wind(0.4);
  }

  /** Open the canopy. Ignored unless falling. */
  deployGlider(): void {
    if (this.state !== 'freefall') return;
    this.state = 'glide';
    this.gliderOpen = true;
    const horizontal = Math.hypot(this.velocity.x, this.velocity.z);
    if (horizontal < 4) {
      // Give the glider something to work with if the player dropped straight down.
      this.velocity.x = -Math.sin(this.yaw) * 8;
      this.velocity.z = -Math.cos(this.yaw) * 8;
    }
    audio.pluck(392, 0.2);
  }

  /** Fast travel: drop the player beside a discovered landing terrace. */
  teleportTo(x: number, z: number): void {
    const ground = this.world.terrain.findGround(x, z, 90);
    this.position.set(ground.x, ground.y + 0.4, ground.z);
    this.velocity.set(0, 0, 0);
    this.state = 'ground';
    this.gliderOpen = false;
    this.ride = null;
    this.vehicle = null;
    this.rig.reset();
    audio.bell();
    this.syncCamera(0);
  }

  // ------------------------------------------------------------------ frame

  update(dt: number): void {
    this.look(dt);

    if (this.vehicle) {
      // The chariot owns position and facing; we just ride and look around.
      this.position.copy(this.vehicle.position);
      this.position.y += this.vehicle.deckHeight;
      this.bodyYaw = this.vehicle.yaw;
      this.velocity.set(0, 0, 0);
      this.state = 'ground';
      this.syncCamera(dt);
      return;
    }

    switch (this.state) {
      case 'vimana':
        this.updateRide(dt);
        break;
      case 'freefall':
        this.updateFreefall(dt);
        break;
      case 'glide':
        this.updateGlide(dt);
        break;
      case 'swim':
        this.updateSwim(dt);
        break;
      default:
        this.updateGround(dt);
        break;
    }

    this.syncCamera(dt);
  }

  private look(dt: number): void {
    const m = this.input.mouse;
    if (m.dx !== 0 || m.dy !== 0) {
      this.yaw -= m.dx;
      this.pitch = clamp(this.pitch - m.dy, -PITCH_LIMIT, PITCH_LIMIT);
    }
    // Keep yaw bounded so it never loses float precision over a long session.
    if (this.yaw > Math.PI) this.yaw -= Math.PI * 2;
    if (this.yaw < -Math.PI) this.yaw += Math.PI * 2;
    void dt;
  }

  /**
   * Movement basis, in three.js's convention.
   *
   * A camera with rotation.y = yaw looks down -Z, so forward is
   * (-sin yaw, 0, -cos yaw) — not (sin yaw, 0, cos yaw). Getting this backwards
   * inverts WASD and makes the scan ray probe whatever is behind you.
   */
  private basis(): void {
    this.forwardVec.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.rightVec.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  // ------------------------------------------------------------------- ride

  private updateRide(dt: number): void {
    const ride = this.ride;
    if (!ride) {
      this.state = 'freefall';
      return;
    }
    this.rideTime += dt;
    if (this.rideGrace > 0) this.rideGrace = Math.max(0, this.rideGrace - dt);
    const t = this.rideTime / ride.duration;
    this.ridePosition.lerpVectors(ride.from, ride.to, Math.min(1, t));
    // A gentle bank and bob, so it feels flown rather than slid.
    this.ridePosition.y += Math.sin(this.rideTime * 0.7) * 2.4;
    this.position.copy(this.ridePosition);

    if (
      this.rideGrace <= 0 &&
      (this.input.justPressed('jump') || this.input.justPressed('interact') || this.input.mouse.leftEdge)
    ) {
      this.jumpOff();
      return;
    }
    // At the end of the run the ride drops you whether you like it or not.
    if (t >= 1) this.jumpOff();
  }

  // --------------------------------------------------------------- freefall

  private updateFreefall(dt: number): void {
    this.basis();
    const axis = this.input.moveAxis();
    this.wish.set(0, 0, 0).addScaledVector(this.forwardVec, axis.z).addScaledVector(this.rightVec, axis.x);

    if (this.wish.lengthSq() > 0) {
      this.velocity.addScaledVector(this.wish.normalize(), FREEFALL_STEER * dt);
      const horizontal = Math.hypot(this.velocity.x, this.velocity.z);
      if (horizontal > FREEFALL_MAX_HORIZONTAL) {
        const k = FREEFALL_MAX_HORIZONTAL / horizontal;
        this.velocity.x *= k;
        this.velocity.z *= k;
      }
    }

    this.velocity.y = Math.max(FREEFALL_TERMINAL, this.velocity.y + FREEFALL_GRAVITY * dt);
    this.integrateAir(dt);

    this.windCooldown -= dt;
    if (this.windCooldown <= 0) {
      audio.wind(Math.min(1, Math.abs(this.velocity.y) / 60));
      this.windCooldown = 0.2;
    }

    const ground = this.world.groundAt(this.position.x, this.position.z, this.position.y);
    const altitude = this.position.y - Math.max(ground, SEA_LEVEL);

    // Manual deploy, or automatic in gentle mode — the default, because a
    // twelve-year-old should not splatter on the Great Bath.
    if (this.input.justPressed('jump') || this.input.mouse.leftEdge) {
      this.deployGlider();
      return;
    }
    if (this.settings.gentleMode && altitude < 95) {
      this.deployGlider();
      return;
    }
    if (altitude <= 0.4) this.land(ground);
  }

  private updateGlide(dt: number): void {
    const axis = this.input.moveAxis();
    // Steer by yawing; the canopy always flies where you are looking.
    this.yaw -= axis.x * GLIDE_TURN * dt;
    this.basis();

    // Pull back to slow and flatten, push forward to dive and gain speed.
    const dive = clamp(-axis.z, -1, 1);
    const descent = GLIDE_DESCENT + dive * 5.5;
    const speed = GLIDE_SPEED - dive * 7;

    this.velocity.x = this.forwardVec.x * speed;
    this.velocity.z = this.forwardVec.z * speed;
    this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, descent, Math.min(1, dt * 3.2));

    this.integrateAir(dt);

    this.windCooldown -= dt;
    if (this.windCooldown <= 0) {
      audio.wind(0.35);
      this.windCooldown = 0.45;
    }

    const ground = this.world.groundAt(this.position.x, this.position.z, this.position.y);
    if (this.position.y - ground <= 0.5) this.land(ground);
    else if (this.position.y <= SEA_LEVEL + 0.6) this.enterWater();
  }

  private land(groundY: number): void {
    const impact = Math.abs(this.velocity.y);
    this.position.y = groundY;
    this.velocity.set(0, 0, 0);
    this.state = 'ground';
    this.gliderOpen = false;
    this.grounded = true;
    this.landingShake = Math.min(0.5, impact / 90);
    audio.footstep(false);
    if (impact > 14) audio.pluck(146, 0.22);
  }

  // ---------------------------------------------------------------- walking

  private updateGround(dt: number): void {
    this.basis();

    const wantCrouch = this.input.pressed('crouch');
    // Do not stand up into a ceiling.
    if (!wantCrouch && this.crouching) {
      const probe = this.world.collision.resolve(
        this.position.x,
        this.position.y,
        this.position.z,
        RADIUS,
        BODY_HEIGHT,
        STEP_HEIGHT,
      );
      this.crouching = probe.blocked ? true : false;
    } else {
      this.crouching = wantCrouch;
    }

    const sprinting = this.input.pressed('sprint') && !this.crouching;
    const maxSpeed = this.crouching ? CROUCH_SPEED : sprinting ? RUN_SPEED : WALK_SPEED;

    const axis = this.input.moveAxis();
    this.wish.set(0, 0, 0).addScaledVector(this.forwardVec, axis.z).addScaledVector(this.rightVec, axis.x);
    const moving = this.wish.lengthSq() > 0.0001;
    if (moving) this.wish.normalize();

    const accel = this.grounded ? ACCEL_GROUND : ACCEL_AIR;
    const target = this.wish.clone().multiplyScalar(maxSpeed);
    this.velocity.x = approach(this.velocity.x, target.x, accel * dt);
    this.velocity.z = approach(this.velocity.z, target.z, accel * dt);

    if (this.grounded && !moving) {
      const damp = Math.max(0, 1 - FRICTION * dt);
      this.velocity.x *= damp;
      this.velocity.z *= damp;
    }

    if (this.grounded) this.coyote = 0.12;
    else this.coyote -= dt;

    if (this.input.justPressed('jump') && this.coyote > 0) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
      this.coyote = 0;
      audio.footstep(true);
    }

    // Walking into a low wall or plinth: hop onto it, as any person would, rather than stopping dead.
    this.vaultCooldown = Math.max(0, this.vaultCooldown - dt);
    if (this.grounded && moving && !this.crouching && this.vaultCooldown <= 0 && this.velocity.y <= 0) {
      const reach = RADIUS + 0.45;
      const top = this.world.collision.supportAt(
        this.position.x + this.wish.x * reach,
        this.position.z + this.wish.z * reach,
        this.position.y + VAULT_HEIGHT,
        0.18,
      );
      if (top !== null) {
        const lift = top - this.position.y;
        if (lift > STEP_HEIGHT + 0.02 && lift <= VAULT_HEIGHT) {
          // Just enough speed to clear the edge with a hand's breadth to spare.
          this.velocity.y = Math.sqrt(2 * -GRAVITY * (lift + 0.22));
          this.grounded = false;
          this.coyote = 0;
          this.vaultCooldown = 0.5;
        }
      }
    }

    this.velocity.y += GRAVITY * dt;

    const before = _tmpA.copy(this.position);
    this.integrateGround(dt);
    const travelled = Math.hypot(this.position.x - before.x, this.position.z - before.z);
    this.distanceWalked += travelled;

    // Footsteps, paced by distance rather than time so sprinting sounds right.
    if (this.grounded && travelled > 0) {
      this.stepAccumulator += travelled;
      const stride = this.crouching ? 1.6 : sprinting ? 2.5 : 2.0;
      if (this.stepAccumulator >= stride) {
        this.stepAccumulator = 0;
        audio.footstep(this.crouching);
      }
    }

    // Head bob, scaled by actual speed.
    const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
    this.bobPhase += dt * (6 + horizontalSpeed * 0.9);
    this.bobAmount = THREE.MathUtils.lerp(
      this.bobAmount,
      this.grounded && this.settings.motionBlurFree ? Math.min(1, horizontalSpeed / RUN_SPEED) : 0,
      Math.min(1, dt * 6),
    );
    this.roll = THREE.MathUtils.lerp(this.roll, -axis.x * 0.022, Math.min(1, dt * 5));
    this.fovTarget = this.baseFov + (sprinting && horizontalSpeed > WALK_SPEED ? 5 : 0);

    // Did we walk into the sea?
    const groundY = this.world.groundAt(this.position.x, this.position.z, this.position.y);
    if (groundY < SEA_LEVEL - 1.0 && this.position.y < SEA_LEVEL + 0.2) this.enterWater();
  }

  private updateSwim(dt: number): void {
    this.basis();
    const axis = this.input.moveAxis();
    this.wish.set(0, 0, 0).addScaledVector(this.forwardVec, axis.z).addScaledVector(this.rightVec, axis.x);
    if (this.wish.lengthSq() > 0) this.wish.normalize();

    this.velocity.x = approach(this.velocity.x, this.wish.x * SWIM_SPEED, 14 * dt);
    this.velocity.z = approach(this.velocity.z, this.wish.z * SWIM_SPEED, 14 * dt);

    // Buoyancy holds the head at the surface; Space gives a stroke upward.
    const surface = SEA_LEVEL - 0.55;
    const rise = (surface - this.position.y) * 5.5;
    this.velocity.y = THREE.MathUtils.lerp(this.velocity.y, rise + (this.input.pressed('jump') ? 2.2 : 0), Math.min(1, dt * 5));

    this.integrateAir(dt);

    this.bobAmount = THREE.MathUtils.lerp(this.bobAmount, 0.35, Math.min(1, dt * 3));
    this.bobPhase += dt * 3.2;
    this.fovTarget = this.baseFov;

    // Climb out when the bottom comes up to meet us.
    const groundY = this.world.groundAt(this.position.x, this.position.z, this.position.y + 1);
    if (groundY > SEA_LEVEL - 0.35) {
      this.position.y = groundY;
      this.velocity.y = 0;
      this.state = 'ground';
      this.grounded = true;
    }
  }

  private enterWater(): void {
    if (this.state === 'swim') return;
    this.state = 'swim';
    this.gliderOpen = false;
    this.velocity.multiplyScalar(0.25);
    audio.splash();
  }

  // -------------------------------------------------------------- integration

  /** Airborne integration: move, resolve walls, never snap to ground. */
  private integrateAir(dt: number): void {
    this.position.addScaledVector(this.velocity, dt);
    this.clampToWorld();
    const r = this.world.collision.resolve(
      this.position.x,
      this.position.y,
      this.position.z,
      RADIUS,
      this.currentHeight(),
      0.1,
    );
    this.position.x = r.x;
    this.position.z = r.z;
  }

  /** Grounded integration: move, resolve walls, then settle onto the surface. */
  private integrateGround(dt: number): void {
    this.position.addScaledVector(this.velocity, dt);
    this.clampToWorld();

    const r = this.world.collision.resolve(
      this.position.x,
      this.position.y,
      this.position.z,
      RADIUS,
      this.currentHeight(),
      STEP_HEIGHT,
    );
    this.position.x = r.x;
    this.position.z = r.z;

    const terrainY = this.world.terrain.heightAt(this.position.x, this.position.z);
    const surface = r.supportY !== null && r.supportY > terrainY ? r.supportY : terrainY;

    if (this.position.y <= surface + 0.02) {
      // Landed, or walked up a step.
      if (this.velocity.y < -12) audio.footstep(false);
      this.position.y = surface;
      this.velocity.y = 0;
      this.grounded = true;
    } else if (this.position.y - surface < STEP_HEIGHT && this.velocity.y <= 0) {
      // Stick to the ground over small undulations instead of bouncing.
      this.position.y = surface;
      this.velocity.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
      // Fell off something high enough to need the glider.
      if (this.position.y - surface > 28 && !this.gliderOpen) this.state = 'freefall';
    }
  }

  private clampToWorld(): void {
    const limit = WORLD_HALF - 20;
    this.position.x = clamp(this.position.x, -limit, limit);
    this.position.z = clamp(this.position.z, -limit, limit);
    if (this.position.y > 900) this.position.y = 900;
  }

  private currentHeight(): number {
    return this.crouching ? CROUCH_HEIGHT : BODY_HEIGHT;
  }

  // ------------------------------------------------------------------ camera

  private syncCamera(dt: number): void {
    const eye = this.crouching ? CROUCH_EYE : EYE_HEIGHT;

    let bob = 0;
    if (this.bobAmount > 0.001) bob += Math.sin(this.bobPhase * 2) * 0.045 * this.bobAmount;
    if (this.landingShake > 0) {
      bob -= this.landingShake;
      this.landingShake = Math.max(0, this.landingShake - dt * 2.2);
    }

    const bobRoll = this.bobAmount > 0.001 ? Math.sin(this.bobPhase) * 0.012 * this.bobAmount : 0;

    // Point the body where it is going, not where the camera is looking. Idle,
    // it drifts round to face the camera so the character never stands with its
    // back to the view for long.
    const horizontal = Math.hypot(this.velocity.x, this.velocity.z);
    if (this.vehicle) {
      this.bodyYaw = this.vehicle.yaw;
    } else if (horizontal > 0.9) {
      const moveYaw = PlayerController.yawTowards(this.velocity.x, this.velocity.z);
      this.bodyYaw = approachAngle(this.bodyYaw, moveYaw, dt * 11);
    } else if (this.state === 'freefall' || this.state === 'glide' || this.state === 'swim') {
      this.bodyYaw = approachAngle(this.bodyYaw, this.yaw, dt * 6);
    } else {
      this.bodyYaw = approachAngle(this.bodyYaw, this.yaw, dt * 2.2);
    }

    // Ease the shown height toward the real one on the ground, so steps and ledges glide. Anything big
    // (a teleport, a fall, a vehicle) snaps.
    const gap = this.position.y - this.visualY;
    if (dt <= 0 || Math.abs(gap) > 1.4 || this.state !== 'ground' || this.vehicle) this.visualY = this.position.y;
    else this.visualY += gap * Math.min(1, dt * 16);
    const shownY = this.visualY;

    _feet.set(this.position.x, shownY + bob, this.position.z);
    this.rig.extraHeight = this.vehicle ? 0.95 : 0;
    this.rig.extraDistance = this.vehicle ? 3.6 : 0;
    this.rig.update(dt, _feet, eye, this.yaw, this.pitch, this.roll + bobRoll, this.input.mouse.right);

    // The avatar stands on the ground, not at the camera.
    this.avatar.group.position.set(this.position.x, shownY, this.position.z);
    this.avatar.update(dt, this.pose(horizontal), horizontal, this.bodyYaw, this.pitch);
    this.avatar.setVisible(this.rig.mode === 'third' && this.state !== 'vimana');

    if (dt > 0 && Math.abs(this.camera.fov - this.fovTarget) > 0.05) {
      this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.fovTarget, Math.min(1, dt * 6));
      this.camera.updateProjectionMatrix();
    }
  }

  private pose(horizontalSpeed: number): AvatarPose {
    if (this.vehicle) return 'ride';
    switch (this.state) {
      case 'freefall':
        return 'fall';
      case 'glide':
        return 'glide';
      case 'swim':
        return 'swim';
      case 'vimana':
        return 'idle';
      default:
        break;
    }
    if (!this.grounded) return this.velocity.y > 0.5 ? 'jump' : 'fall';
    if (horizontalSpeed > WALK_SPEED + 0.6) return 'run';
    if (horizontalSpeed > 0.45) return 'walk';
    return 'idle';
  }

  /** Unit vector the camera is actually looking along. */
  getForward(out = new THREE.Vector3()): THREE.Vector3 {
    const cp = Math.cos(this.pitch);
    return out.set(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp);
  }

  /** Yaw that would make the camera face the given world direction. */
  static yawTowards(dx: number, dz: number): number {
    return Math.atan2(-dx, -dz);
  }

  get eyePosition(): THREE.Vector3 {
    return this.camera.position;
  }

  /**
   * Where the *character* is looking from. In third person this is several
   * metres in front of the camera, and it is what interaction range must be
   * measured against — otherwise the boom length changes how far you can reach.
   */
  get focusPosition(): THREE.Vector3 {
    return _focus.set(
      this.position.x,
      this.position.y + (this.crouching ? CROUCH_EYE : EYE_HEIGHT),
      this.position.z,
    );
  }

  get isCrouching(): boolean {
    return this.crouching;
  }

  get isAirborne(): boolean {
    return this.state === 'freefall' || this.state === 'glide' || !this.grounded;
  }

  /** Altitude above the surface below, for the HUD during a drop. */
  altitude(): number {
    const ground = this.world.groundAt(this.position.x, this.position.z, this.position.y);
    return Math.max(0, this.position.y - Math.max(ground, SEA_LEVEL));
  }

  /** 0..1 progress along the vimana flight path. */
  get rideProgress(): number {
    return this.ride ? Math.min(1, this.rideTime / this.ride.duration) : 1;
  }
}

function approach(current: number, target: number, maxDelta: number): number {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
}

const _tmpA = new THREE.Vector3();
const _feet = new THREE.Vector3();
const _focus = new THREE.Vector3();

/** Rotate `current` towards `target` the short way round. */
function approachAngle(current: number, target: number, maxDelta: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const step = Math.min(Math.abs(diff), Math.max(0.0001, maxDelta) * (1 + Math.abs(diff)));
  return current + Math.sign(diff) * step;
}
