import type { BuildContext } from './index';
import { shade, mixColor } from '../Materials';
import {
  BRONZE,
  WOOD,
  addAmalaka,
  addBanner,
  addChhatri,
  addFire,
  addFlatHouse,
  addIwan,
  addKalasha,
  addPots,
  addTree,
  addWaterPlane,
} from './props';

/* ==================================================================== stupa */

/**
 * A stupa, built in the order the Magadha challenge teaches: medhi, anda,
 * harmika, yashti, chhatra, then enclosed by a vedika with toranas.
 */
export function stupa(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const r = ctx.num('radius', 26);
  const domeH = ctx.num('domeHeight', 18);
  const toranas = Math.max(0, Math.round(ctx.num('toranas', 4)));
  const stone = palette.stone;

  // Paved circumambulation path at ground level.
  kit.cylinder(r + 13, r + 13, 0.5, [0, 0.25, 0], shade(stone, 0.9), { segments: 32, collide: false });

  // Medhi — the drum, with a railed terrace you can walk.
  const medhiH = 5.4;
  kit.cylinder(r, r, medhiH, [0, medhiH / 2, 0], shade(stone, 1.0), { segments: 28 });
  kit.cylinder(r + 1.1, r + 1.1, 0.7, [0, medhiH + 0.35, 0], shade(stone, 1.06), { segments: 28, collide: false });

  // Anda — the dome.
  kit.dome(r * 0.93, [0, medhiH + 0.7, 0], shade(stone, 1.04), { segments: 28, squash: domeH / (r * 0.93) });
  const domeTop = medhiH + 0.7 + domeH;

  // Harmika, yashti and the tiered chhatras.
  kit.box([r * 0.3, r * 0.14, r * 0.3], [0, domeTop + r * 0.07, 0], shade(stone, 1.1));
  kit.ring(4, r * 0.15, (px, pz) => {
    kit.box([0.3, r * 0.1, 0.3], [px, domeTop + r * 0.19, pz], shade(stone, 1.14), { collide: false });
  }, Math.PI / 4);
  const mastBase = domeTop + r * 0.14;
  kit.cylinder(r * 0.03, r * 0.035, r * 0.42, [0, mastBase + r * 0.21, 0], shade(stone, 0.95), { segments: 8, collide: false });
  for (let i = 0; i < 3; i++) {
    const cr = r * (0.19 - i * 0.045);
    kit.cylinder(cr, cr, r * 0.022, [0, mastBase + r * (0.12 + i * 0.12), 0], shade(stone, 1.12), {
      segments: 16,
      collide: false,
    });
  }

  // Stairway up to the terrace.
  kit.steps([-r - 12, 0, 0], 12, medhiH / 12, 1.0, 6, shade(stone, 0.96));

  // Vedika — the railing ring, with gaps at the cardinal gateways.
  const vr = r + 11;
  const posts = 56;
  for (let i = 0; i < posts; i++) {
    const a = (i / posts) * Math.PI * 2;
    // Leave a gap where each torana stands.
    const nearGate = toranas > 0 && [0, 1, 2, 3].slice(0, toranas).some((q) => {
      const ga = (q / 4) * Math.PI * 2;
      let d = Math.abs(a - ga);
      if (d > Math.PI) d = Math.PI * 2 - d;
      return d < 0.16;
    });
    if (nearGate) continue;
    const px = Math.cos(a) * vr;
    const pz = Math.sin(a) * vr;
    kit.box([0.45, 3.2, 0.45], [px, 1.6, pz], shade(stone, 1.02), { rotY: -a, collide: false });
    for (const h of [1.1, 2.0, 2.7]) {
      kit.box([0.3, 0.42, (Math.PI * 2 * vr) / posts], [px, h, pz], shade(stone, 1.08), { rotY: -a, collide: false });
    }
  }

  // Toranas — the carved gateways, the famous part of Sanchi.
  for (let q = 0; q < toranas; q++) {
    const a = (q / 4) * Math.PI * 2;
    const gx = Math.cos(a) * vr;
    const gz = Math.sin(a) * vr;
    buildTorana(ctx, gx, gz, -a + Math.PI / 2, shade(stone, 1.08));
  }

  for (let i = 0; i < 5; i++) {
    const a = rng.next() * Math.PI * 2;
    addTree(kit, Math.cos(a) * (vr + 16), Math.sin(a) * (vr + 16), 0, 'mango', rng, 1.1);
  }
  kit.marker('path', [0, 0.5, vr - 4]);
}

/** A torana: two carved posts and three curved architraves. */
function buildTorana(ctx: BuildContext, x: number, z: number, rotY: number, stone: number): void {
  const { kit } = ctx;
  const h = 10;
  const span = 6.4;
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  const p = (lx: number, ly: number): [number, number, number] => [x + lx * c, ly, z - lx * s];

  for (const side of [-1, 1]) {
    kit.box([1.1, h, 1.1], p(side * span * 0.5, h / 2), stone, { rotY });
    // Capital with addorsed animals, abstracted to blocks.
    kit.box([1.7, 1.0, 1.7], p(side * span * 0.5, h + 0.5), shade(stone, 1.1), { rotY, collide: false });
    kit.box([1.3, 0.9, 1.3], p(side * span * 0.5, h + 1.4), shade(stone, 1.04), { rotY, collide: false });
  }
  for (let i = 0; i < 3; i++) {
    const ay = h + 2.1 + i * 1.5;
    kit.box([span + 3.2, 0.75, 1.0], p(0, ay), stone, { rotY, collide: false });
    // Scroll ends.
    for (const side of [-1, 1]) {
      kit.cylinder(0.55, 0.55, 0.9, p(side * (span * 0.5 + 1.9), ay), shade(stone, 1.12), {
        rotY,
        rotX: Math.PI / 2,
        segments: 8,
        collide: false,
      });
    }
    // Uprights between the architraves.
    if (i < 2) {
      for (const side of [-1, 0, 1]) {
        kit.box([0.5, 0.78, 0.6], p(side * span * 0.28, ay + 0.76), shade(stone, 1.06), { rotY, collide: false });
      }
    }
  }
  kit.lathe(
    [
      [1.2, 0],
      [1.0, 0.8],
      [0.5, 1.6],
      [0.2, 2.0],
    ],
    p(0, h + 6.6),
    shade(stone, 1.12),
    { segments: 12, collide: false },
  );
}

/* =========================================================== Ashokan pillar */

