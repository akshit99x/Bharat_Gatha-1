import * as THREE from 'three';
import { Kit } from './architecture/kit';
import { stoneMaterial, shade } from './Materials';
import { Rng } from '../core/Rng';
import type { NpcSpec } from '../content/types';

/**
 * A living NPC.
 *
 * Far away, every person is a single merged mesh and costs almost nothing. Within
 * about sixty metres they are swapped for one of these: a small rig of body,
 * head, two arms with elbows, and whatever they are holding — which is what lets
 * a smith hammer, a potter knead, a scribe write, a dancer dance and a child run
 * about, rather than every person in the game standing like a statue.
 *
 * What a person *does* comes from their role. Nothing is scripted per character:
 * "Bronze caster" and "Iron smith" both match `hammer`, "Cotton weaver" matches
 * `weave`, and anyone the table does not know simply stands and breathes, looks
 * about, and shifts their weight. All of them turn to face you as you come close,
 * and wave when you first arrive.
 */

export type Style =
  | 'idle'
  | 'speak'
  | 'hammer'
  | 'knead'
  | 'weave'
  | 'dig'
  | 'stir'
  | 'row'
  | 'write'
  | 'dance'
  | 'guard'
  | 'pray'
  | 'carry'
  | 'play';

/** Which activity a role implies. Order matters: the specific comes before the general. */
const RULES: Array<[RegExp, Style]> = [
  [/child/i, 'play'],
  [/dancer/i, 'dance'],
  [/nun|monk(?!ey)/i, 'pray'],
  [/water.?carrier/i, 'carry'],
  [/reed|farmer|garden|canal|cultivator/i, 'dig'],
  [/potter|apprentice/i, 'knead'],
  [/weaver|bead|fletcher|inlay/i, 'weave'],
  [/brewer|cook|physician|surgeon|healer/i, 'stir'],
  [/boatman|fisher|pearl/i, 'row'],
  [/scribe|clerk|accountant|officer|calligrapher|painter|astronom|geolog|surveyor|almanac|diary|student|timekeeper|keeper of the hours/i, 'write'],
  [/smith|caster|mason|cutter|sculptor|carpenter|wright|shipwright|armourer/i, 'hammer'],
  [/captain|scout|herald|signaller|elephant|infantry|inspector/i, 'guard'],
  [/teacher|reciter|narrator|envoy|merchant|trader|queen|engineer|overseer|poet|sthapati|builder|sailor/i, 'speak'],
];

export function styleFor(spec: Pick<NpcSpec, 'role' | 'name'>): Style {
  const text = `${spec.role} ${spec.name}`;
  for (const [pattern, style] of RULES) if (pattern.test(text)) return style;
  return 'idle';
}

/** How far a style wanders from its post, in metres, and how fast. */
const WANDER: Partial<Record<Style, { radius: number; speed: number }>> = {
  play: { radius: 4.2, speed: 2.5 },
  carry: { radius: 4.5, speed: 1.0 },
};

const SKIN = 0x8a5f3c;

interface Rig {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  armL: THREE.Group;
  foreL: THREE.Group;
  armR: THREE.Group;
  foreR: THREE.Group;
  prop: THREE.Object3D | null;
}

function part(kit: Kit): THREE.Mesh {
  const mesh = new THREE.Mesh(kit.build().geometry, stoneMaterial());
  mesh.castShadow = true;
  return mesh;
}

/** One arm: a shoulder joint, an upper arm, an elbow joint and a forearm with a hand. */
function buildArm(side: number, robe: number): { arm: THREE.Group; fore: THREE.Group } {
  const arm = new THREE.Group();
  arm.position.set(side * 0.33, 1.62, 0);
  const upper = new Kit();
  upper.box([0.15, 0.36, 0.17], [0, -0.17, 0], shade(robe, 1.05), { collide: false });
  arm.add(part(upper));

  const fore = new THREE.Group();
  fore.position.set(0, -0.35, 0);
  const lower = new Kit();
  lower.box([0.12, 0.3, 0.14], [0, -0.14, 0], SKIN, { collide: false });
  lower.sphere(0.085, [0, -0.32, 0], SKIN, { segments: 6, collide: false });
  fore.add(part(lower));
  arm.add(fore);
  return { arm, fore };
}

