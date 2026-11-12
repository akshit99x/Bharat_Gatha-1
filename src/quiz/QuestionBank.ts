import { Rng } from '../core/Rng';
import type { Question } from '../content/types';
import { QUESTIONS, questionsForZone } from '../content/questions';
import { generateQuestions } from './generators';
import type { SaveStore, QuestionRecord } from '../core/Save';

/**
 * Question selection.
 *
 * Two jobs. First, spaced repetition: a question you got wrong last time comes
 * back soon, one you have answered right three times in a row almost never
 * does. Second, keeping the supply fresh — the authored bank is finite, so a
 * share of every round is generated from the timeline and codex data, which is
 * what the brief means by "keep shuffling in new questions".
 *
 * Option order is shuffled on every draw, so memorising "the answer is always
 * the second one" does not work.
 */

export interface DrawnQuestion {
  /** Stable id, used for the learning record. */
  id: string;
  zoneId: string;
  difficulty: 1 | 2 | 3;
  stem: string;
  context?: string;
  /** Options in the order they will be displayed. */
  options: string[];
  /** Index into the displayed options. */
  answer: number;
  explain: string;
  skill: string;
  tags: string[];
  /** True when this came from a generator rather than the authored bank. */
  generated: boolean;
}

export interface DrawOptions {
  /** Restrict to a zone; null draws from everywhere. */
  zoneId: string | null;
  count: number;
  /** Fraction of the round that should be procedurally generated, 0..1. */
  generatedShare?: number;
  /** Seed for a reproducible round — a teacher can hand out one seed. */
  seed?: string;
  /** Ids to avoid repeating within a session. */
  exclude?: Set<string>;
}

/** Minutes before a recently-asked question is eligible again without penalty. */
const COOLDOWN_MINUTES = 12;

export class QuestionBank {
  private readonly save: SaveStore;
  private drawCounter = 0;
  /** The class's own questions, added by a teacher (see src/net/Cloud.ts). */
  private extra: Question[] = [];

  constructor(save: SaveStore) {
    this.save = save;
  }

  /** Questions a teacher has added for this class. They are drawn alongside the authored ones. */
  setClassQuestions(list: Question[]): void {
    this.extra = list;
  }

  get classQuestionCount(): number {
    return this.extra.length;
  }

  /** How many authored questions exist for a zone. */
  authoredCount(zoneId: string): number {
    return questionsForZone(zoneId).length;
  }

  get totalAuthored(): number {
    return QUESTIONS.length;
  }

  /**
   * Draw a round. Returns as many as it can — if the authored pool for a zone
   * is thin, the shortfall is made up from generators rather than repeating.
   */
  draw(opts: DrawOptions): DrawnQuestion[] {
    const rng = new Rng(opts.seed ?? `${this.save.profile.worldSeed}:draw:${this.drawCounter++}:${Date.now() & 0xffff}`);
    const exclude = new Set(opts.exclude ?? []);
    const share = clamp01(opts.generatedShare ?? 0.3);

    const wantGenerated = Math.min(opts.count, Math.round(opts.count * share));
    const wantAuthored = opts.count - wantGenerated;

    const authored = this.pickAuthored(rng, opts.zoneId, wantAuthored, exclude);
    for (const q of authored) exclude.add(q.id);

    const generated = generateQuestions(rng, opts.zoneId, wantGenerated, exclude);
    for (const q of generated) exclude.add(q.id);

    // Top up from whichever side can still supply, so a round is never short.
    let pool = [...authored, ...generated];
    if (pool.length < opts.count) {
      const extraGenerated = generateQuestions(rng, opts.zoneId, opts.count - pool.length, exclude);
      for (const q of extraGenerated) exclude.add(q.id);
      pool = [...pool, ...extraGenerated];
    }
    if (pool.length < opts.count) {
      const extraAuthored = this.pickAuthored(rng, null, opts.count - pool.length, exclude);
      pool = [...pool, ...extraAuthored];
    }

    // Easiest first: a round that opens with a hard question feels punishing.
    const ordered = rng
      .shuffled(pool)
      .sort((a, b) => a.difficulty - b.difficulty)
      .slice(0, opts.count);

    return ordered.map((q) => this.present(q, rng, q.id.startsWith('gen:')));
  }

  /** Draw a single question — used after a challenge, when one is enough. */
  drawOne(zoneId: string | null, exclude?: Set<string>): DrawnQuestion | null {
    const [first] = this.draw({ zoneId, count: 1, exclude });
    return first ?? null;
  }

  // ------------------------------------------------------------- selection

