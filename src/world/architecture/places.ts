import type { BuildContext } from './index';
import { shade, mixColor } from '../Materials';
import {
  WOOD,
  THATCH,
  CLOTH_SAFFRON,
  addBanner,
  addBoulder,
  addBoulderStack,
  addChhatri,
  addCrenellations,
  addFire,
  addFlatHouse,
  addHut,
  addIwan,
  addKalasha,
  addPots,
  addTree,
  addWaterPlane,
  addWell,
  scatterTrees,
} from './props';

/* ============================================================== palace city */

/**
 * A courtly complex: ranges of pillared halls around a court, a gateway and
 * towers. Options switch it between a Mauryan pillared court, a Vijayanagara
 * royal enclosure and Akbar's red sandstone Sikri.
 */
export function palaceCity(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const wings = Math.max(2, Math.round(ctx.num('wings', 3)));
  const towerH = ctx.num('towerHeight', 34);
  const court = ctx.num('courtWidth', 90);
  const pillared = ctx.flag('pillared');
  const red = ctx.flag('redSandstone');
  const lotus = ctx.flag('lotus');
  const panch = ctx.flag('panchMahal');

  const stone = red ? mixColor(palette.stone, 0xa8513a, 0.75) : palette.stone;
  const half = court / 2;

  // Courtyard paving and the enclosing wall.
  kit.slab([court, court], [0, 0.3, 0], 0.6, shade(stone, 1.0), { collide: false });
  for (const [a, b] of [
    [[-half, -half], [half, -half]],
    [[-half, half], [-12, half]],
    [[12, half], [half, half]],
    [[-half, -half], [-half, half]],
    [[half, -half], [half, half]],
  ] as Array<[[number, number], [number, number]]>) {
    kit.wall(a, b, 9, 2.4, shade(stone, 0.94));
    addCrenellations(kit, a, b, 9, shade(stone, 1.02), 1.2);
  }

  // Gateway.
  if (red) {
    addIwan(kit, [0, 0, half], 16, 19, 5.0, shade(stone, 1.04), 0x241a12, 0);
    kit.box([26, 5, 6], [0, 24, half], shade(stone, 1.0), { collide: false });
    kit.ring(2, 10, (px) => addChhatri(kit, [px, 26.5, half], 3.0, 7, shade(stone, 1.06), 8));
  } else {
    kit.corbelGate([0, 0, half], 12, 14, 6.0, shade(stone, 1.04));
  }

  // Ranges of halls around three sides.
  const rangeDepth = 22;
  for (let w = 0; w < wings; w++) {
    const angle = (w / Math.max(3, wings)) * Math.PI * 2 + Math.PI / 2;
    const cx = Math.cos(angle) * (half - rangeDepth / 2);
    const cz = Math.sin(angle) * (half - rangeDepth / 2);
    const long = court * 0.62;
    const rot = -angle + Math.PI / 2;

    kit.slab([long, rangeDepth], [cx, 1.2, cz], 2.4, shade(stone, 0.96), { rotY: rot });
    if (pillared) {
      // A hypostyle hall: rows of columns under a flat roof. Mauryan Kumrahar
      // and Vijayanagara's halls both work this way.
      const cols = Math.max(4, Math.round(long / 8));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < 2; j++) {
          const lx = -long / 2 + (long / (cols - 1)) * i;
          const lz = -rangeDepth / 4 + j * (rangeDepth / 2);
          const px = cx + lx * Math.cos(rot) + lz * Math.sin(rot);
          const pz = cz - lx * Math.sin(rot) + lz * Math.cos(rot);
          kit.pillar([px, pz], 9.5, 0.62, shade(stone, 1.06), 2.4, { square: red });
        }
      }
      kit.slab([long + 2, rangeDepth + 2], [cx, 12.6, cz], 1.2, shade(stone, 0.92), { rotY: rot, collide: false });
    } else {
      kit.box([long, 11, rangeDepth], [cx, 7.9, cz], shade(stone, 0.98), { rotY: rot });
      kit.roof([long, rangeDepth], [cx, 13.4, cz], 4.0, THATCH, 1.4);
    }
  }

  // Corner towers.
  kit.ring(4, half * 0.96, (px, pz) => {
    kit.cylinder(5.0, 5.8, towerH, [px, towerH / 2, pz], shade(stone, 0.95), { segments: 12 });
    kit.cylinder(6.0, 5.6, 1.4, [px, towerH + 0.7, pz], shade(stone, 1.04), { segments: 12, collide: false });
    addChhatri(kit, [px, towerH + 1.4, pz], 3.6, 8, shade(stone, 1.02), 8);
  }, Math.PI / 4);

  // Signature set-pieces.
  if (lotus) {
    // A symmetrical pavilion mixing arches with Dravidian mouldings.
    kit.slab([30, 30], [0, 1.4, -10], 2.8, shade(stone, 1.0));
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      addIwan(kit, [Math.cos(a) * 14, 2.8, -10 + Math.sin(a) * 14], 7, 8, 2.4, shade(stone, 1.06), 0x2a2018, -a + Math.PI / 2);
    }
    kit.ring(4, 10.6, (px, pz) => {
      kit.dome(4.4, [px, 13.4, -10 + pz], shade(stone, 1.08), { segments: 14, squash: 1.1, collide: false });
      addKalasha(kit, [px, 18.2, -10 + pz], 0.8, shade(stone, 1.12));
    }, Math.PI / 4);
    kit.slab([31, 31], [0, 13.0, -10], 1.0, shade(stone, 1.02), { collide: false });
  }
  if (panch) {
    // Five diminishing open storeys — the Panch Mahal.
    let w = 26;
    let y = 2.0;
    kit.slab([30, 30], [0, 1.0, 26], 2.0, shade(stone, 0.98));
    for (let s = 0; s < 5; s++) {
      const cols = 5 - s;
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < cols; j++) {
          if (s > 0 && i > 0 && i < cols - 1 && j > 0 && j < cols - 1) continue;
          const px = -w / 2 + (w / Math.max(1, cols - 1)) * i;
          const pz = 26 - w / 2 + (w / Math.max(1, cols - 1)) * j;
          kit.pillar([px, pz], 5.0, 0.4, shade(stone, 1.05), y, { square: true, capital: false });
        }
      }
      y += 5.4;
      kit.slab([w + 2, w + 2], [0, y, 26], 0.8, shade(stone, 1.0), { collide: false });
      w -= 5.0;
    }
    addChhatri(kit, [0, y + 0.8, 26], 4.0, 8, shade(stone, 1.06), 4);
  }

  addWell(kit, half - 10, -half + 12, 0, 2.2, shade(stone, 0.95));
  for (let i = 0; i < 5; i++) {
    addTree(kit, rng.range(-half * 0.5, half * 0.5), rng.range(-half * 0.4, half * 0.4), 0.3, 'mango', rng, 0.85);
  }
  addBanner(kit, -half + 8, half - 8, 0, 11, CLOTH_SAFFRON);
  kit.marker('court', [0, 0.6, 0]);
}

