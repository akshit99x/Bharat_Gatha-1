// Needs Playwright (npm i -D playwright) and a running game: `npm run dev`, or URL=... for another address.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(process.env.URL || 'http://127.0.0.1:5173/'); await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.click('#btn-play'); await page.waitForTimeout(1200);
const rows = await page.evaluate(() => {
  const g = window.game; g.running = false; const w = g.world; const B = w.collision.boxes; const R = w.colliderRanges;
  // footprint of a box, as a centre and a radius (good enough to find things sitting inside each other)
  const fp = (b) => b.circle ? { x: b.circle.cx, z: b.circle.cz, r: b.circle.r } : b.obb ? { x: b.obb.cx, z: b.obb.cz, r: Math.min(b.obb.hx, b.obb.hz) } : { x: (b.minX + b.maxX) / 2, z: (b.minZ + b.maxZ) / 2, r: Math.min(b.maxX - b.minX, b.maxZ - b.minZ) / 2 };
  const out = [];
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) {
    const a = R[i], c = R[j]; const la = w.landmarks.find((l) => l.id === a.landmarkId), lc = w.landmarks.find((l) => l.id === c.landmarkId);
    if (!la || !lc || la.zoneId !== lc.zoneId) continue;
    if (Math.hypot(la.position.x - lc.position.x, la.position.z - lc.position.z) > la.radius + lc.radius + 10) continue;
    let hits = 0, worst = 0;
    for (let p = a.from; p < a.to; p++) { const bp = B[p]; const fa = fp(bp); if (fa.r < 0.8) continue;
      for (let q = c.from; q < c.to; q++) { const bq = B[q]; if (bq.minY >= bp.maxY || bq.maxY <= bp.minY) continue; const fc = fp(bq); if (fc.r < 0.8) continue;
        const d = Math.hypot(fa.x - fc.x, fa.z - fc.z); const pen = fa.r + fc.r - d; if (pen > 1.0) { hits++; worst = Math.max(worst, pen); } } }
    if (hits > 0) out.push({ a: a.landmarkId, b: c.landmarkId, hits, worst: +worst.toFixed(1) });
  }
  return out.sort((x, y) => y.hits - x.hits);
});
console.log(rows.length, 'pairs of monuments have solid pieces inside each other:');
for (const r of rows) console.log(`  ${r.a.padEnd(22)} x ${r.b.padEnd(22)} ${String(r.hits).padStart(4)} overlaps, deepest ${r.worst} m`);
console.log(errors.join('\n') || 'no errors'); await browser.close();
