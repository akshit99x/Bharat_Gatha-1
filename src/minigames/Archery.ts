import { audio } from '../core/Audio';
import type { ArcheryChallenge } from '../content/types';
import { el } from '../ui/overlay';
import { animate, clamp, easeOutCubic } from './shared';
import type { GameHost, MiniGameResult } from './types';

/**
 * Archery: a small ballistics simulation.
 *
 * You look down a range in perspective. Where the arrow lands depends on four
 * things a real archer manages, and the game models each:
 *
 *  - **Aim**, with the sway of a held breath. Hold Shift to steady it — but
 *    breath runs out, and an archer who has held too long shakes worse.
 *  - **Draw.** A full draw is a fast, flat arrow. A short draw is slow, so it
 *    arrives lower. Hold the button until the meter is full.
 *  - **Range.** The longer the arrow flies, the further it drops, so a far
 *    target needs a higher aim. Maratha's posts are labelled in paces for
 *    exactly this reason.
 *  - **Wind**, shown on the pennant, which pushes the arrow sideways in
 *    proportion to its time in the air.
 *
 * A miss tells you why: high, low, left or right, and whether the draw or the
 * wind was to blame. The called-shot variant (Drona's test) only scores the
 * target you named; every other hit is a wasted arrow.
 */

const W = 880;
const H = 480;
const CX = W / 2;
const HORIZON = 296;
const FOCAL = 640;
const EYE = 1.6;
const GRAVITY = 9.8;
const FULL_DRAW_SECONDS = 0.85;
const MAX_DEPTH = 62;
/** A little forgiveness for the thickness of an arrow and of the ring it grazes. */
const HIT_SLACK = 1.18;

interface Target {
  x: number;
  y: number;
  z: number;
  radius: number;
  points: number;
  label: string;
  moving: boolean;
  /** Pulses when struck. */
  wobble: number;
}

interface Flight {
  /** Seconds since loosed. */
  t: number;
  duration: number;
  path: Array<{ sx: number; sy: number; s: number }>;
  hit: Target | null;
  resolved: boolean;
  landing: { sx: number; sy: number; s: number };
  award: number;
  text: string;
}

interface Stuck {
  sx: number;
  sy: number;
  s: number;
  angle: number;
  dust: number;
  target: Target | null;
}

interface Popup {
  sx: number;
  sy: number;
  text: string;
  age: number;
  colour: string;
}

