import type { BuildContext } from './index';
import { shade, mixColor } from '../Materials';
import {
  WOOD,
  THATCH,
  CLOTH_SAFFRON,
  addBanner,
  addCrenellations,
  addFire,
  addFlatHouse,
  addIwan,
  addPots,
  addTree,
  addWaterPlane,
  addWell,
} from './props';

/* ============================================================ Harappan world */

/**
 * The citadel mound: a stepped platform of baked brick carrying a block of
 * chambers. Harappan citadels have no palace and no temple we can identify, so
 * this is deliberately austere — storage, assembly and workshop space.
 */
export function indusCitadel(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const tiers = Math.max(1, Math.round(ctx.num('tiers', 3)));
  const width = ctx.num('width', 120);
  const depth = ctx.num('depth', 86);
  const brick = palette.stone;

  let w = width;
  let d = depth;
  let y = 0;
  const tierHeight = 3.2;

  for (let t = 0; t < tiers; t++) {
    kit.slab([w, d], [0, y + tierHeight / 2, 0], tierHeight, shade(brick, 0.92 + t * 0.05));
    // Brick courses, suggested by thin bands rather than modelled bricks.
    for (let band = 0; band < 3; band++) {
      const by = y + (band + 0.5) * (tierHeight / 3);
      kit.box([w + 0.3, 0.14, d + 0.3], [0, by, 0], shade(brick, 0.82), { collide: false });
    }
    y += tierHeight;
    w -= width * 0.11;
    d -= depth * 0.11;
  }

  // Chambers on the summit, on a strict grid — the point of the whole zone.
  const cols = 5;
  const rows = 3;
  const cw = w / cols;
  const cd = d / rows;
  for (let cx = 0; cx < cols; cx++) {
    for (let cz = 0; cz < rows; cz++) {
      if (rng.bool(0.18)) continue;
      const px = -w / 2 + cw * (cx + 0.5);
      const pz = -d / 2 + cd * (cz + 0.5);
      const h = rng.range(4.2, 6.4);
      addFlatHouse(kit, px, pz, y, cw * 0.78, cd * 0.74, h, brick, rng);
    }
  }

  // Ramp up the long side, and a parapet.
  {
    // One long flight from the ground to the top tier. It has to *reach* the top tier: the tiers step
    // inward, so a flight that stops at the base edge ends in mid-air over the terraces.
    const topEdge = -(width * (1 - 0.11 * (tiers - 1))) / 2;
    const count = Math.ceil(y / 0.4);
    const run = 1.0;
    kit.steps([topEdge - count * run + run / 2, 0, 0], count, y / count, run, 9, shade(brick, 0.88));
  }
  for (const side of [-1, 1]) {
    kit.box([width, 1.2, 0.8], [0, y + 0.6, side * (depth / 2 - 2)], shade(brick, 0.86), { collide: false });
  }
  kit.marker('summit', [0, y, 0]);
  addPots(kit, w * 0.3, d * 0.3, y, 5, rng);
}