function buildProp(style: Style, robe: number): THREE.Object3D | null {
  const kit = new Kit();
  const wood = 0x7a5532;
  const iron = 0x6d727a;
  switch (style) {
    case 'hammer':
      kit.box([0.05, 0.42, 0.05], [0, -0.05, 0.02], wood, { collide: false });
      kit.box([0.2, 0.12, 0.12], [0, 0.16, 0.02], iron, { collide: false });
      break;
    case 'dig':
      kit.box([0.05, 0.9, 0.05], [0, 0.1, 0.02], wood, { collide: false });
      kit.box([0.22, 0.05, 0.12], [0, -0.34, 0.08], iron, { rotX: 0.5, collide: false });
      break;
    case 'stir':
      kit.box([0.04, 0.5, 0.04], [0, -0.05, 0.02], wood, { collide: false });
      break;
    case 'row':
      kit.box([0.05, 1.1, 0.05], [0, 0.1, 0.02], wood, { collide: false });
      kit.box([0.14, 0.34, 0.03], [0, -0.5, 0.02], wood, { collide: false });
      break;
    case 'write':
      kit.box([0.22, 0.3, 0.03], [0, -0.04, 0.12], 0xe8d9b0, { collide: false });
      break;
    case 'guard':
      kit.box([0.04, 1.8, 0.04], [0, 0.4, 0.02], wood, { collide: false });
      kit.box([0.07, 0.22, 0.04], [0, 1.35, 0.02], iron, { collide: false });
      break;
    case 'knead':
      kit.sphere(0.13, [0, -0.04, 0.12], 0xb27a4e, { segments: 7, collide: false });
      break;
    case 'carry':
      kit.sphere(0.2, [0, 0.25, 0], 0xa5653a, { segments: 8, collide: false });
      kit.cylinder(0.1, 0.12, 0.1, [0, 0.45, 0], 0x8f532f, { segments: 8, collide: false });
      break;
    default:
      return null;
  }
  void robe;
  const mesh = part(kit);
  const holder = new THREE.Group();
  holder.add(mesh);
  return holder;
}

