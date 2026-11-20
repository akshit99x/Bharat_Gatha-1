/**
 * The game's content is data, so most bugs are data bugs: a reward that cannot be earned, a conversation that cannot
 * be finished, a puzzle whose "right" answer is wrong. These checks catch them before a player does.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { CODEX, validateContent } from '../../src/content/codex';
import { QUESTIONS, validateQuestions } from '../../src/content/questions';
import { CHAPTERS, validateStory } from '../../src/content/story';
import { TIMELINE } from '../../src/content/timeline';
import type { DialogueNode } from '../../src/content/types';
import { ZONES } from '../../src/content/zones';
import { validateMiniGames } from '../../src/minigames/validate';

const list = (problems: string[]): string => '\n  · ' + problems.join('\n  · ');

describe('the game’s own validators', () => {
  // These run at startup in development and only print. Here they fail the build.
  for (const [name, fn] of [
    ['content references', validateContent],
    ['question bank', validateQuestions],
    ['story', validateStory],
    ['mini-games', validateMiniGames],
  ] as const) {
    it(`${name}: no problems`, () => {
      const problems = fn();
      assert.equal(problems.length, 0, list(problems));
    });
  }
});

describe('codex', () => {
  it('every entry can actually be earned', () => {
    // An entry that nothing unlocks makes "all entries recorded" impossible.
    const earnable = new Set<string>();
    for (const z of ZONES) {
      for (const l of z.landmarks) if (l.codexId) earnable.add(l.codexId);
      for (const n of z.npcs) if (n.unlocks) earnable.add(n.unlocks);
      for (const c of z.challenges) {
        for (const id of c.unlocks ?? []) earnable.add(id);
        if (c.kind === 'dialogue') for (const node of c.config.nodes) for (const id of node.unlocks ?? []) earnable.add(id);
      }
    }
    const orphans = CODEX.filter((e) => !earnable.has(e.id)).map((e) => `${e.id} (${e.zoneId})`);
    assert.equal(orphans.length, 0, 'nothing unlocks:' + list(orphans));
  });

  it('every entry has a body, a date and tags', () => {
    const bad = CODEX.filter((e) => e.body.length === 0 || !e.when.trim() || e.tags.length === 0).map((e) => e.id);
    assert.equal(bad.length, 0, list(bad));
  });
});

/** Every node reachable from the first, and from every reachable node some end can still be reached. */
function dialogueProblems(id: string, nodes: DialogueNode[]): string[] {
  const out: string[] = [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const exits = (n: DialogueNode): string[] =>
    [n.goto ?? n.next, ...(n.choices ?? []).map((c) => c.goto)].filter((x): x is string => !!x && byId.has(x));

  const reached = new Set<string>();
  const stack = nodes.length ? [nodes[0]!.id] : [];
  while (stack.length) {
    const cur = stack.pop()!;
    if (reached.has(cur)) continue;
    reached.add(cur);
    stack.push(...exits(byId.get(cur)!));
  }
  for (const n of nodes) if (!reached.has(n.id)) out.push(`${id}: node "${n.id}" can never be reached`);

  // A choice with no goto ends the conversation, as does an `end` node.
  const canFinish = new Set(nodes.filter((n) => n.end || (n.choices ?? []).some((c) => !c.goto)).map((n) => n.id));
  for (let changed = true; changed; ) {
    changed = false;
    for (const n of nodes) {
      if (!canFinish.has(n.id) && exits(n).some((x) => canFinish.has(x))) {
        canFinish.add(n.id);
        changed = true;
      }
    }
  }
  for (const n of nodes) if (reached.has(n.id) && !canFinish.has(n.id)) out.push(`${id}: from "${n.id}" the conversation can never end`);
  return out;
}

describe('conversations', () => {
  it('every dialogue node is reachable and every path can end', () => {
    const problems: string[] = [];
    for (const z of ZONES) for (const c of z.challenges) if (c.kind === 'dialogue') problems.push(...dialogueProblems(c.id, c.config.nodes));
    for (const ch of CHAPTERS) problems.push(...dialogueProblems(`${ch.zoneId} restoration`, ch.restoration as DialogueNode[]));
    assert.equal(problems.length, 0, list(problems));
  });
});

/**
 * The first date a "when" text names, as a signed year: "c. 2600 BCE" → -2600, "6 June 1674" → 1674,
 * "5th century CE" → 450 (the middle of it), "c. 321–185 BCE" → -321. Null when it names no date.
 */
export function firstYear(when: string): number | null {
  const bce = /\b(BCE|BC)\b/.test(when);
  const sign = (n: number): number => (bce ? -n : n);
  const century = /(\d{1,2})(?:st|nd|rd|th)\b(?:\s*(?:–|-)\s*\d{1,2}(?:st|nd|rd|th))?\s+century/.exec(when);
  const year = /(?<![\d.])(\d{3,4}|\d{1,4}(?=\s*(?:BCE|BC|CE|AD)\b))(?![\d%]|\s*(?:m|km|kg)\b)/.exec(when);
  if (century && (!year || century.index < year.index)) return sign((Number(century[1]) - 1) * 100 + 50);
  return year ? sign(Number(year[1])) : null;
}

describe('sequence puzzles', () => {
  it('the listed "correct" order is really chronological', () => {
    const problems: string[] = [];
    for (const z of ZONES) {
      for (const c of z.challenges) {
        if (c.kind !== 'sequence') continue;
        let prev: { year: number; label: string } | null = null;
        for (const item of c.config.items) {
          const year = firstYear(item.when);
          if (year === null) continue; // undated steps (a process, not a chronology)
          if (prev && year < prev.year) problems.push(`${c.id}: "${item.label}" (${item.when}) is listed after "${prev.label}"`);
          prev = { year, label: item.label };
        }
      }
    }
    assert.equal(problems.length, 0, list(problems));
  });
});

describe('places', () => {
  it('ids are unique across the whole island', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const z of ZONES) {
      for (const [kind, items] of [
        ['landmark', z.landmarks],
        ['challenge', z.challenges],
        ['npc', z.npcs],
      ] as const) {
        for (const it of items) {
          const key = `${kind}:${it.id}`;
          if (seen.has(key)) dupes.push(`${key} in ${z.id} and ${seen.get(key)}`);
          seen.set(key, z.id);
        }
      }
    }
    assert.equal(dupes.length, 0, list(dupes));
  });

  it('everything stands inside its own region', () => {
    const out: string[] = [];
    for (const z of ZONES) {
      const check = (what: string, [x, y]: [number, number]): void => {
        const d = Math.hypot(x, y);
        if (d > z.radius) out.push(`${z.id}: ${what} is ${Math.round(d)} from the centre (region radius ${z.radius})`);
      };
      for (const l of z.landmarks) check(`landmark ${l.id}`, l.offset);
      for (const c of z.challenges) check(`challenge ${c.id}`, c.offset);
      for (const n of z.npcs) check(`npc ${n.id}`, n.offset);
    }
    assert.equal(out.length, 0, list(out));
  });

  it('chapters are numbered 1…n with no gaps', () => {
    const nums = ZONES.map((z) => z.chapter).sort((a, b) => a - b);
    assert.deepEqual(nums, nums.map((_, i) => i + 1));
  });
});