/** The Great Bath: a bitumen-sealed sunken tank with steps at both ends. */
export function greatBath(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const brick = palette.stone;
  const tankW = 14;
  const tankD = 8.5;
  const tankDepth = 2.6;
  const platform = 1.6;

  // Platform with the tank void cut out, made from four slabs.
  const outerW = tankW + 16;
  const outerD = tankD + 14;
  for (const [bx, bz, bw, bd] of [
    [0, -(tankD / 2 + (outerD / 2 - tankD / 2) / 2), outerW, outerD / 2 - tankD / 2],
    [0, tankD / 2 + (outerD / 2 - tankD / 2) / 2, outerW, outerD / 2 - tankD / 2],
    [-(tankW / 2 + (outerW / 2 - tankW / 2) / 2), 0, outerW / 2 - tankW / 2, tankD],
    [tankW / 2 + (outerW / 2 - tankW / 2) / 2, 0, outerW / 2 - tankW / 2, tankD],
  ] as Array<[number, number, number, number]>) {
    kit.slab([bw, bd], [bx, platform / 2, bz], platform, shade(brick, 0.95));
  }

  // Tank lining: walls down to the floor, with a bitumen-dark base course.
  kit.slab([tankW, tankD], [0, -tankDepth, 0], 0.5, 0x2e2622, { collide: true });
  for (const [sx, sz, sw, sd] of [
    [0, -tankD / 2, tankW, 0.6],
    [0, tankD / 2, tankW, 0.6],
    [-tankW / 2, 0, 0.6, tankD],
    [tankW / 2, 0, 0.6, tankD],
  ] as Array<[number, number, number, number]>) {
    kit.box([sw, tankDepth + platform, sd], [sx, -tankDepth / 2 + platform / 2, sz], shade(brick, 1.04));
  }
  addWaterPlane(kit, [tankW - 1.2, tankD - 1.2], [0, -0.9, 0]);

  // The tank is below ground level: cut the ground away over it.
  kit.pit([-tankW / 2, -tankD / 2], [tankW / 2, tankD / 2], -tankDepth - 0.3);

  // A flight of steps down into the water at one end, and the matching flight at the other shown in
  // relief. (Both ends had steps at Mohenjo-daro.)
  kit.steps([0, platform, tankD / 2 - 0.25], 8, -(platform + tankDepth - 0.25) / 8, 0.5, 5.5, shade(brick, 1.0), {}, 'z-');
  for (let i = 0; i < 5; i++) {
    kit.box([5.5, 0.55, 0.9], [0, platform - 0.3 - i * 0.55, -(tankD / 2 - 0.9 - i * 0.9)], shade(brick, 1.0), { collide: false });
  }
  // And steps up onto the platform from the ground, front and back.
  for (const side of [-1, 1]) {
    kit.steps([0, 0, side * (outerD / 2 + 4 * 0.8 - 0.4)], 4, platform / 4, 0.8, 6, shade(brick, 0.98), {}, side > 0 ? 'z-' : 'z+');
  }

  // Surrounding corridor of small rooms, and the well that fed the tank.
  const ring = 1.0;
  for (const [rx, rz, rw, rd] of [
    [-outerW / 2 - 4, 0, 7, outerD],
    [outerW / 2 + 4, 0, 7, outerD],
  ] as Array<[number, number, number, number]>) {
    const cells = 4;
    for (let i = 0; i < cells; i++) {
      const pz = rz - rd / 2 + (rd / cells) * (i + 0.5);
      addFlatHouse(kit, rx, pz, 0, rw, (rd / cells) * 0.8, rng.range(3.6, 4.6), brick, rng);
    }
  }
  void ring;
  addWell(kit, outerW / 2 + 11, -6, 0, 1.8, shade(brick, 0.9));
  kit.marker('tank', [0, platform, tankD / 2 + 3]);
}

/** The lower town: a grid of courtyard houses, with covered drains down the lanes. */
export function indusHousing(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const blocksX = Math.max(1, Math.round(ctx.num('blocksX', 5)));
  const blocksZ = Math.max(1, Math.round(ctx.num('blocksZ', 4)));
  const block = ctx.num('blockSize', 34);
  const lane = ctx.num('lane', 9);
  const tall = ctx.flag('tall');
  const brick = palette.stone;

  const totalW = blocksX * block + (blocksX - 1) * lane;
  const totalD = blocksZ * block + (blocksZ - 1) * lane;

  for (let bx = 0; bx < blocksX; bx++) {
    for (let bz = 0; bz < blocksZ; bz++) {
      const ox = -totalW / 2 + bx * (block + lane) + block / 2;
      const oz = -totalD / 2 + bz * (block + lane) + block / 2;

      // Each block is a ring of houses around a shared courtyard.
      const housesPerSide = 3;
      const hw = block / housesPerSide;
      for (let i = 0; i < housesPerSide; i++) {
        for (const [dx, dz] of [
          [-block / 2 + hw * (i + 0.5), -block / 2 + hw * 0.5],
          [-block / 2 + hw * (i + 0.5), block / 2 - hw * 0.5],
          [-block / 2 + hw * 0.5, -block / 2 + hw * (i + 0.5)],
          [block / 2 - hw * 0.5, -block / 2 + hw * (i + 0.5)],
        ] as Array<[number, number]>) {
          if (rng.bool(0.12)) continue;
          const h = tall ? rng.range(7.5, 9.5) : rng.range(4.4, 6.8);
          addFlatHouse(kit, ox + dx, oz + dz, 0, hw * 0.86, hw * 0.86, h, brick, rng);
        }
      }
      // Courtyard: a bathing platform draining to the lane, plus pots.
      kit.slab([hw * 1.3, hw * 1.3], [ox, 0.12, oz], 0.24, shade(brick, 1.06), { collide: false });
      addPots(kit, ox + hw * 0.4, oz - hw * 0.4, 0, rng.int(2, 4), rng);
      if (rng.bool(0.5)) addTree(kit, ox - hw * 0.5, oz + hw * 0.4, 0, 'mango', rng, 0.6);
    }
  }

  // Lanes, with the covered drain running along them.
  const drainColor = shade(brick, 0.8);
  for (let bx = 0; bx < blocksX - 1; bx++) {
    const lx = -totalW / 2 + (bx + 1) * block + bx * lane + lane / 2;
    kit.slab([lane, totalD], [lx, 0.06, 0], 0.12, shade(brick, 0.88), { collide: false });
    kit.box([1.4, 0.5, totalD], [lx, 0.25, 0], drainColor, { collide: false });
    // Removable cover slabs, every few metres.
    for (let i = 0; i < Math.floor(totalD / 4); i++) {
      kit.box([1.7, 0.16, 1.2], [lx, 0.56, -totalD / 2 + i * 4 + 2], shade(brick, 1.1), { collide: false });
    }
  }
  for (let bz = 0; bz < blocksZ - 1; bz++) {
    const lz = -totalD / 2 + (bz + 1) * block + bz * lane + lane / 2;
    kit.slab([totalW, lane], [0, 0.06, lz], 0.12, shade(brick, 0.88), { collide: false });
    kit.box([totalW, 0.5, 1.4], [0, 0.25, lz], drainColor, { collide: false });
  }
  kit.marker('lane', [0, 0, 0]);
}

