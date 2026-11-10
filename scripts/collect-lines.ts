/**
 * Every line the game can say aloud, as (speaker, text, where). Used by `npm run voices:*`; it is
 * bundled and run by scripts/voices.mjs, and reads only the pure content modules.
 */
import { ZONES } from '../src/content/zones';
import { CHAPTERS, PROLOGUE } from '../src/content/story';
import { SABHA_CLOSING, SABHA_OPENING, VOICE_SAMPLE } from '../src/content/story/sabha';
import type { DialogueNode } from '../src/content/types';

export interface SpokenLine {
  speaker: string;
  role: string;
  text: string;
  where: string;
}

const MAITRI = { name: 'Maitri', role: 'Keeper of the Gatha' };
const EKARUPA = { name: 'Ekarupa', role: 'The Voice That Smooths' };

export function collectLines(): SpokenLine[] {
  const out: SpokenLine[] = [];
  const seen = new Set<string>();
  const add = (who: { name: string; role: string }, text: string | undefined, where: string): void => {
    if (!text || !text.trim()) return;
    const k = `${who.name}|${text}`;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ speaker: who.name, role: who.role, text, where });
  };
  const npcById = new Map<string, { name: string; role: string }>();
  for (const z of ZONES) for (const n of z.npcs) npcById.set(n.id, { name: n.name, role: n.role });

  const nodes = (who: { name: string; role: string }, list: readonly DialogueNode[], where: string): void => {
    for (const n of list) {
      add(who, n.text, where);
      for (const c of n.choices ?? []) add(who, c.reply, where);
    }
  };

  for (const l of PROLOGUE) add(l.who === 'ekarupa' ? EKARUPA : MAITRI, l.text, 'Prologue');

  for (const c of CHAPTERS) {
    const zone = ZONES.find((z) => z.id === c.zoneId);
    const place = zone ? zone.name : c.zoneId;
    for (const l of c.hook) add(l.who === 'ekarupa' ? EKARUPA : MAITRI, l.text, `${place} · arrival`);
    add(MAITRI, c.landing, `${place} · first landing`);
    for (const t of c.trail.stops) add(MAITRI, t.say, `${place} · trail`);
    add(MAITRI, c.trail.payoff, `${place} · trail complete`);
    for (const b of c.anchorBeats) add(npcById.get(b.npcId) ?? MAITRI, b.text, `${place} · after a challenge`);
    nodes(MAITRI, c.restoration, `${place} · restoring the panel`);
    add(npcById.get(c.anchorNpcId) ?? MAITRI, c.witness, `${place} · witness at the Sabha`);
    for (const p of c.plaques) add(EKARUPA, p.claim, `${place} · Sabha claim`);
  }

  for (const z of ZONES) {
    for (const n of z.npcs) for (const line of n.lines) add({ name: n.name, role: n.role }, line, `${z.name} · conversation`);
    for (const ch of z.challenges) {
      if (ch.kind === 'dialogue') nodes({ name: ch.config.speaker.name, role: ch.config.speaker.role }, ch.config.nodes, `${z.name} · ${ch.name}`);
    }
  }

  add(EKARUPA, SABHA_OPENING.join(' '), 'The Sabha · opening');
  add(MAITRI, SABHA_CLOSING, 'The Sabha · closing');
  add(MAITRI, VOICE_SAMPLE, 'Settings · voice test');
  return out;
}