describe('timeline', () => {
  it('ids are unique, zones exist and every event has a date and detail', () => {
    const out: string[] = [];
    const ids = new Set<string>();
    for (const e of TIMELINE) {
      if (ids.has(e.id)) out.push(`duplicate id ${e.id}`);
      ids.add(e.id);
      if (e.zoneId !== 'general' && !ZONES.some((z) => z.id === e.zoneId)) out.push(`${e.id}: unknown zone ${e.zoneId}`);
      if (!Number.isInteger(e.year) || e.year === 0) out.push(`${e.id}: year ${e.year} (there is no year 0)`);
      if (!e.displayDate.trim() || !e.detail.trim()) out.push(`${e.id}: missing date text or detail`);
      const shown = firstYear(e.displayDate);
      if (shown !== null && Math.abs(shown - e.year) > 100) out.push(`${e.id}: year ${e.year} but shown as "${e.displayDate}"`);
    }
    assert.equal(out.length, 0, list(out));
  });

  it('labels are unique, so two quiz options never read the same', () => {
    const seen = new Set<string>();
    const dupes = TIMELINE.filter((e) => (seen.has(e.label) ? true : (seen.add(e.label), false))).map((e) => e.label);
    assert.equal(dupes.length, 0, list(dupes));
  });
});

describe('question bank', () => {
  it('questions are not repeated word for word', () => {
    const seen = new Map<string, string>();
    const dupes: string[] = [];
    for (const q of QUESTIONS) {
      const key = q.stem.trim().toLowerCase();
      if (seen.has(key)) dupes.push(`${q.id} repeats ${seen.get(key)}: "${q.stem}"`);
      seen.set(key, q.id);
    }
    assert.equal(dupes.length, 0, list(dupes));
  });

  it('the right answer is never also offered as a near-copy', () => {
    const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const out = QUESTIONS.filter((q) => new Set(q.options.map(norm)).size !== q.options.length).map((q) => q.id);
    assert.equal(out.length, 0, list(out));
  });
});

describe('reading dates (used by the checks above)', () => {
  it('understands the ways the content writes dates', () => {
    const cases: Array<[string, number | null]> = [
      ['c. 2600 BCE', -2600],
      ['c. 321–185 BCE', -321],
      ['6 June 1674', 1674],
      ['1003 CE', 1003],
      ['5th century CE', 450],
      ['c. 5th–4th century BCE', -450],
      ['26 January 1950', 1950],
      ['the building season', null],
    ];
    for (const [text, year] of cases) assert.equal(firstYear(text), year, text);
  });
});
