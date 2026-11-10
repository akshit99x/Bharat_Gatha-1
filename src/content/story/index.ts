import type { Zone } from '../types';
import { getCodex } from '../codex';
import { ZONES, getZone } from '../zones';
import { KEEPERS } from './epilogue';
import { PROLOGUE } from './prologue';
import type { ChapterStory, Plaque } from './types';

import { sindhuStory } from './chapters/sindhu';
import { meluhhaStory } from './chapters/meluhha';
import { kosalaStory } from './chapters/kosala';
import { setuLankaStory } from './chapters/setuLanka';
import { kurukshetraStory } from './chapters/kurukshetra';
import { magadhaStory } from './chapters/magadha';
import { cholaStory } from './chapters/chola';
import { konarkStory } from './chapters/konark';
import { hampiStory } from './chapters/hampi';
import { agraStory } from './chapters/agra';
import { marathaStory } from './chapters/maratha';

export * from './types';
export { restoration } from './author';
export { PROLOGUE } from './prologue';
export { ENDINGS, KEEPERS } from './epilogue';

/** One story per zone, in chapter order. */
export const CHAPTERS: ChapterStory[] = [
  sindhuStory,
  meluhhaStory,
  kosalaStory,
  setuLankaStory,
  kurukshetraStory,
  magadhaStory,
  cholaStory,
  konarkStory,
  hampiStory,
  agraStory,
  marathaStory,
];

const BY_ZONE = new Map(CHAPTERS.map((c) => [c.zoneId, c]));

export function getChapter(zoneId: string): ChapterStory | undefined {
  return BY_ZONE.get(zoneId);
}

export const ALL_PLAQUES: Plaque[] = CHAPTERS.flatMap((c) => c.plaques);
const PLAQUE_BY_ID = new Map(ALL_PLAQUES.map((p) => [p.id, p]));

export function getPlaque(id: string): Plaque | undefined {
  return PLAQUE_BY_ID.get(id);
}

/** Every story beat id the engine can mark as seen, for validation. */
export const TOTAL_PLAQUES = ALL_PLAQUES.length;
export const TOTAL_PANELS = CHAPTERS.length;

/**
 * Story integrity check, run at startup beside `validateContent()`.
 *
 * The story names zones, landmarks, challenges, NPCs and codex entries by id, so
 * a typo is a silently dead beat rather than a crash. This prints anything that
 * does not resolve, plus the structural rules the engine relies on.
 */
