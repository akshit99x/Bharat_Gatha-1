import { bus } from '../core/EventBus';
import type { SaveStore, StoryState, TwelfthPanel } from '../core/Save';
import { getCodex } from '../content/codex';
import { ZONES, getZone } from '../content/zones';
import type { CodexEntry, NpcSpec, SourceType, Zone } from '../content/types';
import {
  ALL_PLAQUES,
  CHAPTERS,
  ENDINGS,
  getChapter,
  getPlaque,
  type ChapterStory,
  type Ending,
  type Plaque,
  type PlaqueVerdict,
  type StoryLine,
  type Trail,
} from '../content/story';

/**
 * Story logic.
 *
 * No DOM, no three.js: this reads and writes the save and the content, and
 * returns plain data for the UI to present. That keeps every rule here — what
 * counts as a correct plaque, when a panel can be restored, which ending is
 * heard — testable without a browser.
 */

/** Vidya for correcting a plaque. The first correct answer earns more than a retry. */
const PLAQUE_VIDYA = 70;
const PLAQUE_FIRST_TRY_BONUS = 25;
const PANEL_VIDYA = 120;
/** How many restored panels it takes before the Sabha can be convened. */
export const SABHA_MIN_PANELS = 3;
/** How many claims Ekarupa may press in one Sabha, so a long game does not mean a long trial. */
const SABHA_MAX_CLAIMS = 8;

export interface Speaker {
  name: string;
  role: string;
  icon: string;
}

export const MAITRI: Speaker = { name: 'Maitri', role: 'Keeper of the Gatha', icon: '📜' };
export const EKARUPA: Speaker = { name: 'Ekarupa', role: 'The Dhundh — “of one form”', icon: '🌫️' };

export interface EvidenceRow {
  id: string;
  title: string;
  source: SourceType;
  known: boolean;
  /** How to get it, when the player does not have it yet. */
  whereToFind: string;
}

export interface TrailStep {
  trail: Trail;
  /** What Maitri says now. */
  text: string;
  /** True when this was the last stop. */
  complete: boolean;
}

export interface ObjectiveRow {
  id: string;
  text: string;
  done: boolean;
  active: boolean;
}

export interface TwelfthOptions {
  sure: CodexEntry[];
  tradition: CodexEntry[];
  open: CodexEntry[];
  remembered: Array<{ zone: Zone; story: ChapterStory }>;
}

export class StoryEngine {
  /** A seal that has been passed but whose panel has not been restored yet. */
  private pendingSeals: string[] = [];

  constructor(private readonly save: SaveStore) {}

  get state(): StoryState {
    return this.save.story;
  }

  // ------------------------------------------------------------ bookkeeping

  /** Returns true the first time an id is seen, and records it. */
  once(id: string): boolean {
    const seen = this.state.seen;
    if (seen.includes(id)) return false;
    seen.push(id);
    this.save.markDirty();
    return true;
  }

  speakerFor(npcId: string): Speaker | null {
    const npc = findNpc(npcId);
    return npc ? { name: npc.name, role: npc.role, icon: npc.icon } : null;
  }

  // ----------------------------------------------------------------- prologue

  prologueSeen(): boolean {
    return this.state.prologueSeen;
  }

  markPrologueSeen(): void {
    this.state.prologueSeen = true;
    this.save.markDirty();
  }

  // -------------------------------------------------------------------- zones

  /**
   * Lines to say on entering a region, or null if it has been heard before.
   * The very first region the player ever lands in also gets its landing line,
   * because the vimana lets them drop anywhere and the story cannot assume
   * Chapter 1.
   */
  onZoneEnter(zoneId: string): StoryLine[] | null {
    const chapter = getChapter(zoneId);
    if (!chapter || !this.once(`hook:${zoneId}`)) return null;
    const lines: StoryLine[] = [];
    if (this.state.firstZone === null) {
      this.state.firstZone = zoneId;
      lines.push({ who: 'maitri', text: chapter.landing });
    }
    lines.push(...chapter.hook);
    return lines;
  }

