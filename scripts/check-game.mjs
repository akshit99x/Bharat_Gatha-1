#!/usr/bin/env node
/**
 * Game checks: fast tests of the game's data and logic, with no browser.
 *
 * Each tests/game/*.test.ts is bundled with esbuild (already a dependency, through Vite) and run with Node's own test
 * runner, so there is nothing new to install. Run with `npm run check`; CI runs it on every push and pull request.
 *
 *   npm run check                 every file
 *   npm run check -- save i18n    only files whose name contains one of these words
 */
import { buildSync } from 'esbuild';
import { spawnSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testDir = join(root, 'tests', 'game');
const outDir = join(root, 'node_modules', '.cache', 'game-checks');

const filters = process.argv.slice(2);
const files = readdirSync(testDir)
  .filter((f) => f.endsWith('.test.ts'))
  .filter((f) => filters.length === 0 || filters.some((w) => f.includes(w)))
  .sort();
if (files.length === 0) {
  console.error('No test files matched.');
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
buildSync({
  entryPoints: files.map((f) => join(testDir, f)),
  outdir: outDir,
  outExtension: { '.js': '.mjs' },
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node20',
  sourcemap: 'inline',
  alias: { '@': join(root, 'src') },
  // Vite's import.meta.env does not exist under Node; the game code only reads DEV and BASE_URL from it.
  define: { 'import.meta.env': JSON.stringify({ DEV: false, PROD: true, MODE: 'test', BASE_URL: './' }) },
  logLevel: 'error',
});

const built = files.map((f) => join(outDir, f.replace(/\.ts$/, '.mjs')));
const run = spawnSync(process.execPath, ['--enable-source-maps', '--test', '--test-reporter=spec', ...built], { stdio: 'inherit' });
process.exit(run.status ?? 1);