/** The Lothal basin: a brick-lined trapezoidal tank with an inlet channel. */
export function lothalDock(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const brick = palette.stone;
  const len = 86;
  const wide = 34;
  const narrow = 26;
  const depth = 4;

  // Sloping side walls, built as a line of boxes so the plan is trapezoidal.
  const steps = 14;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    const halfW = (wide + (narrow - wide) * t) / 2;
    const z = -len / 2 + len * t;
    for (const side of [-1, 1]) {
      kit.box([2.4, depth + 1.4, len / steps + 0.6], [side * halfW, (depth + 1.4) / 2 - depth, z], shade(brick, 1.03));
    }
  }
  for (const end of [-1, 1]) {
    kit.box([wide + 6, depth + 1.4, 2.6], [0, (depth + 1.4) / 2 - depth, end * (len / 2)], shade(brick, 1.0));
  }
  kit.slab([wide + 2, len], [0, -depth, 0], 0.6, shade(brick, 0.86));
  addWaterPlane(kit, [wide - 2, len - 3], [0, -1.1, 0]);

  // Inlet channel and sluice.
  kit.box([7, 3, 22], [0, -1.2, -len / 2 - 11], shade(brick, 0.95), { collide: false });
  kit.box([1.2, 3.4, 7.2], [-3.5, -0.4, -len / 2 - 2], shade(brick, 1.08));
  kit.box([1.2, 3.4, 7.2], [3.5, -0.4, -len / 2 - 2], shade(brick, 1.08));
  kit.box([8.4, 1.1, 1.2], [0, 1.4, -len / 2 - 2], WOOD, { collide: false });

  // Warehouse on mud-brick plinths — the detail that makes Lothal a trade town.
  const plinths = 4;
  for (let i = 0; i < plinths; i++) {
    for (let j = 0; j < 3; j++) {
      kit.box([7, 1.6, 7], [wide / 2 + 16 + i * 9, 0.8, -12 + j * 9], shade(brick, 0.92));
    }
  }
  addFlatHouse(kit, wide / 2 + 29, -3, 1.6, 26, 24, 5.5, brick, rng);
  addPots(kit, wide / 2 + 14, 12, 0, 6, rng);
  kit.marker('quay', [wide / 2 + 5, 1.4, 0]);
}

/* ========================================================= Mesopotamian world */

