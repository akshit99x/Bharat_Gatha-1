// Needs Playwright (npm i -D playwright) and a running game: `npm run dev`, or URL=... for another address.
import { chromium } from 'playwright';
const GAME_URL = process.env.URL || 'http://127.0.0.1:5173/';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(GAME_URL); await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.click('#btn-play'); await page.waitForTimeout(1200);
const r = await page.evaluate(() => {
  const g = window.game; g.running = false; const p = g.player, w = g.world, inp = g.input;
  inp.moveAxis = () => ({ x: 0, z: 1 }); inp.pressed = () => false; inp.justPressed = () => false; inp.mouse = { dx: 0, dy: 0, right: false, leftEdge: false };
  const gr = w.terrain.findGround(-720, -400, 40); const out = [];
  // flat test ground: put boxes of several heights in front of the player, each 4 m wide, 4 m deep, rotated 0 and 35 degrees
  for (const [h, rot] of [[0.5, 0], [0.9, 0], [1.05, 0], [1.4, 0], [0.9, 35], [1.05, 35], [1.05, 70]]) {
    w.collision.clear?.call; // do not clear the world; add and later ignore
    const n0 = w.collision.count;
    const c = Math.cos(rot * Math.PI / 180), s = Math.sin(rot * Math.PI / 180);
    // player starts 6 m south of the box centre, walking north (-z)
    const cx = gr.x + (out.length * 12), cz = gr.z - 6; const base = w.terrain.heightAt(cx, cz + 2.4);
    w.collision.addPlaced([{ min: [-2, 0, -2], max: [2, h, 2] }], cx, base - 0.01, cz, rot * Math.PI / 180, 1);
    p.state = 'ground'; p.vehicle = null; p.position.set(cx, w.terrain.heightAt(cx, cz + 6) + 0.02, cz + 6); p.velocity.set(0, 0, 0); p.yaw = 0; p.pitch = 0;
    let maxY = 0, frames = 0, ontop = false;
    for (let f = 0; f < 240; f++) { p.update(1 / 60); maxY = Math.max(maxY, p.position.y - base); frames = f; if (p.position.y - base > h - 0.05 && Math.abs(p.position.z - cz) < 1.5) { ontop = true; break; } }
    out.push({ h, rot, ontop, maxRise: +maxY.toFixed(2), zEnd: +(p.position.z - cz).toFixed(1) });
  }
  return out;
});
console.log(r.map((x) => JSON.stringify(x)).join('\n'));
console.log(errors.join('\n') || 'no errors');
await browser.close();
