import type { ChallengeSpec } from '../content/types';

/**
 * Mini-game plumbing.
 *
 * Each challenge kind has a runner. A runner receives its challenge and a host
 * (the shell around the puzzle: the brief, the area to draw in, the footer) and
 * returns a promise that settles when the player has finished a round — passed
 * or not. The manager shows the result and, if the round was not passed, offers
 * a retry. Nothing is ever deducted: a game that can be lost (archery) just
 * offers another go.
 */

export interface MiniGameResult {
  passed: boolean;
  /** 0–100. How cleanly it went; scales the Vidya payout, never gates it. */
  score: number;
  /** Short facts for the result card, e.g. "3 attempts" or "Hit 4 of 8". */
  stats: string[];
}

export interface GameHost {
  /** Where the puzzle draws. Cleared between rounds. */
  readonly area: HTMLElement;
  /** Footer buttons for the current round. Cleared between rounds. */
  readonly foot: HTMLElement;
  /** One line under the brief: progress, a score, a nudge. */
  setStatus(text: string): void;
  /** Register cleanup (window listeners, animation frames) for when the round ends or the player leaves. */
  onDispose(fn: () => void): void;
  /** True once the overlay is gone. Long-running loops should stop. */
  readonly closed: boolean;
}

export type GameRunner<K extends ChallengeSpec['kind']> = (
  challenge: Extract<ChallengeSpec, { kind: K }>,
  host: GameHost,
) => Promise<MiniGameResult>;