/** A ziggurat: battered mud-brick tiers with a triple staircase and a shrine. */
export function ziggurat(ctx: BuildContext): void {
  const { kit, palette } = ctx;
  const tiers = Math.max(2, Math.round(ctx.num('tiers', 3)));
  const base = ctx.num('base', 62);
  const total = ctx.num('height', 40);
  const mud = palette.stone;
  const tierH = total / (tiers + 0.8);

  let w = base;
  let d = base * 0.72;
  let y = 0;
  for (let t = 0; t < tiers; t++) {
    const shadeF = 0.9 + t * 0.06;
    kit.slab([w, d], [0, y + tierH / 2, 0], tierH, shade(mud, shadeF));
    // Buttress strips: the vertical relief that keeps the facade from reading flat.
    const stripes = Math.max(5, Math.round(w / 6));
    for (let i = 0; i < stripes; i++) {
      const px = -w / 2 + (w / stripes) * (i + 0.5);
      for (const side of [-1, 1]) {
        kit.box([w / stripes * 0.42, tierH, 0.7], [px, y + tierH / 2, side * (d / 2 + 0.3)], shade(mud, shadeF * 0.93), {
          collide: false,
        });
      }
    }
    // Weeper holes, so the core could dry — a real detail of Ur.
    for (let i = 0; i < stripes; i += 2) {
      kit.box([0.5, 0.5, 0.5], [-w / 2 + (w / stripes) * (i + 0.5), y + tierH * 0.3, d / 2 + 0.6], 0x2b2218, {
        collide: false,
      });
    }
    y += tierH;
    w -= base * 0.2;
    d -= base * 0.72 * 0.2;
  }

  // The shrine on top.
  kit.slab([w * 0.8, d * 0.8], [0, y + 1.4, 0], 2.8, shade(mud, 1.12));
  kit.box([w * 0.5, 5.4, d * 0.46], [0, y + 5.5, 0], shade(mud, 1.18));
  kit.box([w * 0.18, 3.4, 0.4], [0, y + 4.5, d * 0.24], 0x241c14, { collide: false });

  // Three staircases converging on the first terrace, as at Ur.
  // Three staircases, as at Ur. The great central flight climbs the whole face to the shrine terrace;
  // the two beside it reach the first terrace. Each ends on the tier it climbs to (the tiers step inward,
  // so a flight has to run past the base to meet them).
  {
    const count = Math.ceil(y / 0.45);
    const run = 0.8;
    const topEdge = -(base * (1 - 0.2 * (tiers - 1))) / 2;
    kit.steps([topEdge - count * run + run / 2, 0, 0], count, y / count, run, 8, shade(mud, 0.95));
    const sideCount = Math.ceil(tierH / 0.45);
    for (const side of [-1, 1]) {
      kit.steps([-base / 2 - sideCount * run + run / 2, 0, side * (base * 0.72 * 0.32)], sideCount, tierH / sideCount, run, 5, shade(mud, 0.93));
    }
  }
  kit.marker('summit', [0, y, 0]);
}

/** The tablet house: a scribal courtyard with benches, racks and a kiln. */
export function scribeYard(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const mud = palette.stone;
  const w = 40;
  const d = 32;

  kit.slab([w, d], [0, 0.2, 0], 0.4, shade(mud, 1.05), { collide: false });
  // Courtyard wall with one opening.
  kit.wall([-w / 2, -d / 2], [w / 2, -d / 2], 3.4, 1.2, shade(mud, 0.95));
  kit.wall([-w / 2, d / 2], [-4, d / 2], 3.4, 1.2, shade(mud, 0.95));
  kit.wall([4, d / 2], [w / 2, d / 2], 3.4, 1.2, shade(mud, 0.95));
  kit.wall([-w / 2, -d / 2], [-w / 2, d / 2], 3.4, 1.2, shade(mud, 0.95));
  kit.wall([w / 2, -d / 2], [w / 2, d / 2], 3.4, 1.2, shade(mud, 0.95));

  // Roofed hall along the back, on reed-bundle columns.
  kit.along([-w / 2 + 4, -d / 2 + 5], [w / 2 - 4, -d / 2 + 5], 6, (px, pz) => {
    kit.cylinder(0.5, 0.6, 4.4, [px, 2.2, pz], mixColor(THATCH, 0x7a6a44, 0.3), { segments: 7 });
  });
  kit.slab([w - 4, 11], [0, 4.7, -d / 2 + 5.5], 0.5, shade(mud, 0.88), { collide: false });

  // Benches of wet clay, and racks of drying tablets.
  for (let i = 0; i < 5; i++) {
    const px = -14 + i * 7;
    kit.box([5, 0.9, 2], [px, 0.85, 2], shade(mud, 1.1));
    for (let j = 0; j < 4; j++) {
      kit.box([0.9, 0.16, 0.7], [px - 1.6 + j * 1.1, 1.38, 2], 0xc2a877, { collide: false, rotY: rng.range(-0.3, 0.3) });
    }
  }
  for (let r = 0; r < 3; r++) {
    kit.box([0.5, 3.2, 10], [w / 2 - 6, 1.6, -4 + r * 5], WOOD);
    for (let s = 0; s < 6; s++) {
      kit.box([1.1, 0.14, 0.9], [w / 2 - 6, 0.9 + (s % 3) * 0.9, -8 + r * 5 + (s < 3 ? 0 : 2)], 0xc9b183, {
        collide: false,
      });
    }
  }

  // Kiln for firing the archive.
  kit.cylinder(2.6, 3.1, 4.2, [-w / 2 + 6, 2.1, d / 2 - 7], shade(mud, 0.84), { segments: 10 });
  kit.cylinder(1.1, 1.5, 2.4, [-w / 2 + 6, 5.4, d / 2 - 7], shade(mud, 0.8), { segments: 8, collide: false });
  kit.box([1.6, 1.4, 0.4], [-w / 2 + 6, 0.7, d / 2 - 4.1], 0x3a1f12, { collide: false });
  addFire(kit, -w / 2 + 6, d / 2 - 4.6, 0, 0.8);
  addPots(kit, 12, d / 2 - 6, 0, 5, rng);
  kit.marker('bench', [0, 0, 4.5]);
}