  /** Share of this zone's plaques still clouded, 0–1. A restored panel clears the zone. */
  hazeLevel(zoneId: string): number {
    const chapter = getChapter(zoneId);
    if (!chapter || this.state.panels.includes(zoneId)) return 0;
    const open = chapter.plaques.filter((p) => !this.plaqueDone(p.id)).length;
    return open / Math.max(1, chapter.plaques.length);
  }

  // ----------------------------------------------------------------- plaques

  plaqueDone(id: string): boolean {
    return this.state.plaques[id]?.done === true;
  }

  plaqueTries(id: string): number {
    return this.state.plaques[id]?.tries ?? 0;
  }

  plaquesDone(zoneId: string): { done: number; total: number } {
    const list = getChapter(zoneId)?.plaques ?? [];
    return { done: list.filter((p) => this.plaqueDone(p.id)).length, total: list.length };
  }

  /** The codex entries a plaque asks the player to have read, with how to get each one. */
  evidence(plaque: Plaque): EvidenceRow[] {
    return plaque.requires.map((id) => {
      const entry = getCodex(id);
      return {
        id,
        title: entry?.title ?? id,
        source: entry?.source ?? 'archaeology',
        known: this.save.hasCodex(id),
        whereToFind: whereToFind(id),
      };
    });
  }

  canJudge(plaque: Plaque): boolean {
    return plaque.requires.every((id) => this.save.hasCodex(id));
  }

  /**
   * Record an answer. A wrong answer is counted (it feeds the Sabha) and
   * costs nothing; a right one clears the plaque and pays Vidya.
   */
  resolvePlaque(plaque: Plaque, answer: PlaqueVerdict): { correct: boolean; vidya: number } {
    const record = (this.state.plaques[plaque.id] ??= { done: false, tries: 0 });
    if (record.done) return { correct: answer === plaque.verdict, vidya: 0 };

    const correct = answer === plaque.verdict;
    let vidya = 0;
    if (correct) {
      vidya = PLAQUE_VIDYA + (record.tries === 0 ? PLAQUE_FIRST_TRY_BONUS : 0);
      record.done = true;
      this.save.addVidya(vidya);
      bus.emit('vidya:gain', { amount: vidya, reason: 'Corrected a plaque' });
    } else {
      record.tries++;
    }
    this.save.markDirty();
    bus.emit('story:plaque', { plaqueId: plaque.id, correct });
    return { correct, vidya };
  }

  // --------------------------------------------------------- anchors & trails

  /** What an anchor says after a challenge, the first time it is completed. */
  onChallengeDone(challengeId: string): { speaker: Speaker; text: string } | null {
    for (const chapter of CHAPTERS) {
      const beat = chapter.anchorBeats.find((b) => b.after === challengeId);
      if (!beat || !this.once(`beat:${challengeId}`)) continue;
      const speaker = this.speakerFor(beat.npcId);
      if (speaker) return { speaker, text: beat.text };
    }
    return null;
  }

  trailProgress(trailId: string): number {
    return this.state.trails[trailId] ?? 0;
  }

  /** Record that the player has spoken to someone, and advance any trail it belongs to. */
  onNpcSpoken(npcId: string): TrailStep | null {
    if (!this.state.met.includes(npcId)) {
      this.state.met.push(npcId);
      this.save.markDirty();
    }
    for (const chapter of CHAPTERS) {
      const trail = chapter.trail;
      const at = this.trailProgress(trail.id);
      if (at >= trail.stops.length) continue;
      const stop = trail.stops[at];
      if (!stop || stop.npcId !== npcId) continue;

      this.state.trails[trail.id] = at + 1;
      this.save.markDirty();
      if (at + 1 >= trail.stops.length) {
        this.save.addVidya(trail.vidya);
        bus.emit('vidya:gain', { amount: trail.vidya, reason: trail.title });
        return { trail, text: trail.payoff, complete: true };
      }
      return { trail, text: stop.say ?? '', complete: false };
    }
    return null;
  }

  // ----------------------------------------------------------------- panels

  panelRestored(zoneId: string): boolean {
    return this.state.panels.includes(zoneId);
  }

  /** A chapter that has been sealed (now or in an older save) but whose panel is still missing. */
  restorable(zoneId: string): boolean {
    return this.save.zone(zoneId).sealed && !this.panelRestored(zoneId) && getChapter(zoneId) !== undefined;
  }