/* ================================================================ hermitage */

/** An ashram: thatched huts, a fire altar, a water pot, trees all around. */
export function hermitage(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const huts = Math.max(1, Math.round(ctx.num('huts', 4)));
  const open = ctx.flag('open');

  kit.ring(huts, 13, (hx, hz) => {
    addHut(kit, hx, hz, 0, rng.range(3.0, 4.0), mixColor(palette.stone, 0xa98052, 0.6), rng);
  }, rng.next() * 2);

  // Fire altar at the centre — square, as the texts prescribe.
  kit.slab([5.4, 5.4], [0, 0.4, 0], 0.8, shade(palette.stone, 1.0));
  kit.slab([3.6, 3.6], [0, 1.0, 0], 0.5, shade(palette.stone, 0.9), { collide: false });
  addFire(kit, 0, 0, 1.3, 1.1);
  for (const side of [-1, 1]) {
    kit.box([0.3, 1.6, 0.3], [side * 3.2, 0.8, 3.2], WOOD, { collide: false });
  }

  // Study platform under a tree, water pots, a reading bench.
  kit.slab([8, 6], [12, 0.3, -9], 0.6, shade(palette.stone, 1.04), { collide: false });
  kit.box([4.4, 0.8, 1.6], [12, 0.9, -9], WOOD);
  addPots(kit, -11, 7, 0, 4, rng);
  addWell(kit, 15, 9, 0, 1.5, shade(palette.stone, 0.96));

  // The forest closing in. An ashram is defined by what surrounds it.
  if (!open) {
    scatterTrees(kit, 16, 20, 42, 'sal', rng);
    scatterTrees(kit, 6, 22, 40, 'banyan', rng);
  } else {
    scatterTrees(kit, 8, 26, 46, 'sal', rng);
  }
  addTree(kit, -6, -12, 0, 'banyan', rng, 1.4);
  kit.marker('fire', [0, 0.8, 5]);
}

/* ============================================================ village cluster */

