/**
 * The one rule that ties a spoken line to a recording.
 *
 * A clip belongs to *who says it* and *exactly what they say*. The key is a hash of both, so if a
 * line is ever reworded its old recording simply stops matching (and the game falls back to the
 * synthesised voice) instead of playing the wrong words. This file has no dependencies, because the
 * game and the recording tools must agree on it exactly.
 */

/** Collapse whitespace and curly punctuation so cosmetic edits never orphan a recording. */
export function normaliseLine(text: string): string {
  return text
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** 8 hex digits, FNV-1a over `speaker|text`. */
export function voiceKey(speaker: string, text: string): string {
  const input = `${speaker.trim().toLowerCase()}|${normaliseLine(text)}`;
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) h = Math.imul(h ^ input.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16).padStart(8, '0');
}
