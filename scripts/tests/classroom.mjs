// Needs Playwright, the API (npm run api:dev) and the game (npm run dev). Run: node scripts/tests/classroom.mjs
import { chromium } from 'playwright';
const shots = '/tmp';
const API = 'http://127.0.0.1:5173';
const j = async (path, opts = {}) => { const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.token ? { Authorization: 'Bearer ' + opts.token } : {}) } }); const t = await r.text(); return { status: r.status, body: t ? JSON.parse(t) : null }; };
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message)); page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });

// a teacher makes a class and adds one question of their own
const cls = (await j('/api/classes', { method: 'POST', body: JSON.stringify({ name: 'Class 8B' }) })).body;
await j(`/api/classes/${cls.code}/questions`, { method: 'POST', token: cls.teacher_token, body: JSON.stringify({ zone_id: 'general', difficulty: 1, stem: 'Which river flowed beside the cities of the Indus?', options: ['The Indus', 'The Nile', 'The Tigris'], answer: 0, explain: 'The Indus gave the civilisation its name.', skill: 'Class question' }) });
console.log('teacher made class', cls.code);

await page.goto('http://127.0.0.1:5173/'); await page.waitForSelector('#btn-play', { state: 'visible', timeout: 180000 });
await page.waitForSelector('#btn-class:not([hidden])', { timeout: 8000 });
console.log('title shows Join a class:', await page.$eval('#btn-class', (e) => e.textContent));
await page.screenshot({ path: `${shots}/330-title-class.png` });
await page.click('#btn-class'); await page.waitForSelector('.cls .cls-input', { timeout: 8000 });
await page.fill('.cls .cls-field:nth-of-type(1) input', 'zzzzzz'); await page.fill('.cls .cls-field:nth-of-type(2) input', 'Meera');
await page.click('.cls .btn-primary'); await page.waitForSelector('.cls-msg.cls-bad', { timeout: 8000 });
console.log('wrong class code ->', await page.$eval('.cls-msg.cls-bad', (e) => e.textContent));
await page.fill('.cls .cls-field:nth-of-type(1) input', cls.code.toLowerCase());
await page.click('.cls .btn-primary'); await page.waitForSelector('.cls-code', { timeout: 8000 });
const studentCode = await page.$eval('.cls-code', (e) => e.textContent);
console.log('joined; student code shown:', studentCode);
await page.screenshot({ path: `${shots}/331-class-code.png` });
await page.click('.cls .btn-primary'); await page.waitForSelector('.cls-state', { timeout: 8000 });
await page.waitForTimeout(1200);
console.log('status:', await page.$eval('.cls-state', (e) => e.textContent), '| progress stored in cloud:', (await j('/api/me', { token: studentCode })).body.has_progress);
await page.screenshot({ path: `${shots}/332-class-status.png` });

// a sync with real progress: give the student some vidya, save now
await page.evaluate(() => { const g = window.game; g.save?.addVidya?.(0); });
await page.keyboard.press('Escape'); await page.waitForTimeout(500);
// close the panel and play
await page.evaluate(async () => { const raw = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('profile') || k.includes('save')) || '') || '{}'); });
await page.click('#btn-play'); await page.waitForTimeout(1500);
await page.evaluate(() => { const g = window.game; g.running = false; });
const qCount = await page.evaluate(async () => { await window.game.loadClassQuestions(); return window.game.bank.classQuestionCount; });
console.log('class questions in the game:', qCount);
const drawn = await page.evaluate(() => { const b = window.game.bank; let hit = 0; for (let i = 0; i < 60; i++) { const d = b.draw({ zoneId: 'sindhu', count: 6 }); if (d.some((q) => q.id.startsWith('class:'))) hit++; } return hit; });
console.log('rounds (of 60) that included the teacher\'s question:', drawn);

// teacher's view, once the student has saved
await page.evaluate(() => { const g = window.game; g.save?.flush?.(); });
console.log(errors.join('\n') || 'no page errors');
console.log(JSON.stringify({ code: cls.code, token: cls.teacher_token, student: studentCode }));
await browser.close();