/** A polished sandstone pillar with a bell capital, lions and a wheel. */
export function ashokaPillar(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const h = ctx.num('height', 13);
  const stone = mixColor(palette.stone, 0xd8c9a8, 0.45);

  kit.cylinder(2.6, 3.0, 1.0, [0, 0.5, 0], shade(stone, 0.9), { segments: 16 });
  // The shaft: one monolith, slightly tapered, famously polished.
  kit.cylinder(0.62, 0.9, h, [0, 1.0 + h / 2, 0], shade(stone, 1.12), { segments: 16 });

  const top = 1.0 + h;
  // Bell (lotus) capital.
  kit.lathe(
    [
      [0.66, 0],
      [1.25, 0.5],
      [1.6, 1.1],
      [1.5, 1.5],
      [1.15, 1.75],
      [1.3, 1.95],
    ],
    [0, top, 0],
    shade(stone, 1.16),
    { segments: 20, collide: false },
  );
  // Abacus, carved with the four animals and small wheels.
  const abacusY = top + 2.0;
  kit.cylinder(1.5, 1.5, 0.52, [0, abacusY + 0.26, 0], shade(stone, 1.2), { segments: 20, collide: false });
  kit.ring(4, 1.5, (px, pz, a) => {
    kit.torus(0.26, 0.07, [px, abacusY + 0.26, pz], shade(stone, 1.0), { rotY: -a + Math.PI / 2, segments: 12, collide: false });
  }, Math.PI / 4);

  // Four lions, back to back, facing the cardinal directions.
  const lionY = abacusY + 0.52;
  kit.ring(4, 0.74, (px, pz, a) => {
    const face = -a + Math.PI / 2;
    kit.box([0.78, 0.95, 1.5], [px, lionY + 0.6, pz], shade(stone, 1.18), { rotY: face, collide: false });
    kit.box([0.62, 0.62, 0.62], [px + Math.cos(a) * 0.82, lionY + 1.32, pz + Math.sin(a) * 0.82], shade(stone, 1.22), {
      rotY: face,
      collide: false,
    });
    kit.torus(0.42, 0.14, [px + Math.cos(a) * 0.74, lionY + 1.3, pz + Math.sin(a) * 0.74], shade(stone, 1.1), {
      rotY: face,
      rotX: Math.PI / 2,
      segments: 12,
      collide: false,
    });
    // Forelegs.
    for (const side of [-1, 1]) {
      kit.box([0.2, 0.8, 0.2], [px + Math.cos(a) * 0.66 + Math.cos(a + Math.PI / 2) * side * 0.26, lionY + 0.4, pz + Math.sin(a) * 0.66 + Math.sin(a + Math.PI / 2) * side * 0.26], shade(stone, 1.14), {
        collide: false,
      });
    }
  });

  // The dharmachakra the lions once carried.
  kit.torus(1.05, 0.14, [0, lionY + 2.4, 0], shade(stone, 1.24), { segments: 24, collide: false });
  for (let i = 0; i < 12; i++) {
    kit.box([0.1, 2.0, 0.1], [0, lionY + 2.4, 0], shade(stone, 1.2), {
      rotZ: (i / 12) * Math.PI,
      collide: false,
    });
  }

  // An edict slab, so the pillar is readable as a public notice board.
  kit.box([5.2, 3.4, 0.7], [9, 1.7, 2], shade(palette.stone, 0.98), { rotY: -0.35 });
  for (let line = 0; line < 7; line++) {
    kit.box([4.2, 0.1, 0.1], [9 + Math.sin(line) * 0.1, 2.9 - line * 0.34, 2.38], shade(palette.stone, 0.72), {
      rotY: -0.35,
      collide: false,
    });
  }
  addTree(kit, -11, -6, 0, 'banyan', rng, 1.1);
  kit.marker('edict', [8, 0, 4]);
}

/* ================================================================== Nalanda */

/** Nalanda: rows of multi-storey brick viharas facing a line of temples. */
export function nalandaVihara(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const blocks = Math.max(2, Math.round(ctx.num('blocks', 6)));
  const stories = Math.max(1, Math.round(ctx.num('stories', 3)));
  const brick = mixColor(palette.stone, 0xa4603f, 0.55);

  const blockW = 34;
  const blockD = 40;
  const gap = 12;
  const rowZ = -40;

  // Residential blocks: cells around a courtyard, stacked.
  for (let b = 0; b < blocks; b++) {
    const ox = (b - (blocks - 1) / 2) * (blockW + gap);
    kit.slab([blockW + 3, blockD + 3], [ox, 0.5, rowZ], 1.0, shade(brick, 0.9));
    for (let s = 0; s < stories; s++) {
      const y = 1.0 + s * 4.6;
      // Four ranges of cells.
      for (const [sx, sz, sw, sd] of [
        [0, -blockD / 2 + 4, blockW, 8],
        [0, blockD / 2 - 4, blockW, 8],
        [-blockW / 2 + 4, 0, 8, blockD - 16],
        [blockW / 2 - 4, 0, 8, blockD - 16],
      ] as Array<[number, number, number, number]>) {
        kit.box([sw, 4.4, sd], [ox + sx, y + 2.2, rowZ + sz], shade(brick, 0.96 + s * 0.03));
      }
      // Cell doorways facing the courtyard.
      const cells = 5;
      for (let c = 0; c < cells; c++) {
        const cx = ox - blockW / 2 + (blockW / cells) * (c + 0.5);
        kit.box([1.5, 2.6, 0.3], [cx, y + 1.3, rowZ - blockD / 2 + 8.2], 0x241a12, { collide: false });
        kit.box([1.5, 2.6, 0.3], [cx, y + 1.3, rowZ + blockD / 2 - 8.2], 0x241a12, { collide: false });
      }
      // String course between storeys.
      kit.box([blockW + 1.6, 0.4, blockD + 1.6], [ox, y + 4.5, rowZ], shade(brick, 0.84), { collide: false });
    }
    // Courtyard floor and a well.
    kit.slab([blockW - 16, blockD - 16], [ox, 1.1, rowZ], 0.3, shade(brick, 1.06), { collide: false });
    if (b % 2 === 0) addPots(kit, ox, rowZ, 1.2, 4, rng);
    // Stair tower.
    kit.box([5, stories * 4.6 + 2, 5], [ox + blockW / 2 - 2, 1 + (stories * 4.6) / 2, rowZ + blockD / 2 + 3], shade(brick, 1.02));
  }

  // Temple line facing the viharas, stepped brick pyramids.
  for (let t = 0; t < Math.max(2, blocks - 2); t++) {
    const ox = (t - (Math.max(2, blocks - 2) - 1) / 2) * (blockW + gap);
    const tiers = 4;
    let w = 22;
    let y = 0;
    for (let i = 0; i < tiers; i++) {
      kit.slab([w, w], [ox, y + 2.2, 42], 4.4, shade(brick, 0.94 + i * 0.04));
      y += 4.4;
      w -= 4.2;
    }
    kit.lathe(
      [
        [w * 0.5, 0],
        [w * 0.4, 3],
        [w * 0.22, 6],
        [0.4, 7.4],
      ],
      [ox, y, 42],
      shade(brick, 1.1),
      { segments: 12, collide: false },
    );
    kit.steps([ox - w / 2 - 12, 0, 42], 10, y / 10, 1.2, 7, shade(brick, 0.9));
  }

  // The library block — nine storeys in the sources, abbreviated here.
  const libX = (blocks / 2 + 0.6) * (blockW + gap);
  for (let s = 0; s < 5; s++) {
    const w = 26 - s * 2.2;
    kit.slab([w, w * 0.8], [libX, 1 + s * 5 + 2.5, 0], 5, shade(brick, 0.95 + s * 0.02));
  }
  kit.marker('court', [0, 1.1, rowZ]);
  addTree(kit, -libX, 10, 0, 'mango', rng, 1.3);
}

/* ========================================================= Dravida temple */

/**
 * A South Indian temple: compound wall, gopuram, pillared mandapa, and a
 * vimana built as diminishing storeys (talas) under an octagonal shikhara.
 */