/** A village: huts or houses, a granary, a well, fields, a cattle pen. */
export function villageCluster(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const count = Math.max(3, Math.round(ctx.num('count', 9)));
  const reed = ctx.flag('reed');
  const terraced = ctx.flag('terraced');
  const fields = ctx.flag('fields');
  const workshop = ctx.flag('workshop');

  const wallColor = mixColor(palette.stone, 0xa9794f, 0.5);

  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + rng.range(-0.25, 0.25);
    const r = rng.range(9, 26);
    const hx = Math.cos(a) * r;
    const hz = Math.sin(a) * r;
    const y = terraced ? Math.floor(r / 9) * 1.4 : 0;
    if (terraced) kit.slab([14, 14], [hx, y - 0.4, hz], 0.8, shade(palette.rock, 0.95), { collide: true });
    if (reed || rng.bool(0.55)) {
      addHut(kit, hx, hz, y, rng.range(2.6, 3.8), wallColor, rng, reed);
    } else {
      addFlatHouse(kit, hx, hz, y, rng.range(6, 9), rng.range(5, 8), rng.range(3.4, 4.8), wallColor, rng);
    }
    if (rng.bool(0.4)) addPots(kit, hx + rng.range(-3, 3), hz + rng.range(-3, 3), y, rng.int(2, 4), rng);
  }

  // Granary on a raised plinth, to keep grain off wet ground.
  kit.slab([10, 8], [0, 0.8, -4], 1.6, shade(palette.stone, 0.94));
  kit.cylinder(3.6, 3.9, 5.0, [0, 4.1, -4], shade(wallColor, 1.08), { segments: 12 });
  kit.cone(4.4, 3.4, [0, 8.3, -4], THATCH, { segments: 10, collide: false });

  addWell(kit, 6, 7, 0, 1.7, shade(palette.stone, 0.96));

  // Cattle pen.
  const penR = 7;
  kit.ring(14, penR, (px, pz) => {
    kit.box([0.26, 1.5, 0.26], [px - 20, 0.75, pz + 14], WOOD, { collide: false });
  });
  for (let i = 0; i < 3; i++) {
    const bx = -20 + rng.range(-3, 3);
    const bz = 14 + rng.range(-3, 3);
    kit.box([1.4, 1.6, 2.8], [bx, 1.4, bz], shade(0x9c8468, rng.range(0.85, 1.15)), { rotY: rng.next() * Math.PI });
    kit.box([0.9, 1.0, 1.0], [bx, 2.1, bz - 1.8], 0x9c8468, { collide: false });
  }

  if (fields) {
    // Bunded plots — the geometry of Indian farming.
    for (let fx = 0; fx < 3; fx++) {
      for (let fz = 0; fz < 2; fz++) {
        const px = 34 + fx * 22;
        const pz = -14 + fz * 22;
        kit.slab([20, 20], [px, 0.12, pz], 0.24, shade(palette.foliage, 1.05), { collide: false });
        for (const [bx, bz, bw, bd] of [
          [0, -10, 20, 0.8],
          [0, 10, 20, 0.8],
          [-10, 0, 0.8, 20],
          [10, 0, 0.8, 20],
        ] as Array<[number, number, number, number]>) {
          kit.box([bw, 0.6, bd], [px + bx, 0.3, pz + bz], shade(palette.ground, 0.9), { collide: false });
        }
      }
    }
  }
  if (workshop) {
    // A stone-cutting yard: blocks part-worked, waste chips, a saw frame.
    kit.slab([18, 14], [-30, 0.2, -16], 0.4, shade(palette.stone, 1.02), { collide: false });
    for (let i = 0; i < 5; i++) {
      kit.box(
        [rng.range(2, 4), rng.range(1, 2.4), rng.range(2, 3.4)],
        [-30 + rng.range(-7, 7), 0.9, -16 + rng.range(-5, 5)],
        shade(0xe6e0d2, rng.range(0.92, 1.06)),
        { rotY: rng.next() * Math.PI },
      );
    }
    kit.box([0.3, 2.6, 5.0], [-24, 1.3, -16], WOOD, { collide: false });
    addFire(kit, -36, -10, 0, 0.9);
  }

  scatterTrees(kit, 7, 28, 46, rng.bool(0.5) ? 'mango' : 'acacia', rng);
  kit.marker('well', [6, 0, 9]);
}

/* ============================================================= bazaar street */