  /** Remember a seal so its restoration can run once the assessment screen is closed. */
  queueRestoration(zoneId: string): void {
    if (this.restorable(zoneId) && !this.pendingSeals.includes(zoneId)) this.pendingSeals.push(zoneId);
  }

  takePendingRestoration(): string | null {
    return this.pendingSeals.shift() ?? null;
  }

  /**
   * Finish a restoration: count the choice, mark the panel, pay Vidya.
   * `wise` is how many open-minded options the player picked in that dialogue.
   */
  restorePanel(zoneId: string, choice: { wise: number; made: number }): void {
    if (this.panelRestored(zoneId)) return;
    const open = choice.wise > 0;
    this.state.panels.push(zoneId);
    this.state.choices[zoneId] = open ? 'open' : 'comfort';
    if (choice.made > 0) {
      if (open) this.state.openPicks++;
      else this.state.comfortPicks++;
    }
    this.save.addVidya(PANEL_VIDYA);
    this.save.markDirty();
    bus.emit('vidya:gain', { amount: PANEL_VIDYA, reason: 'Restored a panel' });
    bus.emit('story:panel', { zoneId });
  }

  panelsRestored(): number {
    return this.state.panels.length;
  }

  // -------------------------------------------------------------- objectives

  /**
   * The story's rows for the objective panel. Completed ids are also written
   * to `Save.quests`, which was declared in the save format from the start but
   * had nothing to fill it.
   */
  objectives(zone: Zone): ObjectiveRow[] {
    const chapter = getChapter(zone.id);
    if (!chapter) return [];
    const questId = `story.${zone.id}`;
    const rows: ObjectiveRow[] = [];

    const { done: pDone, total } = this.plaquesDone(zone.id);
    rows.push({ id: 'plaques', text: `Correct the plaques (${pDone}/${total})`, done: pDone >= total, active: pDone < total });

    const anchor = findNpc(chapter.anchorNpcId);
    const heard = this.state.met.includes(chapter.anchorNpcId);
    rows.push({ id: 'anchor', text: `Hear ${anchor?.name ?? 'the anchor'} out`, done: heard, active: !heard });

    const stops = chapter.trail.stops.length;
    const at = Math.min(stops, this.trailProgress(chapter.trail.id));
    rows.push({ id: 'trail', text: `${chapter.trail.title} (${at}/${stops})`, done: at >= stops, active: at < stops });

    const restored = this.panelRestored(zone.id);
    rows.push({
      id: 'panel',
      text: restored ? `Panel restored: ${chapter.panel.title}` : 'Restore the panel (seal the chapter)',
      done: restored,
      active: !restored && this.save.zone(zone.id).sealed,
    });

    for (const row of rows) if (row.done) this.save.completeObjective(questId, row.id);
    return rows;
  }

  // ------------------------------------------------------------------- sabha

  sabhaUnlocked(): boolean {
    return this.panelsRestored() >= SABHA_MIN_PANELS;
  }

  /**
   * The claims Ekarupa presses. One per restored chapter, chosen from that
   * chapter's plaques: the one the player has found hardest — never corrected,
   * or corrected only after the most wrong tries — so the finale leans on
   * their own gaps. Ties break on the plaque id, which keeps it deterministic.
   */
  sabhaClaims(): Plaque[] {
    const picks: Plaque[] = [];
    for (const zoneId of this.state.panels) {
      const chapter = getChapter(zoneId);
      if (!chapter) continue;
      const ranked = [...chapter.plaques].sort((a, b) => this.difficulty(b) - this.difficulty(a) || a.id.localeCompare(b.id));
      const pick = ranked[0];
      if (pick) picks.push(pick);
    }
    picks.sort((a, b) => this.difficulty(b) - this.difficulty(a) || a.id.localeCompare(b.id));
    return picks.slice(0, SABHA_MAX_CLAIMS);
  }

  private difficulty(plaque: Plaque): number {
    const rec = this.state.plaques[plaque.id];
    return (rec?.done ? 0 : 5) + (rec?.tries ?? 0);
  }

  sabhaSettled(id: string): boolean {
    return this.state.sabhaSettled.includes(id);
  }