export function dravidaTemple(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const tiers = Math.max(3, Math.round(ctx.num('tiers', 9)));
  const vimanaH = ctx.num('vimanaHeight', 44);
  const court = ctx.num('courtWidth', 100);
  const withGopuram = ctx.flag('gopuram');
  const stone = palette.stone;

  // Compound wall (prakara) with one entrance.
  const half = court / 2;
  const wallH = 7;
  kit.wall([-half, -half], [half, -half], wallH, 2.2, shade(stone, 0.92));
  kit.wall([-half, half], [-10, half], wallH, 2.2, shade(stone, 0.92));
  kit.wall([10, half], [half, half], wallH, 2.2, shade(stone, 0.92));
  kit.wall([-half, -half], [-half, half], wallH, 2.2, shade(stone, 0.92));
  kit.wall([half, -half], [half, half], wallH, 2.2, shade(stone, 0.92));
  kit.slab([court, court], [0, 0.2, 0], 0.4, shade(stone, 1.0), { collide: false });

  // Gopuram over the entrance: a tapering mass with a barrel-vaulted crown.
  if (withGopuram) {
    const gw = 26;
    const gh = 34;
    const steps = 7;
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      const w = gw * (1 - t * 0.42);
      const d = 14 * (1 - t * 0.3);
      kit.slab([w, d], [0, (gh / steps) * (i + 0.5), half], gh / steps, shade(stone, 0.96 + i * 0.012));
      // Each storey carries a row of small shrine niches.
      const niches = Math.max(3, Math.round(w / 5));
      for (let n = 0; n < niches; n++) {
        const nx = -w / 2 + (w / niches) * (n + 0.5);
        kit.box([w / niches * 0.5, (gh / steps) * 0.55, 0.8], [nx, (gh / steps) * (i + 0.45), half + d / 2 + 0.4], shade(stone, 1.08), {
          collide: false,
        });
      }
    }
    // Barrel-vaulted roof (shala) on top.
    const topW = gw * 0.58;
    kit.cylinder(topW * 0.3, topW * 0.3, topW, [0, gh + topW * 0.22, half], shade(stone, 1.06), {
      segments: 12,
      rotZ: Math.PI / 2,
      collide: false,
    });
    for (let i = 0; i < 5; i++) {
      addKalasha(kit, [-topW * 0.4 + (topW * 0.8 * i) / 4, gh + topW * 0.5, half], 0.55, shade(stone, 1.14));
    }
    // The doorway through it.
    kit.corbelGate([0, 0, half], 9, 13, 14, shade(stone, 1.02));
  }

  // Pillared hall in front of the sanctum.
  const mandapaW = 44;
  const mandapaD = 30;
  kit.slab([mandapaW + 4, mandapaD + 4], [0, 1.0, 14], 2.0, shade(stone, 0.98));
  const cols = 7;
  const rows = 5;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      if (i > 0 && i < cols - 1 && j > 0 && j < rows - 1) continue;
      const px = -mandapaW / 2 + (mandapaW / (cols - 1)) * i;
      const pz = 14 - mandapaD / 2 + (mandapaD / (rows - 1)) * j;
      kit.pillar([px, pz], 7.5, 0.72, shade(stone, 1.04), 2.0, { square: true });
    }
  }
  kit.slab([mandapaW + 6, mandapaD + 6], [0, 10.4, 14], 1.2, shade(stone, 0.94), { collide: false });
  // Overhanging eave (kapota).
  kit.prism(
    [
      [-(mandapaW / 2 + 5), 0],
      [mandapaW / 2 + 5, 0],
      [mandapaW / 2 + 3, 1.4],
      [-(mandapaW / 2 + 3), 1.4],
    ],
    mandapaD + 10,
    [0, 11.0, 14],
    shade(stone, 1.02),
    { collide: false },
  );
  // Steps up to the hall floor, set between the columns: one flight at the side, one at the front.
  kit.steps([-(mandapaW + 4) / 2 - 5 * 1.4 + 0.7, 0, 14 + mandapaD / 8], 5, 0.4, 1.4, 6, shade(stone, 1.0));
  kit.steps([mandapaW / 12, 0, 14 + (mandapaD + 4) / 2 + 5 * 1.4 - 0.7], 5, 0.4, 1.4, 6, shade(stone, 1.0), {}, 'z-');

  // The vimana: diminishing storeys over the sanctum.
  const baseW = 34;
  let w = baseW;
  let y = 0;
  kit.slab([baseW + 8, baseW + 8], [0, 1.5, -18], 3.0, shade(stone, 0.96));
  y = 3.0;
  const storeyH = (vimanaH - 10) / tiers;
  for (let i = 0; i < tiers; i++) {
    kit.slab([w, w], [0, y + storeyH / 2, -18], storeyH, shade(stone, 0.98 + i * 0.008));
    // Cornice and a row of miniature shrines, which is what gives a vimana its texture.
    kit.slab([w + 1.6, w + 1.6], [0, y + storeyH - 0.4, -18], 0.8, shade(stone, 1.06), { collide: false });
    const n = Math.max(2, Math.round(w / 7));
    for (let s = 0; s < n; s++) {
      for (const side of [-1, 1]) {
        const sx = -w / 2 + (w / n) * (s + 0.5);
        kit.box([w / n * 0.46, storeyH * 0.5, 1.0], [sx, y + storeyH * 0.42, -18 + side * (w / 2 + 0.4)], shade(stone, 1.1), {
          collide: false,
        });
        kit.box([1.0, storeyH * 0.5, w / n * 0.46], [side * (w / 2 + 0.4), y + storeyH * 0.42, -18 + sx], shade(stone, 1.1), {
          collide: false,
        });
      }
    }
    y += storeyH;
    w -= (baseW * 0.62) / tiers;
  }
  // Octagonal shikhara and the monolithic capstone.
  kit.lathe(
    [
      [w * 0.62, 0],
      [w * 0.58, 2.4],
      [w * 0.44, 5.0],
      [w * 0.2, 6.6],
      [w * 0.26, 7.0],
    ],
    [0, y, -18],
    shade(stone, 1.12),
    { segments: 8, rotY: Math.PI / 8, collide: false },
  );
  addKalasha(kit, [0, y + 7.0, -18], 1.5, shade(stone, 1.18));

  // Nandi pavilion, flagstaff and a corner shrine.
  addChhatri(kit, [0, 2.0, 36], 6, 9, shade(stone, 1.0), 4);
  kit.box([3.4, 2.2, 5.0], [0, 3.3, 36], shade(stone, 1.14), { collide: false });
  kit.box([2.0, 1.6, 2.0], [0, 4.6, 33.8], shade(stone, 1.16), { collide: false });
  kit.cylinder(0.4, 0.5, 16, [-14, 10, 30], BRONZE, { segments: 8 });
  addBanner(kit, 14, 30, 0, 9, 0xd4702a);
  for (let i = 0; i < 4; i++) {
    const a = rng.next() * Math.PI * 2;
    addTree(kit, Math.cos(a) * (half - 10), Math.sin(a) * (half - 10), 0, 'palm', rng, 1.1);
  }
  kit.marker('mandapa', [0, 3.0, 26]);
}

/* ========================================================== Nagara temple */

