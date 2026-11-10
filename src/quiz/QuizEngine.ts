import type { QuestionBank, DrawnQuestion } from './QuestionBank';
import type { SaveStore } from '../core/Save';
import { bus } from '../core/EventBus';
import { audio } from '../core/Audio';
import { getZone } from '../content/zones';

/**
 * A quiz round.
 *
 * Deliberate design choices, because this is the part that has to teach rather
 * than test: the explanation is shown for every answer including correct ones;
 * a wrong answer reveals the right one rather than letting you guess again; and
 * nothing is lost by getting something wrong — Vidya is earned, never deducted.
 * Failure has to be cheap or children stop taking swings at hard questions.
 */

export type QuizReason = 'challenge' | 'seal' | 'practice';

export interface QuizAnswerRecord {
  question: DrawnQuestion;
  /** Index the learner chose, or -1 if they ran out of time / skipped. */
  chosen: number;
  correct: boolean;
}

export interface QuizStartOptions {
  zoneId: string | null;
  reason: QuizReason;
  count: number;
  /** Percentage needed to pass, for gated rounds. Default: 70 for seals. */
  passMark?: number;
  seed?: string;
}

export interface QuizResult {
  zoneId: string | null;
  reason: QuizReason;
  total: number;
  correct: number;
  percent: number;
  passMark: number;
  passed: boolean;
  vidyaEarned: number;
  answers: QuizAnswerRecord[];
  /** Per-skill tally for this round. */
  skills: Array<{ skill: string; asked: number; right: number }>;
  /** Questions worth revisiting, for the results screen. */
  review: QuizAnswerRecord[];
  elapsedSeconds: number;
}

interface Session {
  zoneId: string | null;
  reason: QuizReason;
  questions: DrawnQuestion[];
  index: number;
  answers: QuizAnswerRecord[];
  passMark: number;
  startedAt: number;
  /** True once the current question has been answered and explained. */
  revealed: boolean;
}

const VIDYA_PER_CORRECT = 18;
const PERFECT_BONUS = 60;

export class QuizEngine {
  private readonly bank: QuestionBank;
  private readonly save: SaveStore;
  private session: Session | null = null;

  constructor(bank: QuestionBank, save: SaveStore) {
    this.bank = bank;
    this.save = save;
  }

  get active(): boolean {
    return this.session !== null;
  }

  get reason(): QuizReason | null {
    return this.session?.reason ?? null;
  }

  get zoneId(): string | null {
    return this.session?.zoneId ?? null;
  }

  /** The question on screen, or null if no round is running. */
  get question(): DrawnQuestion | null {
    const s = this.session;
    if (!s) return null;
    return s.questions[s.index] ?? null;
  }

  get revealed(): boolean {
    return this.session?.revealed ?? false;
  }

  get total(): number {
    return this.session?.questions.length ?? 0;
  }

  get index(): number {
    return this.session?.index ?? 0;
  }

  /** Marks for the progress meter: one per question. */
  get marks(): Array<'ok' | 'no' | 'now' | 'pending'> {
    const s = this.session;
    if (!s) return [];
    return s.questions.map((_, i) => {
      const record = s.answers[i];
      if (record) return record.correct ? 'ok' : 'no';
      return i === s.index ? 'now' : 'pending';
    });
  }

  get tally(): { correct: number; answered: number; total: number } {
    const s = this.session;
    if (!s) return { correct: 0, answered: 0, total: 0 };
    return {
      correct: s.answers.filter((a) => a.correct).length,
      answered: s.answers.length,
      total: s.questions.length,
    };
  }

  // ------------------------------------------------------------------ start

  /** Begin a round. Returns false if no questions could be drawn. */
  start(opts: QuizStartOptions): boolean {
    const count = Math.max(1, Math.round(opts.count));
    // Seals draw more from the authored bank — they are the assessment.
    const generatedShare = opts.reason === 'seal' ? 0.25 : opts.reason === 'practice' ? 0.45 : 0.3;
    const questions = this.bank.draw({
      zoneId: opts.zoneId,
      count,
      generatedShare,
      seed: opts.seed,
    });

    if (questions.length === 0) {
      console.warn('[Quiz] no questions available', opts);
      return false;
    }

    this.session = {
      zoneId: opts.zoneId,
      reason: opts.reason,
      questions,
      index: 0,
      answers: [],
      passMark: opts.passMark ?? (opts.reason === 'seal' ? 70 : 0),
      startedAt: Date.now(),
      revealed: false,
    };
    return true;
  }

