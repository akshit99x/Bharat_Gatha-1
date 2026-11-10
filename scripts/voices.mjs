#!/usr/bin/env node
/**
 * Recording pipeline for the game's spoken lines.
 *
 *   npm run voices:script            list every line, give each a recording ID, write docs/voice/*
 *   npm run voices:import <folder>   take a folder of recordings named by ID, install them, rebuild the manifest
 *   npm run voices:manifest          rebuild public/voices/manifest.json from what is in public/voices
 *   npm run voices:check             coverage per speaker, and recordings whose line has since changed
 *
 * See docs/VOICE_RECORDING.md for the plain-language version.
 */
import { buildSync } from 'esbuild';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = resolve(new URL('..', import.meta.url).pathname);
const REGISTRY = join(root, 'src/content/voice/registry.json');
const PUBLIC = join(root, 'public/voices');
const DOCS = join(root, 'docs/voice');
const EXT = new Set(['.mp3', '.ogg', '.wav', '.m4a', '.webm', '.aac', '.flac']);

async function load() {
  const tmp = join(root, 'scripts/.tmp');
  mkdirSync(tmp, { recursive: true });
  const out = join(tmp, 'collect.mjs');
  buildSync({ entryPoints: [join(root, 'scripts/collect-lines.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', define: { 'import.meta.env': '{}' } });
  const mod = await import(pathToFileURL(out).href + '?t=' + Date.now());
  const keyMod = await import(pathToFileURL(await bundleKey(tmp)).href + '?t=' + Date.now());
  const lines = mod.collectLines();
  rmSync(tmp, { recursive: true, force: true });
  return { lines, voiceKey: keyMod.voiceKey, pronounceable: mod.pronounceable };
}
async function bundleKey(tmp) {
  const out = join(tmp, 'key.mjs');
  buildSync({ entryPoints: [join(root, 'src/core/voiceKey.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error' });
  return out;
}

const slug = (name) => name.normalize('NFKD').replace(/[^A-Za-z0-9 ]+/g, ' ').trim().split(/\s+/).slice(0, 3).join('-').toUpperCase() || 'VOICE';
const readJson = (p, d) => (existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : d);
const csv = (v) => `"${String(v).replace(/"/g, '""')}"`;

function installed() {
  const map = new Map();
  if (!existsSync(PUBLIC)) return map;
  for (const f of readdirSync(PUBLIC)) {
    const e = extname(f).toLowerCase();
    if (EXT.has(e)) map.set(basename(f, e), f);
  }
  return map;
}

function writeManifest() {
  const clips = {};
  for (const [k, f] of installed()) clips[k] = f;
  mkdirSync(PUBLIC, { recursive: true });
  writeFileSync(join(PUBLIC, 'manifest.json'), JSON.stringify({ version: 1, clips }, null, 1) + '\n');
  return Object.keys(clips).length;
}

async function cmdScript() {
  const { lines, voiceKey } = await load();
  const registry = readJson(REGISTRY, {});
  const counters = {};
  for (const id of Object.values(registry)) {
    const m = /^(.*)-(\d+)$/.exec(id);
    if (m) counters[m[1]] = Math.max(counters[m[1]] ?? 0, Number(m[2]));
  }
  const have = installed();
  const rows = lines.map((l) => {
    const key = voiceKey(l.speaker, l.text);
    if (!registry[key]) {
      const s = slug(l.speaker);
      counters[s] = (counters[s] ?? 0) + 1;
      registry[key] = `${s}-${String(counters[s]).padStart(4, '0')}`;
    }
    return { ...l, key, id: registry[key], done: have.has(key) };
  });
  mkdirSync(join(root, 'src/content/voice'), { recursive: true });
  writeFileSync(REGISTRY, JSON.stringify(registry, null, 1) + '\n');

  mkdirSync(join(DOCS, 'by-speaker'), { recursive: true });
  const head = 'id,speaker,role,where,words,recorded,line';
  const body = rows.map((r) => [r.id, r.speaker, r.role, r.where, r.text.split(/\s+/).length, r.done ? 'yes' : 'no', r.text].map(csv).join(','));
  writeFileSync(join(DOCS, 'script.csv'), [head, ...body].join('\n') + '\n');

  const bySpeaker = new Map();
  for (const r of rows) {
    if (!bySpeaker.has(r.speaker)) bySpeaker.set(r.speaker, []);
    bySpeaker.get(r.speaker).push(r);
  }
  const summary = [];
  for (const [speaker, list] of bySpeaker) {
    const words = list.reduce((n, r) => n + r.text.split(/\s+/).length, 0);
    summary.push({ speaker, role: list[0].role, lines: list.length, words, minutes: Math.round(words / 2.3 / 60) });
    const md = [
      `# ${speaker} — ${list[0].role}`,
      '',
      `${list.length} lines · about ${Math.max(1, Math.round(words / 2.3 / 60))} minutes of speech.`,
      '',
      'Record each line on its own. Name the file with the ID in the first column (for example `' + list[0].id + '.wav`).',
      'Leave about half a second of quiet before and after each line. If you slip, record the whole line again.',
      '',
      '| ID | Where it is heard | Say this |',
      '|---|---|---|',
      ...list.map((r) => `| \`${r.id}\` | ${r.where} | ${r.text.replace(/\|/g, '\\|')} |`),
      '',
    ].join('\n');
    writeFileSync(join(DOCS, 'by-speaker', `${slug(speaker)}.md`), md);
  }
  summary.sort((a, b) => b.words - a.words);
  const total = summary.reduce((n, s) => ({ lines: n.lines + s.lines, words: n.words + s.words }), { lines: 0, words: 0 });
  const idx = [
    '# Recording index',
    '',
    `${total.lines} lines · ${total.words.toLocaleString()} words · roughly ${Math.round(total.words / 2.3 / 60)} minutes of finished audio.`,
    '',
    '| Speaker | Role | Lines | Words | ≈ Minutes |',
    '|---|---|---:|---:|---:|',
    ...summary.map((s) => `| [${s.speaker}](by-speaker/${slug(s.speaker)}.md) | ${s.role} | ${s.lines} | ${s.words} | ${s.minutes} |`),
    '',
  ].join('\n');
  writeFileSync(join(DOCS, 'README.md'), idx);
  console.log(`${total.lines} lines · ${bySpeaker.size} speakers · ${total.words} words (~${Math.round(total.words / 2.3 / 60)} min)`);
  console.log('Wrote docs/voice/script.csv, docs/voice/README.md and one page per speaker in docs/voice/by-speaker/');
  console.log('Top speakers:', summary.slice(0, 8).map((s) => `${s.speaker} ${s.lines}`).join(' · '));
}

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0;

/**
 * Tidy a raw take: trim the silence either side, bring it to a consistent loudness (so a line recorded
 * quietly on a phone sits beside one recorded loudly on a laptop), leave a breath of air at each end,
 * and store it as a small mono MP3. Returns false if ffmpeg could not do it.
 */
function tidy(input, output) {
  const filter = [
    'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05',
    'areverse',
    'silenceremove=start_periods=1:start_threshold=-48dB:start_silence=0.05',
    'areverse',
    'loudnorm=I=-18:TP=-1.5:LRA=9',
    'adelay=100|100',
    'apad=pad_dur=0.18',
  ].join(',');
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', input, '-af', filter, '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '96k', output], { stdio: 'inherit' });
  return r.status === 0;
}

async function cmdImport(folder) {
  if (!folder || !existsSync(folder)) {
    console.error('Usage: npm run voices:import <folder-of-recordings>');
    process.exit(1);
  }
  const registry = readJson(REGISTRY, {});
  const byId = new Map(Object.entries(registry).map(([k, id]) => [id.toLowerCase(), k]));
  mkdirSync(PUBLIC, { recursive: true });
  let ok = 0;
  let tidied = 0;
  const unknown = [];
  const wrongType = [];
  for (const file of walk(folder)) {
    const ext = extname(file).toLowerCase();
    const id = basename(file, extname(file)).toLowerCase().replace(/[ _]+/g, '-');
    if (!EXT.has(ext)) {
      if (!basename(file).startsWith('.')) wrongType.push(basename(file));
      continue;
    }
    const key = byId.get(id);
    if (!key) {
      unknown.push(basename(file));
      continue;
    }
    // One clip per line: a new take replaces the old one whatever its format.
    for (const e of EXT) rmSync(join(PUBLIC, key + e), { force: true });
    if (hasFfmpeg && tidy(file, join(PUBLIC, key + '.mp3'))) tidied++;
    else copyFileSync(file, join(PUBLIC, key + ext));
    ok++;
  }
  const total = writeManifest();
  console.log(`Installed ${ok} recording(s)${tidied ? ` (${tidied} trimmed and levelled with ffmpeg)` : hasFfmpeg ? '' : ' (ffmpeg not found, so files were copied as they are)'}. ${total} line(s) now have a human voice.`);
  if (unknown.length) console.log(`Not recognised (check the ID in the file name): ${unknown.slice(0, 12).join(', ')}${unknown.length > 12 ? ` … and ${unknown.length - 12} more` : ''}`);
  if (wrongType.length) console.log(`Skipped (not an audio file): ${wrongType.slice(0, 8).join(', ')}`);
}

async function cmdCheck() {
  const { lines, voiceKey } = await load();
  const have = installed();
  const live = new Set(lines.map((l) => voiceKey(l.speaker, l.text)));
  const per = new Map();
  for (const l of lines) {
    const s = per.get(l.speaker) ?? { total: 0, done: 0 };
    s.total++;
    if (have.has(voiceKey(l.speaker, l.text))) s.done++;
    per.set(l.speaker, s);
  }
  const rows = [...per].sort((a, b) => b[1].total - a[1].total);
  let done = 0;
  let total = 0;
  for (const [, s] of rows) {
    done += s.done;
    total += s.total;
  }
  console.log(`Recorded: ${done} of ${total} lines (${Math.round((done / Math.max(1, total)) * 100)}%)`);
  for (const [name, s] of rows.slice(0, 20)) console.log(`  ${name.padEnd(22)} ${String(s.done).padStart(3)} / ${s.total}`);
  const stale = [...have.keys()].filter((k) => k !== 'manifest' && !live.has(k));
  if (stale.length) console.log(`\n${stale.length} recording(s) match a line that has since been reworded or removed (they will not play): ${stale.slice(0, 8).join(', ')}`);
  else console.log('\nNo stale recordings.');
}

/** Hand the lines to an external renderer: key, who, the words, and the words as a speech engine should say them. */
async function cmdExport(out) {
  const { lines, voiceKey, pronounceable } = await load();
  const registry = readJson(REGISTRY, {});
  const rows = lines.map((l) => {
    const key = voiceKey(l.speaker, l.text);
    return { key, id: registry[key] ?? null, speaker: l.speaker, role: l.role, text: l.text, spoken: pronounceable(l.text) };
  });
  writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`Wrote ${rows.length} lines to ${out}`);
}

const [cmd, arg] = process.argv.slice(2);
if (cmd === 'script') await cmdScript();
else if (cmd === 'import') {
  await cmdImport(arg);
} else if (cmd === 'manifest') console.log(`${writeManifest()} clip(s) listed.`);
else if (cmd === 'check') await cmdCheck();
else if (cmd === 'export') await cmdExport(arg);
else {
  console.log('Commands: script | import <folder> | manifest | check | export <file.json>');
  process.exit(1);
}