/** A northern temple: curvilinear shikhara, amalaka, kalasha. Also builds towers. */
export function nagaraTemple(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const shikharaH = ctx.num('shikharaHeight', 26);
  const kalinga = ctx.flag('kalinga');
  const asTower = ctx.flag('tower');
  const storeys = Math.max(3, Math.round(ctx.num('storeys', 9)));
  const stone = palette.stone;

  if (asTower) {
    // A victory tower: storeys with projecting balconies, like Chittorgarh's.
    const base = 9;
    kit.slab([base + 7, base + 7], [0, 1.0, 0], 2.0, shade(stone, 0.92));
    const h = shikharaH / storeys;
    for (let i = 0; i < storeys; i++) {
      const w = base * (1 - i * 0.035);
      kit.slab([w, w], [0, 2.0 + h * (i + 0.5), 0], h, shade(stone, 0.98 + i * 0.01));
      // Balcony slab and a ring of small columns.
      kit.slab([w + 3.2, w + 3.2], [0, 2.0 + h * (i + 1) - 0.4, 0], 0.7, shade(stone, 1.08), { collide: false });
      kit.ring(8, w * 0.62, (px, pz) => {
        kit.box([0.35, h * 0.5, 0.35], [px, 2.0 + h * (i + 0.72), pz], shade(stone, 1.1), { collide: false });
      }, Math.PI / 8);
    }
    const top = 2.0 + shikharaH;
    addChhatri(kit, [0, top, 0], base * 0.52, 6, shade(stone, 1.06), 8);
    kit.corbelGate([0, 0, base / 2 + 3.4], 3.0, 4.4, 2.4, shade(stone, 1.04));
    kit.marker('entrance', [0, 2.0, base / 2 + 6]);
    return;
  }

  // Jagati — the raised plinth everything sits on.
  const plinth = 30;
  kit.slab([plinth, plinth * 1.35], [0, 1.4, 0], 2.8, shade(stone, 0.94));
  for (let i = 0; i < 3; i++) {
    kit.slab([plinth - i * 1.2, plinth * 1.35 - i * 1.2], [0, 0.45 + i * 0.5, 0], 0.5, shade(stone, 0.9 + i * 0.04), {
      collide: false,
    });
  }
  // A broad flight up the front of the plinth: wide enough to step off either side of the hall at the top.
  kit.steps([0, 0, plinth * 0.675 + 6 * 1.3 - 0.65], 6, 2.8 / 6, 1.3, 22, shade(stone, 0.98), {}, 'z-');

  // Mandapa with a pyramidal roof (pidha deul in Odisha).
  // Set back from the head of the stair, so the flight ends on a landing and not against the wall.
  kit.box([16, 9, 13], [0, 7.3, 10], shade(stone, 1.0));
  kit.box([3.4, 5.2, 0.5], [0, 2.8 + 2.6, 16.6], 0x1c1612, { collide: false }); // the doorway
  const pidhas = 6;
  for (let i = 0; i < pidhas; i++) {
    const w = 17 - i * 2.2;
    kit.slab([w, w * 0.85], [0, 11.8 + i * 1.5, 10], 1.5, shade(stone, 1.04 + i * 0.01), { collide: false });
  }
  kit.sphere(1.6, [0, 11.8 + pidhas * 1.5 + 0.8, 10], shade(stone, 1.1), { segments: 10, collide: false });

  // The sanctum tower. Kalinga rekha deuls rise nearly straight then turn in sharply.
  const profile: Array<[number, number]> = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const curve = kalinga ? Math.pow(t, 3.1) : Math.pow(t, 2.2);
    profile.push([9.5 * (1 - curve * 0.93), 2.8 + shikharaH * t]);
  }
  kit.lathe(profile, [0, 0, -8], shade(stone, 1.02), { segments: kalinga ? 16 : 12, collide: true });

  // Vertical offsets (rathas) that break up the tower face.
  kit.ring(4, 8.2, (px, pz, a) => {
    const h = shikharaH * 0.72;
    kit.prism(
      [
        [-2.2, 0],
        [2.2, 0],
        [0.7, h],
        [-0.7, h],
      ],
      1.6,
      [px, 2.8, pz - 8],
      shade(stone, 1.08),
      { rotY: -a + Math.PI / 2, collide: false },
    );
  }, Math.PI / 4);

  addAmalaka(kit, [0, 2.8 + shikharaH, -8], 3.4, shade(stone, 1.12));
  addKalasha(kit, [0, 2.8 + shikharaH + 2.6, -8], 1.3, shade(stone, 1.18));
  kit.corbelGate([0, 2.8, 20], 4.0, 5.6, 3.0, shade(stone, 1.06));

  addTree(kit, -24, 16, 0, 'banyan', rng, 1.0);
  addPots(kit, 16, 18, 0, 3, rng);
  kit.marker('sanctum', [0, 2.8, 22]);
}

/* ================================================================== Konark */

/** The sun temple as a chariot: a wheeled plinth, seven horses, a tiered porch. */
export function konarkTemple(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const wheels = Math.max(4, Math.round(ctx.num('wheels', 12)));
  const horses = Math.max(2, Math.round(ctx.num('horses', 7)));
  const porchH = ctx.num('jagamohanaHeight', 34);
  const stone = palette.stone;

  const L = 56;
  const W = 34;

  // Plinth, moulded in courses.
  for (let i = 0; i < 4; i++) {
    kit.slab([W + 8 - i * 1.6, L + 8 - i * 1.6], [0, 0.7 + i * 1.4, 0], 1.4, shade(stone, 0.9 + i * 0.03));
  }
  const plinthTop = 0.7 + 4 * 1.4;

  // The twenty-four wheels, twelve a side — and they are sundials.
  const perSide = Math.floor(wheels / 2);
  for (let i = 0; i < perSide; i++) {
    const z = -L / 2 + (L / perSide) * (i + 0.5);
    for (const side of [-1, 1]) {
      buildKonarkWheel(ctx, side * (W / 2 + 3.4), 3.2, z, side > 0 ? Math.PI / 2 : -Math.PI / 2, shade(stone, 1.06));
    }
  }

  // Jagamohana: the pyramidal porch, in receding tiers (pidhas).
  kit.box([W - 4, 14, W - 4], [0, plinthTop + 7, 6], shade(stone, 1.0));
  const tiers = 9;
  for (let i = 0; i < tiers; i++) {
    const t = i / tiers;
    const w = (W - 2) * (1 - t * 0.78);
    kit.slab([w, w], [0, plinthTop + 14 + (porchH - 14) * t, 6], (porchH - 14) / tiers, shade(stone, 1.02 + i * 0.008));
    // Figures of musicians on the tier edges, abstracted to blocks.
    if (i % 2 === 0 && w > 8) {
      kit.ring(4, w * 0.5, (px, pz) => {
        kit.box([1.1, 2.0, 0.9], [px, plinthTop + 14 + (porchH - 14) * t + 1.0, 6 + pz], shade(stone, 1.12), {
          collide: false,
        });
      }, Math.PI / 4);
    }
  }
  kit.cylinder(4.6, 5.4, 2.4, [0, plinthTop + porchH + 1.2, 6], shade(stone, 1.08), { segments: 16, collide: false });
  addAmalaka(kit, [0, plinthTop + porchH + 2.4, 6], 4.0, shade(stone, 1.12));
  addKalasha(kit, [0, plinthTop + porchH + 5.2, 6], 1.6, shade(stone, 1.16));

  // The great deul behind it — collapsed, so only the stump remains.
  kit.box([W - 8, 20, W - 10], [0, plinthTop + 10, -L / 2 - 8], shade(stone, 0.96));
  kit.prism(
    [
      [-(W - 8) / 2, 0],
      [(W - 8) / 2, 0],
      [(W - 8) / 2 - 4, 11],
      [-(W - 8) / 2 + 9, 8],
    ],
    W - 10,
    [0, plinthTop + 20, -L / 2 - 8],
    shade(stone, 0.92),
    { collide: false },
  );
  for (let i = 0; i < 9; i++) {
    const a = rng.next() * Math.PI * 2;
    const r = rng.range(W * 0.6, W);
    kit.box(
      [rng.range(2, 4.5), rng.range(1.5, 3), rng.range(2, 4)],
      [Math.cos(a) * r, 1.2, -L / 2 - 8 + Math.sin(a) * r],
      shade(stone, rng.range(0.86, 1.0)),
      { rotY: rng.next() * Math.PI },
    );
  }

  // Seven horses straining at the front.
  for (let i = 0; i < horses; i++) {
    const hx = (i - (horses - 1) / 2) * 5.4;
    const hz = L / 2 + 23; // ahead of the stair, pulling
    const coat = shade(stone, rng.range(1.02, 1.14));
    kit.box([2.4, 3.2, 6.4], [hx, 3.0, hz], coat, { rotX: -0.18 });
    kit.box([1.7, 2.0, 2.4], [hx, 5.2, hz + 3.8], coat, { collide: false });
    kit.box([1.0, 1.0, 2.2], [hx, 4.6, hz + 5.4], coat, { rotX: 0.4, collide: false });
    for (const [lx, lz, lean] of [
      [-0.8, -2.2, 0.3],
      [0.8, -2.2, 0.3],
      [-0.8, 2.2, -0.35],
      [0.8, 2.2, -0.35],
    ] as Array<[number, number, number]>) {
      kit.box([0.5, 3.0, 0.5], [hx + lx, 1.5, hz + lz], shade(coat, 0.9), { rotX: lean, collide: false });
    }
  }
  // Steps and guardian lions.
  {
    // Up the front to the top course of the plinth (5.6 m), ending on its edge.
    const top = 4 * 1.4;
    const edge = (L + 8 - 3 * 1.6) / 2;
    const count = 13;
    kit.steps([0, 0, edge + count * 1.0 - 0.5], count, top / count, 1.0, 12, shade(stone, 1.0), {}, 'z-');
  }
  for (const side of [-1, 1]) {
    kit.box([3.0, 4.4, 5.0], [side * 11, plinthTop + 2.2, L / 2 + 2], shade(stone, 1.1), { collide: false });
    kit.box([2.2, 2.2, 2.2], [side * 11, plinthTop + 5.4, L / 2 + 0.6], shade(stone, 1.14), { collide: false });
  }
  kit.marker('wheel', [W / 2 + 7, 0, 0]);
}

