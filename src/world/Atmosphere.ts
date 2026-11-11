import * as THREE from 'three';
import { Rng } from '../core/Rng';

/**
 * Ambient motes: dust, pollen and, toward evening, fireflies.
 *
 * A few hundred soft points drift in a volume around the camera. They are
 * recycled as the camera moves, so the air is always populated without ever
 * simulating anything far away, and they cost one draw call. At a glance they
 * are depth — the world has air in it — and they pick up the colour of each
 * region's sun, so the dust in Hampi is amber and the haze over the Sindhu is
 * pale.
 */

const COUNT = 380;
const RADIUS = 46;
const HEIGHT = 20;

function softSprite(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d') as CanvasRenderingContext2D;
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.35, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Atmosphere {
  readonly points: THREE.Points;
  private readonly positions: Float32Array;
  private readonly phase: Float32Array;
  private readonly speed: Float32Array;
  private readonly material: THREE.PointsMaterial;
  private readonly rng = new Rng('atmosphere');
  private wind = new THREE.Vector3(0.6, 0.05, 0.25);

  constructor() {
    this.positions = new Float32Array(COUNT * 3);
    this.phase = new Float32Array(COUNT);
    this.speed = new Float32Array(COUNT);
    for (let i = 0; i < COUNT; i++) {
      this.positions[i * 3] = this.rng.range(-RADIUS, RADIUS);
      this.positions[i * 3 + 1] = this.rng.range(0.4, HEIGHT);
      this.positions[i * 3 + 2] = this.rng.range(-RADIUS, RADIUS);
      this.phase[i] = this.rng.range(0, Math.PI * 2);
      this.speed[i] = this.rng.range(0.5, 1.4);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.positions, 3));
    this.material = new THREE.PointsMaterial({
      size: 0.34,
      map: softSprite(),
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
      color: 0xfff1c9,
      fog: true,
    });
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.points.name = 'atmosphere';
    this.points.renderOrder = 5;
  }

  /**
   * Drift the motes, wrapping them around `focus`. `tint` is the region's sun
   * colour and `warmth` (0–1) is how low the sun is: low sun, more glow.
   */
  update(dt: number, elapsed: number, focus: THREE.Vector3, tint: THREE.Color, warmth: number): void {
    const p = this.positions;
    for (let i = 0; i < COUNT; i++) {
      const ix = i * 3;
      const t = elapsed * this.speed[i]! + this.phase[i]!;
      p[ix] = p[ix]! + (this.wind.x * this.speed[i]! + Math.sin(t * 0.7) * 0.35) * dt;
      p[ix + 1] = p[ix + 1]! + (Math.sin(t * 0.9) * 0.28 + this.wind.y) * dt;
      p[ix + 2] = p[ix + 2]! + (this.wind.z * this.speed[i]! + Math.cos(t * 0.6) * 0.3) * dt;

      // Wrap around the camera so the cloud follows it.
      for (const axis of [0, 2] as const) {
        const rel = p[ix + axis]! - (axis === 0 ? focus.x : focus.z);
        if (rel > RADIUS) p[ix + axis] = p[ix + axis]! - RADIUS * 2;
        else if (rel < -RADIUS) p[ix + axis] = p[ix + axis]! + RADIUS * 2;
      }
      const floor = focus.y - 1.5;
      if (p[ix + 1]! > floor + HEIGHT) p[ix + 1] = floor + 0.4;
      else if (p[ix + 1]! < floor) p[ix + 1] = floor + HEIGHT - 0.4;
    }
    (this.points.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true;

    this.material.color.copy(tint).lerp(new THREE.Color(0xffffff), 0.35);
    this.material.opacity = 0.32 + warmth * 0.4;
    this.material.size = 0.3 + warmth * 0.14;
  }

  dispose(): void {
    this.points.geometry.dispose();
    this.material.map?.dispose();
    this.material.dispose();
  }
}
