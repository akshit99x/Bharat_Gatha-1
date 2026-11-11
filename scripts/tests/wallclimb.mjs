// Needs Playwright (npm i -D playwright) and a running game: `npm run dev`, or URL=... for another address.
import { chromium } from 'playwright';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } });
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
await page.goto(process.env.URL || 'http://127.0.0.1:5173/'); await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.click('#btn-play'); await page.waitForTimeout(1200);
const r = await page.evaluate(() => {
  const g = window.game; g.running = false; const p = g.player, w = g.world, inp = g.input;
  let jump = false, back = false;
  inp.moveAxis = () => ({ x: 0, z: back ? -1 : 1 }); inp.pressed = (a) => (a === 'back' ? back : false); inp.justPressed = (a) => a === 'jump' && jump; inp.mouse = { dx: 0, dy: 0, right: false, leftEdge: false };
  const gr = w.terrain.findGround(-720, -400, 40); const out = [];
  let n = 0;
  for (const [h, rot, round] of [[1.0, 0, 0], [2.0, 0, 0], [3.2, 0, 0], [6.0, 30, 0], [9.0, 0, 0], [11.0, 0, 0], [4.0, 0, 1]]) {
    const cx = gr.x + 14 * n++, cz = gr.z - 6; const base = w.terrain.heightAt(cx, cz + 2.4);
    w.collision.addPlaced([{ min: [-2.5, 0, -2.5], max: [2.5, h, 2.5], round: !!round }], cx, base - 0.01, cz, rot * Math.PI / 180, 1);
    p.state = 'ground'; p.vehicle = null; p.position.set(cx, w.terrain.heightAt(cx, cz + 7) + 0.02, cz + 7); p.velocity.set(0, 0, 0); p.yaw = 0; p.pitch = 0; back = false;
    let onTop = false, sawPrompt = false, frames = 0;
    for (let f = 0; f < 60 * 9; f++) {
      // a player would press Space when the prompt appears
      jump = p.canClimb && f % 10 === 0; if (p.canClimb) sawPrompt = true;
      p.update(1 / 60); frames = f;
      if (p.state === 'ground' && p.position.y - base > h - 0.06 && Math.hypot(p.position.x - cx, p.position.z - cz) < 2.6) { onTop = true; break; }
    }
    out.push({ wall: h, rot, round: !!round, prompt: sawPrompt, onTop, seconds: +(frames / 60).toFixed(1), state: p.state });
  }
  // letting go: start a climb on the 9 m wall then press back
  { const cx = gr.x + 14 * 4, cz = gr.z - 6; p.state = 'ground'; p.position.set(cx, w.terrain.heightAt(cx, cz + 7) + 0.02, cz + 7); p.velocity.set(0, 0, 0); p.yaw = 0; back = false;
    for (let f = 0; f < 200; f++) { jump = p.canClimb; p.update(1 / 60); if (p.state === 'climb' && f > 150) break; }
    const mid = p.state; back = true; jump = false; for (let f = 0; f < 120; f++) p.update(1 / 60);
    out.push({ letGo: { whileClimbing: mid, after: p.state, backOnGround: p.position.y - w.terrain.heightAt(p.position.x, p.position.z) < 0.3 } }); }
  return out;
});
console.log(r.map((x) => JSON.stringify(x)).join('\n')); console.log(errors.join('\n') || 'no errors'); await browser.close();
