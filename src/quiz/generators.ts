import { Rng } from '../core/Rng';
import type { Question, Zone } from '../content/types';
import { SOURCE_LABEL, type SourceType } from '../content/types';
import { TIMELINE, centuryLabel, type TimelineEvent } from '../content/timeline';
import { CODEX } from '../content/codex';
import { ZONES, allLandmarks } from '../content/zones';

/**
 * Procedurally generated questions.
 *
 * The authored bank is finite; a class that plays this for a term would exhaust
 * it. These generators build questions from the structured content instead, so
 * the supply is effectively unlimited and — more importantly — the answer key
 * is derived from the data rather than typed by hand. If a date in the timeline
 * is corrected, every chronology question corrects itself.
 *
 * Each generator returns a Question with a stable id derived from its inputs,
 * so the spaced-repetition record still works across sessions.
 */

export interface Generator {
  id: string;
  label: string;
  skill: string;
  /** Produce one question, or null if the data cannot support it this time. */
  generate(rng: Rng, zoneId: string | null): Question | null;
}

const MIN_GAP = 60; // years — below this, "which came first" is unfair

// ----------------------------------------------------------------- helpers

function eventPool(zoneId: string | null): TimelineEvent[] {
  if (!zoneId) return TIMELINE;
  // Weight towards the current zone but keep some outside events, because the
  // interesting comparisons are cross-regional.
  const local = TIMELINE.filter((e) => e.zoneId === zoneId);
  return local.length >= 2 ? [...local, ...TIMELINE] : TIMELINE;
}

/**
 * Pick n events whose years are all at least MIN_GAP apart. Events whose date historians dispute are left out: a
 * "which came first" question built on one would mark a student wrong on a date nobody agrees on.
 */
function spreadEvents(rng: Rng, pool: TimelineEvent[], n: number, tries = 40): TimelineEvent[] | null {
  const dated = dedupe(pool).filter((e) => !e.contested);
  for (let t = 0; t < tries; t++) {
    const picked = rng.sample(dated, n);
    if (picked.length < n) return null;
    const years = picked.map((e) => e.year).sort((a, b) => a - b);
    let ok = true;
    for (let i = 1; i < years.length; i++) {
      if ((years[i] as number) - (years[i - 1] as number) < MIN_GAP) {
        ok = false;
        break;
      }
    }
    if (ok) return picked;
  }
  return null;
}

function dedupe(events: TimelineEvent[]): TimelineEvent[] {
  const seen = new Set<string>();
  const out: TimelineEvent[] = [];
  for (const e of events) {
    if (seen.has(e.id)) continue;
    seen.add(e.id);
    out.push(e);
  }
  return out;
}

// -------------------------------------------------------------- generators

/** Which of four events came first? */
const chronoFirst: Generator = {
  id: 'chrono-first',
  label: 'Chronology — earliest',
  skill: 'Chronological reasoning',
  generate(rng, zoneId) {
    const picked = spreadEvents(rng, eventPool(zoneId), 4);
    if (!picked) return null;
    const sorted = [...picked].sort((a, b) => a.year - b.year);
    const answer = sorted[0] as TimelineEvent;
    const key = picked.map((e) => e.id).sort().join('|');
    return {
      id: `gen:chrono-first:${key}`,
      zoneId: zoneId ?? 'general',
      difficulty: 2,
      stem: 'Which of these happened first?',
      options: picked.map((e) => e.label),
      answer: picked.indexOf(answer),
      explain: `${answer.label} — ${answer.displayDate}. In order: ${sorted
        .map((e) => `${e.label} (${e.displayDate})`)
        .join(', then ')}.`,
      tags: ['chronology', 'generated'],
      skill: 'Chronological reasoning',
    };
  },
};

