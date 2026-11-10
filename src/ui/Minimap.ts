import type { Terrain } from '../world/Terrain';
import { WORLD_SIZE, WORLD_HALF, SEA_LEVEL } from '../world/Terrain';
import { ZONES } from '../content/zones';
import { mixColor, shade } from '../world/Materials';

/**
 * The corner map.
 *
 * The island is rendered once into an offscreen canvas at load — coastline,
 * biome colour and hill shading — and every frame we blit the piece of it under
 * the player and stamp the markers on top. Redrawing the terrain each frame
 * would be the obvious approach and would cost more than the 3D scene does.
 *
 * North is always up. A rotating map is more immersive and worse for learning
 * where things actually are, and this is a game about where things are.
 */

export type MarkerKind = 'landmark' | 'challenge' | 'npc' | 'chariot' | 'pad' | 'player';

export interface MinimapMarker {
  x: number;
  z: number;
  kind: MarkerKind;
  label?: string;
  /** Challenges that are done, landmarks already scanned. */
  done?: boolean;
  /** Dim markers for things not yet discovered. */
  dim?: boolean;
  /** Facing, for the chariot wedge. */
  yaw?: number;
}

const BASE_RES = 768;
const ZOOM_LEVELS = [180, 300, 480, 820];
const DEFAULT_ZOOM = 1;

const COLORS: Record<MarkerKind, string> = {
  landmark: '#ffd97a',
  challenge: '#ff9a52',
  npc: '#7fd4c8',
  chariot: '#e8713a',
  pad: '#9fb6ff',
  player: '#ffffff',
};

export class Minimap {
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly base: HTMLCanvasElement;
  private readonly labelHost: HTMLElement;

  private statics: MinimapMarker[] = [];
  private zoomIndex = DEFAULT_ZOOM;
  private size = 190;
  private dpr = 1;

  constructor(terrain: Terrain, container: HTMLElement) {
    this.canvas = container.querySelector('canvas') as HTMLCanvasElement;
    if (!this.canvas) throw new Error('[Minimap] container has no <canvas>');
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('[Minimap] 2D context unavailable');
    this.ctx = ctx;
    this.labelHost = container.querySelector('.mm-labels') as HTMLElement;

    this.base = renderIsland(terrain);
    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private resize(): void {
    this.size = this.canvas.clientWidth || 190;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.size * this.dpr);
    this.canvas.height = Math.round(this.size * this.dpr);
  }

  /** The whole island, rendered once, for the full map. */
  island(): HTMLCanvasElement {
    return this.base;
  }

  /** Markers that do not move: monuments, challenge posts, NPCs, terraces. */
  setStaticMarkers(markers: MinimapMarker[]): void {
    this.statics = markers;
  }

