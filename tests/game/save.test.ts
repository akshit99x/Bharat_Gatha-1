/**
 * A save is read back from the browser (or from the class server) at startup. Old versions, hand-edited files and
 * half-written saves all reach the same loader, and if it throws, the game never starts. So: feed it rubbish.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DEFAULT_SETTINGS, migrateProfile, type Profile } from '../../src/core/Save';

/** Everything the rest of the game assumes about a loaded profile. */
function assertUsable(p: Profile, label: string): void {
  const ok = (cond: boolean, what: string): void => assert.ok(cond, `${label}: ${what}`);
  ok(Number.isFinite(p.vidya) && p.vidya >= 0, 'vidya is a number');
  ok(Array.isArray(p.codex) && p.codex.every((c) => typeof c === 'string'), 'codex is a list of ids');
  ok(new Set(p.codex).size === p.codex.length, 'codex has no repeats');
  ok(!!p.zones && typeof p.zones === 'object' && !Array.isArray(p.zones), 'zones is a record');
  for (const [id, z] of Object.entries(p.zones)) {
    ok(typeof z.discovered === 'boolean' && typeof z.sealed === 'boolean', `zone ${id} flags`);
    ok(Array.isArray(z.challenges), `zone ${id} challenges list`);
    ok(Number.isFinite(z.bestSeal) && Number.isFinite(z.timeSpent), `zone ${id} numbers`);
  }
  for (const [key, def] of Object.entries(DEFAULT_SETTINGS)) {
    const v = (p.settings as unknown as Record<string, unknown>)[key];
    ok(typeof v === typeof def, `setting ${key} is a ${typeof def}`);
    if (typeof v === 'number') ok(Number.isFinite(v), `setting ${key} is finite`);
  }
  ok(['en', 'hi', 'bn', 'mr', 'ta', 'kn', 'te', 'gu', 'ml'].includes(p.settings.lang), 'language is one the game has');
  for (const k of ['seen', 'met', 'panels', 'sabhaSettled'] as const) ok(Array.isArray(p.story[k]), `story.${k} is a list`);
  ok(typeof p.story.plaques === 'object' && p.story.plaques !== null, 'story.plaques is a record');
  ok(Array.isArray(p.creative.aksharas) && Array.isArray(p.creative.melodies), 'creative lists');
  ok(typeof p.questions === 'object' && p.questions !== null && !Array.isArray(p.questions), 'question records');
  ok(p.lastPosition === null || (Array.isArray(p.lastPosition) && p.lastPosition.length === 3 && p.lastPosition.every(Number.isFinite)), 'last position');
  // The calls the game makes on load must not throw.
  JSON.stringify(p);
  Object.values(p.zones).some((z) => z.discovered || z.challenges.length > 0);
}

describe('loading a save', () => {
  it('an empty save gives a fresh profile', () => {
    assertUsable(migrateProfile({}), 'empty');
  });

  it('a good save keeps its progress', () => {
    const p = migrateProfile({
      vidya: 120,
      codex: ['indus-greatbath'],
      zones: { sindhu: { discovered: true, challenges: ['x'], sealed: true, bestSeal: 0.8, timeSpent: 300 } },
      settings: { ...DEFAULT_SETTINGS, lang: 'ta', musicVolume: 0.2 },
    });
    assertUsable(p, 'good');
    assert.equal(p.vidya, 120);
    assert.deepEqual(p.codex, ['indus-greatbath']);
    assert.equal(p.zones.sindhu!.sealed, true);
    assert.equal(p.settings.lang, 'ta');
    assert.equal(p.settings.musicVolume, 0.2);
  });

  // Each of these came from a real way a save goes wrong: an older version, a partial write, a hand edit.
  const broken: Array<[string, unknown]> = [
    ['zone missing its challenge list (older save)', { zones: { sindhu: { discovered: true } } }],
    ['zone that is null', { zones: { sindhu: null } }],
    ['zones saved as a list', { zones: [1, 2] }],
    ['settings as a string', { settings: 'loud' }],
    ['volume as text', { settings: { musicVolume: 'loud', mouseSensitivity: null } }],
    ['unknown language', { settings: { lang: 'xx' } }],
    ['vidya as text', { vidya: 'lots' }],
    ['negative / infinite vidya', { vidya: -Infinity }],
    ['codex with junk', { codex: ['a', 3, null, 'a'] }],
    ['story lists missing', { story: { seen: 'yes', panels: null, plaques: [] } }],
    ['creative as null', { creative: null }],
    ['questions as a list', { questions: [1] }],
    ['broken last position', { lastPosition: [1, 'x'] }],
    ['stats as null', { stats: null }],
  ];
  for (const [label, input] of broken) {
    it(`survives: ${label}`, () => {
      assertUsable(migrateProfile(input), label);
    });
  }

  it('survives anything JSON can hold', () => {
    for (const input of [null, 0, 'x', [], true, { settings: [] }, { zones: 'x' }]) assertUsable(migrateProfile(input), JSON.stringify(input));
  });
});