/** Which of four events came last? */
const chronoLast: Generator = {
  id: 'chrono-last',
  label: 'Chronology — latest',
  skill: 'Chronological reasoning',
  generate(rng, zoneId) {
    const picked = spreadEvents(rng, eventPool(zoneId), 4);
    if (!picked) return null;
    const sorted = [...picked].sort((a, b) => a.year - b.year);
    const answer = sorted[sorted.length - 1] as TimelineEvent;
    const key = picked.map((e) => e.id).sort().join('|');
    return {
      id: `gen:chrono-last:${key}`,
      zoneId: zoneId ?? 'general',
      difficulty: 2,
      stem: 'Which of these happened most recently?',
      options: picked.map((e) => e.label),
      answer: picked.indexOf(answer),
      explain: `${answer.label} — ${answer.displayDate}. In order: ${sorted
        .map((e) => `${e.label} (${e.displayDate})`)
        .join(', then ')}.`,
      tags: ['chronology', 'generated'],
      skill: 'Chronological reasoning',
    };
  },
};

/** Roughly which century did this happen in? */
const centuryOf: Generator = {
  id: 'century-of',
  label: 'Dating — century',
  skill: 'Dating and periodisation',
  generate(rng, zoneId) {
    const pool = dedupe(eventPool(zoneId)).filter((e) => !e.contested);
    if (pool.length === 0) return null;
    const event = rng.pick(pool);
    const correct = centuryLabel(event.year);

    // Distractors: nearby centuries on the same side of the era boundary, plus
    // one from the other side so the BCE/CE distinction is actually tested.
    const offsets = rng.shuffled([-3, -2, -1, 1, 2, 3]);
    const options = new Set<string>([correct]);
    for (const off of offsets) {
      if (options.size >= 4) break;
      const shifted = event.year + off * 100;
      if (shifted === 0) continue;
      options.add(centuryLabel(shifted));
    }
    const list = rng.shuffled([...options]).slice(0, 4);
    if (!list.includes(correct)) list[0] = correct;
    const shuffled = rng.shuffled(list);

    return {
      id: `gen:century:${event.id}`,
      zoneId: zoneId ?? event.zoneId,
      difficulty: 2,
      stem: `Roughly when did this happen: ${event.label}?`,
      options: shuffled,
      answer: shuffled.indexOf(correct),
      explain: `${event.displayDate}. ${event.detail}`,
      tags: ['dating', 'generated'],
      skill: 'Dating and periodisation',
    };
  },
};

/**
 * What kind of evidence supports this claim?
 *
 * This is the generator worth having. It takes the source tag the codex already
 * carries and turns the game's own epistemic honesty into a testable skill:
 * knowing whether something rests on a dig, a document, an epic or an argument.
 */
const evidenceType: Generator = {
  id: 'evidence-type',
  label: 'Evidence — what kind?',
  skill: 'Evaluating evidence',
  generate(rng, zoneId) {
    const pool = zoneId ? CODEX.filter((c) => c.zoneId === zoneId) : CODEX;
    const usable = (pool.length > 0 ? pool : CODEX).filter((c) => c.body.length > 0);
    if (usable.length === 0) return null;
    const entry = rng.pick(usable);
    const kinds: SourceType[] = ['archaeology', 'text', 'epic', 'debate'];
    const options = kinds.map((k) => SOURCE_LABEL[k]);
    const correct = SOURCE_LABEL[entry.source];
    const shuffled = rng.shuffled(options);

    const sentence = firstSentence(entry.body[0] as string);
    return {
      id: `gen:evidence:${entry.id}`,
      zoneId: entry.zoneId,
      difficulty: 3,
      stem: `What kind of evidence is "${entry.title}" based on?`,
      context: sentence,
      options: shuffled,
      answer: shuffled.indexOf(correct),
      explain: explainSource(entry.source),
      tags: ['evidence', 'historiography', 'generated'],
      skill: 'Evaluating evidence',
    };
  },
};