  private pickAuthored(rng: Rng, zoneId: string | null, count: number, exclude: Set<string>): Question[] {
    if (count <= 0) return [];
    const own = zoneId ? this.extra.filter((q) => q.zoneId === zoneId || q.zoneId === 'general') : this.extra;
    const base = zoneId ? [...questionsForZone(zoneId), ...questionsForZone('general'), ...own] : [...QUESTIONS, ...own];
    const candidates = base.filter((q) => !exclude.has(q.id));
    if (candidates.length === 0) return [];

    const picked: Question[] = [];
    const remaining = [...candidates];
    const now = Date.now();

    while (picked.length < count && remaining.length > 0) {
      const chosen = rng.weighted(remaining, (q) => this.weightFor(q, now));
      picked.push(chosen);
      remaining.splice(remaining.indexOf(chosen), 1);
    }
    return picked;
  }

  /**
   * Spaced-repetition weight.
   *
   * The ordering that matters: recently-wrong questions outrank unseen ones,
   * and well-mastered ones nearly vanish without disappearing entirely.
   */
  private weightFor(q: Question, now: number): number {
    const rec: QuestionRecord | undefined = this.save.profile.questions[q.id];
    if (!rec || rec.seen === 0) return 3.0;

    let weight: number;
    if (rec.streak === 0) weight = 6.0; // got it wrong last time — bring it back
    else if (rec.streak === 1) weight = 2.2;
    else if (rec.streak === 2) weight = 1.0;
    else weight = 0.3; // mastered

    // Accuracy over time nudges it too: a question answered right 1-in-5 times
    // is worth more attention than its streak alone suggests.
    const accuracy = rec.right / Math.max(1, rec.seen);
    weight *= 1.6 - accuracy * 0.8;

    // Do not ask the same thing twice in one sitting.
    const minutesSince = (now - rec.last) / 60000;
    if (minutesSince < COOLDOWN_MINUTES) weight *= 0.12;

    return Math.max(0.05, weight);
  }

  /** Shuffle the options and remap the answer index. */
  private present(q: Question, rng: Rng, generated: boolean): DrawnQuestion {
    const indices = rng.shuffled(q.options.map((_, i) => i));
    const options = indices.map((i) => q.options[i] as string);
    const answer = indices.indexOf(q.answer);
    return {
      id: q.id,
      zoneId: q.zoneId,
      difficulty: q.difficulty,
      stem: q.stem,
      context: q.context,
      options,
      answer: answer >= 0 ? answer : 0,
      explain: q.explain,
      skill: q.skill,
      tags: q.tags,
      generated,
    };
  }

  // ---------------------------------------------------------------- mastery

  /** Fraction of a zone's authored questions answered right at least twice. */
  masteryFor(zoneId: string): number {
    const pool = questionsForZone(zoneId);
    if (pool.length === 0) return 0;
    let mastered = 0;
    for (const q of pool) {
      const rec = this.save.profile.questions[q.id];
      if (rec && rec.streak >= 2) mastered++;
    }
    return mastered / pool.length;
  }

  /** Per-skill accuracy across everything answered so far. */
  skillBreakdown(): Array<{ skill: string; asked: number; right: number; accuracy: number }> {
    const map = new Map<string, { asked: number; right: number }>();
    const skillOf = new Map([...QUESTIONS, ...this.extra].map((q) => [q.id, q.skill]));

    for (const [id, rec] of Object.entries(this.save.profile.questions)) {
      // Generated ids encode their generator, which maps onto a skill name.
      const skill = skillOf.get(id) ?? skillForGeneratedId(id);
      if (!skill) continue;
      const entry = map.get(skill) ?? { asked: 0, right: 0 };
      entry.asked += rec.seen;
      entry.right += rec.right;
      map.set(skill, entry);
    }

    return [...map.entries()]
      .map(([skill, v]) => ({ skill, asked: v.asked, right: v.right, accuracy: v.asked > 0 ? v.right / v.asked : 0 }))
      .sort((a, b) => a.accuracy - b.accuracy);
  }

  /** The weakest skills, for the "what to revise" line on the report card. */
  weakestSkills(limit = 3): string[] {
    return this.skillBreakdown()
      .filter((s) => s.asked >= 3 && s.accuracy < 0.7)
      .slice(0, limit)
      .map((s) => s.skill);
  }
}

function skillForGeneratedId(id: string): string | null {
  if (!id.startsWith('gen:')) return null;
  const kind = id.split(':')[1] ?? '';
  switch (kind) {
    case 'chrono-first':
    case 'chrono-last':
      return 'Chronological reasoning';
    case 'century':
    case 'era-order':
      return 'Dating and periodisation';
    case 'evidence':
      return 'Evaluating evidence';
    case 'region':
      return 'Regional geography';
    default:
      return null;
  }
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
