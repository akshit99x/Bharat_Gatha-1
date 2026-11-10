import type { PatternChallenge } from '../content/types';

/** Pure symmetry maths for the pattern game, kept free of the DOM so it can be validated at startup. */

export type Symmetry = PatternChallenge['config']['symmetry'];

/** Every cell that a symmetry says must carry the same colour as (x, y). */
export function orbit(symmetry: Symmetry, n: number, x: number, y: number): Array<[number, number]> {
  const m = n - 1;
  switch (symmetry) {
    case 'mirror':
      return [
        [x, y],
        [m - x, y],
      ];
    case 'fourfold':
      return [
        [x, y],
        [m - x, y],
        [x, m - y],
        [m - x, m - y],
      ];
    case 'rotational':
      // Quarter-turns about the centre of the square.
      return [
        [x, y],
        [m - y, x],
        [m - x, m - y],
        [y, m - x],
      ];
  }
}

/** The design the given cells imply, as a map of "x,y" → colour index. Reports any cell two given cells disagree about. */
export function expectedDesign(config: PatternChallenge['config']): { cells: Map<string, number>; conflicts: string[] } {
  const cells = new Map<string, number>();
  const conflicts: string[] = [];
  for (const [gx, gy, colour] of config.given) {
    for (const [x, y] of orbit(config.symmetry, config.gridSize, gx, gy)) {
      const key = `${x},${y}`;
      const existing = cells.get(key);
      if (existing !== undefined && existing !== colour) conflicts.push(`${key}: ${existing} vs ${colour}`);
      cells.set(key, colour);
    }
  }
  return { cells, conflicts };
}

