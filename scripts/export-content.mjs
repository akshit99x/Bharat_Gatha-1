#!/usr/bin/env node
/**
 * Write the game's content to server/data/content.json, for the Python teacher API and tools.
 *
 *   npm run content:export
 */
import { buildSync } from 'esbuild';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(new URL('..', import.meta.url).pathname);
const tmp = join(root, 'scripts/.tmp');
mkdirSync(tmp, { recursive: true });
const out = join(tmp, 'content.mjs');
buildSync({ entryPoints: [join(root, 'scripts/content-export.ts')], bundle: true, platform: 'node', format: 'esm', outfile: out, logLevel: 'error', define: { 'import.meta.env': '{}' } });
const { exportContent } = await import(pathToFileURL(out).href + '?t=' + Date.now());
const data = exportContent();
rmSync(tmp, { recursive: true, force: true });
mkdirSync(join(root, 'server/data'), { recursive: true });
writeFileSync(join(root, 'server/data/content.json'), JSON.stringify(data, null, 1) + '\n');
console.log(`${data.zones.length} zones, ${data.codex.length} codex entries, ${data.questions.length} questions, ${data.zones.reduce((n, z) => n + (z.story?.plaques.length ?? 0), 0)} plaques -> server/data/content.json`);