/** A colonnaded market street, optionally with an assembly hall at one end. */
export function bazaarStreet(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const stalls = Math.max(4, Math.round(ctx.num('stalls', 12)));
  const length = ctx.num('length', 120);
  const hall = ctx.flag('hall');
  const colonnade = ctx.flag('colonnade');
  const stone = palette.stone;

  const streetW = 16;
  kit.slab([streetW, length], [0, 0.2, 0], 0.4, shade(stone, 1.02), { collide: false });

  const perSide = Math.ceil(stalls / 2);
  for (const side of [-1, 1]) {
    // Continuous platform both sides — the standing remains at Hampi.
    kit.slab([11, length], [side * (streetW / 2 + 5.5), 0.75, 0], 1.5, shade(stone, 0.98));
    for (let i = 0; i < perSide; i++) {
      const pz = -length / 2 + (length / perSide) * (i + 0.5);
      const px = side * (streetW / 2 + 5.5);

      if (colonnade) {
        // Pillared shop fronts.
        for (const d of [-2.6, 2.6]) {
          kit.pillar([px - side * 4.2, pz + d], 5.4, 0.46, shade(stone, 1.06), 1.5, { square: true });
        }
        kit.box([9, 1.0, length / perSide], [px, 7.4, pz], shade(stone, 0.94), { collide: false });
      } else {
        // Timber-framed awning.
        for (const d of [-2.4, 2.4]) {
          kit.cylinder(0.22, 0.26, 4.2, [px - side * 4.4, 3.6, pz + d], WOOD, { segments: 5, collide: false });
        }
        kit.prism(
          [
            [-5, 0],
            [5, 0],
            [4, 1.2],
            [-4, 1.2],
          ],
          length / perSide - 0.4,
          [px, 5.6, pz],
          shade(rng.bool(0.5) ? CLOTH_SAFFRON : 0xb8995c, rng.range(0.9, 1.1)),
          { rotY: Math.PI / 2, collide: false },
        );
      }

      // Back wall and the goods on display.
      kit.box([1.2, 5.0, length / perSide], [px + side * 5.0, 4.0, pz], shade(stone, 0.96));
      kit.box([2.6, 0.8, 3.0], [px - side * 1.5, 2.65, pz], WOOD, { collide: false });
      addPots(kit, px - side * 2.5, pz, 1.5, rng.int(2, 4), rng);
      if (rng.bool(0.4)) {
        for (let s = 0; s < 4; s++) {
          kit.box([1.3, 0.3, 1.3], [px - side * 1.5, 3.1 + s * 0.3, pz + rng.range(-1, 1)], shade(0xc8743a, rng.range(0.8, 1.2)), {
            collide: false,
          });
        }
      }
    }
  }

  if (hall) {
    // An open pillared hall: the village assembly meets in one of these.
    const hz = length / 2 + 20;
    kit.slab([34, 26], [0, 1.0, hz], 2.0, shade(stone, 1.0));
    const cols = 5;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < 4; j++) {
        if (i > 0 && i < cols - 1 && j > 0 && j < 3) continue;
        kit.pillar([-14 + i * 7, hz - 9 + j * 6], 7.0, 0.56, shade(stone, 1.06), 2.0, { square: true });
      }
    }
    kit.slab([36, 28], [0, 10.0, hz], 1.2, shade(stone, 0.94), { collide: false });
    kit.roof([34, 26], [0, 10.6, hz], 4.4, shade(stone, 1.02), 1.4);
    // The inscribed wall — where the election rules are carved.
    kit.box([32, 6.0, 1.2], [0, 5.0, hz + 12], shade(stone, 1.08));
    for (let line = 0; line < 12; line++) {
      kit.box([28, 0.12, 0.12], [0, 7.4 - line * 0.42, hz + 11.3], shade(stone, 0.76), { collide: false });
    }
    // The pot the names are drawn from.
    kit.lathe(
      [
        [0.9, 0],
        [1.3, 0.8],
        [1.0, 1.5],
        [0.6, 1.8],
      ],
      [0, 2.0, hz - 4],
      0xa2613f,
      { segments: 12, collide: false },
    );
    kit.marker('assembly', [0, 2.0, hz - 8]);
  }

  addBanner(kit, streetW / 2 + 12, -length / 2 + 6, 0, 9, CLOTH_SAFFRON);
  addTree(kit, -(streetW / 2 + 16), length / 2 - 10, 0, 'banyan', rng, 1.2);
  kit.marker('street', [0, 0.4, 0]);
}

/* ================================================================ hill fort */

