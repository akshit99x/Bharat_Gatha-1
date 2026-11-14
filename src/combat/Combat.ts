import * as THREE from 'three';
import { Rng } from '../core/Rng';
import { audio } from '../core/Audio';
import { ZONES } from '../content/zones';
import type { World } from '../world/World';
import { buildPerson } from '../world/World';
import { SEA_LEVEL } from '../world/Terrain';

/**
 * Combat: the Dhundh, given form.
 *
 * The haze in this story makes history simple. Out in the open country of every region it gathers into
 * shades: grey, faceless raiders that come at you when you near their haze column. You drive them off with
 * the bow (left click) or a close strike (Q, or left click with the Shilpa hammer). They dissolve when
 * beaten. The people of the island are never targets: an arrow that reaches one of them clatters harmlessly
 * to the ground and they tell you to mind your aim.
 *
 * Nothing is lost by being overwhelmed: the haze sets you down at the region's landing terrace, at full
 * strength, and the shades go back to their column. A site, once cleared, gathers again after a while.
 */

const SHADE_HP = 3;
const SHADE_SPEED = 3.7;
const SHADE_REACH = 1.9;
const WINDUP = 0.6;
const RECOVER = 0.9;
const AGGRO = 34;
const LEASH = 70;
const ARROW_SPEED = 68;
const ARROW_GRAVITY = 9.8;
const BOW_COOLDOWN = 0.45;
const STRIKE_COOLDOWN = 0.55;
const STRIKE_RANGE = 2.6;
const REGROW_SECONDS = 600;
export const PLAYER_HEARTS = 5;

type ShadeState = 'idle' | 'chase' | 'windup' | 'recover' | 'gone';

interface Shade {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  site: Site;
  pos: THREE.Vector3;
  home: THREE.Vector3;
  hp: number;
  state: ShadeState;
  timer: number;
  flash: number;
  fade: number;
  yaw: number;
  phase: number;
}

interface Site {
  id: string;
  zoneId: string;
  pos: THREE.Vector3;
  column: THREE.Mesh;
  shades: Shade[];
  clearedAt: number | null;
}

interface Arrow {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  stuck: boolean;
}

export interface CombatEvents {
  /** A shade was dispersed. */
  onDefeat?: (zoneId: string, siteCleared: boolean) => void;
  /** The player's hearts changed. */
  onHealth?: (hearts: number, max: number) => void;
  /** The haze overwhelmed the player. */
  onOverwhelmed?: () => void;
  /** An arrow reached one of the island's people. */
  onNpcStruck?: (npcId: string) => void;
}

export class Combat {
  readonly group = new THREE.Group();
  hearts = PLAYER_HEARTS;
  enabled = true;
  /** True while shades are actively coming at the player: the HUD shows hearts then. */
  engaged = false;

  private readonly sites: Site[] = [];

