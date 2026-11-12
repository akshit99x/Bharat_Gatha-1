/**
 * The game's content as plain data, for the Python side (the teacher API and the tools). Bundled and run by
 * scripts/export-content.mjs; reads only the pure content modules.
 */
import { ZONES } from '../src/content/zones';
import { CODEX } from '../src/content/codex';
import { QUESTIONS } from '../src/content/questions';
import { CHAPTERS } from '../src/content/story';

export function exportContent() {
  const chapterOf = new Map(CHAPTERS.map((c) => [c.zoneId, c]));
  return {
    version: 1,
    zones: ZONES.map((z) => {
      const ch = chapterOf.get(z.id);
      return {
        id: z.id,
        name: z.name,
        nameLocal: z.nameLocal,
        chapter: z.chapter,
        era: z.era,
        eraStart: z.eraStart,
        eraEnd: z.eraEnd,
        tagline: z.tagline,
        sealRequires: z.sealRequires,
        landmarks: z.landmarks.map((l) => ({ id: l.id, name: l.name, codexId: l.codexId ?? null })),
        challenges: z.challenges.map((c) => ({ id: c.id, name: c.name, kind: c.kind })),
        npcs: z.npcs.length,
        story: ch ? { title: ch.title, plaques: ch.plaques.map((p) => ({ id: p.id, claim: p.claim })) } : null,
      };
    }),
    codex: CODEX.map((c) => ({ id: c.id, zoneId: c.zoneId, title: c.title, when: c.when, source: c.source, body: c.body, tags: c.tags })),
    questions: QUESTIONS.map((q) => ({
      id: q.id,
      zoneId: q.zoneId,
      difficulty: q.difficulty,
      stem: q.stem,
      context: q.context ?? null,
      options: q.options,
      answer: q.answer,
      explain: q.explain,
      tags: q.tags,
      skill: q.skill,
    })),
  };
}
