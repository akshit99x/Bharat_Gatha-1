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
const out = await page.evaluate(() => {
  const g = window.game; g.running = false; g.narration?.clear?.();
  const p = g.player, w = g.world, inp = g.input;
  let axis = { x: 0, z: 1 }, jump = false;
  inp.moveAxis = () => axis; inp.pressed = (a) => a === 'sprint' ? false : false; inp.justPressed = (a) => a === 'jump' && jump;
  inp.mouse = { dx: 0, dy: 0, right: false, leftEdge: false };
  const targets = w.landmarks;
  const kinds = {}; for (const i of w.interactables) kinds[i.kind] = (kinds[i.kind] || 0) + 1;
  const rows = [];
  for (const t of targets) {
    let best = 0, bestDist = 1e9;
    for (let d = 0; d < 8; d++) {
      const a = (d / 8) * Math.PI * 2, R = 38;
      const sx = t.position.x + Math.cos(a) * R, sz = t.position.z + Math.sin(a) * R;
      const gr = w.terrain.findGround(sx, sz, 8);
      p.state = 'ground'; p.position.set(gr.x, gr.y + 0.05, gr.z); p.velocity.set(0, 0, 0); p.vehicle = null;
      p.yaw = Math.atan2(-(t.position.x - gr.x), -(t.position.z - gr.z)); p.pitch = 0;
      const base = gr.y; let gain = 0;
      for (let f = 0; f < 60 * 16; f++) {
        // keep heading at the target, hop occasionally
        p.yaw = Math.atan2(-(t.position.x - p.position.x), -(t.position.z - p.position.z));
        jump = f % 90 === 89; p.update(1 / 60);
        if (p.state === 'swim') break;
        gain = Math.max(gain, p.position.y - w.terrain.heightAt(p.position.x, p.position.z));
        if (Math.hypot(t.position.x - p.position.x, t.position.z - p.position.z) < 2) break;
      }
      const dist = Math.hypot(t.position.x - p.position.x, t.position.z - p.position.z);
      best = Math.max(best, gain); bestDist = Math.min(bestDist, dist);
    }
    rows.push({ id: t.id, h: +t.height.toFixed(0), bestGainAboveTerrain: +best.toFixed(1), closest: +bestDist.toFixed(1) });
  }
  return { kinds, rows };
});
console.log(JSON.stringify(out.kinds));
const tall = out.rows.filter((r) => r.bestGainAboveTerrain > 2);
console.log('monuments probed', out.rows.length, '| player got >2 m above terrain on', tall.length);
console.log('closest >6 m (could not get near):', JSON.stringify(out.rows.filter((r) => r.closest > 6).map((r) => r.id + ':' + r.closest)));
console.log('climbed:', JSON.stringify(tall.map((r) => r.id + '(h' + r.h + '):' + r.bestGainAboveTerrain)));
console.log(errors.join('\n') || 'no errors');
await browser.close();