/** One Konark wheel: rim, hub, eight major and eight minor spokes, beaded edge. */
function buildKonarkWheel(ctx: BuildContext, x: number, y: number, z: number, rotY: number, stone: number): void {
  const { kit } = ctx;
  const R = 5.2;
  kit.torus(R, 0.62, [x, y + R * 0.72, z], stone, { rotY, segments: 26, collide: false });
  kit.torus(R * 0.82, 0.3, [x, y + R * 0.72, z], shade(stone, 0.94), { rotY, segments: 24, collide: false });
  kit.cylinder(1.25, 1.25, 1.0, [x, y + R * 0.72, z], shade(stone, 1.08), {
    segments: 14,
    rotZ: Math.PI / 2,
    rotY,
    collide: false,
  });
  // Eight broad spokes.
  for (let i = 0; i < 8; i++) {
    kit.box([0.75, R * 2 - 0.6, 0.55], [x, y + R * 0.72, z], shade(stone, 1.04), {
      rotY,
      rotZ: (i / 8) * Math.PI,
      collide: false,
    });
  }
  // Eight slender ones between — these halve the three-hour divisions.
  for (let i = 0; i < 8; i++) {
    kit.box([0.3, R * 1.96, 0.4], [x, y + R * 0.72, z], shade(stone, 0.98), {
      rotY,
      rotZ: ((i + 0.5) / 8) * Math.PI,
      collide: false,
    });
  }
  // Beads along the rim: the finest subdivision of the dial.
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    kit.sphere(0.26, [x, y + R * 0.72 + Math.sin(a) * R, z + Math.cos(a) * R * Math.cos(rotY)], shade(stone, 1.12), {
      segments: 5,
      collide: false,
    });
  }
  // Axle stub, which is what you put your finger against to read the time.
  kit.cylinder(0.3, 0.3, 1.8, [x, y + R * 0.72, z], shade(stone, 1.16), {
    segments: 8,
    rotZ: Math.PI / 2,
    rotY,
    collide: false,
  });
}

/* ============================================================ Jantar Mantar */