/* =============================================================== Epic warfare */

/** An army camp: tents in a ring, a command pavilion, pickets and fires. */
export function warCamp(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const tents = Math.max(4, Math.round(ctx.num('tents', 12)));
  const banner = ctx.num('banner', CLOTH_SAFFRON);
  const cloth = mixColor(0xd8cbb0, palette.ground, 0.25);

  // Command pavilion.
  kit.slab([18, 14], [0, 0.25, 0], 0.5, shade(palette.stone, 0.95), { collide: false });
  for (const [cx, cz] of [
    [-8, -6],
    [8, -6],
    [-8, 6],
    [8, 6],
  ] as Array<[number, number]>) {
    kit.cylinder(0.22, 0.26, 5.2, [cx, 2.6, cz], WOOD, { segments: 5 });
  }
  kit.roof([18, 14], [0, 5.2, 0], 3.4, banner, 1.2);
  addBanner(kit, 0, -8.5, 0, 8, banner);

  // Tents around it.
  kit.ring(tents, 34, (tx, tz, a, i) => {
    const r = rng.range(3.2, 4.4);
    kit.cone(r, r * 1.9, [tx, r * 0.95, tz], shade(cloth, rng.range(0.9, 1.08)), { segments: 8 });
    kit.box([r * 0.5, r * 0.9, 0.2], [tx, r * 0.45, tz + r * 0.96], 0x2b241c, { collide: false });
    kit.cylinder(0.08, 0.1, r * 2.4, [tx, r * 1.2, tz], WOOD, { segments: 4, collide: false });
    if (i % 3 === 0) addBanner(kit, tx + Math.cos(a) * 3, tz + Math.sin(a) * 3, 0, 5.5, banner);
    if (i % 4 === 1) addFire(kit, tx * 0.82, tz * 0.82, 0, 1.1);
  });

  // Picket line.
  kit.ring(
    Math.max(18, tents * 3),
    48,
    (px, pz, a) => {
      kit.box([0.3, 2.2, 0.3], [px, 1.1, pz], WOOD, { collide: false });
      void a;
    },
  );
  for (let i = 0; i < 4; i++) {
    addPots(kit, rng.range(-26, 26), rng.range(-26, 26), 0, rng.int(2, 4), rng);
  }
  kit.marker('pavilion', [0, 0.5, 8]);
}

/** A line of chariots with their teams — the epic's defining machine. */
export function chariotLine(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const count = Math.max(1, Math.round(ctx.num('count', 9)));
  const spacing = 13;

  for (let i = 0; i < count; i++) {
    const x = (i - (count - 1) / 2) * spacing;
    const jitter = rng.range(-1.2, 1.2);
    buildChariot(ctx, x, jitter, rng.range(-0.1, 0.1), i % 3 === 0 ? 0x3f6bbf : palette.stone);
  }
  kit.marker('line', [0, 0, 6]);
}