function buildRig(style: Style, robe: number, child: boolean): Rig {
  const root = new THREE.Group();

  const bodyKit = new Kit();
  bodyKit.lathe(
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
  bodyKit.box([0.52, 0.56, 0.3], [0, 1.4, 0], robe, { collide: false });
  bodyKit.box([0.62, 0.12, 0.32], [0, 1.66, 0], shade(robe, 1.08), { collide: false });
  // A sash, so that front and back read at a distance.
  bodyKit.box([0.54, 0.1, 0.32], [0, 1.28, 0.01], shade(robe, 1.3), { rotZ: 0.4, collide: false });
  const body = part(bodyKit);
  root.add(body);

  const head = new THREE.Group();
  head.position.set(0, 1.73, 0);
  const headKit = new Kit();
  headKit.cylinder(0.08, 0.09, 0.12, [0, 0, 0], SKIN, { segments: 6, collide: false });
  headKit.sphere(0.165, [0, 0.17, 0], SKIN, { segments: 9, collide: false });
  headKit.dome(0.175, [0, 0.15, 0], shade(robe, 1.14), { segments: 9, squash: 0.8, collide: false });
  headKit.box([0.07, 0.04, 0.04], [0, 0.17, 0.155], 0x6d4630, { collide: false }); // a nose, so the head has a front
  head.add(part(headKit));
  root.add(head);

  const l = buildArm(-1, robe);
  const r = buildArm(1, robe);
  root.add(l.arm, r.arm);

  let prop: THREE.Object3D | null = null;
  const made = buildProp(style, robe);
  if (made) {
    prop = made;
    // Carried things sit on the head; everything else in the right hand.
    if (style === 'carry') {
      prop.position.set(0, 1.95, 0);
      root.add(prop);
    } else if (style === 'write') {
      l.fore.add(prop);
      prop.position.set(0, -0.32, 0);
    } else {
      r.fore.add(prop);
      prop.position.set(0, -0.32, 0);
    }
  }

  if (child) root.scale.setScalar(0.72);
  return { root, body, head, armL: l.arm, foreL: l.fore, armR: r.arm, foreR: r.fore, prop };
}

const GREETINGS = ['Namaste.', 'Welcome, traveller.', 'Come, sit a while.', 'Mind the sun.', 'You have come a long way.', 'Pranam.'];

export interface ActorEnv {
  /** Ground height at a point, or null if there is none. */
  groundAt(x: number, z: number): number;
  /** Slide a point out of walls; returns the adjusted x/z. */
  resolve(x: number, y: number, z: number): { x: number; z: number };
  /** Lowest ground a person may stand on. */
  seaLevel: number;
}

export class NpcActor {
  readonly root: THREE.Group;
  readonly style: Style;
  readonly home: THREE.Vector2;
  readonly position = new THREE.Vector3();
  yaw: number;

  private readonly rig: Rig;
  private readonly rng: Rng;
  private readonly wander: { radius: number; speed: number } | null;
  private phase = 0;
  private waveLeft = 0;
  private greeted = false;
  private target: THREE.Vector2 | null = null;
  private pause = 0;
  private speed = 0;
  private headYaw = 0;
  private barkTimer: number;

  constructor(
    readonly spec: NpcSpec,
    x: number,
    y: number,
    z: number,
    yaw: number,
    robe: number,
  ) {
    this.style = styleFor(spec);
    this.rng = new Rng(`npc:${spec.id}`);
    this.home = new THREE.Vector2(x, z);
    this.position.set(x, y, z);
    this.yaw = yaw;
    this.wander = WANDER[this.style] ?? null;
    this.barkTimer = this.rng.range(18, 50);
    const child = /child|young/i.test(`${spec.role} ${spec.name}`);
    this.rig = buildRig(this.style, robe, child);
    this.root = this.rig.root;
    this.root.position.copy(this.position);
    this.root.rotation.y = yaw;
    this.phase = this.rng.range(0, 6.28);
  }

  /** True once this person has waved at the player. */
  get hasGreeted(): boolean {
    return this.greeted;
  }

  /**
   * Advance one frame.
   * @param player  where the player is
   * @param talking true while this person is in conversation
   * @returns a line to say aloud, when they want to say one
   */
  update(dt: number, env: ActorEnv, player: THREE.Vector3, talking: boolean): string | null {
    this.phase += dt;
    const dx = player.x - this.position.x;
    const dz = player.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    let say: string | null = null;

    // --- Where to be.
    const moving = this.wander && !talking && dist > 2.2;
    if (moving && this.wander) this.walk(dt, env);
    else this.speed = Math.max(0, this.speed - dt * 4);

    // --- Which way to look. Close up, turn to the player; otherwise face home or the walk direction.
    const toPlayer = Math.atan2(dx, dz);
    // A person who is walking looks where they are going, not at you; they turn to you when they stop.
    const near = dist < (talking ? 40 : 6.5) && !(moving && this.speed > 0.3);
    if (near) this.yaw = turn(this.yaw, toPlayer, dt * (talking ? 5 : 2.6));
    this.root.rotation.y = this.yaw;

    // --- The head follows the player further out than the body does.
    const looking = dist < 12 || talking;
    const headGoal = looking ? clamp(angleDiff(toPlayer, this.yaw), -0.9, 0.9) : Math.sin(this.phase * 0.35 + this.spec.id.length) * 0.5;
    this.headYaw += (headGoal - this.headYaw) * Math.min(1, dt * 3.5);

    // --- Greeting, once, as the player first comes close.
    if (!this.greeted && dist < 5.5) {
      this.greeted = true;
      this.waveLeft = 2.4;
      say = this.rng.pick(GREETINGS);
    }
    if (this.waveLeft > 0) this.waveLeft -= dt;

    // --- Now and then, a remark to nobody in particular.
    if (dist < 11 && !talking) {
      this.barkTimer -= dt;
      if (this.barkTimer <= 0) {
        this.barkTimer = this.rng.range(35, 80);
        say ??= this.remark();
      }
    }

    this.animate(dt, talking);
    return say;
  }

  /** A short line from the person's own lines, so what they mutter is what they would say. */
  private remark(): string | null {
    const sentences = this.spec.lines.flatMap((l) => l.split(/(?<=[.!?])\s+/)).filter((s) => s.length >= 18 && s.length <= 86);
    return sentences.length > 0 ? this.rng.pick(sentences) : null;
  }

  // ---------------------------------------------------------------- walking

  private walk(dt: number, env: ActorEnv): void {
    const w = this.wander as { radius: number; speed: number };
    if (this.pause > 0) {
      this.pause -= dt;
      this.speed = Math.max(0, this.speed - dt * 5);
      return;
    }
    if (!this.target) {
      // Choose a spot to go to that is dry ground, close to home.
      for (let tries = 0; tries < 8; tries++) {
        const a = this.rng.range(0, Math.PI * 2);
        const r = this.rng.range(1, w.radius);
        const tx = this.home.x + Math.cos(a) * r;
        const tz = this.home.y + Math.sin(a) * r;
        if (env.groundAt(tx, tz) > env.seaLevel + 0.7) {
          this.target = new THREE.Vector2(tx, tz);
          break;
        }
      }
      if (!this.target) {
        this.pause = 2;
        return;
      }
    }
    const tx = this.target.x - this.position.x;
    const tz = this.target.y - this.position.z;
    const d = Math.hypot(tx, tz);
    if (d < 0.4) {
      this.target = null;
      this.pause = this.style === 'play' ? this.rng.range(0.2, 1.1) : this.rng.range(1.5, 4);
      return;
    }
    const want = Math.atan2(tx, tz);
    this.yaw = turn(this.yaw, want, dt * 5);
    this.speed += (w.speed - this.speed) * Math.min(1, dt * 4);
    const step = this.speed * dt;
    let nx = this.position.x + Math.sin(this.yaw) * step;
    let nz = this.position.z + Math.cos(this.yaw) * step;
    // A wall in the way means this route is no good: stay put and choose another. Never let the wall
    // eject them — a large box would throw a person metres out of their patch.
    const slid = env.resolve(nx, this.position.y, nz);
    if (Math.hypot(slid.x - nx, slid.z - nz) > Math.max(0.04, step * 0.5)) {
      this.target = null;
      this.pause = 0.5;
      this.speed = 0;
      return;
    }
    nx = slid.x;
    nz = slid.z;
    const gy = env.groundAt(nx, nz);
    if (gy < env.seaLevel + 0.4) {
      this.target = null;
      return;
    }
    this.position.set(nx, gy, nz);
    this.root.position.copy(this.position);
  }

  // -------------------------------------------------------------- animation

  private animate(dt: number, talking: boolean): void {
    const { body, head, armL, armR, foreL, foreR } = this.rig;
    const t = this.phase;
    const walking = this.speed > 0.3;
    const stride = t * (this.style === 'play' ? 9 : 5.2);

    // Defaults: arms hanging, upright, breathing.
    let aL = 0.05;
    let aR = 0.05;
    let eL = -0.1;
    let eR = -0.1;
    let zL = 0.06;
    let zR = -0.06;
    let lean = 0;
    let bob = 0;
    let twist = 0;
    let nod = 0;

    const breath = Math.sin(t * 1.5) * 0.012;
    const sway = Math.sin(t * 0.45) * 0.02;

    if (walking) {
      const s = Math.sin(stride);
      aL = -s * 0.7;
      aR = s * 0.7;
      eL = -0.2;
      eR = -0.2;
      bob = Math.abs(Math.sin(stride)) * 0.05;
      lean = 0.05;
      twist = s * 0.07;
      if (this.style === 'carry') {
        // Both hands steady the pot overhead.
        aL = aR = -2.45;
        eL = eR = -0.4;
        zL = 0.5;
        zR = -0.5;
      }
    } else {
      switch (this.style) {
        case 'speak': {
          const g = Math.sin(t * 2.1);
          aR = -0.45 + g * 0.35;
          eR = -0.95 + Math.sin(t * 2.1 + 1) * 0.35;
          aL = -0.15 + Math.sin(t * 1.4) * 0.12;
          nod = Math.sin(t * 3) * 0.06;
          break;
        }
        case 'hammer': {
          const h = Math.sin(t * 4.2);
          aR = -1.15 + Math.max(0, h) * 0.9;
          eR = -0.7 - Math.max(0, h) * 0.7;
          aL = -0.65;
          eL = -0.9;
          lean = 0.16 + Math.max(0, -h) * 0.06;
          nod = 0.18;
          break;
        }
        case 'knead': {
          const k = Math.sin(t * 2.2);
          aL = -0.85 + k * 0.2;
          aR = -0.85 - k * 0.2;
          eL = -0.7;
          eR = -0.7;
          lean = 0.28 + k * 0.03;
          nod = 0.3;
          break;
        }
        case 'weave': {
          aL = -0.95 + Math.sin(t * 3) * 0.28;
          aR = -0.95 + Math.cos(t * 3) * 0.28;
          eL = -0.55;
          eR = -0.55;
          lean = 0.12;
          nod = 0.22;
          break;
        }
        case 'dig': {
          const d = Math.sin(t * 1.5);
          aR = -0.9 + d * 0.5;
          aL = -0.85 + d * 0.5;
          eR = -0.3;
          eL = -0.3;
          lean = 0.5 + d * 0.22;
          nod = 0.2;
          break;
        }
        case 'stir': {
          aR = -0.95;
          eR = -0.6 + Math.sin(t * 3.2) * 0.25;
          zR = -0.1 + Math.cos(t * 3.2) * 0.3;
          aL = -0.5;
          eL = -0.9;
          lean = 0.14;
          nod = 0.22;
          break;
        }
        case 'row': {
          const r = Math.sin(t * 1.7);
          aR = -0.85 + r * 0.6;
          aL = -0.85 - r * 0.6;
          eR = -0.4;
          eL = -0.4;
          lean = 0.12 + r * 0.14;
          break;
        }
        case 'write': {
          aL = -0.55;
          eL = -1.0;
          aR = -0.6;
          eR = -1.25 + Math.sin(t * 7) * 0.08;
          zR = -0.08 + Math.sin(t * 6.2) * 0.04;
          nod = 0.35 + Math.sin(t * 0.7) * 0.05;
          lean = 0.08;
          break;
        }
        case 'dance': {
          const d = Math.sin(t * 2.6);
          twist = d * 0.45;
          aL = -1.3 + Math.sin(t * 2.6 + 1) * 0.5;
          aR = -1.3 + Math.sin(t * 2.6 + 3) * 0.5;
          eL = -0.9;
          eR = -0.9;
          zL = 0.7;
          zR = -0.7;
          bob = Math.abs(Math.sin(t * 5.2)) * 0.07;
          nod = d * 0.12;
          break;
        }
        case 'guard': {
          aR = -0.15;
          eR = -0.3;
          lean = Math.sin(t * 0.3) * 0.015;
          break;
        }
        case 'pray': {
          aL = aR = -0.75;
          eL = eR = -1.45;
          zL = -0.3;
          zR = 0.3;
          nod = 0.42 + Math.sin(t * 0.8) * 0.04;
          break;
        }
        case 'play': {
          aL = Math.sin(t * 2) * 0.3;
          aR = -Math.sin(t * 2) * 0.3;
          break;
        }
        default:
          aL += Math.sin(t * 0.9) * 0.05;
          aR -= Math.sin(t * 0.9) * 0.05;
          break;
      }
    }

    // A wave of greeting overrides the right arm for a moment.
    if (this.waveLeft > 0) {
      const k = Math.min(1, this.waveLeft / 0.3, (2.4 - this.waveLeft) / 0.3 + 0.001);
      aR = lerp(aR, -2.55, k);
      eR = lerp(eR, -0.4 + Math.sin(t * 9) * 0.45, k);
      zR = lerp(zR, -0.25, k);
    }
    // In conversation, a talking gesture.
    if (talking && !walking) {
      aR = lerp(aR, -0.5 + Math.sin(t * 2.4) * 0.3, 0.7);
      eR = lerp(eR, -0.9 + Math.sin(t * 2.4 + 1) * 0.3, 0.7);
      nod += Math.sin(t * 3.4) * 0.05;
    }

    const k = Math.min(1, dt * 9);
    armL.rotation.x += (aL - armL.rotation.x) * k;
    armR.rotation.x += (aR - armR.rotation.x) * k;
    foreL.rotation.x += (eL - foreL.rotation.x) * k;
    foreR.rotation.x += (eR - foreR.rotation.x) * k;
    armL.rotation.z += (zL - armL.rotation.z) * k;
    armR.rotation.z += (zR - armR.rotation.z) * k;

    body.rotation.x += (lean - body.rotation.x) * k;
    body.rotation.y += (twist - body.rotation.y) * k;
    body.rotation.z = sway;
    body.scale.y = 1 + breath;
    body.position.y = bob;

    head.rotation.y = this.headYaw;
    head.rotation.x += (nod - head.rotation.x) * k;
    // The head, and the arms hung from the shoulders, ride on the lean and the bob.
    head.position.y = 1.73 + bob - Math.sin(lean) * 0.1;
    head.position.z = Math.sin(lean) * 0.55;
    for (const a of [armL, armR]) {
      a.position.y = 1.62 + bob - Math.sin(lean) * 0.08;
      a.position.z = Math.sin(lean) * 0.5;
    }
  }

  dispose(): void {
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
    });
  }
}

const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function angleDiff(a: number, b: number): number {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Turn `from` toward `to` by at most `step` radians. */
function turn(from: number, to: number, step: number): number {
  const d = angleDiff(to, from);
  return from + clamp(d, -Math.abs(step), Math.abs(step));
}
