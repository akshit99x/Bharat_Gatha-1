import * as THREE from 'three';
import { Kit } from '../world/architecture/kit';
import { stoneMaterial, shade } from '../world/Materials';

/**
 * The character you see in third person.
 *
 * Limbs are separate meshes whose geometry hangs *below* their group origin, so
 * the origin is the joint and a plain rotation swings the limb from the hip or
 * shoulder. That is the whole trick — no skeleton, no skinning, no animation
 * files, and it costs seven draw calls.
 */

export type AvatarPose = 'idle' | 'walk' | 'run' | 'jump' | 'fall' | 'glide' | 'swim' | 'ride' | 'climb';

const SKIN = 0x9a6b42;
const CLOTH = 0xe8863a;
const CLOTH_DARK = 0xb9552a;
const SASH = 0xf0d9a8;

export class PlayerAvatar {
  readonly group = new THREE.Group();

  private readonly body: THREE.Mesh;
  private readonly head: THREE.Group;
  private readonly armL: THREE.Group;
  private readonly armR: THREE.Group;
  private readonly legL: THREE.Group;
  private readonly legR: THREE.Group;
  private readonly canopy: THREE.Mesh;

  private phase = 0;
  private bend = 0;
  private lean = 0;

  constructor() {
    this.group.name = 'avatar';

    // --- torso, from the hips up. Origin at the feet.
    const torso = new Kit();
    // Dhoti, flaring at the hem.
    torso.lathe(
      [
        [0.3, 0.0],
        [0.33, 0.25],
        [0.27, 0.62],
        [0.24, 0.92],
      ],
      [0, 0, 0],
      CLOTH_DARK,
      { segments: 10, collide: false },
    );
    // Chest and shoulders.
    torso.box([0.46, 0.52, 0.27], [0, 1.16, 0], CLOTH, { collide: false });
    torso.box([0.56, 0.14, 0.3], [0, 1.4, 0], shade(CLOTH, 1.1), { collide: false });
    // Sash across the chest — reads instantly at distance and gives a front.
    torso.box([0.5, 0.12, 0.3], [0, 1.2, 0.01], SASH, { rotZ: 0.42, collide: false });
    // Satchel on the hip: this is a traveller.
    torso.box([0.26, 0.22, 0.14], [0.3, 0.86, -0.06], 0x7d5a3a, { collide: false });
    torso.box([0.07, 0.5, 0.07], [0.12, 1.14, -0.04], 0x7d5a3a, { rotZ: -0.5, collide: false });
    this.body = new THREE.Mesh(torso.build().geometry, stoneMaterial());
    this.body.castShadow = true;
    this.group.add(this.body);

    // --- head, on its own group so it can turn independently of the body.
    this.head = new THREE.Group();
    this.head.position.set(0, 1.5, 0);
    const headKit = new Kit();
    headKit.cylinder(0.075, 0.085, 0.1, [0, 0.03, 0], SKIN, { segments: 6, collide: false });
    headKit.sphere(0.16, [0, 0.21, 0], SKIN, { segments: 10, collide: false });
    // Wrapped cloth, with a tail down the back.
    headKit.dome(0.175, [0, 0.19, 0], CLOTH, { segments: 10, squash: 0.85, collide: false });
    headKit.box([0.1, 0.26, 0.06], [0, 0.16, -0.15], CLOTH, { rotX: -0.3, collide: false });
    const headMesh = new THREE.Mesh(headKit.build().geometry, stoneMaterial());
    headMesh.castShadow = true;
    this.head.add(headMesh);
    this.group.add(this.head);

    // --- limbs. Geometry hangs below the group origin = the joint.
    this.armL = this.makeArm(-1);
    this.armR = this.makeArm(1);
    this.legL = this.makeLeg(-1);
    this.legR = this.makeLeg(1);
    this.group.add(this.armL, this.armR, this.legL, this.legR);

    // --- the glider canopy, shown only while gliding.
    const canopyKit = new Kit();
    canopyKit.lathe(
      [
        [0.05, 0],
        [1.5, -0.35],
        [2.4, -0.75],
        [2.55, -1.0],
      ],
      [0, 0, 0],
      CLOTH,
      { segments: 16, collide: false },
    );
    canopyKit.ring(6, 2.3, (x, z) => {
      canopyKit.box([0.05, 1.5, 0.05], [x * 0.5, -1.3, z * 0.5], 0x6b4a2f, { collide: false });
    });
    this.canopy = new THREE.Mesh(canopyKit.build().geometry, stoneMaterial());
    this.canopy.position.set(0, 3.5, 0);
    this.canopy.visible = false;
    this.group.add(this.canopy);
  }