export function runArchery(challenge: ArcheryChallenge, host: GameHost): Promise<MiniGameResult> {
  return new Promise((resolve) => {
    const cfg = challenge.config;
    const called = cfg.calledShot?.toLowerCase() ?? null;
    const targets: Target[] = cfg.targets.map((t) => ({
      x: t.pos[0],
      y: t.pos[1],
      z: t.pos[2],
      radius: t.radius,
      points: t.points,
      label: t.label ?? '',
      moving: t.moving === true,
      wobble: 0,
    }));
    const base = new Map(targets.map((t) => [t, t.x]));

    const canvas = el('canvas', 'ar-canvas');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label', 'Archery range. Move the mouse to aim, hold the left button to draw, release to loose.');
    host.area.appendChild(canvas);
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    ctx.scale(dpr, dpr);

    // ------------------------------------------------------------------ state

    let arrows = cfg.arrows;
    let score = 0;
    let hits = 0;
    let wasted = 0;
    let finished = false;

    let aimX = CX;
    let aimY = HORIZON - 70;
    let goalX = aimX;
    let goalY = aimY;

    let drawing = false;
    let drawTime = 0;
    let breath = 1;
    let holding = false;
    let wind = 0;
    let windGoal = 0;
    let swayT = 0;
    let clock = 0;
    let flight: Flight | null = null;
    const stuck: Stuck[] = [];
    const popups: Popup[] = [];
    let cooldown = 0;
    let lastDrawSound = 0;

    const newWind = (): void => {
      windGoal = (Math.random() * 2 - 1) * 1.6;
    };
    newWind();
    wind = windGoal;

    host.setStatus(
      called
        ? 'Name your target in your mind: only the bird’s eye counts. Move to aim, hold the button to draw, release to loose. Shift steadies your breath.'
        : 'Move to aim, hold the left button to draw to full, release to loose. Shift steadies your breath. Watch the wind pennant.',
    );

    // --------------------------------------------------------------- geometry

    /** Perspective: a point in the range to a point on the canvas. */
    const project = (x: number, y: number, z: number): { sx: number; sy: number; s: number } => {
      const depth = Math.max(1, -z);
      const s = FOCAL / depth;
      return { sx: CX + x * s, sy: HORIZON - (y - EYE) * s, s };
    };

    /** Where a moving target is, `ahead` seconds from now. */
    const targetX = (t: Target, ahead = 0): number => {
      if (!t.moving) return base.get(t) as number;
      return (base.get(t) as number) + Math.sin((clock + ahead) * 1.25) * 3.4;
    };

    // ------------------------------------------------------------------ input

    const toLogical = (e: PointerEvent): { x: number; y: number } => {
      const r = canvas.getBoundingClientRect();
      return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
    };

    canvas.addEventListener('pointermove', (e) => {
      const p = toLogical(e);
      goalX = clamp(p.x, 20, W - 20);
      goalY = clamp(p.y, 20, HORIZON + 80);
    });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      canvas.setPointerCapture(e.pointerId);
      canvas.focus();
      const p = toLogical(e);
      goalX = clamp(p.x, 20, W - 20);
      goalY = clamp(p.y, 20, HORIZON + 80);
      beginDraw();
    });
    canvas.addEventListener('pointerup', () => release());
    canvas.addEventListener('pointercancel', () => release());
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    const keysDown = new Set<string>();
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') holding = true;
      if (e.key === ' ' && !e.repeat) {
        e.preventDefault();
        e.stopPropagation();
        beginDraw();
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault();
        e.stopPropagation();
        keysDown.add(e.key);
      }
    };
    const onKeyUp = (e: KeyboardEvent): void => {
      if (e.key === 'Shift') holding = false;
      if (e.key === ' ') {
        e.preventDefault();
        release();
      }
      keysDown.delete(e.key);
    };
    window.addEventListener('keydown', onKeyDown, true);
    window.addEventListener('keyup', onKeyUp, true);
    host.onDispose(() => {
      window.removeEventListener('keydown', onKeyDown, true);
      window.removeEventListener('keyup', onKeyUp, true);
    });
    // The pointer may be released outside the canvas; Shift too.
    const stopHolding = (): void => {
      holding = false;
    };
    window.addEventListener('blur', stopHolding);
    host.onDispose(() => window.removeEventListener('blur', stopHolding));

    function beginDraw(): void {
      if (finished || flight || arrows <= 0 || cooldown > 0 || drawing) return;
      drawing = true;
      drawTime = 0;
      lastDrawSound = 0;
      audio.bowDraw();
    }

    function release(): void {
      if (!drawing) return;
      drawing = false;
      const power = clamp(drawTime / FULL_DRAW_SECONDS, 0, 1);
      if (power < 0.08) return; // a twitch, not a shot
      loose(power);
    }

    // ----------------------------------------------------------------- firing

    function sway(): { x: number; y: number } {
      // Two incommensurate waves read as a breathing wobble rather than a loop.
      const steady = holding && breath > 0.02 ? 0.22 : 1;
      const tired = breath < 0.25 ? 1 + (0.25 - breath) * 5 : 1;
      const a = 9.5 * steady * tired;
      return {
        x: (Math.sin(swayT * 1.7) * a + Math.sin(swayT * 3.1 + 1.3) * a * 0.55),
        y: (Math.cos(swayT * 1.35) * a * 0.8 + Math.sin(swayT * 2.6) * a * 0.4),
      };
    }

    function loose(power: number): void {
      const s = sway();
      const sx = aimX + s.x;
      const sy = aimY + s.y;
      // Direction of the line of sight, as a slope per metre of range.
      const dirX = (sx - CX) / FOCAL;
      const dirY = (HORIZON - sy) / FOCAL;
      const speed = 42 + 78 * power;

      /** Where the arrow is when it has flown `Z` metres downrange, at time t. */
      const at = (Z: number): { x: number; y: number; t: number } => {
        const t = Z / speed;
        return { x: dirX * Z + 0.5 * wind * t * t, y: EYE + dirY * Z - 0.5 * GRAVITY * t * t, t };
      };

      // Find what it hits: the nearest target whose disc it passes through.
      let hit: Target | null = null;
      let hitDist = 0;
      let hitAt = { x: 0, y: 0, t: 0 };
      const byDepth = [...targets].sort((a, b) => -a.z - -b.z);
      for (const t of byDepth) {
        const Z = -t.z;
        const p = at(Z);
        const tx = targetX(t, p.t);
        const d = Math.hypot(p.x - tx, p.y - t.y);
        if (d <= t.radius * HIT_SLACK) {
          hit = t;
          hitDist = d / t.radius;
          hitAt = p;
          break;
        }
      }

      // Where it comes to rest if it hit nothing: the ground, or over the top.
      let landZ = MAX_DEPTH;
      let ground = false;
      if (!hit) {
        for (let Z = 6; Z <= MAX_DEPTH; Z += 0.5) {
          if (at(Z).y <= 0) {
            landZ = Z;
            ground = true;
            break;
          }
        }
      }
      const end = hit ? hitAt : at(landZ);
      const landing = project(end.x, hit ? end.y : ground ? 0 : Math.max(end.y, 0), hit ? hit.z : -landZ);
      const duration = clamp((hit ? -hit.z : landZ) / speed, 0.25, 0.9) + 0.05;

      // The visible path: sampled along the real trajectory so the arc on screen is the arc that was flown.
      const path: Flight['path'] = [];
      const reach = hit ? -hit.z : landZ;
      for (let i = 0; i <= 28; i++) {
        const Z = (reach * i) / 28;
        const q = at(Z);
        path.push(project(q.x, Math.max(0, q.y), -Z));
      }

      // Score it.
      let award = 0;
      let text = '';
      if (hit) {
        const isCalled = !called || hit.label.toLowerCase().includes(called);
        if (!isCalled) {
          award = 0;
          wasted++;
          text = `That arrow hit ${hit.label.charAt(0).toLowerCase()}${hit.label.slice(1)}, not the eye. It is wasted.`;
        } else {
          award = hitDist <= 0.42 ? hit.points : Math.ceil(hit.points / 2);
          hits++;
          text = hitDist <= 0.42 ? `Dead centre on ${hit.label}: ${award}.` : `Hit ${hit.label}, off centre: ${award}.`;
        }
      } else {
        text = explainMiss(at, power);
      }

      flight = { t: 0, duration, path, hit, resolved: false, landing, award, text };
      arrows--;
      cooldown = 0.4;
      audio.bowRelease();
      newWind();
    }

    /** Tell the player why it missed, in the terms an archer would use. */
    function explainMiss(at: (Z: number) => { x: number; y: number; t: number }, power: number): string {
      // Judge against the target it was nearest to when it passed that target's range.
      let best: { t: Target; dx: number; dy: number; d: number } | null = null;
      for (const t of targets) {
        const p = at(-t.z);
        const d = Math.hypot(p.x - targetX(t, p.t), p.y - t.y) / t.radius;
        if (!best || d < best.d) best = { t, dx: p.x - targetX(t, p.t), dy: p.y - t.y, d };
      }
      if (!best) return 'Missed.';
      const parts: string[] = [];
      const vertical = Math.abs(best.dy) > Math.abs(best.dx);
      if (vertical) parts.push(best.dy < 0 ? 'low' : 'high');
      else parts.push(best.dx < 0 ? 'left' : 'right');
      let because = '';
      if (best.dy < 0 && power < 0.85) because = ' You loosed before a full draw, so the arrow was slow and dropped.';
      else if (best.dy < 0) because = ' Over this distance an arrow drops: aim higher for far targets.';
      else if (!vertical && Math.abs(wind) > 0.7) because = ` The wind (${wind > 0 ? 'to the right' : 'to the left'}) pushed it ${wind > 0 ? 'right' : 'left'}: lean into it.`;
      return `Missed — ${parts.join(' and ')} of ${best.t.label || 'the target'}.${because}`;
    }

    // ------------------------------------------------------------------- loop

    animate(canvas, (dt) => {
      if (host.closed) return false;
      clock += dt;
      swayT += dt;
      cooldown = Math.max(0, cooldown - dt);

      // Aim follows the pointer with a little weight, so it feels held rather than teleported.
      const k = 1 - Math.exp(-14 * dt);
      for (const key of keysDown) {
        if (key === 'ArrowLeft') goalX -= 260 * dt;
        if (key === 'ArrowRight') goalX += 260 * dt;
        if (key === 'ArrowUp') goalY -= 260 * dt;
        if (key === 'ArrowDown') goalY += 260 * dt;
      }
      goalX = clamp(goalX, 20, W - 20);
      goalY = clamp(goalY, 20, HORIZON + 80);
      aimX += (goalX - aimX) * k;
      aimY += (goalY - aimY) * k;

      wind += (windGoal - wind) * (1 - Math.exp(-0.6 * dt));

      // Breath: held, it drains; released, it comes back.
      if (holding && breath > 0) breath = Math.max(0, breath - 0.42 * dt);
      else if (!holding) breath = Math.min(1, breath + 0.3 * dt);

      if (drawing) {
        drawTime += dt;
        if (drawTime - lastDrawSound > 0.3 && drawTime < FULL_DRAW_SECONDS) {
          lastDrawSound = drawTime;
          audio.hover();
        }
      }

      for (const t of targets) t.wobble = Math.max(0, t.wobble - dt * 2.2);
      for (const p of popups) p.age += dt;
      while (popups.length > 0 && (popups[0] as Popup).age > 1.4) popups.shift();
      for (const s of stuck) s.dust = Math.max(0, s.dust - dt);

      if (flight) {
        flight.t += dt;
        if (!flight.resolved && flight.t >= flight.duration) resolveFlight(flight);
      }

      render();

      if (!finished && arrows <= 0 && !flight && popups.every((p) => p.age > 0.8)) finish();
      return true;
    }, 0.1);

    function resolveFlight(f: Flight): void {
      f.resolved = true;
      const last = f.path[f.path.length - 1] ?? f.landing;
      const prev = f.path[f.path.length - 2] ?? last;
      stuck.push({
        sx: f.landing.sx,
        sy: f.landing.sy,
        s: f.landing.s,
        angle: Math.atan2(last.sy - prev.sy, last.sx - prev.sx),
        dust: f.hit ? 0 : 0.6,
        target: f.hit,
      });
      if (f.hit) {
        f.hit.wobble = 1;
        const good = f.award > 0;
        audio.arrowHit(good);
        if (good) {
          score += f.award;
          popups.push({ sx: f.landing.sx, sy: f.landing.sy - 14, text: `+${f.award}`, age: 0, colour: '#ffd97a' });
        } else {
          popups.push({ sx: f.landing.sx, sy: f.landing.sy - 14, text: 'wasted', age: 0, colour: '#e05252' });
        }
      } else {
        audio.arrowHit(false);
        popups.push({ sx: f.landing.sx, sy: f.landing.sy - 10, text: 'miss', age: 0, colour: '#cfd2da' });
      }
      host.setStatus(`${f.text} ${arrows > 0 ? `${arrows} arrow${arrows === 1 ? '' : 's'} left.` : 'That was your last arrow.'}`);
      // Keep the arrow on screen a moment before the next one can be drawn.
      window.setTimeout(() => {
        if (flight === f) flight = null;
      }, 350);
    }

    function finish(): void {
      finished = true;
      const passed = score >= cfg.passScore;
      resolve({
        passed,
        score: passed ? clamp(Math.round((score / (cfg.passScore * 1.5)) * 100), 55, 100) : 40,
        stats: [`Score ${score} (needed ${cfg.passScore})`, `Scoring hits ${hits} of ${cfg.arrows}`, ...(wasted > 0 ? [`${wasted} wasted on the wrong target`] : [])],
      });
    }

    // -------------------------------------------------------------- rendering

    function render(): void {
      drawBackdrop();
      drawTargets();
      drawStuck();
      drawFlight();
      drawBow();
      drawHud();
    }

    function drawBackdrop(): void {
      const sky = ctx.createLinearGradient(0, 0, 0, HORIZON);
      sky.addColorStop(0, '#7fb6e0');
      sky.addColorStop(1, '#f7e5b6');
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, W, HORIZON);
      // Sun and far hills.
      ctx.fillStyle = 'rgba(255,244,205,0.9)';
      ctx.beginPath();
      ctx.arc(W * 0.8, 84, 30, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#9db79a';
      ctx.beginPath();
      ctx.moveTo(0, HORIZON);
      for (let x = 0; x <= W; x += 40) ctx.lineTo(x, HORIZON - 22 - Math.sin(x * 0.011) * 14 - Math.sin(x * 0.027) * 8);
      ctx.lineTo(W, HORIZON);
      ctx.fill();

      const ground = ctx.createLinearGradient(0, HORIZON, 0, H);
      ground.addColorStop(0, '#9bb566');
      ground.addColorStop(1, '#5c7a3d');
      ctx.fillStyle = ground;
      ctx.fillRect(0, HORIZON, W, H - HORIZON);
      // Mown lanes converging on the vanishing point, and range lines every ten metres.
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 2;
      for (let i = -8; i <= 8; i++) {
        ctx.beginPath();
        ctx.moveTo(CX + i * 11, HORIZON);
        ctx.lineTo(CX + i * 190, H);
        ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 1;
      let lastLabelY = Infinity;
      for (const Z of [10, 20, 30, 40, 50]) {
        const y = HORIZON + (EYE * FOCAL) / Z;
        if (y > H) continue;
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
        // Label a range line only if there is room for it: the far ones crowd together at the horizon.
        if (lastLabelY - y >= 13) {
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          ctx.font = '600 10px Mukta, sans-serif';
          ctx.fillText(`${Z} m`, 8, y - 3);
          lastLabelY = y;
        }
      }
    }

    function drawTargets(): void {
      // A tree for the called shot, so the bird has somewhere to sit.
      if (called) {
        const trunk = project(0, 0, -32);
        const top = project(0, 11.5, -32);
        ctx.strokeStyle = '#5a3e22';
        ctx.lineWidth = Math.max(6, top.s * 0.5);
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(trunk.sx, trunk.sy);
        ctx.lineTo(top.sx, top.sy);
        ctx.stroke();
        ctx.lineCap = 'butt';
      }

      // Far to near, so near targets overlap far ones.
      // In the called shot the eye is drawn last, so the bird's body does not cover it.
      const order = [...targets].sort((a, b) => a.z - b.z || Number(called !== null && a.label.toLowerCase().includes(called)) - Number(called !== null && b.label.toLowerCase().includes(called)));
      for (const t of order) {
        const x = targetX(t);
        const p = project(x, t.y, t.z);
        const r = t.radius * p.s * (1 + t.wobble * 0.12 * Math.sin(t.wobble * 18));

        if (!called) {
          // Post.
          const foot = project(x, 0, t.z);
          ctx.strokeStyle = '#5a3e22';
          ctx.lineWidth = Math.max(3, p.s * 0.12);
          ctx.beginPath();
          ctx.moveTo(foot.sx, foot.sy);
          ctx.lineTo(p.sx, p.sy + r * 0.8);
          ctx.stroke();
        }
        drawTargetShape(t, p.sx, p.sy, r);

        if (t.label && !called) {
          ctx.fillStyle = 'rgba(20,12,6,0.72)';
          ctx.font = '700 11px Mukta, sans-serif';
          ctx.textAlign = 'center';
          const text = `${t.label} · ${t.points}`;
          const w = ctx.measureText(text).width + 12;
          ctx.fillRect(p.sx - w / 2, p.sy + r + 6, w, 16);
          ctx.fillStyle = '#f3e7cf';
          ctx.fillText(text, p.sx, p.sy + r + 18);
          ctx.textAlign = 'start';
        }
      }
    }

    function drawTargetShape(t: Target, x: number, y: number, r: number): void {
      const name = t.label.toLowerCase();
      if (called) {
        if (name.includes('eye')) {
          ctx.fillStyle = '#e8b44b';
          ctx.beginPath();
          ctx.arc(x, y, r * 1.05, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#3a2a10';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#1b1208';
          ctx.beginPath();
          ctx.arc(x, y, r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (name.includes('body')) {
          ctx.fillStyle = '#6b4a2c';
          ctx.beginPath();
          ctx.ellipse(x, y, r * 1.5, r * 1.05, -0.2, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#2f2010';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = '#d9962f';
          ctx.beginPath();
          ctx.moveTo(x + r * 1.35, y - r * 0.5);
          ctx.lineTo(x + r * 2.1, y - r * 0.2);
          ctx.lineTo(x + r * 1.4, y + r * 0.1);
          ctx.fill();
        } else if (name.includes('branch')) {
          ctx.strokeStyle = '#5a3e22';
          ctx.lineWidth = Math.max(4, r * 0.8);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(x - r * 1.4, y + r * 0.5);
          ctx.lineTo(x + r * 1.4, y - r * 0.5);
          ctx.stroke();
          ctx.lineCap = 'butt';
        } else {
          ctx.fillStyle = 'rgba(70,120,60,0.9)';
          for (const [dx, dy, k] of [[-0.6, 0.2, 0.8], [0.5, -0.3, 0.9], [0, 0.6, 0.7], [0.1, -0.7, 0.6]] as const) {
            ctx.beginPath();
            ctx.ellipse(x + dx * r, y + dy * r, r * k, r * k * 0.7, 0.3, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        return;
      }
      // Concentric rings: the centre third is the full-points zone.
      const rings = ['#3a2a18', '#f3e7cf', '#c9382a', '#f3e7cf', '#e8b44b'];
      rings.forEach((c, i) => {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, y, r * (1 - i * 0.2), 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.strokeStyle = 'rgba(20,10,4,0.7)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    function drawArrow(x: number, y: number, angle: number, size: number, alpha = 1): void {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(x, y);
      ctx.rotate(angle);
      const len = Math.max(14, size);
      ctx.strokeStyle = '#d8c294';
      ctx.lineWidth = Math.max(1.5, len * 0.07);
      ctx.beginPath();
      ctx.moveTo(-len, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.fillStyle = '#9aa0a8';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-len * 0.16, -len * 0.07);
      ctx.lineTo(-len * 0.16, len * 0.07);
      ctx.fill();
      ctx.fillStyle = '#c9382a';
      ctx.fillRect(-len, -len * 0.06, len * 0.16, len * 0.12);
      ctx.restore();
    }

    function drawStuck(): void {
      for (const s of stuck) {
        // Arrows that hit a target are drawn in the target's frame so a moving one carries them along.
        let x = s.sx;
        if (s.target && s.target.moving) {
          const p = project(targetX(s.target), s.target.y, s.target.z);
          const orig = project(base.get(s.target) as number, s.target.y, s.target.z);
          x = s.sx + (p.sx - orig.sx);
        }
        drawArrow(x, s.sy, s.angle, Math.min(44, 10 + s.s * 2.2));
        if (s.dust > 0) {
          ctx.fillStyle = `rgba(200,180,140,${s.dust})`;
          ctx.beginPath();
          ctx.arc(x, s.sy, 3 + (0.6 - s.dust) * 24, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function drawFlight(): void {
      if (!flight || flight.resolved) return;
      const u = clamp(flight.t / flight.duration, 0, 1);
      const idx = u * (flight.path.length - 1);
      const i = Math.floor(idx);
      const a = flight.path[i] as Flight['path'][number];
      const b = (flight.path[Math.min(i + 1, flight.path.length - 1)] ?? a) as Flight['path'][number];
      const f = idx - i;
      const x = a.sx + (b.sx - a.sx) * f;
      const y = a.sy + (b.sy - a.sy) * f;
      const angle = Math.atan2(b.sy - a.sy, b.sx - a.sx);
      // A faint trail along the arc so the player can read the drop.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let k = 0; k <= i; k++) {
        const p = flight.path[k] as Flight['path'][number];
        if (k === 0) ctx.moveTo(p.sx, p.sy);
        else ctx.lineTo(p.sx, p.sy);
      }
      ctx.stroke();
      const size = 14 + (a.s + (b.s - a.s) * f) * 1.6;
      drawArrow(x, y, Number.isFinite(angle) ? angle : -Math.PI / 2, Math.min(60, size));
    }

    function drawBow(): void {
      if (flight && !flight.resolved) return;
      const s = sway();
      const tx = aimX + s.x;
      const ty = aimY + s.y;
      const bowX = CX;
      const bowY = H - 18;
      const angle = Math.atan2(ty - bowY, tx - bowX);
      const power = drawing ? clamp(drawTime / FULL_DRAW_SECONDS, 0, 1) : 0;

      ctx.save();
      ctx.translate(bowX, bowY);
      ctx.rotate(angle + Math.PI / 2);
      // Limbs flex forward as the string comes back.
      const bend = 26 + power * 16;
      ctx.strokeStyle = '#4a2f18';
      ctx.lineWidth = 6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-74, 6);
      ctx.quadraticCurveTo(0, -bend * 2, 74, 6);
      ctx.stroke();
      // String and nocked arrow.
      const pull = power * 40 + 4;
      ctx.strokeStyle = 'rgba(245,236,214,0.9)';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(-74, 6);
      ctx.lineTo(0, pull);
      ctx.lineTo(74, 6);
      ctx.stroke();
      ctx.strokeStyle = '#d8c294';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, pull);
      ctx.lineTo(0, -70);
      ctx.stroke();
      ctx.fillStyle = '#9aa0a8';
      ctx.beginPath();
      ctx.moveTo(0, -84);
      ctx.lineTo(-4.5, -68);
      ctx.lineTo(4.5, -68);
      ctx.fill();
      ctx.lineCap = 'butt';
      ctx.restore();
    }

    function drawHud(): void {
      // Crosshair, with the sway shown: that is what the player is steadying.
      const s = sway();
      const cx = aimX + s.x;
      const cy = aimY + s.y;
      const power = drawing ? clamp(drawTime / FULL_DRAW_SECONDS, 0, 1) : 0;
      ctx.strokeStyle = power >= 1 ? '#76bb5a' : 'rgba(255,255,255,0.92)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 11 - power * 3, 0, Math.PI * 2);
      ctx.moveTo(cx - 19, cy);
      ctx.lineTo(cx - 6, cy);
      ctx.moveTo(cx + 6, cy);
      ctx.lineTo(cx + 19, cy);
      ctx.moveTo(cx, cy - 19);
      ctx.lineTo(cx, cy - 6);
      ctx.moveTo(cx, cy + 6);
      ctx.lineTo(cx, cy + 19);
      ctx.stroke();

      // Score plate.
      plate(14, 14, 168, 40);
      ctx.fillStyle = '#f3e7cf';
      ctx.font = '700 12px Mukta, sans-serif';
      ctx.fillText('SCORE', 26, 31);
      ctx.fillStyle = '#ffd97a';
      ctx.font = '700 22px Cinzel, serif';
      ctx.fillText(`${score}`, 26, 49);
      ctx.fillStyle = '#cdbfa5';
      ctx.font = '600 12px Mukta, sans-serif';
      ctx.fillText(`needed ${cfg.passScore}`, 84, 49);

      // Quiver: one arrow per remaining shot.
      plate(W - 14 - (cfg.arrows * 14 + 24), 14, cfg.arrows * 14 + 24, 40);
      for (let i = 0; i < cfg.arrows; i++) {
        const used = i >= arrows;
        ctx.strokeStyle = used ? 'rgba(255,255,255,0.18)' : '#d8c294';
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.moveTo(W - 14 - cfg.arrows * 14 - 10 + i * 14 + 12, 22);
        ctx.lineTo(W - 14 - cfg.arrows * 14 - 10 + i * 14 + 12, 46);
        ctx.stroke();
      }

      // Wind pennant.
      const wx = CX;
      plate(wx - 66, 14, 132, 40);
      ctx.fillStyle = '#cdbfa5';
      ctx.font = '600 11px Mukta, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('WIND', wx, 29);
      const strength = clamp(Math.abs(wind) / 1.6, 0, 1);
      const dir = wind >= 0 ? 1 : -1;
      const flap = Math.sin(clock * (6 + strength * 8)) * 2.5 * strength;
      ctx.strokeStyle = '#ffd97a';
      ctx.fillStyle = '#ffd97a';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(wx - dir * 24, 46);
      ctx.lineTo(wx + dir * (6 + strength * 24), 42 + flap);
      ctx.stroke();
      ctx.beginPath();
      const tipX = wx + dir * (14 + strength * 26);
      ctx.moveTo(tipX, 42 + flap);
      ctx.lineTo(tipX - dir * 8, 37 + flap);
      ctx.lineTo(tipX - dir * 8, 47 + flap);
      ctx.fill();
      ctx.textAlign = 'start';

      // Draw and breath meters.
      meter(14, H - 30, 150, 12, power, power >= 1 ? '#76bb5a' : '#e8b44b', 'DRAW');
      meter(W - 164, H - 30, 150, 12, breath, holding ? '#7fb6e0' : '#9aa0ab', 'BREATH (Shift)');

      // Popups float up.
      for (const p of popups) {
        const a = clamp(1 - p.age / 1.4, 0, 1);
        ctx.globalAlpha = a;
        ctx.fillStyle = p.colour;
        ctx.font = '800 20px Cinzel, serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.text, p.sx, p.sy - easeOutCubic(Math.min(1, p.age)) * 30);
        ctx.textAlign = 'start';
        ctx.globalAlpha = 1;
      }
    }

    function plate(x: number, y: number, w: number, h: number): void {
      ctx.fillStyle = 'rgba(18,14,24,0.7)';
      ctx.strokeStyle = 'rgba(232,180,75,0.4)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, 8);
      ctx.fill();
      ctx.stroke();
    }

    function meter(x: number, y: number, w: number, h: number, value: number, colour: string, label: string): void {
      ctx.fillStyle = 'rgba(18,14,24,0.7)';
      ctx.beginPath();
      ctx.roundRect(x - 4, y - 16, w + 8, h + 22, 6);
      ctx.fill();
      ctx.fillStyle = '#cdbfa5';
      ctx.font = '700 9px Mukta, sans-serif';
      ctx.fillText(label, x, y - 5);
      ctx.fillStyle = 'rgba(255,255,255,0.1)';
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = colour;
      ctx.fillRect(x, y, w * value, h);
    }
  });
}