/** Where in the world would you find this monument? */
const landmarkRegion: Generator = {
  id: 'landmark-region',
  label: 'Geography — which region?',
  skill: 'Regional geography',
  generate(rng, zoneId) {
    const all = allLandmarks().filter((l) => l.landmark.signposted && l.landmark.codexId);
    if (all.length < 2 || ZONES.length < 4) return null;
    // Prefer a landmark the player has not just been standing next to.
    const candidates = zoneId ? all.filter((l) => l.zone.id !== zoneId) : all;
    const chosen = rng.pick(candidates.length >= 2 ? candidates : all);

    const wrongZones = rng.sample(
      ZONES.filter((z) => z.id !== chosen.zone.id),
      3,
    );
    const options = rng.shuffled([chosen.zone.name, ...wrongZones.map((z) => z.name)]);

    return {
      id: `gen:region:${chosen.landmark.id}`,
      zoneId: chosen.zone.id,
      difficulty: 1,
      stem: `In which region of the map would you find "${chosen.landmark.name}"?`,
      options,
      answer: options.indexOf(chosen.zone.name),
      explain: `${chosen.landmark.name} stands in ${chosen.zone.name} (${chosen.zone.era}).`,
      tags: ['geography', 'generated'],
      skill: 'Regional geography',
    };
  },
};

/** Which of these periods is the oldest? Tests era ordering across regions. */
const eraOrder: Generator = {
  id: 'era-order',
  label: 'Periodisation — oldest region',
  skill: 'Dating and periodisation',
  generate(rng) {
    // Regions that start in the same year (the two epic regions share their text's date) would give two right
    // answers, so at most one region per start year goes into a question.
    const byStart = new Map<number, Zone>();
    for (const z of rng.shuffled(ZONES)) if (!byStart.has(z.eraStart)) byStart.set(z.eraStart, z);
    if (byStart.size < 4) return null;
    const picked = rng.sample([...byStart.values()], 4);
    const sorted = [...picked].sort((a, b) => a.eraStart - b.eraStart);
    const answer = sorted[0]!;
    const options = picked.map((z) => `${z.name} (${z.era})`);
    const key = picked.map((z) => z.id).sort().join('|');
    return {
      id: `gen:era-order:${key}`,
      zoneId: 'general',
      difficulty: 2,
      stem: 'Which of these begins earliest?',
      options,
      answer: picked.indexOf(answer),
      explain: `${answer.name} — ${answer.era}. Oldest first: ${sorted.map((z) => z.name).join(' → ')}.`,
      tags: ['periodisation', 'generated'],
      skill: 'Dating and periodisation',
    };
  },
};

export const GENERATORS: Generator[] = [chronoFirst, chronoLast, centuryOf, evidenceType, landmarkRegion, eraOrder];

/**
 * Generate up to `count` distinct questions, avoiding ids in `exclude`.
 * Returns fewer than requested rather than looping forever.
 */
export function generateQuestions(rng: Rng, zoneId: string | null, count: number, exclude = new Set<string>()): Question[] {
  const out: Question[] = [];
  const seen = new Set(exclude);
  const budget = count * 12;
  for (let attempt = 0; attempt < budget && out.length < count; attempt++) {
    const gen = rng.pick(GENERATORS);
    const q = gen.generate(rng, zoneId);
    if (!q) continue;
    if (seen.has(q.id)) continue;
    // A generated question with a duff answer index is a bug; drop it rather
    // than show the player something unanswerable.
    if (q.answer < 0 || q.answer >= q.options.length) continue;
    if (new Set(q.options).size !== q.options.length) continue;
    seen.add(q.id);
    out.push(q);
  }
  return out;
}

// ------------------------------------------------------------------ support

function firstSentence(text: string): string {
  const match = /^(.{40,260}?[.!?])\s/.exec(`${text} `);
  return match ? (match[1] as string) : text.slice(0, 220);
}

function explainSource(source: SourceType): string {
  switch (source) {
    case 'archaeology':
      return 'Archaeology: the claim rests on excavated material — structures, artefacts, bones, sediment cores. You can go and look at it.';
    case 'text':
      return 'A written source: an inscription, a treatise or a chronicle whose date and authorship can be reasonably established. Reliable about what it says, biased about what it leaves out.';
    case 'epic':
      return 'Epic tradition: a narrative transmitted and reshaped over centuries. It tells you what a culture valued, which is real evidence — but it is not a dig report.';
    case 'debate':
      return 'Debated: historians genuinely disagree, usually because the evidence is thin or can be read more than one way. The honest answer is to hold both readings.';
    default:
      return '';
  }
}
