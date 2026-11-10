import { Rng } from '../core/Rng';

export const reducedMotion = (): boolean => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export const clamp = (v: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeInOut = (t: number): number => t * t * (3 - 2 * t);
/** Overshoots a little, then settles: the feel of a piece dropping into place. */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};

/** Fisher–Yates with a seeded generator, so a teacher's seed gives every student the same shuffle. */
export function shuffled<T>(items: readonly T[], seed: string): T[] {
  const rng = new Rng(seed);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}

/** Make sure a shuffle is never already solved — a puzzle that starts finished is no puzzle. */
export function shuffledNotSolved<T>(items: readonly T[], seed: string, same: (a: T, b: T) => boolean): T[] {
  for (let n = 0; n < 12; n++) {
    const s = shuffled(items, `${seed}:${n}`);
    if (!s.every((x, i) => same(x, items[i] as T))) return s;
  }
  return [...items].reverse();
}

/** Run a per-frame callback until it returns false or the element leaves the page. */
export function animate(el: Element, step: (dt: number, t: number) => boolean): void {
  let last = performance.now();
  const start = last;
  const frame = (now: number): void => {
    if (!el.isConnected) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (step(dt, (now - start) / 1000)) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** A short-lived burst of particles in a container, for the moment something clicks into place. */
export function sparkle(host: HTMLElement, x: number, y: number, colour = '#ffd97a', count = 10): void {
  if (reducedMotion()) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = 'mg-spark';
    const a = (i / count) * Math.PI * 2 + Math.random() * 0.6;
    const d = 18 + Math.random() * 26;
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = colour;
    p.style.setProperty('--dx', `${Math.cos(a) * d}px`);
    p.style.setProperty('--dy', `${Math.sin(a) * d}px`);
    host.appendChild(p);
    window.setTimeout(() => p.remove(), 700);
  }
}