/** Masonry astronomical instruments. Scale is the whole point of this place. */
export function jantarMantar(ctx: BuildContext): void {
  const { kit, palette } = ctx;
  const gnomonH = ctx.num('gnomonHeight', 27);
  const stone = mixColor(palette.stone, 0xc9a98a, 0.4);
  const scaleColor = shade(stone, 1.14);

  kit.slab([150, 120], [0, 0.2, 0], 0.4, shade(stone, 0.9), { collide: false });

  // --- Samrat Yantra: the giant equinoctial sundial.
  // The hypotenuse is set parallel to Earth's axis, so it points at the pole.
  const gl = gnomonH * 1.7;
  kit.prism(
    [
      [-gl / 2, 0],
      [gl / 2, 0],
      [-gl / 2, gnomonH],
    ],
    5.0,
    [-30, 0, 0],
    stone,
    { collide: true },
  );
  {
    // The stair runs up the gnomon's own slope, from its foot to its head, as at Jaipur, and ends on a
    // small landing: the place the instrument is read from.
    const count = Math.ceil(gnomonH / 0.5);
    const run = gl / count;
    kit.steps([-30 + gl / 2 - run / 2, 0, 3.9], count, gnomonH / count, run, 2.6, shade(stone, 1.04), {}, 'x-');
    kit.slab([4.2, 7.6], [-30 - gl / 2 - 2.1, gnomonH - 0.3, 1.4], 0.6, shade(stone, 1.08));
    kit.slab([4.2, 7.6], [-30 - gl / 2 - 2.1, gnomonH / 2 - 0.3, 1.4], gnomonH - 0.6, shade(stone, 0.96), { collide: false, inset: 0 });
  }
  // Two quadrant scales flanking it, built as arcs of small blocks.
  for (const side of [-1, 1]) {
    const arcR = gnomonH * 0.78;
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * Math.PI * 0.62 + 0.1;
      kit.box(
        [2.6, 1.0, 1.4],
        [-30 - gl * 0.12 + Math.cos(a) * arcR * 0.6, Math.sin(a) * arcR, side * (3.6 + arcR * 0.42 * (1 - Math.cos(a)))],
        i % 5 === 0 ? scaleColor : shade(stone, 1.0),
        { rotZ: a, collide: false },
      );
    }
    kit.prism(
      [
        [-arcR * 0.5, 0],
        [arcR * 0.5, 0],
        [arcR * 0.5, 3.0],
        [-arcR * 0.5, 3.0],
      ],
      2.0,
      [-30 - gl * 0.1, 0, side * (4.6 + arcR * 0.2)],
      shade(stone, 0.94),
      { collide: true },
    );
  }

  // --- Jai Prakash Yantra: two complementary sunken hemispheres.
  for (const side of [-1, 1]) {
    const cx = 34;
    const cz = side * 26;
    kit.cylinder(10.5, 10.5, 1.4, [cx, 0.7, cz], shade(stone, 0.96), { segments: 24, collide: false });
    // The bowl: a hemisphere turned upside down and sunk below the rim.
    kit.dome(9.4, [cx, 1.4, cz], shade(stone, 1.06), { segments: 22, squash: 0.85, rotX: Math.PI, collide: false });
    // Cross wires and the marble sectors between them.
    for (let i = 0; i < 6; i++) {
      kit.box([19, 0.18, 0.18], [cx, 1.5, cz], scaleColor, { rotY: (i / 6) * Math.PI, collide: false });
    }
    kit.blocker([cx - 10.5, 0, cz - 10.5], [cx + 10.5, 1.4, cz + 10.5]);
  }

  // --- Ram Yantra: two open cylinders reading altitude and azimuth.
  for (const side of [-1, 1]) {
    const cx = -32;
    const cz = side * 40;
    const R = 9;
    kit.cylinder(R, R, 0.7, [cx, 0.35, cz], shade(stone, 1.02), { segments: 20, collide: false });
    // Sector walls with gaps — the gaps are what let you look in.
    kit.ring(12, R * 0.92, (px, pz, a) => {
      kit.box([R * 0.42, 7.0, 0.7], [cx + px * 0.78, 3.5, cz + pz * 0.78], shade(stone, 1.0), {
        rotY: -a + Math.PI / 2,
        collide: true,
      });
      void a;
    });
    // Radial floor scales and the central gnomon pillar.
    for (let i = 0; i < 12; i++) {
      kit.box([R * 1.8, 0.14, 0.3], [cx, 0.78, cz], scaleColor, { rotY: (i / 12) * Math.PI, collide: false });
    }
    kit.cylinder(0.3, 0.34, 7.0, [cx, 3.5, cz], scaleColor, { segments: 8 });
  }

  // --- Narivalaya: twin dials for the two halves of the year.
  for (const [side, label] of [
    [-1, 'north'],
    [1, 'south'],
  ] as Array<[number, string]>) {
    void label;
    kit.box([9, 4.4, 9], [6, 2.2, side * 56], shade(stone, 0.98));
    kit.cylinder(4.2, 4.2, 0.5, [6, 4.9, side * 56], scaleColor, {
      segments: 20,
      rotX: side * (Math.PI / 2 - 0.46),
      collide: false,
    });
    kit.cylinder(0.14, 0.14, 4.4, [6, 5.6, side * 56], shade(stone, 1.2), {
      segments: 6,
      rotX: side * -0.46,
      collide: false,
    });
  }

  // --- Chakra Yantra: a ring free to turn about the polar axis.
  kit.box([5, 5.6, 5], [52, 2.8, -4], shade(stone, 0.98));
  kit.torus(3.4, 0.22, [52, 7.6, -4], scaleColor, { rotX: 0.46, segments: 24, collide: false });
  kit.cylinder(0.16, 0.16, 8.0, [52, 7.6, -4], shade(stone, 1.2), { segments: 6, rotX: Math.PI / 2 - 0.46, collide: false });

  // --- Rashivalaya: twelve instruments, one per zodiac sign.
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const rx = -6 + Math.cos(a) * 44;
    const rz = -56 + Math.sin(a) * 18;
    kit.prism(
      [
        [-3.4, 0],
        [3.4, 0],
        [-3.4, 4.6],
      ],
      2.4,
      [rx, 0, rz],
      shade(stone, 1.0),
      { rotY: a, collide: true },
    );
    kit.box([1.2, 0.2, 2.6], [rx + 1.6, 2.4, rz], scaleColor, { rotY: a, rotZ: 0.6, collide: false });
  }

  kit.marker('samrat', [-30, 0, 10]);
}

/* ============================================================= Mughal tomb */

/** A marble garden tomb: chamfered cube, four iwans, double dome, minarets. */
export function mughalTomb(ctx: BuildContext): void {
  const { kit, palette } = ctx;
  const domeR = ctx.num('domeRadius', 17);
  const minarets = Math.max(0, Math.round(ctx.num('minarets', 4)));
  const plinthW = ctx.num('plinth', 96);
  const marble = mixColor(palette.stone, 0xf2ece0, 0.75);
  const inlay = 0x2a2420;

  // Plinth.
  kit.slab([plinthW, plinthW], [0, 3.0, 0], 6.0, shade(marble, 0.94));
  kit.slab([plinthW + 4, plinthW + 4], [0, 0.6, 0], 1.2, shade(marble, 0.88));
  kit.steps([-plinthW / 2 - 12, 0, 0], 12, 0.5, 1.0, 14, shade(marble, 0.92));

  // The tomb mass: a square with its corners cut off, i.e. an octagon.
  const cubeR = domeR * 2.1;
  const cubeH = domeR * 2.0;
  kit.cylinder(cubeR, cubeR, cubeH, [0, 6.0 + cubeH / 2, 0], marble, { segments: 8, rotY: Math.PI / 8 });

  // Four great iwans on the cardinal faces, with smaller ones on the chamfers.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const px = Math.cos(a) * cubeR * 0.93;
    const pz = Math.sin(a) * cubeR * 0.93;
    addIwan(kit, [px, 6.0, pz], domeR * 0.92, cubeH * 0.5, 3.0, shade(marble, 1.03), inlay, -a + Math.PI / 2);
  }
  for (let i = 0; i < 4; i++) {
    const a = ((i + 0.5) / 4) * Math.PI * 2;
    const px = Math.cos(a) * cubeR * 0.9;
    const pz = Math.sin(a) * cubeR * 0.9;
    addIwan(kit, [px, 6.0, pz], domeR * 0.42, cubeH * 0.3, 2.0, shade(marble, 1.02), inlay, -a + Math.PI / 2);
    addIwan(kit, [px, 6.0 + cubeH * 0.52, pz], domeR * 0.42, cubeH * 0.26, 2.0, shade(marble, 1.02), inlay, -a + Math.PI / 2);
  }

  // Calligraphic band: letters grow with height so they read evenly from below.
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    const px = Math.cos(a) * cubeR * 0.99;
    const pz = Math.sin(a) * cubeR * 0.99;
    kit.box([domeR * 1.5, 1.8, 0.3], [px, 6.0 + cubeH * 0.86, pz], inlay, { rotY: -a + Math.PI / 2, collide: false });
  }

  // Parapet and corner kiosks.
  const parapetY = 6.0 + cubeH;
  kit.cylinder(cubeR + 1.0, cubeR + 1.0, 1.4, [0, parapetY + 0.7, 0], shade(marble, 1.04), {
    segments: 8,
    rotY: Math.PI / 8,
    collide: false,
  });
  kit.ring(4, cubeR * 0.82, (px, pz) => {
    addChhatri(kit, [px, parapetY + 1.4, pz], domeR * 0.3, domeR * 0.62, shade(marble, 1.02), 8);
  }, Math.PI / 4);

  // Drum, then the two dome shells — the lesson of the Agra assembly challenge.
  const drumY = parapetY + 1.4;
  kit.cylinder(domeR * 0.95, domeR * 1.0, domeR * 0.52, [0, drumY + domeR * 0.26, 0], shade(marble, 1.02), {
    segments: 24,
  });
  // Inner shell, visible only as the ceiling from inside — kept low.
  kit.dome(domeR * 0.8, [0, drumY + domeR * 0.5, 0], shade(marble, 0.9), { segments: 18, squash: 0.78, collide: false });
  // Outer onion shell, sized for the skyline.
  const bulb: Array<[number, number]> = [];
  const N = 16;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    // A bulge below the midpoint then a tight neck: the onion silhouette.
    const r = domeR * (Math.sin(t * Math.PI * 0.96) * (1 + 0.22 * Math.sin(t * Math.PI)) * (1 - t * 0.1));
    bulb.push([Math.max(0.05, r), domeR * 1.62 * t]);
  }
  kit.lathe(bulb, [0, drumY + domeR * 0.5, 0], shade(marble, 1.06), { segments: 26, collide: false });

  const apex = drumY + domeR * 0.5 + domeR * 1.62;
  kit.lathe(
    [
      [domeR * 0.14, 0],
      [domeR * 0.1, domeR * 0.22],
      [domeR * 0.16, domeR * 0.3],
      [domeR * 0.05, domeR * 0.52],
    ],
    [0, apex - domeR * 0.12, 0],
    shade(marble, 1.1),
    { segments: 12, collide: false },
  );
  // Brass finial.
  kit.cylinder(0.14, 0.14, domeR * 0.5, [0, apex + domeR * 0.6, 0], 0xc9a23c, { segments: 8, collide: false });
  kit.sphere(domeR * 0.09, [0, apex + domeR * 0.46, 0], 0xc9a23c, { segments: 10, collide: false });
  kit.torus(domeR * 0.11, domeR * 0.02, [0, apex + domeR * 0.76, 0], 0xc9a23c, { rotX: Math.PI / 2, segments: 14, collide: false });

  // Minarets at the plinth corners, leaning very slightly outward.
  for (let i = 0; i < minarets; i++) {
    const a = ((i + 0.5) / 4) * Math.PI * 2;
    const mx = Math.cos(a) * plinthW * 0.44;
    const mz = Math.sin(a) * plinthW * 0.44;
    const mh = cubeH * 1.5;
    const lean = 0.022;
    kit.cylinder(1.9, 2.4, mh, [mx, 6.0 + mh / 2, mz], shade(marble, 1.0), {
      segments: 14,
      rotX: Math.sin(a) * lean,
      rotZ: -Math.cos(a) * lean,
    });
    for (let b = 1; b <= 3; b++) {
      kit.cylinder(2.9, 2.9, 0.8, [mx, 6.0 + (mh * b) / 3.6, mz], shade(marble, 1.08), { segments: 16, collide: false });
    }
    addChhatri(kit, [mx, 6.0 + mh, mz], 2.6, 6.0, shade(marble, 1.04), 8);
  }

  kit.marker('plinth', [0, 6.0, cubeR + 10]);
}