export function validateStory(): string[] {
  const problems: string[] = [];
  const seenPlaques = new Set<string>();
  const seenTrails = new Set<string>();

  if (KEEPERS.length !== 41) problems.push(`Keeper's Log has ${KEEPERS.length} entries; the reveal needs 41`);
  if (PROLOGUE.length === 0) problems.push('prologue is empty');

  for (const zone of ZONES) {
    if (!BY_ZONE.has(zone.id)) problems.push(`zone "${zone.id}" has no chapter story`);
  }

  for (const chapter of CHAPTERS) {
    const zone = getZone(chapter.zoneId);
    if (!zone) {
      problems.push(`story for unknown zone "${chapter.zoneId}"`);
      continue;
    }
    const where = `story[${zone.id}]`;
    const npc = (id: string): boolean => zone.npcs.some((n) => n.id === id);
    const landmark = (id: string): boolean => zone.landmarks.some((l) => l.id === id);
    const challenge = (id: string): boolean => zone.challenges.some((c) => c.id === id);

    if (chapter.hook.length === 0) problems.push(`${where}: no hook`);
    if (chapter.landing.trim().length === 0) problems.push(`${where}: no landing line`);
    if (!npc(chapter.anchorNpcId)) problems.push(`${where}: anchor npc "${chapter.anchorNpcId}" is not in this zone`);
    if (!npc(chapter.maker.npcId)) problems.push(`${where}: maker npc "${chapter.maker.npcId}" is not in this zone`);

    for (const beat of chapter.anchorBeats) {
      if (!challenge(beat.after)) problems.push(`${where}: anchor beat after unknown challenge "${beat.after}"`);
      if (!npc(beat.npcId)) problems.push(`${where}: anchor beat npc "${beat.npcId}" is not in this zone`);
    }

    if (chapter.plaques.length < 3) problems.push(`${where}: needs three plaques, has ${chapter.plaques.length}`);
    for (const p of chapter.plaques) {
      if (seenPlaques.has(p.id)) problems.push(`${where}: duplicate plaque id "${p.id}"`);
      seenPlaques.add(p.id);
      if (p.zoneId !== zone.id) problems.push(`${where}: plaque "${p.id}" claims zone "${p.zoneId}"`);
      if (!landmark(p.near)) problems.push(`${where}: plaque "${p.id}" is near unknown landmark "${p.near}"`);
      if (p.requires.length === 0) problems.push(`${where}: plaque "${p.id}" requires no evidence`);
      for (const id of p.requires) if (!getCodex(id)) problems.push(`${where}: plaque "${p.id}" requires unknown codex "${id}"`);
      if (p.nudge && p.nudge[p.verdict]) problems.push(`${where}: plaque "${p.id}" has a nudge for its own correct verdict`);
    }

    if (seenTrails.has(chapter.trail.id)) problems.push(`${where}: duplicate trail id "${chapter.trail.id}"`);
    seenTrails.add(chapter.trail.id);
    if (chapter.trail.stops.length < 2) problems.push(`${where}: trail needs at least two stops`);
    const stopIds = new Set<string>();
    for (const stop of chapter.trail.stops) {
      if (!npc(stop.npcId)) problems.push(`${where}: trail stop npc "${stop.npcId}" is not in this zone`);
      if (stopIds.has(stop.npcId)) problems.push(`${where}: trail visits "${stop.npcId}" twice`);
      stopIds.add(stop.npcId);
    }
    chapter.trail.stops.forEach((stop, i, all) => {
      if (i < all.length - 1 && !stop.say) problems.push(`${where}: trail stop "${stop.npcId}" has nothing to say about where next`);
    });

    // Restoration graph: one choice node, a wise option, and every goto resolves.
    const nodes = chapter.restoration;
    const byId = new Map(nodes.map((n) => [n.id, n]));
    if (!byId.has('start')) problems.push(`${where}: restoration has no "start" node`);
    const choiceNodes = nodes.filter((n) => n.choices && n.choices.length > 0);
    if (choiceNodes.length !== 1) problems.push(`${where}: restoration needs exactly one choice node, has ${choiceNodes.length}`);
    for (const n of nodes) {
      for (const c of n.choices ?? []) {
        if (c.goto && !byId.has(c.goto)) problems.push(`${where}: restoration choice goes to unknown node "${c.goto}"`);
      }
      const next = n.goto ?? n.next;
      if (next && !byId.has(next)) problems.push(`${where}: restoration node "${n.id}" goes to unknown node "${next}"`);
    }
    const choice = choiceNodes[0];
    if (choice && !choice.choices?.some((c) => c.wise)) problems.push(`${where}: restoration offers no open-minded option`);
    if (choice && choice.choices?.every((c) => c.wise)) problems.push(`${where}: restoration has no comfortable option to contrast with`);

    if (chapter.panel.threads.length === 0) problems.push(`${where}: panel carries no threads`);
    if (chapter.witness.trim().length === 0) problems.push(`${where}: no witness line`);
  }

  // All three threads must be carried by at least one panel, or the finale braid has nothing to braid.
  for (const motif of ['water', 'writing', 'measure'] as const) {
    if (!CHAPTERS.some((c) => c.panel.threads.includes(motif))) problems.push(`no panel carries the "${motif}" thread`);
  }
  return problems;
}

/** Zones whose story exists, in chapter order. Convenience for UI that walks both. */
export function storyZones(): Array<{ zone: Zone; story: ChapterStory }> {
  return CHAPTERS.map((story) => ({ zone: getZone(story.zoneId) as Zone, story })).filter((x) => x.zone);
}