/** A giri-durga: ring wall with bastions on a mound, a bent gate, a citadel. */
export function hillFort(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const R = ctx.num('wallRadius', 110);
  const towers = Math.max(4, Math.round(ctx.num('towers', 9)));
  const wallH = ctx.num('height', 22);
  const bentGate = ctx.flag('bentGate');
  const stone = palette.stone;

  // The mound itself, as terraces (machis) the walls stand on.
  for (let i = 0; i < 4; i++) {
    const r = R * (1.06 - i * 0.14);
    kit.cylinder(r, r * 1.03, 5.0, [0, 2.5 + i * 4.6, 0], shade(palette.rock, 0.94 + i * 0.03), { segments: 28 });
  }
  const crest = 2.5 + 3 * 4.6 + 2.5;

  // Curtain wall, as straight segments between bastions. The ring is turned half a step so that a
  // wall, not a bastion, faces east: that is where the gate and the way up go.
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < towers; i++) {
    const a = ((i + 0.5) / towers) * Math.PI * 2;
    pts.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  const gateX = R * Math.cos(Math.PI / towers);
  const gateGap = 11;
  for (let i = 0; i < towers; i++) {
    const a = pts[i] as [number, number];
    const b = pts[(i + 1) % towers] as [number, number];
    if (i === towers - 1) {
      // The east wall, with the gateway left open in the middle and the wall carried over it.
      kit.wall(a, [gateX, -gateGap / 2], wallH, 4.0, shade(stone, 0.96), 0);
      kit.wall([gateX, gateGap / 2], b, wallH, 4.0, shade(stone, 0.96), 0);
      kit.box([4.0, wallH - 14, gateGap], [gateX, 14 + (wallH - 14) / 2, 0], shade(stone, 0.98), { collide: false });
    } else {
      kit.wall(a, b, wallH, 4.0, shade(stone, 0.96), 0);
    }
    addCrenellations(kit, a, b, wallH, shade(stone, 1.04), 1.4);
  }

  // Bastions — round, projecting, and sited to shoot along the wall.
  for (const [bx, bz] of pts) {
    kit.cylinder(7.5, 8.6, wallH * 1.12, [bx, (wallH * 1.12) / 2, bz], shade(stone, 0.98), { segments: 14 });
    kit.cylinder(8.8, 8.2, 1.6, [bx, wallH * 1.12 + 0.8, bz], shade(stone, 1.06), { segments: 14, collide: false });
    kit.ring(9, 8.0, (px, pz) => {
      kit.box([1.3, 1.9, 1.0], [bx + px, wallH * 1.12 + 2.5, bz + pz], shade(stone, 1.02), { collide: false });
    });
  }

  // The way up: one long stair from the foot of the hill, through the gate, to the summit terrace.
  // (It used to be a few decorative slabs, and the fort could not be entered at all.)
  {
    const count = Math.ceil(crest / 0.45);
    const run = 1.15;
    const topEdge = R * (1.06 - 3 * 0.14);
    kit.steps([topEdge + count * run - run / 2, 0, 0], count, crest / count, run, 7, shade(palette.rock, 1.04), {}, 'x-');
    // The gatehouse stands in the wall, astride the stair.
    kit.corbelGate([gateX, 0, 0], 8.4, 15, 6.0, shade(stone, 1.04), { rotY: Math.PI / 2 });
    if (bentGate) {
      // An outer gate lower down, set off the line of the stair's foot: the approach is exposed and
      // turns, so nothing can charge the main gate. (Kept clear of the stair itself.)
      const ox = topEdge + count * run + 6;
      kit.corbelGate([ox, 0, 9], 7, 10, 5.0, shade(stone, 1.0), {});
      kit.wall([ox - 7, 3], [ox - 7, 22], wallH * 0.5, 2.6, shade(stone, 0.94));
    }
    kit.marker('gate', [topEdge + count * run + 3, 0, 0]);
  }

  // The citadel on the summit, with its own flight up from the terrace.
  kit.cylinder(R * 0.3, R * 0.33, 8.0, [0, crest + 4, 0], shade(stone, 1.0), { segments: 18 });
  kit.steps([R * 0.3 + 18 * 1.0 - 0.5 - 0.6, crest, 0], 18, 8 / 18, 1.0, 6, shade(stone, 1.02), {}, 'x-');
  // Turned so no tower stands at the head of the stair.
  kit.ring(6, R * 0.26, (px, pz) => {
    kit.box([7, 10, 7], [px, crest + 13, pz], shade(stone, 1.02));
    addCrenellations(kit, [px - 3.5, pz], [px + 3.5, pz], crest + 18, shade(stone, 1.08), 1.0);
  }, Math.PI / 6);
  kit.box([R * 0.26, 14, R * 0.22], [0, crest + 15, 0], shade(stone, 1.04));
  addChhatri(kit, [0, crest + 22, 0], 6, 10, shade(stone, 1.06), 8);
  addBanner(kit, R * 0.2, -R * 0.2, crest + 8, 14, CLOTH_SAFFRON);

  // Rock-cut cisterns — the thing that actually decides a siege.
  for (let i = 0; i < 3; i++) {
    const a = 1.1 + i * 1.9;
    const cx = Math.cos(a) * R * 0.5;
    const cz = Math.sin(a) * R * 0.5;
    kit.box([16, 1.2, 12], [cx, crest - 0.6, cz], 0x3a4a4e);
    addWaterPlane(kit, [15, 11], [cx, crest - 0.3, cz]);
    for (let s = 0; s < 4; s++) {
      kit.box([16, 0.5, 1.4], [cx, crest - 0.9 - s * 0.5, cz + 5 - s * 1.4], shade(palette.rock, 1.0), { collide: false });
    }
  }

  // Bare rock and scrub on the slopes.
  for (let i = 0; i < 22; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = R * rng.range(1.05, 1.5);
    addBoulder(kit, Math.cos(a) * r, Math.sin(a) * r, 0, rng.range(1.4, 3.6), palette.rock, rng);
  }
  scatterTrees(kit, 14, R * 1.15, R * 1.7, 'acacia', rng);
  kit.marker('citadel', [0, crest + 8, 0]);
}