/** One chariot: platform, spoked wheels, yoke pole, two horses. */
function buildChariot(ctx: BuildContext, x: number, z: number, rotY: number, trim: number): void {
  const { kit, rng } = ctx;
  const body = WOOD;

  kit.box([3.4, 0.4, 2.6], [x, 1.25, z], body, { rotY });
  // Curved front screen, suggested with a prism.
  kit.prism(
    [
      [-1.7, 0],
      [1.7, 0],
      [1.7, 1.5],
      [0.9, 2.0],
      [-0.9, 2.0],
      [-1.7, 1.5],
    ],
    0.2,
    [x, 1.45, z - 1.2],
    trim,
    { rotY, collide: false },
  );
  for (const side of [-1, 1]) {
    kit.box([0.2, 1.0, 2.6], [x + side * 1.7 * Math.cos(rotY), 1.95, z - side * 1.7 * Math.sin(rotY)], body, {
      rotY,
      collide: false,
    });
  }
  // Spoked wheels.
  for (const side of [-1, 1]) {
    const wx = x + side * 1.55 * Math.cos(rotY);
    const wz = z - side * 1.55 * Math.sin(rotY);
    kit.torus(1.05, 0.14, [wx, 1.05, wz], 0x4e3a26, { rotY: rotY + Math.PI / 2, segments: 14, collide: false });
    for (let s = 0; s < 8; s++) {
      const a = (s / 8) * Math.PI;
      kit.box([0.1, 2.0, 0.1], [wx, 1.05, wz], 0x4e3a26, { rotY: rotY + Math.PI / 2, rotZ: a, collide: false });
    }
    kit.cylinder(0.18, 0.18, 0.5, [wx, 1.05, wz], 0x3a2b1c, { segments: 6, rotZ: Math.PI / 2, rotY, collide: false });
  }
  // Pole and yoke.
  kit.box([0.22, 0.22, 5.4], [x + Math.sin(rotY) * 0, 1.2, z - 3.6], body, { rotY, collide: false });
  kit.box([2.8, 0.2, 0.2], [x, 1.5, z - 6.1], body, { rotY, collide: false });

  // Two horses, abstracted — volume and stance, not anatomy.
  for (const side of [-1, 1]) {
    const hx = x + side * 1.1;
    const hz = z - 7.4;
    const coat = side < 0 ? 0x6b513a : shade(0x8a6b4a, rng.range(0.9, 1.1));
    kit.box([1.1, 1.5, 3.0], [hx, 2.1, hz], coat, { rotY, collide: true });
    kit.box([0.8, 1.0, 1.1], [hx, 2.9, hz - 1.7], coat, { rotY, collide: false });
    kit.box([0.5, 0.5, 1.0], [hx, 2.6, hz - 2.5], coat, { rotY: rotY + 0.2, collide: false });
    for (const [lx, lz] of [
      [-0.35, -1.0],
      [0.35, -1.0],
      [-0.35, 1.0],
      [0.35, 1.0],
    ] as Array<[number, number]>) {
      kit.box([0.26, 1.45, 0.26], [hx + lx, 0.73, hz + lz], shade(coat, 0.85), { collide: false });
    }
    kit.box([0.12, 0.9, 0.5], [hx, 3.1, hz + 1.5], 0x2e2219, { rotZ: 0.4, collide: false });
  }
}

/** The field shrine where the Gita dialogue happens: a platform under a banyan. */
export function kuruShrine(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const stone = palette.stone;

  kit.cylinder(11, 11.6, 1.2, [0, 0.6, 0], shade(stone, 1.02), { segments: 20 });
  kit.cylinder(7.6, 8, 0.7, [0, 1.45, 0], shade(stone, 1.1), { segments: 18, collide: false });
  kit.steps([-15, 0, 0], 4, 0.3, 1.1, 6, shade(stone, 0.95));

  // A small open shrine, four pillars and a flat slab.
  kit.ring(4, 3.4, (px, pz) => {
    kit.pillar([px, pz], 4.2, 0.4, shade(stone, 1.06), 1.8, { capital: true });
  }, Math.PI / 4);
  kit.slab([8.4, 8.4], [0, 6.6, 0], 0.6, shade(stone, 1.0), { collide: false });
  kit.lathe(
    [
      [4.2, 0],
      [3.4, 1.6],
      [2.4, 3.2],
      [1.2, 4.4],
      [0.4, 5.0],
    ],
    [0, 7.2, 0],
    shade(stone, 0.96),
    { segments: 14, collide: false },
  );
  kit.sphere(0.5, [0, 12.5, 0], 0xc9a23c, { segments: 8, collide: false });

  // The chariot drawn up beside it, and the tree the scene is always painted under.
  buildChariot(ctx, 15, 4, -0.5, 0x3f6bbf);
  addTree(kit, -17, -10, 0, 'banyan', rng, 1.5);
  addFire(kit, 6, 9, 0, 1.0);
  kit.marker('dialogue', [0, 1.5, 6]);
}

