// Needs Playwright (npm i -D playwright) and a running game: `npm run dev`, or URL=... for another address.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(process.env.URL || 'http://127.0.0.1:5173/'); await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.click('#btn-play'); await page.waitForTimeout(1200);
const rows = await page.evaluate(() => {
  const g = window.game; g.running = false; const w = g.world; const boxes = w.collision.boxes;
  const inside = (b, x, z) => { if (b.circle) return Math.hypot(x - b.circle.cx, z - b.circle.cz) <= b.circle.r; const o = b.obb; if (!o) return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ; const ox = x - o.cx, oz = z - o.cz; const qx = ox * o.c - oz * o.s, qz = ox * o.s + oz * o.c; return Math.abs(qx) <= o.hx && Math.abs(qz) <= o.hz; };
  return w.stairs.map((st) => {
    const { top, beyond } = st;
    const th = w.terrain.heightAt(beyond.x, beyond.z);
    const here = boxes.filter((b) => inside(b, beyond.x, beyond.z));
    // standable surfaces just beyond the top step
    const cands = [th, ...here.map((b) => b.maxY)].filter((y) => !here.some((b) => b.minY < y + 1.75 && b.maxY > y + 0.08));
    const best = cands.reduce((a, y) => (Math.abs(y - top.y) < Math.abs(a - top.y) ? y : a), -1e9);
    const walled = here.some((b) => b.maxY > top.y + 0.7 && b.minY < top.y + 1.7);
    const rise = top.y - w.terrain.heightAt(top.x, top.z);
    return { id: st.landmarkId, rise: +rise.toFixed(1), floorDelta: +(best - top.y).toFixed(2), walled };
  });
});
let bad = 0;
for (const r of rows) { const ok = !r.walled && r.floorDelta <= 0.7 && r.floorDelta >= -0.7; if (!ok) bad++; console.log(`${ok ? 'ok  ' : 'BAD '} ${r.id.padEnd(22)} climbs ${String(r.rise).padStart(5)} m | floor beyond top is ${r.floorDelta > 0 ? '+' : ''}${r.floorDelta} m${r.walled ? ' | WALL in the way' : ''}`); }
console.log(`${rows.length} staircases, ${bad} do not connect`);
console.log(errors.join('\n') || 'no errors'); await browser.close();