/* ================================================================ lanka fort */

/** A walled island citadel. With `sea`, it sits on rocks in the water. */
export function lankaFort(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const R = ctx.num('wallRadius', 72);
  const towers = Math.max(4, Math.round(ctx.num('towers', 6)));
  const wallH = ctx.num('height', 26);
  const sea = ctx.flag('sea');
  const stone = palette.stone;

  if (sea) {
    // A rubble foundation of boulders in the surf.
    for (let i = 0; i < 40; i++) {
      const a = rng.next() * Math.PI * 2;
      const r = R * rng.range(1.0, 1.35);
      addBoulder(kit, Math.cos(a) * r, Math.sin(a) * r, -2.5, rng.range(2.0, 4.5), shade(palette.rock, 0.9), rng);
    }
    kit.cylinder(R * 1.02, R * 1.1, 6.0, [0, 1.0, 0], shade(palette.rock, 0.95), { segments: 26 });
  }
  const baseY = sea ? 4.0 : 0;

  // Curtain wall with projecting towers.
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < towers; i++) {
    const a = (i / towers) * Math.PI * 2;
    pts.push([Math.cos(a) * R, Math.sin(a) * R]);
  }
  for (let i = 0; i < towers; i++) {
    const a = pts[i] as [number, number];
    const b = pts[(i + 1) % towers] as [number, number];
    kit.wall(a, b, wallH, 4.4, shade(stone, 0.96), baseY);
    addCrenellations(kit, a, b, baseY + wallH, shade(stone, 1.04), 1.5);
  }
  for (const [bx, bz] of pts) {
    kit.box([13, wallH * 1.2, 13], [bx, baseY + (wallH * 1.2) / 2, bz], shade(stone, 0.98), {
      rotY: -Math.atan2(bz, bx),
    });
    addChhatri(kit, [bx, baseY + wallH * 1.2, bz], 5.0, 9, shade(stone, 1.04), 4);
  }

  // Gate facing the causeway.
  const g = pts[0] as [number, number];
  kit.corbelGate([g[0], baseY, g[1]], 11, 15, 8.0, shade(stone, 1.04), { rotY: -Math.atan2(g[1], g[0]) });

  // Palace within: terraces, pillared halls, a tower.
  kit.cylinder(R * 0.52, R * 0.55, 4.0, [0, baseY + 2.0, 0], shade(stone, 1.0), { segments: 20 });
  kit.ring(4, R * 0.3, (px, pz) => {
    kit.box([18, 13, 14], [px, baseY + 10.5, pz], shade(stone, 1.02), { rotY: -Math.atan2(pz, px) });
    kit.roof([18, 14], [px, baseY + 17.0, pz], 5.0, shade(stone, 0.96), 1.4);
  }, Math.PI / 4);
  kit.box([20, 30, 20], [0, baseY + 19.0, 0], shade(stone, 1.04));
  let w = 18;
  for (let i = 0; i < 5; i++) {
    kit.slab([w, w], [0, baseY + 34 + i * 3.4, 0], 3.4, shade(stone, 1.06 + i * 0.01), { collide: false });
    w -= 2.6;
  }
  addKalasha(kit, [0, baseY + 51, 0], 2.0, shade(stone, 1.14));
  addBanner(kit, R * 0.4, R * 0.4, baseY + 4.0, 16, 0x8f3a3a);

  scatterTrees(kit, 10, R * 0.62, R * 0.92, 'palm', rng, baseY + 4.0);
  kit.marker('gate', [g[0] * 1.15, baseY, g[1] * 1.15]);
}

/* =================================================================== ram setu */