  /** Mouse wheel changes how much of the island you can see. */
  adjustZoom(delta: number): string {
    this.zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, this.zoomIndex + delta));
    return `${ZOOM_LEVELS[this.zoomIndex]} m`;
  }

  get range(): number {
    return ZOOM_LEVELS[this.zoomIndex] as number;
  }

  /**
   * @param px,pz   player world position
   * @param yaw     player heading, for the arrow
   * @param dynamic markers that move — chariots, and anything else later
   */
  update(px: number, pz: number, yaw: number, dynamic: MinimapMarker[] = []): void {
    const ctx = this.ctx;
    const size = this.size;
    const r = size / 2;
    const range = this.range;
    // Pixels per world unit.
    const scale = r / range;

    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, size, size);

    // Circular viewport.
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.clip();

    // Sea underneath, so anything off the island edge still reads as water.
    ctx.fillStyle = '#12303c';
    ctx.fillRect(0, 0, size, size);

    // Blit the island. Base canvas covers the whole world.
    const basePerUnit = BASE_RES / WORLD_SIZE;
    const srcSize = range * 2 * basePerUnit;
    const srcX = (px + WORLD_HALF) * basePerUnit - srcSize / 2;
    const srcY = (pz + WORLD_HALF) * basePerUnit - srcSize / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(this.base, srcX, srcY, srcSize, srcSize, 0, 0, size, size);

    // Zone names, so the map teaches geography rather than just position.
    ctx.textAlign = 'center';
    ctx.font = '600 8px Mukta, sans-serif';
    for (const zone of ZONES) {
      const zx = r + (zone.center[0] - px) * scale;
      const zy = r + (zone.center[1] - pz) * scale;
      if (zx < -40 || zx > size + 40 || zy < -20 || zy > size + 20) continue;
      ctx.fillStyle = 'rgba(255, 240, 210, 0.62)';
      ctx.fillText(zone.name.toUpperCase(), zx, zy);
    }

    // Markers.
    const all = [...this.statics, ...dynamic];
    for (const m of all) {
      const mx = r + (m.x - px) * scale;
      const my = r + (m.z - pz) * scale;
      if (mx < -8 || mx > size + 8 || my < -8 || my > size + 8) continue;
      this.drawMarker(ctx, mx, my, m);
    }

    // The player, last so nothing covers it.
    ctx.save();
    ctx.translate(r, r);
    // yaw 0 faces -Z, which is up on this map.
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -6.5);
    ctx.lineTo(4.6, 5);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-4.6, 5);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.lineWidth = 1.2;
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    ctx.restore();

    // Rim and the north mark live outside the clip.
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(232, 180, 75, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    if (this.labelHost) {
      this.labelHost.textContent = `${Math.round(px)}, ${Math.round(pz)} · ${range} m`;
    }
  }

  private drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, m: MinimapMarker): void {
    const color = COLORS[m.kind];
    ctx.globalAlpha = m.dim ? 0.42 : 1;
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 1;

    switch (m.kind) {
      case 'landmark': {
        // Diamond; filled once scanned.
        ctx.beginPath();
        ctx.moveTo(x, y - 4);
        ctx.lineTo(x + 4, y);
        ctx.lineTo(x, y + 4);
        ctx.lineTo(x - 4, y);
        ctx.closePath();
        if (m.done) {
          ctx.fillStyle = color;
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(20,18,28,0.75)';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.stroke();
        }
        break;
      }
      case 'challenge': {
        ctx.beginPath();
        ctx.arc(x, y, 3.4, 0, Math.PI * 2);
        if (m.done) {
          ctx.fillStyle = '#76bb5a';
          ctx.fill();
        } else {
          ctx.fillStyle = 'rgba(20,18,28,0.8)';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1.6;
          ctx.stroke();
        }
        break;
      }
      case 'npc': {
        ctx.beginPath();
        ctx.arc(x, y, 2.1, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        break;
      }
      case 'chariot': {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(-(m.yaw ?? 0));
        ctx.beginPath();
        ctx.moveTo(0, -4.4);
        ctx.lineTo(3.2, 3.4);
        ctx.lineTo(-3.2, 3.4);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
        ctx.restore();
        break;
      }
      case 'pad': {
        ctx.beginPath();
        ctx.rect(x - 3.2, y - 3.2, 6.4, 6.4);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.stroke();
        break;
      }
      default:
        break;
    }
    ctx.globalAlpha = 1;
  }
}

/**
 * Draw the whole island once: water depth, beaches, biome colour, hill shading.
 * Costs a few hundred milliseconds at load and nothing afterwards.
 */
export function renderIsland(terrain: Terrain): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = BASE_RES;
  canvas.height = BASE_RES;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  const image = ctx.createImageData(BASE_RES, BASE_RES);
  const data = image.data;
  const unitsPerPixel = WORLD_SIZE / BASE_RES;

  // Nearest-zone lookup, computed per pixel but only against 11 centres.
  for (let py = 0; py < BASE_RES; py++) {
    const wz = -WORLD_HALF + (py + 0.5) * unitsPerPixel;
    for (let pxi = 0; pxi < BASE_RES; pxi++) {
      const wx = -WORLD_HALF + (pxi + 0.5) * unitsPerPixel;
      const h = terrain.heightAt(wx, wz);
      const i = (py * BASE_RES + pxi) * 4;

      let color: number;
      if (h < SEA_LEVEL - 0.2) {
        // Water, darker with depth.
        const depth = Math.min(1, (SEA_LEVEL - h) / 28);
        color = mixColor(0x4e8fa0, 0x0f2730, depth);
      } else if (h < SEA_LEVEL + 2.2) {
        color = 0xd9c79a; // beach
      } else {
        const zone = nearestZonePalette(wx, wz);
        color = mixColor(zone.ground, zone.foliage, 0.45);
        // Hill shading from a north-west light, so relief reads at a glance.
        const dx = terrain.heightAt(wx + unitsPerPixel, wz) - h;
        const dz = terrain.heightAt(wx, wz + unitsPerPixel) - h;
        const slope = (dx + dz) / unitsPerPixel;
        color = shade(color, Math.max(0.55, Math.min(1.45, 1 - slope * 1.6)));
      }

      data[i] = (color >> 16) & 0xff;
      data[i + 1] = (color >> 8) & 0xff;
      data[i + 2] = color & 0xff;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas;
}

function nearestZonePalette(x: number, z: number): { ground: number; foliage: number } {
  let best = ZONES[0]!;
  let bestD = Infinity;
  for (const zone of ZONES) {
    const dx = x - zone.center[0];
    const dz = z - zone.center[1];
    const d = dx * dx + dz * dz;
    if (d < bestD) {
      bestD = d;
      best = zone;
    }
  }
  return best.palette;
}