/* ================================================================= Gateways */

/** A monumental city gate: two bastions, a corbelled or arched opening, walls. */
export function cityGate(ctx: BuildContext): void {
  const { kit, palette } = ctx;
  const width = ctx.num('width', 36);
  const height = ctx.num('height', 20);
  const mud = ctx.flag('mud');
  const timber = ctx.flag('timber');
  const red = ctx.flag('redSandstone');
  const iwan = ctx.flag('iwan');

  const stone = red ? 0xa8513a : mud ? shade(palette.stone, 0.9) : palette.stone;
  const towerW = width * 0.3;
  const open = width * 0.34;

  // Two bastions flanking the opening.
  for (const side of [-1, 1]) {
    const cx = side * (open / 2 + towerW / 2);
    if (mud) {
      kit.box([towerW, height, towerW * 0.85], [cx, height / 2, 0], shade(stone, 0.96));
    } else {
      kit.cylinder(towerW * 0.52, towerW * 0.6, height, [cx, height / 2, 0], shade(stone, 0.96), { segments: 12 });
    }
    // Battered base.
    kit.box([towerW * 1.16, height * 0.12, towerW * 1.0], [cx, height * 0.06, 0], shade(stone, 0.88));
    // Parapet.
    kit.cylinder(towerW * 0.58, towerW * 0.54, height * 0.08, [cx, height * 1.02, 0], shade(stone, 1.04), {
      segments: 12,
      collide: false,
    });
    addCrenellations(kit, [cx - towerW * 0.5, -towerW * 0.4], [cx + towerW * 0.5, -towerW * 0.4], height * 1.06, stone, 1.0);
    addCrenellations(kit, [cx - towerW * 0.5, towerW * 0.4], [cx + towerW * 0.5, towerW * 0.4], height * 1.06, stone, 1.0);
  }

  // The opening itself.
  if (iwan) {
    addIwan(kit, [0, 0, 0], open, height * 0.62, towerW * 0.8, shade(stone, 1.05), 0x1e1710, 0);
    kit.box([open + towerW * 0.4, height * 0.2, towerW * 0.85], [0, height * 0.9, 0], shade(stone, 1.0), {
      collide: false,
    });
  } else {
    kit.corbelGate([0, 0, 0], open, height * 0.56, towerW * 0.8, shade(stone, 1.04));
  }
  kit.box([open + towerW * 0.2, height * 0.12, towerW * 0.9], [0, height * 0.86, 0], shade(stone, 1.06), {
    collide: false,
  });
  addCrenellations(kit, [-open / 2, 0], [open / 2, 0], height * 0.92, stone, 1.0);

  // Timber-leaf doors, open.
  if (timber) {
    for (const side of [-1, 1]) {
      kit.box([open * 0.46, height * 0.5, 0.5], [side * open * 0.3, height * 0.25, towerW * 0.42], WOOD, {
        rotY: side * 0.9,
        collide: false,
      });
    }
  }

  // Wall stubs running off to either side.
  for (const side of [-1, 1]) {
    const x0 = side * (open / 2 + towerW);
    const x1 = side * (open / 2 + towerW + 46);
    kit.wall([x0, 0], [x1, 0], height * 0.72, towerW * 0.55, shade(stone, 0.93));
    addCrenellations(kit, [x0, -towerW * 0.26], [x1, -towerW * 0.26], height * 0.72, stone, 1.0);
    addCrenellations(kit, [x0, towerW * 0.26], [x1, towerW * 0.26], height * 0.72, stone, 1.0);
  }
  kit.marker('gate', [0, 0, towerW]);
}

/* ================================================================= Maritime */