/** The causeway: a rubble core on a shoal, surfaced with dressed slabs. */
export function ramSetu(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const span = ctx.num('span', 300);
  const segments = Math.max(6, Math.round(ctx.num('segments', 26)));
  const stone = shade(palette.rock, 0.95);

  for (let i = 0; i < segments; i++) {
    const t = i / (segments - 1);
    const x = -span / 2 + span * t;
    // The causeway dips towards the middle, where the water is deepest, so the
    // completed section is at the ends and the works are still in progress.
    const sag = Math.sin(t * Math.PI) * 2.2;
    const y = -sag;
    const width = 11 - Math.sin(t * Math.PI) * 2.2;

    // Rubble core.
    for (let b = 0; b < 5; b++) {
      addBoulder(
        kit,
        x + rng.range(-3, 3),
        rng.range(-width / 2, width / 2),
        y - 3.2,
        rng.range(1.6, 3.2),
        stone,
        rng,
      );
    }
    // Timber crib binding, exposed where the surface is unfinished.
    if (t > 0.3 && t < 0.75) {
      kit.box([span / segments, 0.5, width], [x, y + 0.2, 0], WOOD, { collide: false });
      for (let c = 0; c < 3; c++) {
        kit.box([0.4, 0.4, width + 2], [x - 2 + c * 2, y + 0.6, 0], WOOD, { collide: false });
      }
    } else {
      // Dressed surface slabs.
      kit.slab([span / segments + 0.4, width], [x, y + 0.8, 0], 0.7, shade(stone, 1.12));
      // Kerb stones.
      for (const side of [-1, 1]) {
        kit.box([span / segments, 0.9, 1.0], [x, y + 1.5, side * (width / 2 - 0.5)], shade(stone, 1.04), {
          collide: false,
        });
      }
    }
    // Marker posts with the sounding depths, every few segments.
    if (i % 5 === 0) {
      kit.cylinder(0.18, 0.22, 4.4, [x, y + 2.6, width / 2 + 2], WOOD, { segments: 5, collide: false });
      kit.box([0.9, 0.7, 0.1], [x, y + 4.6, width / 2 + 2], 0xd9cdb2, { collide: false });
    }
  }

  // Working platforms at either end.
  for (const side of [-1, 1]) {
    const x = side * (span / 2 + 7);
    kit.slab([14, 18], [x, 1.0, 0], 2.0, shade(stone, 1.08));
    addPots(kit, x, 5, 2.0, 3, rng);
    for (let i = 0; i < 5; i++) {
      addBoulder(kit, x + rng.range(-6, 6), rng.range(-8, 8), 2.0, rng.range(1.0, 1.8), stone, rng);
    }
  }
  kit.marker('works', [0, 0, 14]);
}

/* ============================================================== boulder field */

/** Weathered granite: scattered, stacked, sometimes quarried. */
export function boulderField(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const count = Math.max(6, Math.round(ctx.num('count', 34)));
  const spread = ctx.num('spread', 90);
  const scale = ctx.num('scale', 1.3);
  const rock = palette.rock;

  for (let i = 0; i < count; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = Math.sqrt(rng.next()) * spread;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (rng.bool(0.22)) {
      addBoulderStack(kit, x, z, 0, scale, rock, rng);
    } else {
      addBoulder(kit, x, z, 0, rng.range(1.6, 5.5) * scale, rock, rng);
    }
  }

  // Quarry marks: rows of wedge holes, visible on hundreds of Hampi boulders.
  for (let q = 0; q < 3; q++) {
    const a = rng.next() * Math.PI * 2;
    const r = spread * rng.range(0.3, 0.8);
    const bx = Math.cos(a) * r;
    const bz = Math.sin(a) * r;
    const big = 5.0 * scale;
    addBoulder(kit, bx, bz, 0, big, rock, rng);
    for (let h = 0; h < 7; h++) {
      kit.box([0.5, 0.35, 0.5], [bx - big * 0.6 + (h * big * 1.2) / 7, big * 0.75, bz], shade(rock, 0.7), {
        collide: false,
      });
    }
    // A part-split slab beside it.
    kit.box([big * 1.4, 1.2, big * 0.6], [bx + big * 1.4, 0.6, bz + 2], shade(rock, 1.05), {
      rotY: rng.next() * Math.PI,
    });
  }

  scatterTrees(kit, Math.round(count / 5), spread * 0.3, spread, 'acacia', rng);
  kit.marker('field', [0, 0, 0]);
}

/* ================================================================= stepwell */

