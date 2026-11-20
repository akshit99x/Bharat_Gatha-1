/**
 * Generated quiz questions are made at play time from the timeline, the codex and the map, so a bad combination only
 * shows up for an unlucky player. This plays thousands of seeds for every region and checks each question is fair.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { TIMELINE, centuryLabel } from '../../src/content/timeline';
import { ZONES } from '../../src/content/zones';
import { Rng } from '../../src/core/Rng';
import { GENERATORS, generateQuestions } from '../../src/quiz/generators';

const SEEDS = 300;
const byLabel = new Map(TIMELINE.map((e) => [e.label, e]));
const zoneByOption = new Map(ZONES.map((z) => [`${z.name} (${z.era})`, z]));

function* everyQuestion() {
  for (const zoneId of [null, ...ZONES.map((z) => z.id)]) {
    for (let seed = 1; seed <= SEEDS; seed++) {
      for (const gen of GENERATORS) {
        const q = gen.generate(new Rng(`${zoneId}:${seed}:${gen.id}`), zoneId);
        if (q) yield { gen: gen.id, zoneId, q };
      }
    }
  }
}

describe('generated questions', () => {
  it('are well formed: 3+ distinct options, one valid answer, an explanation', () => {
    const out = new Set<string>();
    for (const { gen, q } of everyQuestion()) {
      if (q.options.length < 3) out.add(`${gen}: only ${q.options.length} options in ${q.id}`);
      if (new Set(q.options).size !== q.options.length) out.add(`${gen}: repeated option in ${q.id}`);
      if (q.answer < 0 || q.answer >= q.options.length) out.add(`${gen}: answer out of range in ${q.id}`);
      if (q.options.some((o) => !o || !o.trim())) out.add(`${gen}: empty option in ${q.id}`);
      if (!q.explain.trim()) out.add(`${gen}: no explanation in ${q.id}`);
    }
    assert.equal(out.size, 0, [...out].slice(0, 20).join('\n'));
  });

  it('"which happened first/last" has one clear answer from undisputed dates', () => {
    const out = new Set<string>();
    for (const { gen, q } of everyQuestion()) {
      if (gen !== 'chrono-first' && gen !== 'chrono-last') continue;
      const events = q.options.map((o) => byLabel.get(o));
      assert.ok(events.every(Boolean), `options not from the timeline in ${q.id}`);
      const years = events.map((e) => e!.year);
      const target = gen === 'chrono-first' ? Math.min(...years) : Math.max(...years);
      if (years.filter((y) => y === target).length > 1) out.add(`tie in ${q.id}`);
      if (years[q.answer] !== target) out.add(`wrong answer marked in ${q.id}`);
      for (const e of events) if (e!.contested) out.add(`uses "${e!.label}", whose date historians dispute`);
    }
    assert.equal(out.size, 0, [...out].slice(0, 20).join('\n'));
  });

  it('"which begins earliest" never has two regions starting together', () => {
    const out = new Set<string>();
    for (const { gen, q } of everyQuestion()) {
      if (gen !== 'era-order') continue;
      const starts = q.options.map((o) => zoneByOption.get(o)!.eraStart);
      const min = Math.min(...starts);
      if (starts.filter((s) => s === min).length > 1) out.add(`tie: ${q.options.join(' / ')}`);
      if (starts[q.answer] !== min) out.add(`wrong answer marked: ${q.options.join(' / ')}`);
    }
    assert.equal(out.size, 0, [...out].join('\n'));
  });

  it('"which region" questions name a landmark that exists in only one region', () => {
    const names = new Map<string, Set<string>>();
    for (const z of ZONES) for (const l of z.landmarks) if (l.signposted && l.codexId) names.set(l.name, (names.get(l.name) ?? new Set()).add(z.id));
    const ambiguous = [...names].filter(([, zones]) => zones.size > 1).map(([n, zones]) => `${n}: ${[...zones].join(', ')}`);
    assert.equal(ambiguous.length, 0, ambiguous.join('\n'));
  });

  it('a round always fills up, for every region', () => {
    for (const zoneId of [null, ...ZONES.map((z) => z.id)]) {
      const got = generateQuestions(new Rng(`round:${zoneId}`), zoneId, 6);
      assert.equal(got.length, 6, `only ${got.length} generated questions for ${zoneId ?? 'mixed'}`);
      assert.equal(new Set(got.map((q) => q.id)).size, got.length, `repeats in a round for ${zoneId}`);
    }
  });
});

describe('century labels', () => {
  it('follow the calendar: there is no year 0 and 1–100 is the 1st century', () => {
    const cases: Array<[number, string]> = [
      [-2600, '26th century BCE'],
      [-101, '2nd century BCE'],
      [-100, '1st century BCE'],
      [-1, '1st century BCE'],
      [1, '1st century CE'],
      [100, '1st century CE'],
      [101, '2nd century CE'],
      [1010, '11th century CE'],
      [1111, '12th century CE'],
      [1201, '13th century CE'],
      [1734, '18th century CE'],
    ];
    for (const [year, label] of cases) assert.equal(centuryLabel(year), label, `year ${year}`);
  });
});
