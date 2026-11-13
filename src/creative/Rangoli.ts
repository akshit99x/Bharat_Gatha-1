import * as THREE from 'three';
import type { World } from '../world/World';

/**
 * Floor art on every landing terrace, made fresh from the region's id so each one is different.
 *
 * Most regions get a rangoli: a mandala of petals, dots and a star in coloured powder with white edges, in
 * eight-, twelve- or sixteen-fold symmetry. The Chola Country gets a kolam instead: white rice-flour lines
 * looping round a grid of dots, as drawn on Tamil doorsteps every morning. Symmetry, counting and closed
 * curves: the mathematics of the floor.
 */

const TEX = 1024;
/** Radius in metres; the terrace's inner disc is about 12.6 m across the top. */
const RADIUS = 9.4;
/** Height of the inner disc's top above the terrace's base. */
const DISC_TOP = 2.0;

const POWDERS = ['#f4a300', '#d7372b', '#f2c230', '#2e8b57', '#3949ab', '#e0608a', '#8e1d5b', '#1e9bb0', '#ff7a1a'];

function rng(seedText: string): () => number {
  let h = 2166136261;
  for (const ch of seedText) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  let s = h >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1_000_000) / 1_000_000;
  };
}

function powderGrain(ctx: CanvasRenderingContext2D, rnd: () => number): void {
  // Powder is never perfectly even: knock tiny flecks out of it.
  ctx.save();
  ctx.globalCompositeOperation = 'destination-out';
  for (let i = 0; i < 9000; i++) {
    ctx.globalAlpha = 0.25 + rnd() * 0.4;
    ctx.fillRect(rnd() * TEX, rnd() * TEX, 1.5, 1.5);
  }
  ctx.restore();
}

