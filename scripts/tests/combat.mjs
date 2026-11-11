// Needs Playwright (npm i -D playwright) and a running game (npm run dev).
import { chromium } from 'playwright';
const shots = '/tmp/claude-0/-home-user/82abfe19-1016-5a53-b25f-8941b1cdfc38/scratchpad/shots';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 300)); });
await page.goto(process.env.URL || 'http://127.0.0.1:5173/'); await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.click('#btn-play'); await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const g = window.game; g.running = false; g.narration.clear(); const c = g.combat, p = g.player, w = g.world;
  const out = { sites: c.siteList.length, perZone: {} };
  for (const s of c.siteList) out.perZone[s.zoneId] = (out.perZone[s.zoneId] || 0) + 1;
  const site = c.sites.find((s) => s.zoneId === 'kosala') || c.sites[0];
  // stand 20 m from the column
  p.state = 'ground'; p.teleportTo(site.pos.x + 20, site.pos.z); p.velocity.set(0, 0, 0);
  const step = (n) => { for (let i = 0; i < n; i++) { p.update(1 / 30); c.update(1 / 30, 100 + i / 30, p.position, false); } };
  step(30);
  out.engagedAfterApproach = c.engaged;
  out.shadesChasing = site.shades.filter((s) => s.state === 'chase' || s.state === 'windup').length;
  // stand still and let them reach and hit
  const before = c.hearts; step(120); out.heartsAfterStandingStill = `${before} -> ${c.hearts}`;
  // shoot each shade: aim from a camera point straight at it
  let shots = 0, kills = 0;
  for (let k = 0; k < 40 && site.shades.some((s) => s.state !== 'gone'); k++) {
    const t = site.shades.find((s) => s.state !== 'gone');
    const eye = p.position.clone(); eye.y += 1.6;
    const aim = t.pos.clone(); aim.y += 1.1; const dir = aim.sub(eye).normalize();
    c.bowCooldown = 0; if (c.shoot(eye.clone().add(dir.clone().multiplyScalar(0.4)), eye, dir)) shots++;
    for (let i = 0; i < 20; i++) c.update(1 / 30, 110 + k + i / 30, p.position, true);
    kills = site.shades.filter((s) => s.state === 'gone').length;
  }
  out.shotsToClear = shots; out.cleared = `${kills}/${site.shades.length}`; out.siteCleared = site.clearedAt !== null;
  // overwhelmed -> respawn
  g.combat.hearts = 1; const pos0 = p.position.clone(); c.restore(); g.overwhelmed(); out.respawnMoved = +p.position.distanceTo(pos0).toFixed(0); out.heartsAfterRespawn = c.hearts;
  // arrows glance off people
  const npc = w.interactables.find((i) => i.kind === 'npc' && i.npc && !/child|water/i.test(i.npc.role + i.npc.name));
  let barked = null; c.events.onNpcStruck = (id) => { barked = id; };
  const eye = npc.position.clone().add({ x: 6, y: 0.4, z: 0 }); const dir = npc.position.clone().sub(eye).normalize();
  c.bowCooldown = 0; c.shoot(eye.clone(), eye, dir); for (let i = 0; i < 20; i++) c.update(1 / 30, 200 + i / 30, eye, true);
  out.npcStruckReported = barked === npc.npc.id;
  return out;
});
console.log(JSON.stringify(r, null, 1));
console.log(errors.join('\n') || 'no errors'); await browser.close();
