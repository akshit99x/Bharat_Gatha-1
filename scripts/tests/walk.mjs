// Needs Playwright (npm i -D playwright) and a running game: `npm run dev`, or URL=... for another address.
import { chromium } from 'playwright';
const GAME_URL = process.env.URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(GAME_URL);
await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.click('#btn-play');
await page.waitForTimeout(1200);
const report = await page.evaluate(() => {
  const g = window.game; g.running = false; g.narration?.clear?.();
  const p = g.player, w = g.world, inp = g.input;
  p.vehicle = null;
  const SEA = -36;
  // stand-ins for keyboard input
  let axis = { x: 0, z: 0 }, sprint = false, jump = false;
  inp.moveAxis = () => axis;
  inp.pressed = (a) => (a === 'sprint' ? sprint : false);
  inp.justPressed = (a) => (a === 'jump' ? jump : false);
  inp.mouse = { dx: 0, dy: 0, right: false, leftEdge: false };
  // points: every interactable, plus a land grid
  const pts = [];
  for (const it of w.interactables) pts.push({ x: it.position.x, z: it.position.z, tag: it.kind + ':' + it.id });
  for (let x = -1500; x <= 1500; x += 150) for (let z = -1500; z <= 1500; z += 150) { if (w.terrain.heightAt(x, z) > SEA + 3) pts.push({ x, z, tag: 'grid' }); }
  const dirs = 8, dt = 1 / 60, frames = 240; // 4 s at walk speed
  const per = {}; const res = { per, runs: 0, stuck: [], pops: [], under: [], nan: [], swims: 0 };
  for (const pt of pts) {
    const gr = w.terrain.findGround(pt.x, pt.z, 40);
    for (let d = 0; d < dirs; d++) {
      const yaw = (d / dirs) * Math.PI * 2;
      p.state = 'ground'; p.position.set(gr.x, gr.y + 0.05, gr.z); p.velocity.set(0, 0, 0); p.yaw = yaw; p.pitch = 0; p.vehicle = null;
      axis = { x: 0, z: 1 }; sprint = false; jump = false;
      const sx = p.position.x, sz = p.position.z; let maxDy = 0, lastY = p.position.y, popAt = null, underAt = null, bad = false;
      for (let f = 0; f < frames; f++) {
        // hop over knee-high things now and then, like a player would
        jump = (f % 70 === 69);
        p.update(dt);
        const y = p.position.y; if (!Number.isFinite(y) || !Number.isFinite(p.position.x)) { bad = true; break; }
        const dy = Math.abs(y - lastY); if (p.state === 'ground' && dy > maxDy) { maxDy = dy; popAt = f; }
        lastY = y;
        const th = w.terrain.heightAt(p.position.x, p.position.z);
        if (p.state === 'ground' && y < th - 0.6) underAt = f;
        if (p.state === 'swim') break;
      }
      res.runs++;
      if (bad) { res.nan.push(pt.tag); continue; }
      if (p.state === 'swim') { res.swims++; continue; }
      const moved = Math.hypot(p.position.x - sx, p.position.z - sz);
      // expected ≈ 4 s × 5.4 m/s, a little less for accel
      const k = pt.tag + '@' + Math.round(sx) + ',' + Math.round(sz); per[k] = per[k] || { ok: 0, bad: 0 }; if (moved < 8) per[k].bad++; else per[k].ok++;
      if (moved < 8) res.stuck.push({ tag: pt.tag, at: [Math.round(sx), Math.round(sz)], dir: d, moved: +moved.toFixed(1) });
      if (maxDy > 0.9 && popAt > 2) res.pops.push({ tag: pt.tag, at: [Math.round(sx), Math.round(sz)], dir: d, dy: +maxDy.toFixed(2), frame: popAt });
      if (underAt !== null) res.under.push({ tag: pt.tag, at: [Math.round(sx), Math.round(sz)], dir: d });
    }
  }
  return res;
});
console.log('runs', report.runs, 'swims', report.swims, 'stuck', report.stuck.length, 'pops', report.pops.length, 'under', report.under.length, 'nan', report.nan.length);
const byTag = (arr) => { const m = {}; for (const a of arr) { const k = a.tag.split(':')[0]; m[k] = (m[k] || 0) + 1; } return m; };
const trapped = Object.entries(report.per).filter(([, v]) => v.bad >= 6).map(([k, v]) => k + ' ' + v.bad + '/8'); console.log('TRAPPED points (>=6 of 8 directions blocked):', trapped.length, JSON.stringify(trapped));
console.log('stuck by kind', JSON.stringify(byTag(report.stuck)));
console.log('stuck sample', JSON.stringify(report.stuck.slice(0, 14)));
console.log('pop sample', JSON.stringify(report.pops.slice(0, 10)));
console.log('under sample', JSON.stringify(report.under.slice(0, 10)));
console.log(errors.join('\n') || 'no errors');
await browser.close();