/** A working harbour: quay, jetty, warehouses, timber crane, moored craft. */
export function harbour(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const ships = Math.max(1, Math.round(ctx.num('ships', 2)));
  const stone = palette.stone;

  // Quay wall and deck.
  kit.box([70, 5, 16], [0, -0.6, -8], shade(stone, 0.94));
  kit.slab([70, 16], [0, 2.1, -8], 0.6, shade(stone, 1.06), { collide: false });
  // Bollards.
  kit.along([-32, 0], [32, 0], 9, (px, pz) => {
    kit.cylinder(0.5, 0.6, 1.1, [px, 2.9, pz], shade(stone, 0.88), { segments: 8, collide: false });
  });
  // Steps down to the water.
  kit.steps([-6, 2.4, 0.6], 6, -0.42, 1.2, 7, shade(stone, 1.0), {}, 'z+');

  // Jetty out into the water.
  kit.along([0, 2], [0, 34], 10, (px, pz) => {
    for (const side of [-1, 1]) {
      kit.cylinder(0.35, 0.4, 5, [px + side * 2.6, 0.2, pz], WOOD, { segments: 6, collide: false });
    }
  });
  kit.slab([7, 34], [0, 2.4, 18], 0.4, WOOD);

  // Warehouses and a crane.
  for (let i = 0; i < 3; i++) {
    addFlatHouse(kit, -24 + i * 24, -22, 2.4, 18, 13, rng.range(5.5, 7), stone, rng);
  }
  kit.cylinder(0.7, 0.8, 11, [26, 8, -3], WOOD, { segments: 7 });
  kit.box([0.5, 0.5, 13], [26, 13, 3], WOOD, { rotX: 0.35, collide: false });
  kit.cylinder(0.1, 0.1, 5, [26, 10.5, 9], 0x6b6050, { segments: 4, collide: false });
  kit.box([1.6, 1.6, 1.6], [26, 7.6, 9], WOOD, { collide: false });

  addPots(kit, -14, -14, 2.4, 7, rng);
  addPots(kit, 12, -13, 2.4, 5, rng);
  for (let i = 0; i < ships; i++) {
    buildBoat(ctx, -18 + i * 22, 30 + rng.range(-5, 5), rng.range(-0.4, 0.4), 1 + i * 0.15);
  }
  kit.marker('quay', [0, 2.4, -4]);
}

/** A sewn-plank trading boat with a settee sail. */
export function dhow(ctx: BuildContext): void {
  const large = ctx.flag('large');
  buildBoat(ctx, 0, 0, 0, large ? 1.55 : 1);
  ctx.kit.marker('deck', [0, 2.4, 0]);
}

function buildBoat(ctx: BuildContext, x: number, z: number, rotY: number, scale: number): void {
  const { kit } = ctx;
  const L = 16 * scale;
  const W = 4.6 * scale;
  const hull = 0x6d5133;

  // Hull: a boat-shaped outline extruded across the beam, then the raised ends.
  kit.prism(
    [
      [-L / 2, 1.6 * scale],
      [-L * 0.36, 0],
      [L * 0.36, 0],
      [L / 2, 1.8 * scale],
      [L * 0.42, 2.6 * scale],
      [-L * 0.42, 2.4 * scale],
    ],
    W,
    [x, 0, z],
    hull,
    { rotY },
  );
  // Deck and a cabin.
  kit.slab([L * 0.78, W * 0.86], [x, 2.5 * scale, z], 0.3 * scale, shade(hull, 1.15), { rotY, collide: true });
  kit.box([L * 0.22, 2.0 * scale, W * 0.66], [x + L * 0.2 * Math.cos(rotY), 3.6 * scale, z - L * 0.2 * Math.sin(rotY)], shade(hull, 0.9), {
    rotY,
    collide: false,
  });
  // Mast, yard and sail.
  kit.cylinder(0.18 * scale, 0.24 * scale, 13 * scale, [x, 9 * scale, z], 0x7a5e3a, { segments: 6, rotY });
  kit.box([0.16 * scale, 0.16 * scale, 11 * scale], [x, 12 * scale, z], 0x7a5e3a, { rotY, rotX: 0.25, collide: false });
  kit.prism(
    [
      [0, 0],
      [9 * scale, 1.2 * scale],
      [8 * scale, 9 * scale],
      [0, 10.5 * scale],
    ],
    0.1,
    [x, 3.2 * scale, z],
    0xd9cdb2,
    { rotY: rotY + Math.PI / 2, collide: false },
  );
  // Steering oar.
  kit.box([0.2 * scale, 0.2 * scale, 6 * scale], [x - L * 0.46 * Math.cos(rotY), 2.2 * scale, z + L * 0.46 * Math.sin(rotY)], 0x6b5133, {
    rotY,
    rotX: 0.5,
    collide: false,
  });
}
