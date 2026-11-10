import { ZONES } from '../content/zones';
import { fewestWeights } from './Trade';
import { expectedDesign } from './symmetry';

/**
 * Startup check for mini-game data, in the same spirit as the content and story
 * validators: a typo in a config is otherwise a silently unwinnable puzzle.
 */
export function validateMiniGames(): string[] {
  const problems: string[] = [];
  for (const zone of ZONES) {
    for (const c of zone.challenges) {
      const where = `challenge "${c.id}"`;
      switch (c.kind) {
        case 'pattern': {
          const { conflicts, cells } = expectedDesign(c.config);
          for (const x of conflicts) problems.push(`${where}: given cells disagree under ${c.config.symmetry} symmetry (${x})`);
          if (cells.size <= c.config.given.length) problems.push(`${where}: symmetry adds no cells beyond the given ones`);
          for (const [x, y, k] of c.config.given) {
            if (x < 0 || y < 0 || x >= c.config.gridSize || y >= c.config.gridSize) problems.push(`${where}: given cell (${x},${y}) is outside the grid`);
            if (!c.config.palette[k]) problems.push(`${where}: given cell uses missing palette colour ${k}`);
          }
          break;
        }
        case 'trade': {
          if (fewestWeights(c.config.weights, c.config.target) === null) problems.push(`${where}: the weights cannot make ${c.config.target}`);
          const unit = c.config.goods.map((g) => g.unitMass);
          const reachable = new Set<number>([0]);
          for (let t = 1; t <= c.config.target; t++) if (unit.some((u) => u <= t && reachable.has(t - u))) reachable.add(t);
          if (!reachable.has(c.config.target)) problems.push(`${where}: the goods cannot make ${c.config.target}`);
          break;
        }
        case 'assembly': {
          const { pieces, sockets } = c.config;
          if (pieces.length !== sockets.length) problems.push(`${where}: ${pieces.length} pieces for ${sockets.length} sockets`);
          const ids = new Set(pieces.map((p) => p.id));
          for (const s of sockets) if (!ids.has(s.accepts)) problems.push(`${where}: socket "${s.id}" accepts unknown piece "${s.accepts}"`);
          if (new Set(sockets.map((s) => s.accepts)).size !== sockets.length) problems.push(`${where}: two sockets accept the same piece`);
          break;
        }
        case 'scriptMatch': {
          const rights = new Set(c.config.right.map((r) => r.id));
          for (const l of c.config.left) if (!rights.has(l.id)) problems.push(`${where}: sign "${l.id}" has no meaning on the right`);
          if (c.config.left.length !== c.config.right.length) problems.push(`${where}: ${c.config.left.length} signs but ${c.config.right.length} meanings`);
          break;
        }
        case 'sequence':
          if (new Set(c.config.items.map((i) => i.id)).size !== c.config.items.length) problems.push(`${where}: duplicate item ids`);
          if (c.config.items.length < 3) problems.push(`${where}: too few items to order`);
          break;
        case 'archery': {
          const { targets, calledShot } = c.config;
          if (calledShot && !targets.some((t) => t.label && t.label.toLowerCase().includes(calledShot.toLowerCase()) )) {
            problems.push(`${where}: called shot "${calledShot}" matches no target label`);
          }
          break;
        }
        case 'collect': {
          const real = c.config.items.filter((i) => !i.decoy).length;
          if (real < c.config.need) problems.push(`${where}: needs ${c.config.need} real items but only ${real} exist`);
          break;
        }
        default:
          break;
      }
    }
  }
  return problems;
}