  settleClaim(plaqueId: string): void {
    if (!this.state.sabhaSettled.includes(plaqueId)) {
      this.state.sabhaSettled.push(plaqueId);
      this.save.markDirty();
    }
  }

  finishSabha(): void {
    if (this.state.sabhaDone) return;
    this.state.sabhaDone = true;
    this.save.addVidya(200);
    bus.emit('vidya:gain', { amount: 200, reason: 'Settled the Sabha' });
    this.save.markDirty();
  }

  /** The chapter’s anchor, called as a witness for a claim from that chapter. */
  witnessFor(zoneId: string): { speaker: Speaker; text: string } | null {
    const chapter = getChapter(zoneId);
    const speaker = chapter ? this.speakerFor(chapter.anchorNpcId) : null;
    return chapter && speaker ? { speaker, text: chapter.witness } : null;
  }

  // --------------------------------------------------------------- twelfth

  twelfthUnlocked(): boolean {
    return this.state.sabhaDone;
  }

  twelfthOptions(): TwelfthOptions {
    const known = (source: (s: SourceType) => boolean): CodexEntry[] =>
      this.save.profile.codex
        .map((id) => getCodex(id))
        .filter((e): e is CodexEntry => e !== undefined && source(e.source));
    return {
      sure: known((s) => s === 'archaeology' || s === 'text'),
      tradition: known((s) => s === 'epic'),
      open: known((s) => s === 'debate'),
      remembered: CHAPTERS.filter((c) => this.panelRestored(c.zoneId)).map((story) => ({
        story,
        zone: getZone(story.zoneId) as Zone,
      })),
    };
  }

  writeTwelfth(panel: Omit<TwelfthPanel, 'writtenAt'>): void {
    this.state.twelfth = { ...panel, writtenAt: Date.now() };
    this.save.markDirty();
  }

  /**
   * Which ending is heard. Read from the order of the restoration choices: a
   * player who began comfortable and ended open-minded "changed their mind with
   * evidence"; mostly-comfortable throughout is the storyteller; anything else
   * doubts kindly. Never a score — it only picks the wording.
   */
  ending(): Ending {
    const { comfortPicks, openPicks, choices } = this.state;
    if (comfortPicks === 0) return ENDINGS.open;

    const ordered = CHAPTERS.map((c) => choices[c.zoneId]).filter((c): c is 'open' | 'comfort' => c !== undefined);
    const half = Math.floor(ordered.length / 2);
    const share = (list: string[]): number => (list.length === 0 ? 0 : list.filter((c) => c === 'comfort').length / list.length);
    if (half > 0 && share(ordered.slice(0, half)) > share(ordered.slice(half))) return ENDINGS.changed;
    return comfortPicks > openPicks ? ENDINGS.storyteller : ENDINGS.open;
  }

  /** True when all eleven panels are back and the Sabha has been settled. */
  complete(): boolean {
    return this.panelsRestored() >= CHAPTERS.length && this.state.sabhaDone;
  }

  // ----------------------------------------------------------------- queries

  totalPlaquesDone(): number {
    return ALL_PLAQUES.filter((p) => this.plaqueDone(p.id)).length;
  }

  plaque(id: string): Plaque | undefined {
    return getPlaque(id);
  }
}

// ------------------------------------------------------------------ helpers

export function findNpc(id: string): NpcSpec | undefined {
  for (const zone of ZONES) {
    const hit = zone.npcs.find((n) => n.id === id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Say how to get a codex entry, from the content itself: the landmark that
 * scans to it, the challenge that unlocks it, or the person who teaches it.
 */
export function whereToFind(codexId: string): string {
  for (const zone of ZONES) {
    const landmark = zone.landmarks.find((l) => l.codexId === codexId);
    if (landmark) return `Scan ${landmark.name} (${zone.name}) with the Pramana lens.`;
  }
  for (const zone of ZONES) {
    const npc = zone.npcs.find((n) => n.unlocks === codexId);
    if (npc) return `Speak with ${npc.name} (${zone.name}).`;
  }
  for (const zone of ZONES) {
    const challenge = zone.challenges.find((c) => c.unlocks?.includes(codexId));
    if (challenge) return `Complete “${challenge.name}” (${zone.name}).`;
  }
  return 'Explore the region to find it.';
}