/** A stepped tank. Options give rock-cut cisterns and large temple tanks. */
export function stepwell(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const large = ctx.flag('large');
  const stepped = ctx.flag('stepped');
  const rockCut = ctx.flag('rockCut');
  const stone = rockCut ? shade(palette.rock, 1.0) : palette.stone;

  const W = large ? 56 : 34;
  const D = large ? 44 : 28;
  const depth = large ? 12 : 9;
  const stepCount = Math.round(depth / 0.9);

  // Descending terraces on all four sides — the pushkarani form.
  for (let s = 0; s < stepCount; s++) {
    const inset = s * ((W / 2 - 4) / stepCount);
    const w = W - inset * 2;
    const d = D - inset * 2;
    const y = -s * (depth / stepCount);
    for (const [bx, bz, bw, bd] of [
      [0, -d / 2, w, 1.2],
      [0, d / 2, w, 1.2],
      [-w / 2, 0, 1.2, d],
      [w / 2, 0, 1.2, d],
    ] as Array<[number, number, number, number]>) {
      kit.box([bw, depth / stepCount + 0.3, bd], [bx, y - (depth / stepCount) / 2, bz], shade(stone, 1.0 + (s % 3) * 0.03), {
        collide: false,
      });
    }
    // Numbered blocks — Hampi's stepped tank was assembled from a kit of parts.
    if (stepped && s % 3 === 0) {
      kit.box([1.0, 0.2, 1.0], [-w / 2 + 2, y + 0.1, -d / 2 + 2], shade(stone, 0.8), { collide: false });
    }
  }

  // Water at the bottom, and a collider so you can walk the terraces.
  const floorY = -depth;
  kit.slab([W - (W / 2 - 4) * 2 + 4, D - (W / 2 - 4) * 2 + 4], [0, floorY, 0], 0.6, 0x24343a);
  addWaterPlane(kit, [W * 0.3, D * 0.3], [0, floorY + 1.2, 0]);
  // Ring of invisible blockers forming a walkable funnel.
  for (let s = 0; s < stepCount; s++) {
    const inset = s * ((W / 2 - 4) / stepCount);
    const y = -s * (depth / stepCount);
    kit.blocker([-(W / 2 - inset), y - 0.4, -(D / 2 - inset)], [W / 2 - inset, y, D / 2 - inset]);
  }

  // Coping and, unless this is a bare cistern, side pavilions.
  for (const [bx, bz, bw, bd] of [
    [0, -D / 2 - 1.2, W + 4, 2.4],
    [0, D / 2 + 1.2, W + 4, 2.4],
    [-W / 2 - 1.2, 0, 2.4, D + 4],
    [W / 2 + 1.2, 0, 2.4, D + 4],
  ] as Array<[number, number, number, number]>) {
    kit.box([bw, 1.4, bd], [bx, 0.7, bz], shade(stone, 1.08));
  }
  if (!rockCut) {
    for (const side of [-1, 1]) {
      addChhatri(kit, [side * (W / 2 + 8), 1.4, 0], 4.4, 8.5, shade(stone, 1.04), 4);
    }
    addTree(kit, -(W / 2 + 12), D / 2 + 8, 0, 'mango', rng, 1.0);
  }
  if (rockCut) {
    for (let i = 0; i < 9; i++) {
      const a = rng.next() * Math.PI * 2;
      addBoulder(kit, Math.cos(a) * (W * 0.75), Math.sin(a) * (D * 0.8), 0, rng.range(2, 4), palette.rock, rng);
    }
  }
  kit.marker('steps', [0, 0, D / 2 + 4]);
}

/* ================================================================ vimana pad */

/** The landing terrace: where the Vimana drops you, and a fast-travel point. */
export function vimanaPad(ctx: BuildContext): void {
  const { kit, palette } = ctx;
  const stone = palette.stone;
  const R = 15;

  // Lotus-petal platform.
  kit.cylinder(R, R + 1.2, 1.6, [0, 0.8, 0], shade(stone, 1.0), { segments: 24 });
  kit.cylinder(R - 2.4, R - 2.4, 0.5, [0, 1.75, 0], shade(stone, 1.1), { segments: 24, collide: false });
  kit.ring(16, R - 1.0, (px, pz, a) => {
    kit.prism(
      [
        [-1.5, 0],
        [1.5, 0],
        [0, 2.2],
      ],
      0.5,
      [px, 1.6, pz],
      shade(stone, 1.14),
      { rotY: -a + Math.PI / 2, collide: false },
    );
  });
  // A gold inlay ring, so the pad reads as a waypoint from the air.
  kit.torus(R - 4.2, 0.3, [0, 2.1, 0], 0xd9a93c, { rotX: Math.PI / 2, segments: 30, collide: false });

  // Torana arch over the steps.
  const span = 9;
  for (const side of [-1, 1]) {
    kit.box([1.4, 11, 1.4], [side * span, 5.5, R + 2], shade(stone, 1.04));
    kit.box([2.2, 1.2, 2.2], [side * span, 11.4, R + 2], shade(stone, 1.1), { collide: false });
  }
  for (let i = 0; i < 2; i++) {
    kit.box([span * 2 + 4, 0.9, 1.2], [0, 12.4 + i * 1.5, R + 2], shade(stone, 1.08), { collide: false });
  }
  addKalasha(kit, [0, 15.4, R + 2], 1.0, shade(stone, 1.16));
  kit.steps([0, 0, R + 4 * 1.2], 4, 0.4, 1.2, 10, shade(stone, 1.02), {}, 'z-');

  addBanner(kit, -R + 4, -R + 4, 1.6, 10, CLOTH_SAFFRON);
  addBanner(kit, R - 4, -R + 4, 1.6, 10, CLOTH_SAFFRON);
  kit.marker('landing', [0, 1.6, 0]);
}
