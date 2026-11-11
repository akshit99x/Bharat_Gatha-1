import type { Profile } from '../core/Save';
import { ZONES } from '../content/zones';
import type { Zone } from '../content/types';
import { CHAPTERS, getChapter } from '../content/story';

/**
 * Where the player is in each chapter, and what to do next.
 *
 * Pure: it reads a save profile and the content and returns plain numbers and a
 * sentence, so the map, the roadmap and the HUD all agree about progress, and it
 * can be checked without a browser.
 *
 * A chapter is a path, not a checklist, and the order below is the path the
 * game is built around: find the place, scan its monuments, meet its people, play
 * its challenges, correct its plaques, then seal the chapter and restore the panel.
 */

export interface ChapterProgress {
  zone: Zone;
  discovered: boolean;
  scanned: number;
  scanTotal: number;
  met: number;
  metTotal: number;
  challenges: number;
  challengeTotal: number;
  plaques: number;
  plaqueTotal: number;
  trail: number;
  trailTotal: number;
  /** Challenges needed before the chapter assessment unlocks. */
  sealRequires: number;
  sealed: boolean;
  restored: boolean;
  /** 0–1 across everything that counts. */
  fraction: number;
  /** The one thing to do next here, as a sentence. */
  next: string;
}

export type JourneyState = 'unvisited' | 'inProgress' | 'sealed' | 'restored';

export function stateOf(p: ChapterProgress): JourneyState {
  if (p.restored) return 'restored';
  if (p.sealed) return 'sealed';
  return p.discovered ? 'inProgress' : 'unvisited';
}

export function chapterProgress(zone: Zone, profile: Profile): ChapterProgress {
  const zp = profile.zones[zone.id];
  const story = profile.story;
  const chapter = getChapter(zone.id);

  const scannable = zone.landmarks.filter((l) => l.codexId);
  const scanned = scannable.filter((l) => l.codexId && profile.codex.includes(l.codexId)).length;
  const met = zone.npcs.filter((n) => story.met.includes(n.id)).length;
  const challenges = zp?.challenges.length ?? 0;
  const plaquesList = chapter?.plaques ?? [];
  const plaques = plaquesList.filter((p) => story.plaques[p.id]?.done).length;
  const trailTotal = chapter?.trail.stops.length ?? 0;
  const trail = Math.min(trailTotal, chapter ? (story.trails[chapter.trail.id] ?? 0) : 0);
  const sealed = zp?.sealed === true;
  const restored = story.panels.includes(zone.id);
  const discovered = zp?.discovered === true;

  // What counts toward "how far through": the four things you do, then the seal and the panel.
  const parts = [
    scannable.length > 0 ? scanned / scannable.length : 1,
    zone.challenges.length > 0 ? challenges / zone.challenges.length : 1,
    plaquesList.length > 0 ? plaques / plaquesList.length : 1,
    trailTotal > 0 ? trail / trailTotal : 1,
    sealed ? 1 : 0,
    restored ? 1 : 0,
  ];
  const fraction = parts.reduce((a, b) => a + b, 0) / parts.length;

  const result: ChapterProgress = {
    zone,
    discovered,
    scanned,
    scanTotal: scannable.length,
    met,
    metTotal: zone.npcs.length,
    challenges,
    challengeTotal: zone.challenges.length,
    plaques,
    plaqueTotal: plaquesList.length,
    trail,
    trailTotal,
    sealRequires: zone.sealRequires,
    sealed,
    restored,
    fraction,
    next: '',
  };
  result.next = nextStep(result, profile);
  return result;
}

/** The single most useful thing to do in this chapter right now. */
export function nextStep(p: ChapterProgress, profile: Profile): string {
  const z = p.zone;
  if (!p.discovered) return `Travel to ${z.name}, or drop onto it from the vimana, to begin Chapter ${z.chapter}.`;
  if (p.restored) return 'This chapter is complete. Its panel hangs on the Gatha.';

  const chapter = getChapter(z.id);
  if (p.sealed && !p.restored) return 'Open the Gatha (K) and restore this chapter’s panel.';
  if (p.scanned < p.scanTotal) {
    const left = z.landmarks.find((l) => l.codexId && !profile.codex.includes(l.codexId));
    return left ? `Scan ${left.name} with the Pramana lens (hold the right mouse button).` : 'Scan the monuments.';
  }
  const anchor = chapter ? z.npcs.find((n) => n.id === chapter.anchorNpcId) : undefined;
  if (anchor && !profile.story.met.includes(anchor.id)) return `Hear ${anchor.name} out: ${anchor.role}. Look for the gold ★ nameplate.`;
  if (p.challenges < p.sealRequires) {
    const todo = z.challenges.find((c) => !profile.zones[z.id]?.challenges.includes(c.id));
    return todo ? `Try “${todo.name}” at its glowing post: ${todo.brief}` : 'Play the challenges.';
  }
  if (p.plaques < p.plaqueTotal) return `Correct the plaques (${p.plaques}/${p.plaqueTotal}). Read the codex evidence each one asks for, then judge the claim.`;
  if (!p.sealed) return 'Take the chapter assessment (open the map and choose “Take the chapter assessment”) to seal this chapter.';
  return 'Finish the remaining challenges and the trail for a full set.';
}

export function allProgress(profile: Profile): ChapterProgress[] {
  return ZONES.map((z) => chapterProgress(z, profile));
}

/** What to do next across the whole game, for the banner at the top of the roadmap. */
export function journeyNext(profile: Profile): { text: string; zone: Zone | null } {
  const all = allProgress(profile);
  const restored = all.filter((p) => p.restored).length;

  if (!all.some((p) => p.discovered)) {
    return { text: 'Board the vimana and drop onto any region. Everything starts by landing somewhere.', zone: null };
  }
  // The earliest chapter in the guided path that is begun but not finished, else the next one not begun.
  const active = all.find((p) => p.discovered && !p.restored) ?? all.find((p) => !p.restored);
  if (restored >= 3 && !profile.story.sabhaDone) {
    return { text: 'You have restored enough panels to convene the Sabha of Sources. Open the Gatha (K).', zone: null };
  }
  if (profile.story.sabhaDone && !profile.story.twelfth) {
    return { text: 'The Sabha is settled. Open the Gatha (K) and write the Twelfth Panel.', zone: null };
  }
  if (!active) return { text: 'Every panel is restored. The Gatha is yours to read, and to keep reading.', zone: null };
  return { text: active.next, zone: active.zone };
}

export const TOTAL_CHAPTERS = CHAPTERS.length;