  private makeArm(side: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * 0.3, 1.36, 0);
    const kit = new Kit();
    kit.box([0.13, 0.42, 0.14], [0, -0.21, 0], CLOTH, { collide: false });
    kit.box([0.115, 0.34, 0.12], [0, -0.58, 0], SKIN, { collide: false });
    kit.sphere(0.075, [0, -0.78, 0], SKIN, { segments: 6, collide: false });
    const mesh = new THREE.Mesh(kit.build().geometry, stoneMaterial());
    mesh.castShadow = true;
    g.add(mesh);
    return g;
  }

  private makeLeg(side: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * 0.13, 0.82, 0);
    const kit = new Kit();
    kit.box([0.17, 0.44, 0.18], [0, -0.22, 0], shade(CLOTH_DARK, 0.92), { collide: false });
    kit.box([0.145, 0.38, 0.15], [0, -0.63, 0], SKIN, { collide: false });
    kit.box([0.17, 0.09, 0.26], [0, -0.84, 0.04], 0x5f4530, { collide: false });
    const mesh = new THREE.Mesh(kit.build().geometry, stoneMaterial());
    mesh.castShadow = true;
    g.add(mesh);
    return g;
  }

  /**
   * Drive the pose.
   *
   * @param speed    horizontal speed in m/s, for stride length and cadence
   * @param bodyYaw  which way the character is facing
   * @param lookPitch camera pitch, so the head tracks roughly where you look
   */
  update(dt: number, pose: AvatarPose, speed: number, bodyYaw: number, lookPitch: number): void {
    this.group.rotation.y = bodyYaw;

    // Cadence scales with speed so a sprint does not look like a moonwalk.
    const cadence = pose === 'run' ? 2.2 + speed * 0.75 : pose === 'walk' ? 1.6 + speed * 0.95 : 2.4;
    this.phase += dt * cadence;

    const swing = Math.sin(this.phase);
    const swing2 = Math.sin(this.phase * 2);

    switch (pose) {
      case 'walk':
      case 'run': {
        const amp = pose === 'run' ? 0.95 : 0.6;
        this.legL.rotation.x = swing * amp;
        this.legR.rotation.x = -swing * amp;
        this.armL.rotation.x = -swing * amp * 0.8;
        this.armR.rotation.x = swing * amp * 0.8;
        this.armL.rotation.z = 0.08;
        this.armR.rotation.z = -0.08;
        this.body.position.y = Math.abs(swing2) * 0.035;
        this.head.position.y = 1.5 + Math.abs(swing2) * 0.035;
        this.bend = lerp(this.bend, pose === 'run' ? 0.17 : 0.06, dt * 8);
        break;
      }
      case 'jump':
        this.legL.rotation.x = -0.5;
        this.legR.rotation.x = 0.25;
        this.armL.rotation.x = -1.6;
        this.armR.rotation.x = -1.6;
        this.bend = lerp(this.bend, -0.1, dt * 8);
        break;
      case 'fall':
        // Skydive: arms out, legs apart.
        this.legL.rotation.x = 0.4;
        this.legR.rotation.x = 0.4;
        this.legL.rotation.z = -0.3;
        this.legR.rotation.z = 0.3;
        this.armL.rotation.x = -2.1;
        this.armR.rotation.x = -2.1;
        this.armL.rotation.z = 0.5;
        this.armR.rotation.z = -0.5;
        this.bend = lerp(this.bend, 0.45, dt * 6);
        break;
      case 'glide':
        this.legL.rotation.x = 0.2;
        this.legR.rotation.x = 0.2;
        this.legL.rotation.z = 0;
        this.legR.rotation.z = 0;
        this.armL.rotation.x = -2.6;
        this.armR.rotation.x = -2.6;
        this.armL.rotation.z = 0.25;
        this.armR.rotation.z = -0.25;
        this.bend = lerp(this.bend, 0.12, dt * 6);
        break;
      case 'swim':
        this.legL.rotation.x = swing * 0.4;
        this.legR.rotation.x = -swing * 0.4;
        this.armL.rotation.x = -1.2 + swing * 0.9;
        this.armR.rotation.x = -1.2 - swing * 0.9;
        this.armL.rotation.z = 0.5;
        this.armR.rotation.z = -0.5;
        this.bend = lerp(this.bend, 1.15, dt * 5);
        break;
      case 'climb':
        // Hand over hand up a wall: arms reach high and alternate, knees come up in turn.
        this.armL.rotation.x = -2.5 + swing * 0.55;
        this.armR.rotation.x = -2.5 - swing * 0.55;
        this.armL.rotation.z = 0.18;
        this.armR.rotation.z = -0.18;
        this.legL.rotation.x = -0.55 - swing * 0.5;
        this.legR.rotation.x = -0.55 + swing * 0.5;
        this.bend = lerp(this.bend, 0.08, dt * 6);
        break;
      case 'ride':
        // Standing in a chariot: knees soft, one hand forward on the rail.
        this.legL.rotation.x = 0.12;
        this.legR.rotation.x = -0.12;
        this.legL.rotation.z = -0.1;
        this.legR.rotation.z = 0.1;
        this.armL.rotation.x = -1.25;
        this.armR.rotation.x = -1.15;
        this.armL.rotation.z = 0.12;
        this.armR.rotation.z = -0.12;
        this.bend = lerp(this.bend, 0.2, dt * 6);
        break;
      default: {
        // Idle: breathing, and a slow sway so the figure is never static.
        const breathe = Math.sin(this.phase * 0.5) * 0.04;
        this.legL.rotation.x = lerp(this.legL.rotation.x, 0, dt * 8);
        this.legR.rotation.x = lerp(this.legR.rotation.x, 0, dt * 8);
        this.legL.rotation.z = lerp(this.legL.rotation.z, -0.03, dt * 8);
        this.legR.rotation.z = lerp(this.legR.rotation.z, 0.03, dt * 8);
        this.armL.rotation.x = lerp(this.armL.rotation.x, breathe, dt * 6);
        this.armR.rotation.x = lerp(this.armR.rotation.x, -breathe, dt * 6);
        this.armL.rotation.z = lerp(this.armL.rotation.z, 0.14, dt * 6);
        this.armR.rotation.z = lerp(this.armR.rotation.z, -0.14, dt * 6);
        this.body.position.y = breathe * 0.25;
        this.head.position.y = 1.5 + breathe * 0.25;
        this.bend = lerp(this.bend, 0, dt * 6);
        break;
      }
    }

    // Lean into a turn or a dive.
    this.lean = lerp(this.lean, pose === 'fall' || pose === 'glide' ? 0.0 : 0.0, dt * 6);
    this.body.rotation.x = this.bend;
    this.body.rotation.z = this.lean;
    this.head.rotation.x = clamp(lookPitch * 0.45 - this.bend * 0.8, -0.6, 0.6);

    this.canopy.visible = pose === 'glide';
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  /** World position of the head, used as the camera pivot. */
  get headHeight(): number {
    return 1.6;
  }

  dispose(): void {
    this.group.traverse((obj) => {
      if (obj instanceof THREE.Mesh) obj.geometry.dispose();
    });
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * Math.min(1, Math.max(0, t));
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
