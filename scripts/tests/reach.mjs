// Needs Playwright (npm i -D playwright) and a running game: `npm run dev`, or URL=... for another address.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(process.env.URL || 'http://127.0.0.1:5173/'); await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.click('#btn-play'); await page.waitForTimeout(1200);
const zones = await page.evaluate(() => [...new Set(window.game.world.interactables.map((i) => i.zoneId))]);
const all = [];
for (const zoneId of zones) {
  const rows = await page.evaluate((zoneId) => {
    const g = window.game; g.running = false; const w = g.world; const boxes = w.collision.boxes; const T = w.terrain;
    const its = w.interactables.filter((i) => i.zoneId === zoneId); const pad = its.find((i) => i.kind === 'pad');
    // The creative side: hidden letters (floating 1.35 m above where you stand) and the musical pillars.
    for (const a of g.aksharas.positions().filter((a) => a.zoneId === zoneId)) its.push({ id: a.id, kind: 'akshara', zoneId, position: { x: a.position.x, y: a.position.y - 1.35, z: a.position.z } });
    if (zoneId === 'hampi') for (const p of g.pillars.pillars) its.push({ id: `pillar-${p.index}`, kind: 'pillar', zoneId, position: { x: p.world.x, y: p.world.y - 1.4, z: p.world.z } });
    const CELL = 0.8, H = 1.75, SEA = -36;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const i of its) { x0 = Math.min(x0, i.position.x); x1 = Math.max(x1, i.position.x); z0 = Math.min(z0, i.position.z); z1 = Math.max(z1, i.position.z); }
    for (const l of w.landmarks.filter((l) => l.zoneId === zoneId)) { x0 = Math.min(x0, l.position.x - l.radius); x1 = Math.max(x1, l.position.x + l.radius); z0 = Math.min(z0, l.position.z - l.radius); z1 = Math.max(z1, l.position.z + l.radius); }
    x0 -= 30; z0 -= 30; x1 += 30; z1 += 30;
    const nx = Math.ceil((x1 - x0) / CELL), nz = Math.ceil((z1 - z0) / CELL);
    const inside = (b, x, z) => { if (b.circle) return Math.hypot(x - b.circle.cx, z - b.circle.cz) <= b.circle.r; const o = b.obb; if (!o) return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ; const ox = x - o.cx, oz = z - o.cz; const qx = ox * o.c - oz * o.s, qz = ox * o.s + oz * o.c; return Math.abs(qx) <= o.hx && Math.abs(qz) <= o.hz; };
    // bucket boxes by coarse cell for speed
    const BK = 16; const buckets = new Map();
    for (const b of boxes) { if (b.maxX < x0 || b.minX > x1 || b.maxZ < z0 || b.minZ > z1) continue; for (let i = Math.floor(b.minX / BK); i <= Math.floor(b.maxX / BK); i++) for (let j = Math.floor(b.minZ / BK); j <= Math.floor(b.maxZ / BK); j++) { const k = i * 100003 + j; let a = buckets.get(k); if (!a) buckets.set(k, a = []); a.push(b); } }
    const surf = new Array(nx * nz);
    for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * CELL, z = z0 + (j + 0.5) * CELL; const th = T.heightAt(x, z);
      const here = (buckets.get(Math.floor(x / BK) * 100003 + Math.floor(z / BK)) || []).filter((b) => inside(b, x, z));
      const ok = [];
      for (const y of [th, ...here.map((b) => b.maxY).filter((y) => y > th + 0.05)]) { if (y < SEA - 1.2) continue; if (here.some((b) => b.minY < y + H && b.maxY > y + 0.08)) continue; if (!ok.some((o) => Math.abs(o - y) < 0.05)) ok.push(y); }
      surf[j * nx + i] = ok;
    }
    const cellOf = (p) => [Math.floor((p.x - x0) / CELL), Math.floor((p.z - z0) / CELL)];
    const run = (REACH) => {
      const best = new Map(); const q = []; // key -> true
      const key = (i, j, s) => (j * nx + i) * 8 + s;
      const [pi, pj] = cellOf(pad.position);
      // start on every surface near the pad
      for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const a = pi + di, b = pj + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; surf[b * nx + a].forEach((y, s) => { best.set(key(a, b, s), 1); q.push([a, b, s]); }); }
      while (q.length) { const [i, j, s] = q.pop(); const y = surf[j * nx + i][s]; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const list = surf[b * nx + a]; for (let t = 0; t < list.length && t < 8; t++) { if (list[t] - y > REACH) continue; const k = key(a, b, t); if (best.has(k)) continue; best.set(k, 1); q.push([a, b, t]); } } }
      return (it) => { // can we stand within 2.4 m of it, at about its height?
        const [ci, cj] = cellOf(it.position);
        for (let dj = -3; dj <= 3; dj++) for (let di = -3; di <= 3; di++) { const a = ci + di, b = cj + dj; if (a < 0 || b < 0 || a >= nx || b >= nz) continue; const list = surf[b * nx + a]; for (let t = 0; t < list.length && t < 8; t++) if (Math.abs(list[t] - it.position.y) < 2.2 && best.has(key(a, b, t))) return true; }
        return false;
      };
    };
    const walk = run(0.68), hop = run(1.12), climb = run(9.5);
    return its.filter((i) => i.kind !== 'pad').map((i) => ({ id: i.id, kind: i.kind, walk: walk(i), hop: hop(i), climb: climb(i), up: +(i.position.y - T.heightAt(i.position.x, i.position.z)).toFixed(1) }));
  }, zoneId);
  all.push(...rows.map((r) => ({ zoneId, ...r })));
}
const n = all.length;
console.log(`${n} people, challenges, plaques, hidden letters and musical pillars`);
console.log(`  reachable on foot (steps only): ${all.filter((r) => r.walk).length}`);
console.log(`  + with the automatic hop:       ${all.filter((r) => r.hop).length}`);
console.log(`  + with climbing:                ${all.filter((r) => r.climb).length}`);
const needClimb = all.filter((r) => !r.hop && r.climb), never = all.filter((r) => !r.climb);
console.log('need a climb:', JSON.stringify(needClimb.map((r) => `${r.id} (+${r.up} m)`)));
console.log('NOT reachable:', JSON.stringify(never.map((r) => `${r.id} (+${r.up} m)`)));
console.log('standing above ground level:', JSON.stringify(all.filter((r) => r.up > 0.5).map((r) => `${r.id} +${r.up}`)));
console.log(errors.join('\n') || 'no errors'); await browser.close();
