/**
 * Every interface language must cover exactly the same strings, fill every pattern with the same parts, and keep the
 * numbers and key names a player needs to read. A pack that falls behind English shows English in the middle of a
 * translated screen; one that drops a "$2" shows a sentence with a hole in it.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ZONES } from '../../src/content/zones';
import { save } from '../../src/core/Save';
import { LANGS, translate, zoneLabel } from '../../src/i18n';
import { EXACT as HI, PATTERNS } from '../../src/i18n/hi';
import { PACKS } from '../../src/i18n/packs';

const englishKeys = Object.keys(HI).sort();
const slots = (s: string): string => [...new Set(s.match(/\$\d/g) ?? [])].sort().join(',');
const keyTokens = (s: string): string[] => s.match(/\b(?:F1|Esc|Enter|Space|Shift|WASD|W\/S|A\/D|[B-HJ-Z](?![a-z’'])|\d+%?)\b|[★🧭❗○✓▼←]/g) ?? [];

/** The script each language is written in, as a Unicode block. */
const SCRIPT: Record<string, RegExp> = {
  hi: /[ऀ-ॿ]/,
  mr: /[ऀ-ॿ]/,
  bn: /[ঀ-৿]/,
  ta: /[஀-௿]/,
  kn: /[ಀ-೿]/,
  te: /[ఀ-౿]/,
  gu: /[઀-૿]/,
  ml: /[ഀ-ൿ]/,
};

describe('language packs', () => {
  it('the picker lists exactly the packs that exist', () => {
    assert.deepEqual(LANGS.map((l) => l.code).filter((c) => c !== 'en').sort(), Object.keys(PACKS).sort());
  });

  for (const [code, pack] of Object.entries(PACKS)) {
    describe(code, () => {
      it('covers every interface string, and nothing else', () => {
        const keys = Object.keys(pack.exact).sort();
        const missing = englishKeys.filter((k) => !(k in pack.exact));
        const extra = keys.filter((k) => !(k in HI));
        assert.deepEqual({ missing, extra }, { missing: [], extra: [] });
      });

      it('has a template for every pattern, using the same parts', () => {
        assert.equal(pack.templates.length, PATTERNS.length);
        const bad = PATTERNS.map(([re, hi], i) => [re, hi, pack.templates[i] ?? ''] as const)
          .filter(([, hi, t]) => slots(hi) !== slots(t))
          .map(([re, , t]) => `${re.source} → "${t}"`);
        assert.equal(bad.length, 0, bad.join('\n'));
      });

      it('is written in its own script and keeps numbers and key names', () => {
        const out: string[] = [];
        for (const [en, tr] of Object.entries(pack.exact)) {
          if (!tr.trim()) out.push(`empty: ${en}`);
          else if (/[a-z]{3,}/i.test(en) && !SCRIPT[code]!.test(tr) && keyTokens(en).join() !== en.replace(/\s/g, '')) {
            if (!/^[A-Z0-9 /·]+$/.test(tr)) out.push(`not in ${code} script: "${en}" → "${tr}"`);
          }
          for (const tok of keyTokens(en)) if (!tr.includes(tok)) out.push(`lost "${tok}": "${en}" → "${tr}"`);
        }
        assert.equal(out.length, 0, out.slice(0, 25).join('\n'));
      });

      it('names every region', () => {
        const missing = ZONES.filter((z) => !pack.regions[z.name]).map((z) => z.name);
        assert.deepEqual(missing, []);
        for (const z of ZONES) assert.match(pack.regions[z.name]!, SCRIPT[code]!, `${z.name} is not in ${code} script`);
      });
    });
  }
});

describe('translating', () => {
  const withLang = (code: string, fn: () => void): void => {
    const before = save.settings.lang;
    (save.settings as { lang: string }).lang = code;
    try {
      fn();
    } finally {
      save.settings.lang = before;
    }
  };

  it('English is left exactly as it is', () => {
    withLang('en', () => {
      assert.equal(translate('Resume'), 'Resume');
      assert.equal(translate('Question 3 of 5'), 'Question 3 of 5');
    });
  });

  for (const { code } of LANGS.filter((l) => l.code !== 'en')) {
    it(`${code}: whole strings, patterns with region names, and untouched content`, () => {
      withLang(code, () => {
        const pack = PACKS[code as keyof typeof PACKS]!;
        assert.equal(translate('Resume'), pack.exact['Resume']);
        // Surrounding whitespace survives, so text next to a bold number still reads.
        assert.equal(translate('  Resume '), `  ${pack.exact['Resume']} `);
        const sindhu = ZONES.find((z) => z.id === 'sindhu')!;
        const practice = translate(`Practice: ${sindhu.name}`);
        assert.ok(practice.includes(pack.regions[sindhu.name]!), `region not translated inside a pattern: ${practice}`);
        assert.ok(!/\$\d/.test(practice), `unfilled slot: ${practice}`);
        assert.equal(zoneLabel(sindhu), pack.regions[sindhu.name]);
        // Numbers in patterns arrive intact.
        assert.ok(translate('Scan 7 monuments (2/7)').includes('2/7'));
        // History content is not in the dictionaries and must pass through unchanged.
        const content = 'The Great Bath was built of fired brick sealed with bitumen.';
        assert.equal(translate(content), content);
      });
    });
  }

  it('an unknown saved language falls back to English', () => {
    withLang('xx', () => assert.equal(translate('Resume'), 'Resume'));
  });

  it('every pattern matches the kind of string it was written for', () => {
    // A pattern placed after a broader one never fires; each must win for at least one example of its own.
    const examples = PATTERNS.map(([re]) => re.source);
    const shadowed: string[] = [];
    PATTERNS.forEach(([re], i) => {
      const sample = exampleFor(re);
      if (sample === null) return;
      const first = PATTERNS.findIndex(([r]) => r.test(sample));
      if (first !== i) shadowed.push(`${examples[i]} is hidden by ${examples[first]} (e.g. "${sample}")`);
    });
    assert.equal(shadowed.length, 0, shadowed.join('\n'));
  });
});

/** A string a pattern should match: fill each group with something plausible. */
function exampleFor(re: RegExp): string | null {
  let s = re.source.replace(/^\^|\$$/g, '');
  s = s
    .replace(/\(\?:st\|nd\|rd\|th\)/g, 'th')
    .replace(/\(\\d\+\)/g, '7')
    .replace(/\(\[IVXL\]\+\)/g, 'IV')
    .replace(/\(([A-Za-z ]+)(?:\|[A-Za-z ]+)+\)/g, '$1')
    .replace(/\(\.\+\)/g, 'Sample text')
    .replace(/s\?/g, 's')
    .replace(/\\(.)/g, '$1');
  return /[()[\]|?*+]/.test(s) ? null : s;
}