/* ================================================================ charbagh */

/** A four-part paradise garden: raised walkways, channels, a central tank. */
export function charbagh(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const size = ctx.num('size', 180);
  const withChannels = ctx.flag('channels');
  const stone = mixColor(palette.stone, 0xd9cdb4, 0.5);
  const half = size / 2;

  // Sunken planting beds, raised walkways between them.
  const walk = 9;
  for (const qx of [-1, 1]) {
    for (const qz of [-1, 1]) {
      const cx = qx * (half / 2 + walk / 4);
      const cz = qz * (half / 2 + walk / 4);
      const bedW = half - walk;
      kit.slab([bedW, bedW], [cx, 0.1, cz], 0.2, shade(palette.foliage, 1.05), { collide: false });
      // Each quadrant is itself quartered — the pattern repeats at every scale.
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          kit.slab(
            [bedW / 2 - 2, bedW / 2 - 2],
            [cx + (sx * bedW) / 4, 0.18, cz + (sz * bedW) / 4],
            0.16,
            shade(palette.foliage, 0.92),
            { collide: false },
          );
        }
      }
      // Cypresses on the cross axes, fruit trees in the corners.
      for (let i = 0; i < 4; i++) {
        addTree(kit, cx + rng.range(-bedW * 0.4, bedW * 0.4), cz + rng.range(-bedW * 0.4, bedW * 0.4), 0.2, 'mango', rng, 0.9);
      }
    }
  }

  // Walkways along both axes and around the edge.
  kit.slab([size, walk], [0, 0.45, 0], 0.9, shade(stone, 1.06));
  kit.slab([walk, size], [0, 0.45, 0], 0.9, shade(stone, 1.06));
  for (const side of [-1, 1]) {
    kit.slab([size, walk], [0, 0.45, side * half], 0.9, shade(stone, 1.02));
    kit.slab([walk, size], [side * half, 0.45, 0], 0.9, shade(stone, 1.02));
  }

  // Water channels down the middle of each walkway, with fountain jets.
  if (withChannels) {
    kit.box([size, 0.6, 2.6], [0, 0.6, 0], shade(stone, 0.9), { collide: false });
    kit.box([2.6, 0.6, size], [0, 0.6, 0], shade(stone, 0.9), { collide: false });
    addWaterPlane(kit, [size - 1, 2.2], [0, 0.82, 0]);
    addWaterPlane(kit, [2.2, size - 1], [0, 0.82, 0]);
    for (let i = 1; i <= 6; i++) {
      for (const side of [-1, 1]) {
        const d = (half * i) / 7;
        kit.cylinder(0.5, 0.6, 0.5, [side * d, 1.1, 0], shade(stone, 1.12), { segments: 8, collide: false });
        kit.cylinder(0.5, 0.6, 0.5, [0, 1.1, side * d], shade(stone, 1.12), { segments: 8, collide: false });
      }
    }
  }

  // Central raised tank — the point from which the whole garden is symmetrical.
  kit.cylinder(13, 13.6, 1.5, [0, 0.75, 0], shade(stone, 1.1), { segments: 24 });
  kit.cylinder(11.4, 11.4, 0.4, [0, 1.3, 0], 0x1f4a52, { segments: 24, collide: false });
  addWaterPlane(kit, [22, 22], [0, 1.45, 0]);
  kit.ring(8, 12.4, (px, pz) => {
    kit.box([0.9, 1.1, 0.9], [px, 2.05, pz], shade(stone, 1.14), { collide: false });
  }, Math.PI / 8);

  kit.marker('tank', [0, 1.5, 16]);
}

/* =========================================================== Stone chariot */