  /** Where the haze columns stand, so other things can be placed clear of them. */
  sitePositions(): THREE.Vector3[] {
    return this.sites.map((s) => s.pos.clone());
  }
  private readonly arrows: Arrow[] = [];
  private readonly arrowGeo: THREE.BufferGeometry;
  private readonly arrowMat = new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.7 });
  private readonly shadeGeo: THREE.BufferGeometry;
  private bowCooldown = 0;
  private strikeCooldown = 0;
  private sinceHurt = 99;
  private regen = 0;
  private clock = 0;
  private readonly v = new THREE.Vector3();
  private readonly w = new THREE.Vector3();

  constructor(
    private readonly world: World,
    seed: string,
    private readonly events: CombatEvents = {},
  ) {
    this.group.name = 'combat';
    // An arrow: shaft, head and fletching, pointing down +Z.
    const shaft = new THREE.CylinderGeometry(0.018, 0.018, 0.85, 5);
    shaft.rotateX(Math.PI / 2);
    const head = new THREE.ConeGeometry(0.045, 0.14, 6);
    head.rotateX(Math.PI / 2);
    head.translate(0, 0, 0.49);
    this.arrowGeo = mergeSimple([shaft, head]);

    this.shadeGeo = buildPerson(0x7a8394, new Rng(`${seed}:shade`));
    this.placeSites(seed);
  }

  /** Two haze columns per region, out in open country, well away from the people and the monuments. */
  private placeSites(seed: string): void {
    const columnGeo = new THREE.CylinderGeometry(2.2, 4.5, 26, 14, 1, true);
    columnGeo.translate(0, 13, 0);
    for (const zone of ZONES) {
      const rng = new Rng(`${seed}:haze:${zone.id}`);
      let placed = 0;
      for (let attempt = 0; attempt < 60 && placed < 2; attempt++) {
        const a = rng.next() * Math.PI * 2;
        const r = zone.radius * rng.range(0.45, 0.8);
        const x = zone.center[0] + Math.cos(a) * r;
        const z = zone.center[1] + Math.sin(a) * r;
        const y = this.world.terrain.heightAt(x, z);
        if (y < SEA_LEVEL + 2.5 || this.world.terrain.slopeAt(x, z) > 0.22) continue;
        if (this.world.collision.columnAt(x, z).length > 0) continue;
        const tooClose =
          this.world.interactables.some((it) => Math.hypot(it.position.x - x, it.position.z - z) < 40) ||
          this.world.landmarks.some((l) => Math.hypot(l.position.x - x, l.position.z - z) < l.radius + 26) ||
          this.sites.some((s) => s.pos.distanceTo(this.v.set(x, y, z)) < 90);
        if (tooClose) continue;

        const mat = new THREE.MeshBasicMaterial({ color: 0x8a909c, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide, fog: true });
        const column = new THREE.Mesh(columnGeo, mat);
        column.position.set(x, y, z);
        this.group.add(column);
        const site: Site = { id: `${zone.id}:${placed}`, zoneId: zone.id, pos: new THREE.Vector3(x, y, z), column, shades: [], clearedAt: null };
        const count = 2 + (rng.next() < 0.5 ? 1 : 0);
        for (let i = 0; i < count; i++) site.shades.push(this.makeShade(site, i, count));
        this.sites.push(site);
        placed++;
      }
    }
  }

  private makeShade(site: Site, i: number, count: number): Shade {
    const mat = new THREE.MeshStandardMaterial({
      color: 0x23262e,
      emissive: 0x56607a,
      emissiveIntensity: 0.18,
      roughness: 1,
      transparent: true,
      opacity: 0.88,
    });
    const mesh = new THREE.Mesh(this.shadeGeo, mat);
    mesh.scale.setScalar(1.08);
    const a = (i / count) * Math.PI * 2;
    const home = new THREE.Vector3(site.pos.x + Math.cos(a) * 5, site.pos.y, site.pos.z + Math.sin(a) * 5);
    mesh.position.copy(home);
    this.group.add(mesh);
    return { mesh, mat, site, pos: home.clone(), home, hp: SHADE_HP, state: 'idle', timer: 0, flash: 0, fade: 1, yaw: 0, phase: i * 1.7 };
  }

  /** Where the nearest uncleared haze column is, for the map. */
  get siteList(): ReadonlyArray<{ zoneId: string; x: number; z: number; cleared: boolean }> {
    return this.sites.map((s) => ({ zoneId: s.zoneId, x: s.pos.x, z: s.pos.z, cleared: s.clearedAt !== null }));
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    this.group.visible = on;
    if (!on) {
      this.engaged = false;
      for (const s of this.sites) for (const sh of s.shades) if (sh.state !== 'gone') this.reset(sh);
    }
  }

  // ------------------------------------------------------------- attacks

  /**
   * Loose an arrow from `from` toward wherever the crosshair is pointing. `aim` is the camera's position
   * and forward direction, so the arrow lands where the player is looking even in third person.
   */
  shoot(from: THREE.Vector3, aimOrigin: THREE.Vector3, aimDir: THREE.Vector3): boolean {
    if (!this.enabled || this.bowCooldown > 0) return false;
    this.bowCooldown = BOW_COOLDOWN;
    // What is the crosshair on? Walls and ground first, then a shade if one is nearer.
    let dist = 160;
    const hit = this.world.collision.raycast(aimOrigin.x, aimOrigin.y, aimOrigin.z, aimDir.x, aimDir.y, aimDir.z, dist);
    if (hit) dist = Math.min(dist, hit.distance);
    for (const s of this.activeShades()) {
      const t = rayToSphere(aimOrigin, aimDir, s.pos, 1.1, 0.75);
      if (t !== null && t < dist) dist = t;
    }
    const target = this.v.copy(aimOrigin).addScaledVector(aimDir, dist);
    const dir = this.w.copy(target).sub(from).normalize();
    // A touch of lift so a long shot arcs onto the crosshair rather than dropping short.
    const flight = from.distanceTo(target) / ARROW_SPEED;
    const vel = dir.multiplyScalar(ARROW_SPEED);
    vel.y += 0.5 * ARROW_GRAVITY * flight;
    const mesh = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    mesh.position.copy(from);
    this.group.add(mesh);
    this.arrows.push({ mesh, pos: from.clone(), vel: vel.clone(), life: 9, stuck: false });
    audio.bowRelease();
    return true;
  }

  /** A close strike in front of the player. Returns true if anything was hit. */
  strike(at: THREE.Vector3, facing: THREE.Vector3): boolean {
    if (!this.enabled || this.strikeCooldown > 0) return false;
    this.strikeCooldown = STRIKE_COOLDOWN;
    audio.swing();
    let any = false;
    for (const s of this.activeShades()) {
      this.v.copy(s.pos).sub(at);
      this.v.y = 0;
      const d = this.v.length();
      if (d > STRIKE_RANGE) continue;
      // In front of the player, in a wide arc.
      if (d > 0.6 && this.v.normalize().dot(this.w.set(facing.x, 0, facing.z).normalize()) < 0.25) continue;
      this.damage(s, 1, this.w.set(facing.x, 0, facing.z).normalize());
      any = true;
    }
    return any;
  }

  private damage(s: Shade, amount: number, push: THREE.Vector3): void {
    if (s.state === 'gone') return;
    s.hp -= amount;
    s.flash = 0.18;
    s.pos.addScaledVector(push, 1.1);
    if (s.state === 'windup') {
      // A hit breaks the swing.
      s.state = 'recover';
      s.timer = RECOVER * 0.7;
    } else if (s.state === 'idle') s.state = 'chase';
    if (s.hp <= 0) {
      s.state = 'gone';
      s.fade = 1;
      audio.shadeGone();
      const cleared = s.site.shades.every((o) => o.state === 'gone');
      if (cleared) s.site.clearedAt = this.clock;
      this.events.onDefeat?.(s.site.zoneId, cleared);
    } else audio.shadeHit();
  }

  private reset(s: Shade): void {
    s.state = 'idle';
    s.hp = SHADE_HP;
    s.pos.copy(s.home);
    s.fade = 1;
    s.mesh.visible = true;
    s.mat.opacity = 0.88;
    s.mesh.scale.setScalar(1.08);
  }

  /** Full strength again (after being overwhelmed and set down somewhere safe). */
  restore(): void {
    this.hearts = PLAYER_HEARTS;
    this.sinceHurt = 99;
    for (const site of this.sites) for (const s of site.shades) if (s.state !== 'gone') this.reset(s);
    this.engaged = false;
    this.events.onHealth?.(this.hearts, PLAYER_HEARTS);
  }

  private *activeShades(): Generator<Shade> {
    for (const site of this.sites) for (const s of site.shades) if (s.state !== 'gone') yield s;
  }

  // -------------------------------------------------------------- update

  /**
   * Advance everything. `player` is the player's feet; `paused` stops the shades (menus, dialogue, flight)
   * but lets arrows already in the air finish.
   */
  update(dt: number, elapsed: number, player: THREE.Vector3, paused: boolean): void {
    this.clock = elapsed;
    this.bowCooldown = Math.max(0, this.bowCooldown - dt);
    this.strikeCooldown = Math.max(0, this.strikeCooldown - dt);
    this.updateArrows(dt);
    if (!this.enabled) return;

    let engaged = false;
    for (const site of this.sites) {
      // The column breathes; a cleared one thins away and regrows after a while.
      const mat = site.column.material as THREE.MeshBasicMaterial;
      const cleared = site.clearedAt !== null;
      mat.opacity = THREE.MathUtils.lerp(mat.opacity, cleared ? 0.0 : 0.16 + Math.sin(elapsed * 0.8 + site.pos.x) * 0.05, Math.min(1, dt * 1.5));
      site.column.rotation.y += dt * 0.15;
      if (cleared && elapsed - (site.clearedAt as number) > REGROW_SECONDS && site.pos.distanceTo(player) > 120) {
        site.clearedAt = null;
        for (const s of site.shades) this.reset(s);
      }

      const far = site.pos.distanceTo(player) > 160;
      for (const s of site.shades) {
        if (s.state === 'gone') {
          // Dissolve: thin, rise and fade.
          if (s.mesh.visible) {
            s.fade -= dt * 1.4;
            s.mat.opacity = Math.max(0, 0.88 * s.fade);
            s.mesh.position.y += dt * 1.6;
            s.mesh.scale.set(1.08 * (0.6 + 0.4 * s.fade), 1.08 * (1 + (1 - s.fade) * 0.4), 1.08 * (0.6 + 0.4 * s.fade));
            if (s.fade <= 0) s.mesh.visible = false;
          }
          continue;
        }
        if (far) continue;
        if (!paused) this.think(s, dt, player);
        if (s.state === 'chase' || s.state === 'windup' || s.state === 'recover') engaged = true;
        this.pose(s, dt, elapsed);
      }
    }
    this.engaged = engaged;

    // Out of the fight for a while: strength comes back, a heart at a time.
    this.sinceHurt += dt;
    if (!engaged && this.sinceHurt > 5 && this.hearts < PLAYER_HEARTS) {
      this.regen += dt;
      if (this.regen > 1.6) {
        this.regen = 0;
        this.hearts++;
        this.events.onHealth?.(this.hearts, PLAYER_HEARTS);
      }
    }
  }

  private think(s: Shade, dt: number, player: THREE.Vector3): void {
    const toPlayer = this.v.copy(player).sub(s.pos);
    toPlayer.y = 0;
    const d = toPlayer.length();
    const fromHome = Math.hypot(player.x - s.site.pos.x, player.z - s.site.pos.z);

    switch (s.state) {
      case 'idle':
        if (d < AGGRO) s.state = 'chase';
        break;
      case 'chase':
        if (fromHome > LEASH) {
          // Too far from its haze: it drifts back and forgets.
          this.moveToward(s, s.home, dt, SHADE_SPEED * 0.8);
          if (s.pos.distanceTo(s.home) < 1) s.state = 'idle';
          break;
        }
        if (d > SHADE_REACH) this.moveToward(s, player, dt, SHADE_SPEED);
        else {
          s.state = 'windup';
          s.timer = WINDUP;
        }
        s.yaw = Math.atan2(toPlayer.x, toPlayer.z);
        break;
      case 'windup':
        s.timer -= dt;
        s.yaw = Math.atan2(toPlayer.x, toPlayer.z);
        if (s.timer <= 0) {
          // The blow lands only if the player is still there: stepping back dodges it.
          if (d < SHADE_REACH + 0.5) this.hurtPlayer();
          s.state = 'recover';
          s.timer = RECOVER;
        }
        break;
      case 'recover':
        s.timer -= dt;
        if (s.timer <= 0) s.state = 'chase';
        break;
      default:
        break;
    }
  }

  private moveToward(s: Shade, target: THREE.Vector3, dt: number, speed: number): void {
    const dir = this.w.copy(target).sub(s.pos);
    dir.y = 0;
    const len = dir.length();
    if (len < 0.01) return;
    dir.multiplyScalar(Math.min(len, speed * dt) / len);
    const nx = s.pos.x + dir.x;
    const nz = s.pos.z + dir.z;
    const r = this.world.collision.resolve(nx, s.pos.y, nz, 0.42, 1.8, 0.6);
    s.pos.x = r.x;
    s.pos.z = r.z;
    const ground = this.world.terrain.heightAt(s.pos.x, s.pos.z);
    s.pos.y = r.supportY !== null && r.supportY > ground ? r.supportY : ground;
  }

  private pose(s: Shade, dt: number, elapsed: number): void {
    const m = s.mesh;
    const hover = Math.sin(elapsed * 2.2 + s.phase) * 0.06;
    m.position.set(s.pos.x, s.pos.y + 0.05 + hover, s.pos.z);
    m.rotation.y = s.yaw;
    // Lean in for the blow: a clear tell, so it can be dodged.
    const lean = s.state === 'windup' ? -0.32 * (1 - s.timer / WINDUP) : s.state === 'recover' ? 0.15 : 0;
    m.rotation.x = THREE.MathUtils.lerp(m.rotation.x, lean, Math.min(1, dt * 10));
    s.flash = Math.max(0, s.flash - dt);
    s.mat.emissiveIntensity = s.flash > 0 ? 1.4 : s.state === 'windup' ? 0.55 + Math.sin(elapsed * 30) * 0.2 : 0.18;
    s.mat.opacity = 0.72 + Math.sin(elapsed * 3.1 + s.phase) * 0.1;
  }

  private hurtPlayer(): void {
    this.hearts = Math.max(0, this.hearts - 1);
    this.sinceHurt = 0;
    this.regen = 0;
    audio.hurt();
    this.events.onHealth?.(this.hearts, PLAYER_HEARTS);
    if (this.hearts <= 0) this.events.onOverwhelmed?.();
  }

  private updateArrows(dt: number): void {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i] as Arrow;
      a.life -= dt;
      if (a.life <= 0) {
        this.group.remove(a.mesh);
        this.arrows.splice(i, 1);
        continue;
      }
      if (a.stuck) continue;
      const step = Math.min(dt, 0.05);
      a.vel.y -= ARROW_GRAVITY * step;
      const move = a.vel.length() * step;
      const dir = this.v.copy(a.vel).normalize();

      // Shades first: an arrow that reaches one is spent.
      let struck = false;
      if (this.enabled) {
        for (const s of this.activeShades()) {
          const t = rayToSphere(a.pos, dir, s.pos, 1.1, 0.7);
          if (t !== null && t <= move) {
            this.damage(s, 1, this.w.copy(dir).setY(0).normalize());
            audio.arrowHit(true);
            struck = true;
            break;
          }
        }
      }
      if (struck) {
        this.group.remove(a.mesh);
        this.arrows.splice(i, 1);
        continue;
      }

      // Then the world: walls, the ground.
      const hit = this.world.collision.raycast(a.pos.x, a.pos.y, a.pos.z, dir.x, dir.y, dir.z, move);
      if (hit && hit.distance <= move) {
        a.pos.addScaledVector(dir, Math.max(0, hit.distance - 0.3));
        const tag = hit.box.tag;
        if (tag && tag.startsWith('npc:')) {
          // A person: the arrow glances off and falls, and they let you know about it.
          this.events.onNpcStruck?.(tag.slice(4));
          a.vel.set(-dir.x * 2, 2, -dir.z * 2);
          a.life = Math.min(a.life, 2.5);
          continue;
        }
        a.stuck = true;
        a.life = Math.min(a.life, 8);
        audio.arrowHit(false);
      } else {
        a.pos.addScaledVector(dir, move);
        const ground = this.world.terrain.heightAt(a.pos.x, a.pos.z);
        if (a.pos.y <= ground + 0.05) {
          a.pos.y = ground + 0.05;
          a.stuck = true;
          a.life = Math.min(a.life, 8);
        }
      }
      a.mesh.position.copy(a.pos);
      a.mesh.lookAt(this.w.copy(a.pos).add(a.vel));
    }
  }

  dispose(): void {
    this.arrowGeo.dispose();
    this.arrowMat.dispose();
    for (const site of this.sites) {
      (site.column.material as THREE.Material).dispose();
      for (const s of site.shades) s.mat.dispose();
    }
  }
}

/** Distance along a ray to a vertical capsule-ish target (a sphere at chest height), or null. */
function rayToSphere(o: THREE.Vector3, d: THREE.Vector3, feet: THREE.Vector3, chest: number, r: number): number | null {
  const cx = feet.x - o.x;
  const cy = feet.y + chest - o.y;
  const cz = feet.z - o.z;
  const t = cx * d.x + cy * d.y + cz * d.z;
  if (t < 0) return null;
  const px = cx - d.x * t;
  const py = cy - d.y * t;
  const pz = cz - d.z * t;
  // Taller than wide: squash the vertical so a shot at the head or the knees still counts.
  const dist2 = px * px + (py * 0.55) ** 2 + pz * pz;
  return dist2 <= r * r ? t : null;
}

function mergeSimple(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nrm: number[] = [];
  for (const p0 of parts) {
    const p = p0.index ? p0.toNonIndexed() : p0;
    pos.push(...(p.getAttribute('position').array as unknown as number[]));
    nrm.push(...(p.getAttribute('normal').array as unknown as number[]));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  return g;
}