export function drawRangoli(seed: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const rnd = rng(seed);
  const pick = (): string => POWDERS[Math.floor(rnd() * POWDERS.length)] as string;
  const cols = [pick(), pick(), pick(), pick(), pick()];
  const n = [8, 12, 16][Math.floor(rnd() * 3)] as number;
  const m = TEX / 2;
  const R = TEX * 0.48;
  ctx.translate(m, m);
  ctx.lineJoin = 'round';
  const white = '#fbf6ea';

  // Outer band of teardrop petals, two per segment.
  for (let i = 0; i < n * 2; i++) {
    ctx.save();
    ctx.rotate((i / (n * 2)) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.72);
    ctx.quadraticCurveTo(R * 0.12, -R * 0.88, 0, -R);
    ctx.quadraticCurveTo(-R * 0.12, -R * 0.88, 0, -R * 0.72);
    ctx.fillStyle = i % 2 ? (cols[0] as string) : (cols[1] as string);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = white;
    ctx.stroke();
    ctx.restore();
  }
  // A ring band.
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.7, 0, Math.PI * 2);
  ctx.lineWidth = R * 0.05;
  ctx.strokeStyle = cols[2] as string;
  ctx.stroke();
  ctx.lineWidth = 4;
  ctx.strokeStyle = white;
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.725, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, 0, R * 0.675, 0, Math.PI * 2);
  ctx.stroke();
  // Dots on the band.
  ctx.fillStyle = white;
  for (let i = 0; i < n * 4; i++) {
    const a = (i / (n * 4)) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 0.62, Math.sin(a) * R * 0.62, R * 0.014, 0, Math.PI * 2);
    ctx.fill();
  }
  // Lotus: n broad petals, outlined, with a vein.
  for (let i = 0; i < n; i++) {
    ctx.save();
    ctx.rotate((i / n) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.2);
    ctx.bezierCurveTo(R * 0.2, -R * 0.3, R * 0.14, -R * 0.52, 0, -R * 0.58);
    ctx.bezierCurveTo(-R * 0.14, -R * 0.52, -R * 0.2, -R * 0.3, 0, -R * 0.2);
    ctx.fillStyle = cols[3] as string;
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = white;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.25);
    ctx.lineTo(0, -R * 0.5);
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.restore();
  }
  // Star.
  ctx.beginPath();
  for (let i = 0; i <= n * 2; i++) {
    const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 ? R * 0.14 : R * 0.26;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = cols[4] as string;
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = white;
  ctx.stroke();
  // Centre: rings and a bindu.
  for (const [r, col] of [
    [0.11, cols[0]],
    [0.075, white],
    [0.05, cols[1]],
    [0.02, white],
  ] as Array<[number, string]>) {
    ctx.beginPath();
    ctx.arc(0, 0, R * r, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  powderGrain(ctx, rnd);
  return c;
}

/** A pulli kolam: a diamond of dots, each ringed, joined by loops, inside a looping border. */
export function drawKolam(seed: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = c.height = TEX;
  const ctx = c.getContext('2d');
  if (!ctx) return c;
  const rnd = rng(seed);
  const m = TEX / 2;
  const rows = 7;
  const gap = TEX * 0.085;
  // Kolam is drawn on ground washed dark with water, so the white flour stands out.
  const wash = ctx.createRadialGradient(m, m, TEX * 0.3, m, m, TEX * 0.5);
  wash.addColorStop(0, 'rgba(58,44,32,0.82)');
  wash.addColorStop(1, 'rgba(58,44,32,0)');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, TEX, TEX);
  ctx.translate(m, m);
  ctx.rotate(Math.PI / 4);
  ctx.strokeStyle = '#fbf8f0';
  ctx.fillStyle = '#fbf8f0';
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 7;
  const half = ((rows - 1) * gap) / 2;
  const dots: Array<[number, number]> = [];
  for (let i = 0; i < rows; i++) for (let j = 0; j < rows; j++) dots.push([i * gap - half, j * gap - half]);
  // Dots.
  for (const [x, y] of dots) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, Math.PI * 2);
    ctx.fill();
  }
  // Each dot wrapped by a rounded square loop that just touches its neighbours: the woven lattice.
  const r = gap * 0.5;
  for (const [x, y] of dots) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.quadraticCurveTo(x + r, y - r, x + r, y);
    ctx.quadraticCurveTo(x + r, y + r, x, y + r);
    ctx.quadraticCurveTo(x - r, y + r, x - r, y);
    ctx.quadraticCurveTo(x - r, y - r, x, y - r);
    ctx.stroke();
  }
  // Petal loops off each edge of the diamond.
  for (let side = 0; side < 4; side++) {
    ctx.save();
    ctx.rotate((side * Math.PI) / 2);
    for (let i = 0; i < rows; i++) {
      const x = i * gap - half;
      const y = -half - r;
      ctx.beginPath();
      ctx.moveTo(x - r * 0.6, y + r * 0.2);
      ctx.bezierCurveTo(x - r * 0.9, y - r * 1.6, x + r * 0.9, y - r * 1.6, x + r * 0.6, y + r * 0.2);
      ctx.stroke();
    }
    ctx.restore();
  }
  // An outer looping border.
  ctx.rotate(-Math.PI / 4);
  const B = TEX * 0.47;
  ctx.beginPath();
  const lobes = 24;
  for (let i = 0; i <= 360; i++) {
    const a = (i / 360) * Math.PI * 2;
    const rr = B * (0.94 + 0.05 * Math.sin(a * lobes));
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  powderGrain(ctx, rnd);
  return c;
}

/** Lay floor art on every landing terrace. */
export function placeRangolis(world: World, scene: THREE.Object3D): THREE.Group {
  const group = new THREE.Group();
  group.name = 'rangoli';
  for (const lm of world.landmarks) {
    if (lm.kind !== 'vimanaPad') continue;
    const art = lm.zoneId === 'chola' ? drawKolam(lm.zoneId) : drawRangoli(lm.zoneId);
    const tex = new THREE.CanvasTexture(art);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      transparent: true,
      roughness: 0.95,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(RADIUS, 64), mat);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(lm.position.x, lm.position.y + DISC_TOP + 0.015, lm.position.z);
    disc.receiveShadow = true;
    disc.renderOrder = 1;
    group.add(disc);
  }
  scene.add(group);
  return group;
}