/** The Garuda shrine at Hampi — a chariot carved from several blocks. */
export function stoneChariot(ctx: BuildContext): void {
  const { kit, palette } = ctx;
  const stone = palette.stone;

  kit.slab([14, 20], [0, 0.5, 0], 1.0, shade(stone, 0.92));
  kit.slab([11, 17], [0, 1.4, 0], 0.8, shade(stone, 0.98));

  // Chariot body, with mouldings and figured panels.
  kit.box([8.4, 4.6, 12.0], [0, 4.1, 0], shade(stone, 1.04));
  for (const side of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      kit.box([0.5, 2.6, 2.2], [side * 4.3, 4.0, -4.2 + i * 2.8], shade(stone, 1.12), { collide: false });
    }
  }
  kit.slab([9.6, 13.2], [0, 6.6, 0], 0.8, shade(stone, 1.08), { collide: false });

  // Pillared upper storey and a small tower.
  kit.ring(4, 3.4, (px, pz) => {
    kit.pillar([px, pz * 1.5], 3.6, 0.42, shade(stone, 1.1), 7.0, { square: true });
  }, Math.PI / 4);
  kit.slab([8.2, 11.4], [0, 11.2, 0], 0.7, shade(stone, 1.06), { collide: false });
  kit.lathe(
    [
      [4.0, 0],
      [3.4, 2.0],
      [2.2, 4.2],
      [1.0, 5.6],
      [1.3, 6.0],
    ],
    [0, 11.6, 0],
    shade(stone, 1.1),
    { segments: 14, collide: false },
  );
  addKalasha(kit, [0, 17.6, 0], 1.0, shade(stone, 1.16));

  // Four wheels. They did turn once; they are fixed now.
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const wx = sx * 4.9;
      const wz = sz * 4.2;
      kit.torus(2.0, 0.42, [wx, 2.1, wz], shade(stone, 1.06), { rotY: Math.PI / 2, segments: 22, collide: false });
      kit.cylinder(0.6, 0.6, 0.9, [wx, 2.1, wz], shade(stone, 1.12), {
        segments: 12,
        rotZ: Math.PI / 2,
        collide: false,
      });
      for (let i = 0; i < 8; i++) {
        kit.box([0.26, 3.6, 0.3], [wx, 2.1, wz], shade(stone, 1.02), {
          rotY: Math.PI / 2,
          rotZ: (i / 8) * Math.PI,
          collide: false,
        });
      }
      // Lotus medallion on the hub face.
      kit.cylinder(1.3, 1.3, 0.25, [wx + sx * 0.5, 2.1, wz], shade(stone, 1.16), {
        segments: 14,
        rotZ: Math.PI / 2,
        collide: false,
      });
    }
  }

  // The two elephants that replaced the original horses.
  for (const side of [-1, 1]) {
    const ex = side * 2.6;
    const ez = 12.0;
    kit.box([3.4, 3.6, 6.0], [ex, 3.0, ez], shade(stone, 1.02));
    kit.box([2.6, 2.6, 2.6], [ex, 4.4, ez + 3.6], shade(stone, 1.06), { collide: false });
    kit.cylinder(0.5, 0.9, 3.4, [ex, 2.6, ez + 4.6], shade(stone, 1.04), { segments: 8, rotX: 0.9, collide: false });
    for (const [lx, lz] of [
      [-1.1, -1.9],
      [1.1, -1.9],
      [-1.1, 1.9],
      [1.1, 1.9],
    ] as Array<[number, number]>) {
      kit.cylinder(0.75, 0.85, 2.4, [ex + lx, 1.2, ez + lz], shade(stone, 0.98), { segments: 8, collide: false });
    }
  }
  // Stairway up into the shrine.
  kit.steps([0, 0, -8.5 - 4 * 0.9 + 0.45], 4, 0.45, 0.9, 5, shade(stone, 1.0), {}, 'z+');
  kit.marker('front', [0, 1.4, 14]);
}

/* ============================================================ bronze foundry */

/** A working bronze workshop: furnace, crucibles, wax benches, finished images. */
export function bronzeFoundry(ctx: BuildContext): void {
  const { kit, rng, palette } = ctx;
  const stone = palette.stone;

  // Open shed.
  kit.slab([34, 26], [0, 0.25, 0], 0.5, shade(stone, 0.96), { collide: false });
  for (const [px, pz] of [
    [-15, -11],
    [15, -11],
    [-15, 11],
    [15, 11],
    [0, -11],
    [0, 11],
  ] as Array<[number, number]>) {
    kit.cylinder(0.4, 0.5, 6.0, [px, 3.0, pz], WOOD, { segments: 6 });
  }
  kit.roof([34, 26], [0, 6.0, 0], 3.6, 0xa8894f, 1.6);

  // Furnace with a chimney and bellows.
  kit.cylinder(3.0, 3.6, 4.6, [-11, 2.3, -6], shade(stone, 0.86), { segments: 12 });
  kit.cylinder(1.0, 1.4, 3.6, [-11, 6.4, -6], shade(stone, 0.82), { segments: 8, collide: false });
  kit.box([1.8, 1.6, 0.4], [-11, 1.0, -3.3], 0x2a1a10, { collide: false });
  addFire(kit, -11, -3.8, 0, 1.0);
  kit.box([2.6, 1.2, 1.6], [-7.0, 0.8, -3.0], 0x6b4a2f, { rotY: 0.4 });

  // Crucibles and a pour channel.
  for (let i = 0; i < 3; i++) {
    kit.lathe(
      [
        [0.8, 0],
        [1.0, 0.7],
        [0.85, 1.3],
      ],
      [-5 + i * 2.2, 0.5, -7.6],
      0x6d6054,
      { segments: 10, collide: false },
    );
  }
  kit.box([7.0, 0.5, 1.0], [0, 0.6, -7.0], shade(stone, 1.1), { collide: false });

  // Wax modelling benches.
  for (let i = 0; i < 2; i++) {
    kit.box([9.0, 1.0, 3.0], [4 + i * 0, 1.0, 2 + i * 6], WOOD);
    for (let j = 0; j < 3; j++) {
      // Half-finished wax figures.
      kit.cylinder(0.3, 0.42, 1.8, [1 + j * 2.6, 2.4, 2 + i * 6], 0xe0c070, { segments: 8, collide: false });
      kit.sphere(0.34, [1 + j * 2.6, 3.4, 2 + i * 6], 0xe0c070, { segments: 7, collide: false });
    }
  }
  // Clay piles for investment coats.
  kit.dome(2.2, [12, 0, -6], 0x8d6a4c, { segments: 10, squash: 0.6 });
  kit.dome(1.6, [14.5, 0, -2], 0x7d5c40, { segments: 9, squash: 0.6 });

  // Finished bronzes on plinths, outside the shed where the light is.
  for (let i = 0; i < 3; i++) {
    const px = -8 + i * 8;
    const pz = 17;
    kit.box([3.0, 1.6, 3.0], [px, 0.8, pz], shade(stone, 1.04));
    // A standing figure inside a ring of flame, read as a Nataraja.
    kit.cylinder(0.26, 0.34, 2.6, [px, 2.9, pz], BRONZE, { segments: 8, collide: false });
    kit.sphere(0.4, [px, 4.4, pz], BRONZE, { segments: 8, collide: false });
    kit.box([1.9, 0.18, 0.18], [px, 3.6, pz], BRONZE, { rotZ: 0.35, collide: false });
    kit.box([1.7, 0.18, 0.18], [px, 3.2, pz], BRONZE, { rotZ: -0.45, collide: false });
    if (i === 1) {
      kit.torus(1.9, 0.14, [px, 3.4, pz], BRONZE, { segments: 22, collide: false });
      kit.ring(14, 1.9, (fx, fy) => {
        kit.cone(0.2, 0.6, [px + fx, 3.4 + fy, pz], 0xc9862f, { segments: 5, collide: false });
      });
    }
  }
  addPots(kit, 10, 8, 0, 5, rng);
  addFlatHouse(kit, -24, 8, 0, 12, 10, 4.4, stone, rng);
  kit.marker('bench', [4, 0, 4]);
}
