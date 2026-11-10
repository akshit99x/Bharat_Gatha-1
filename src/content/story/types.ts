/**
 * Story schema.
 *
 * The narrative layer is data, like everything else in `content/`. It names
 * zones, landmarks, challenges, NPCs and codex entries by id and never imports
 * from `world/`, `player/` or `ui/`; `validateStory()` (in `index.ts`) checks
 * that every one of those ids resolves.
 *
 * The premise: the island holds the Gatha, a scroll of eleven painted panels,
 * and a haze called the Dhundh is smudging it. The Dhundh works in two ways —
 * it gilds the past into a flattering fairy-tale, or erases it into a shrug —
 * and the only thing it cannot survive is the question "how do we know that?".
 * That question is the game's evidence-type system, so the story and the
 * learning rules are the same thing.
 */

import type { DialogueNode, SourceType } from '../types';

// ---------------------------------------------------------------- verdicts

/**
 * Where a claim honestly belongs once the evidence has been read.
 *
 * The four source types are the codex's own. The other two exist because the
 * Dhundh deals in claims that are not simply "archaeology" or "debate":
 *
 * - `unsupported` — nothing in the evidence backs it (the Taj workers' hands).
 * - `overstated`  — there is a true core, stretched past what the evidence
 *                   carries ("the Cholas had democracy").
 */
export type PlaqueVerdict = SourceType | 'unsupported' | 'overstated';

export const VERDICT_ORDER: readonly PlaqueVerdict[] = [
  'archaeology',
  'text',
  'epic',
  'debate',
  'overstated',
  'unsupported',
];

export const VERDICT_LABEL: Record<PlaqueVerdict, string> = {
  archaeology: 'Archaeology',
  text: 'Written source',
  epic: 'Epic tradition',
  debate: 'Debated',
  overstated: 'Overstated',
  unsupported: 'No evidence',
};

export const VERDICT_GLOSS: Record<PlaqueVerdict, string> = {
  archaeology: 'It rests on digs, inscriptions, coins or other material evidence.',
  text: 'It rests on a dated written source.',
  epic: 'It belongs to the epic tradition — cultural truth, not a dig report.',
  debate: 'Historians genuinely disagree, and both readings deserve to be shown.',
  overstated: 'There is a true core, stretched further than the evidence goes.',
  unsupported: 'Nothing in the evidence supports it.',
};

// ---------------------------------------------------------------- voices

/** The two voices that are not NPCs. Everyone else is looked up by NPC id. */
export type StoryVoice = 'maitri' | 'ekarupa';

/** Ekarupa's two masks. The Gilder flatters; the Eraser dismisses. */
export type Mask = 'gilder' | 'eraser';

export interface StoryLine {
  who: StoryVoice;
  text: string;
  /** Only meaningful for Ekarupa. */
  mask?: Mask;
}

/** The three motifs that run through all eleven regions. */
export type Motif = 'water' | 'writing' | 'measure';

export const MOTIF_LABEL: Record<Motif, { name: string; glyph: string; gloss: string }> = {
  water: { name: 'Water', glyph: '💧', gloss: 'Every civilisation’s first serious engineering problem.' },
  writing: { name: 'Writing', glyph: '✍️', gloss: 'How the dead talk to us — or fail to.' },
  measure: { name: 'Measure', glyph: '⚖️', gloss: 'To measure is to agree on what is real.' },
};

// ---------------------------------------------------------------- plaques

/**
 * A weathered plaque with the Dhundh clinging to it.
 *
 * It states a popular claim. The player reads the evidence (the codex entries
 * in `requires`) and says where the honest version of the claim belongs. A
 * wrong answer is never punished: the plaque stays, Maitri explains, try again.
 */
export interface Plaque {
  id: string;
  zoneId: string;
  /** Landmark this stands beside. The world works out the exact spot. */
  near: string;
  /** The claim, as it is usually repeated. */
  claim: string;
  /** Which mask is speaking: the Gilder flatters, the Eraser dismisses. */
  mask: Mask;
  /** The evidence label the plaque wears — usually the wrong one. */
  shown: SourceType | 'none';
  /** The honest answer. */
  verdict: PlaqueVerdict;
  /** Prompt override; the default is "Where does the honest version of this claim belong?" */
  ask?: string;
  /** Codex entries the player must have recorded before they can judge. */
  requires: string[];
  /** What the evidence actually shows, written for a 12–16 year old. */
  correction: string;
  /** Per-wrong-answer nudges. Anything missing falls back to a generic one. */
  nudge?: Partial<Record<PlaqueVerdict, string>>;
}

// ---------------------------------------------------------------- beats

/** After a challenge is completed, an anchor says one thing that only they could. */
export interface AnchorBeat {
  /** Challenge id; the beat fires the first time it is completed. */
  after: string;
  npcId: string;
  text: string;
}

/** The person this chapter's history almost forgot. Remembered when the panel is restored. */
export interface ForgottenMaker {
  /** The NPC who stands for them. */
  npcId: string;
  /** Who, in one line — shown in the Keeper's Log and offered on the Twelfth Panel. */
  who: string;
  /** What the record can actually tell us, no more. */
  record: string;
  source: SourceType;
}

/**
 * A short trail across a region, three people deep.
 *
 * Each stop fires when the player speaks to the named NPC, in order. It is the
 * cheapest quest shape there is and it makes the player meet the cast.
 */
export interface Trail {
  id: string;
  title: string;
  brief: string;
  /**
   * Each stop but the last says where to go next. Speaking to the last one
   * completes the trail, and Maitri delivers `payoff` instead.
   */
  stops: Array<{ npcId: string; say?: string }>;
  /** Maitri, once the last stop is done. */
  payoff: string;
  vidya: number;
}

// ---------------------------------------------------------------- panel

export type PanelMotif =
  | 'seal' //       Indus seal pressed into clay
  | 'tablet' //     cuneiform tablet
  | 'threeStyles' // one scene, three painted ways
  | 'causeway' //   the Setu: half bridge, half shoal
  | 'field' //      two armies, one colour
  | 'pillar' //     Ashokan pillar
  | 'granite' //    temple tower with a tiny signature
  | 'wheel' //      Konark wheel with a live shadow
  | 'ruin' //       the city before and after
  | 'tomb' //       white dome, one unpainted border
  | 'fort'; //      fort over a cistern line

export interface Panel {
  title: string;
  /** What the panel shows, for the gallery caption. */
  caption: string;
  motif: PanelMotif;
  /** Which of the three threads this panel carries into the finale. */
  threads: Motif[];
  /** The detail the player is invited to notice. */
  detail: string;
}

// ---------------------------------------------------------------- chapter

export interface ChapterStory {
  zoneId: string;
  /** The chapter's story title. */
  title: string;
  /** Shown the first time the player enters. Maitri, then possibly Ekarupa. */
  hook: StoryLine[];
  /** Extra line when this is the very first region the player lands in. */
  landing: string;
  /** The NPC who carries the chapter's arc. */
  anchorNpcId: string;
  anchorBeats: AnchorBeat[];
  plaques: Plaque[];
  maker: ForgottenMaker;
  trail: Trail;
  /**
   * The panel-restoration conversation, started when the chapter is sealed.
   * Spoken by Maitri. Exactly one node offers the choice; its `wise` flag
   * marks the open-minded pick, and the other options are the comfortable ones.
   */
  restoration: DialogueNode[];
  panel: Panel;
  /** What the chapter's anchor says if the player brings them to the Sabha. */
  witness: string;
}

// ---------------------------------------------------------------- finale

export interface Ending {
  id: 'open' | 'changed' | 'storyteller';
  title: string;
  body: string;
}