  // ----------------------------------------------------------------- answer

  /**
   * Submit an answer for the current question. Idempotent: answering twice
   * does nothing, so a double-click cannot skip a question.
   */
  answer(chosen: number): { correct: boolean; correctIndex: number; explain: string } | null {
    const s = this.session;
    const q = this.question;
    if (!s || !q || s.revealed) return null;

    const correct = chosen === q.answer;
    s.answers[s.index] = { question: q, chosen, correct };
    s.revealed = true;

    this.save.recordAnswer(q.id, correct);

    if (correct) {
      const gain = VIDYA_PER_CORRECT * q.difficulty;
      this.save.addVidya(gain);
      bus.emit('vidya:gain', { amount: gain, reason: 'Correct answer' });
      audio.success(Math.min(4, 1 + q.difficulty));
    } else {
      audio.failure();
    }

    return { correct, correctIndex: q.answer, explain: q.explain };
  }

  /** Skip without answering. Counts as wrong, but records the attempt. */
  skip(): void {
    const s = this.session;
    const q = this.question;
    if (!s || !q || s.revealed) return;
    s.answers[s.index] = { question: q, chosen: -1, correct: false };
    s.revealed = true;
    this.save.recordAnswer(q.id, false);
  }

  /** Move to the next question. Returns false when the round is over. */
  advance(): boolean {
    const s = this.session;
    if (!s) return false;
    if (!s.revealed) return true; // must answer first
    if (s.index >= s.questions.length - 1) return false;
    s.index++;
    s.revealed = false;
    return true;
  }

  get hasMore(): boolean {
    const s = this.session;
    if (!s) return false;
    return s.index < s.questions.length - 1;
  }

  // ----------------------------------------------------------------- finish

  /** Close the round and compute the result. */
  finish(): QuizResult | null {
    const s = this.session;
    if (!s) return null;

    const answers = s.questions.map(
      (q, i) => s.answers[i] ?? { question: q, chosen: -1, correct: false },
    );
    const correct = answers.filter((a) => a.correct).length;
    const total = answers.length;
    const percent = total > 0 ? Math.round((correct / total) * 100) : 0;
    const passed = percent >= s.passMark;

    let vidyaEarned = answers.reduce((sum, a) => (a.correct ? sum + VIDYA_PER_CORRECT * a.question.difficulty : sum), 0);
    if (correct === total && total >= 3) {
      vidyaEarned += PERFECT_BONUS;
      this.save.addVidya(PERFECT_BONUS);
      bus.emit('vidya:gain', { amount: PERFECT_BONUS, reason: 'Perfect round' });
    }

    // Per-skill tally for this round.
    const skillMap = new Map<string, { asked: number; right: number }>();
    for (const a of answers) {
      const entry = skillMap.get(a.question.skill) ?? { asked: 0, right: 0 };
      entry.asked++;
      if (a.correct) entry.right++;
      skillMap.set(a.question.skill, entry);
    }

    // Chapter seals are recorded against the zone.
    if (s.reason === 'seal' && s.zoneId) {
      const progress = this.save.zone(s.zoneId);
      if (percent > progress.bestSeal) progress.bestSeal = percent;
      if (passed && !progress.sealed) {
        progress.sealed = true;
        audio.bell();
        const zone = getZone(s.zoneId);
        bus.emit('toast', {
          kind: 'vidya',
          icon: '🔔',
          title: `Chapter sealed — ${zone?.name ?? s.zoneId}`,
          body: `${percent}% on the chapter assessment.`,
          ttl: 7000,
        });
        bus.emit('chapter:sealed', { zoneId: s.zoneId, percent });
      }
      this.save.markDirty();
    }

    if (s.zoneId) {
      bus.emit('quiz:finish', { zoneId: s.zoneId, correct, total });
    }

    const result: QuizResult = {
      zoneId: s.zoneId,
      reason: s.reason,
      total,
      correct,
      percent,
      passMark: s.passMark,
      passed,
      vidyaEarned,
      answers,
      skills: [...skillMap.entries()].map(([skill, v]) => ({ skill, asked: v.asked, right: v.right })),
      review: answers.filter((a) => !a.correct),
      elapsedSeconds: Math.round((Date.now() - s.startedAt) / 1000),
    };

    this.session = null;
    this.save.flush();
    return result;
  }

  /** Abandon the round without recording a result. Answers already given stand. */
  abort(): void {
    this.session = null;
  }
}
