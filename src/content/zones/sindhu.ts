import type { Zone } from '../types';

/**
 * Chapter 1 — Sindhu-Sarasvati (the Harappan / Indus Valley world).
 *
 * Teaching goals: urban planning as a civilisational achievement; standardised
 * measurement; craft specialisation; long-distance trade; and the honest
 * admission that the script is undeciphered, so we read these cities from their
 * bricks and drains rather than from their words.
 */
export const sindhu: Zone = {
  id: 'sindhu',
  name: 'Sindhu-Sarasvati',
  nameLocal: 'सिन्धु–सरस्वती',
  era: 'c. 2600–1900 BCE',
  eraStart: -2600,
  eraEnd: -1900,
  chapter: 1,
  tagline: 'The cities that wrote nothing we can read — and planned everything.',
  blurb:
    'A grid of baked brick stretching to the horizon: streets at right angles, covered drains under every lane, a bath at the top of the citadel and standardised weights in every shop. Five thousand years on, we still cannot read a word of their script.',
  center: [-760, -620],
  radius: 300,
  plateau: 20,
  biome: 'riverPlain',
  raga: 'bhairav',
  tonic: 48,
  sealRequires: 3,
  palette: {
    ground: 0xbf9d68,
    rock: 0xa58d6b,
    foliage: 0x7c8f4c,
    stone: 0xb06a4a,
    horizon: 0xf3bc7e,
    zenith: 0x5f7fb4,
    fog: 0xdcb98f,
    sun: 0xffd9a4,
    sunElevation: 20,
    sunAzimuth: 96,
  },

  landmarks: [
    {
      id: 'sindhu-citadel',
      name: 'The Citadel Mound',
      kind: 'indusCitadel',
      offset: [0, -40],
      scale: 1,
      codexId: 'indus-townplan',
      scanSeconds: 3.5,
      signposted: true,
      opts: { tiers: 3, width: 120, depth: 86 },
    },
    {
      id: 'sindhu-greatbath',
      name: 'The Great Bath',
      kind: 'greatBath',
      // North of the citadel mound, on open ground. (It used to sit inside the mound's footprint, where the
      // mound swallowed it whole.)
      offset: [-6, -114],
      codexId: 'indus-greatbath',
      scanSeconds: 3,
      signposted: true,
    },
    {
      id: 'sindhu-lowertown',
      name: 'The Lower Town',
      kind: 'indusHousing',
      offset: [20, 90],
      codexId: 'indus-drains',
      scanSeconds: 3,
      signposted: true,
      opts: { blocksX: 5, blocksZ: 4, blockSize: 34, lane: 9 },
    },
    {
      id: 'sindhu-granary',
      name: 'The Great Granary',
      kind: 'indusHousing',
      offset: [-92, -10],
      rotation: 90,
      opts: { blocksX: 2, blocksZ: 1, blockSize: 30, lane: 7, tall: 1 },
      codexId: 'harappan-crafts',
      scanSeconds: 2.5,
      signposted: true,
    },
    {
      id: 'sindhu-dock',
      name: 'The Lothal Basin',
      kind: 'lothalDock',
      offset: [150, 150],
      rotation: 12,
      codexId: 'lothal-dock',
      scanSeconds: 3,
      signposted: true,
    },
    {
      id: 'sindhu-dhow',
      name: 'A Meluhhan Trading Boat',
      kind: 'dhow',
      offset: [172, 178],
      rotation: 30,
      codexId: 'meluhha-trade',
      scanSeconds: 2.5,
    },
    {
      id: 'sindhu-stepwell',
      name: 'Dholavira-style Reservoir',
      kind: 'stepwell',
      offset: [-120, 86],
      codexId: 'dholavira-water',
      scanSeconds: 3,
      signposted: true,
    },
    {
      id: 'sindhu-vimanapad',
      name: 'Landing Terrace',
      kind: 'vimanaPad',
      offset: [60, -130],
    },
  ],

  challenges: [
    {
      id: 'sindhu-weights',
      kind: 'trade',
      name: 'The Balance at the Bead Shop',
      brief: 'Weigh out exactly 32 ratio-units of carnelian using Harappan cubical weights.',
      teaches: 'Harappan weights follow a binary series (1, 2, 4, 8, 16, 32…), standardised across 1,500 km.',
      offset: [40, 96],
      vidya: 120,
      quizAfter: 2,
      prompt: 'Use the pan balance',
      unlocks: ['indus-weights'],
      config: {
        goods: [
          { id: 'carnelian', label: 'Carnelian beads', unitMass: 1, glyph: '🔶' },
          { id: 'steatite', label: 'Steatite seals', unitMass: 2, glyph: '🔲' },
          { id: 'copper', label: 'Copper ingots', unitMass: 8, glyph: '🟫' },
          { id: 'shell', label: 'Shell bangles', unitMass: 4, glyph: '⚪' },
        ],
        weights: [1, 2, 4, 8, 16, 32, 64],
        target: 32,
        note:
          'Harappan stone weights are cubical and follow the ratios 1, 2, 4, 8, 16, 32, 64… The unit (ratio 1) is about 0.856 g; ratio 16 is about 13.7 g. The same series turns up at Harappa, Mohenjo-daro, Lothal and Dholavira — a shared standard across a vast area.',
      },
    },
    {
      id: 'sindhu-drains',
      kind: 'assembly',
      name: 'Lay the Covered Drain',
      brief: 'Fit the drain sections from the house outlet down to the main sewer — in the right order.',
      teaches: 'Indus cities put sanitation first: house soak-pits feed covered street drains with a deliberate gradient.',
      offset: [-10, 74],
      vidya: 140,
      quizAfter: 2,
      prompt: 'Take up the mason’s trowel',
      unlocks: ['indus-drains'],
      config: {
        ordered: true,
        hint: 'Water flows downhill. Start at the house and finish at the main sewer.',
        pieces: [
          { id: 'soakpit', label: 'House soak-pit jar', size: [1.6, 1.8, 1.6], color: 0x9c6b4a },
          { id: 'outlet', label: 'Brick outlet chute', size: [2.4, 1, 1.2], color: 0xb27a52 },
          { id: 'channel', label: 'Covered lane channel', size: [4, 0.9, 1.4], color: 0xb06a4a },
          { id: 'inspection', label: 'Inspection manhole slab', size: [1.8, 0.4, 1.8], color: 0x8e8574 },
          { id: 'sewer', label: 'Corbelled main sewer', size: [5, 1.6, 2.2], color: 0x95583c },
        ],
        sockets: [
          { id: 's1', label: '1 · At the house wall', pos: [-9, 0.5, 0], accepts: 'soakpit' },
          { id: 's2', label: '2 · Through the wall', pos: [-4.5, 0.5, 0], accepts: 'outlet' },
          { id: 's3', label: '3 · Under the lane', pos: [0, 0.4, 0], accepts: 'channel' },
          { id: 's4', label: '4 · Access point', pos: [4.5, 0.3, 0], accepts: 'inspection' },
          { id: 's5', label: '5 · Main sewer', pos: [9.5, 0.6, 0], accepts: 'sewer' },
        ],
      },
    },
    {
      id: 'sindhu-seals',
      kind: 'scriptMatch',
      name: 'The Sealmaker’s Table',
      brief: 'Match each seal to what archaeologists can actually identify on it.',
      teaches:
        'Indus seals can be described but not read: we identify the animals and objects carved on them, while the accompanying signs remain undeciphered.',
      offset: [-52, 40],
      vidya: 130,
      quizAfter: 2,
      prompt: 'Examine the seals',
      unlocks: ['indus-script', 'indus-seals'],
      config: {
        note:
          'Careful: these are IDENTIFICATIONS of carved motifs, not translations. No one has deciphered the Indus script — there is no bilingual key like the Rosetta Stone, the inscriptions are very short (about five signs on average), and we do not know what language it recorded.',
        left: [
          { id: 'unicorn', glyph: '🦄', caption: 'One-horned animal facing a standard' },
          { id: 'bull', glyph: '🐂', caption: 'Humped zebu bull, heavy dewlap' },
          { id: 'pashupati', glyph: '🧘', caption: 'Seated figure, horned headdress, animals around' },
          { id: 'tiger', glyph: '🐅', caption: 'Striped feline with a figure in a tree' },
          { id: 'boat', glyph: '⛵', caption: 'Flat-bottomed craft with a central cabin' },
        ],
        right: [
          { id: 'unicorn', label: 'The commonest seal motif — an animal in profile with one horn shown' },
          { id: 'bull', label: 'The zebu, an Indian breed still farmed today' },
          { id: 'pashupati', label: 'The so-called "Pashupati" seal — its meaning is disputed' },
          { id: 'tiger', label: 'Evidence that tigers lived in the Indus region' },
          { id: 'boat', label: 'A river craft of the kind that carried goods to the Gulf' },
        ],
      },
    },
    {
      id: 'sindhu-decline',
      kind: 'dialogue',
      name: 'Why Did the Cities Empty?',
      brief: 'Hear the evidence from the excavation director, then judge for yourself.',
      teaches: 'The Harappan decline has several competing explanations; climate and river change now carry most weight.',
      offset: [-70, -86],
      vidya: 110,
      quizAfter: 1,
      prompt: 'Talk to the excavation director',
      unlocks: ['indus-decline'],
      config: {
        speaker: { name: 'Dr. Ila Rao', role: 'Excavation Director', icon: '🪔' },
        nodes: [
          {
            id: 'start',
            text:
              'You are standing on nine metres of other people’s rubbish, and I mean that as a compliment. Every layer is a century. Around 1900 BCE the top layers change: the big public buildings stop being maintained, the weights stop being standard, the long-distance trade goods thin out. People do not vanish — they move, and they live differently. The question is why.',
            choices: [
              { label: 'Was it an invasion?', goto: 'invasion' },
              { label: 'Was it the rivers?', goto: 'rivers' },
              { label: 'Could the cities simply have outgrown themselves?', goto: 'systems' },
            ],
          },
          {
            id: 'invasion',
            text:
              'That was the old story — Mortimer Wheeler once read a group of skeletons at Mohenjo-daro as a massacre. Later study showed those skeletons are from different periods and mostly show no battle wounds. There is no destruction layer, no burnt citadel, no mass of foreign weapons. Migration into the subcontinent in the second millennium BCE is well supported by linguistics and ancient DNA, but it is not the same claim as a war that ended the cities.',
            choices: [
              { label: 'So the "massacre" reading was wrong?', reply: 'Over-read. The bones did not say what the headline said.', goto: 'rivers', wise: true, note: 'Good instinct: check whether the evidence supports the drama.' },
              { label: 'Then what did end them?', goto: 'rivers' },
            ],
          },
          {
            id: 'rivers',
            text:
              'Water. Palaeoclimate records — lake sediments, stalagmites, ocean cores — show the summer monsoon weakening after about 2200 BCE across a wide belt from Mesopotamia to the Indus. At the same time the Ghaggar-Hakra system in the east was drying and the Indus itself was shifting channels. Cities that depended on predictable floodwater farming and on river transport lose both at once.',
            choices: [
              { label: 'So the cities de-urbanised rather than died?', goto: 'systems', wise: true, note: 'Exactly the phrase archaeologists use: de-urbanisation, not extinction.' },
              { label: 'Did everyone leave?', goto: 'systems' },
            ],
          },
          {
            id: 'systems',
            text:
              'Settlement counts tell the story: sites in the west and on the Hakra decline, while sites in Haryana, Punjab and Gujarat increase. The population shifted east and south into smaller villages. Pottery traditions continue. Farming continues. What ends is the *city system* — the standard weights, the seals, the great public works. Civilisations rarely die. They reorganise.',
            end: true,
            vidya: 60,
            unlocks: ['indus-decline'],
          },
        ],
      },
    },
  ],

  npcs: [
    {
      id: 'sindhu-dockmaster',
      name: 'Kaushi',
      role: 'Dock overseer, Lothal basin',
      icon: '⚓',
      offset: [138, 138],
      color: 0xc9a06a,
      lines: [
        'Tide’s turning. If the boat is not loaded before the water drops, it waits a day.',
        'Carnelian out, copper and silver in. Keep the weights honest and the Gulf keeps buying.',
        'That basin is lined with burnt brick, two hundred metres of it. Someone planned this before a single boat came.',
      ],
      unlocks: 'meluhha-trade',
    },
    {
      id: 'sindhu-beadmaker',
      name: 'Ashvini',
      role: 'Bead-maker',
      icon: '🔶',
      offset: [48, 104],
      color: 0xb8705a,
      lines: [
        'A long carnelian bead takes days. Heat the stone, flake it, grind it, then drill — and the drill is harder than the stone.',
        'They want our beads in Ur. I have never seen Ur. My beads have.',
        'The trick is the drill bit: a stone we call ernestite, cooked until it bites.',
      ],
    },
    {
      id: 'sindhu-surveyor',
      name: 'Hiranya',
      role: 'City surveyor',
      icon: '📐',
      offset: [8, 30],
      color: 0x8fa36a,
      lines: [
        'One brick, two brick, four brick. Length twice the width, width twice the height. Always.',
        'Lay the main streets north-south first. Everything else follows the grid.',
        'A city without drains is a village with ambitions.',
      ],
    },
  ],
};
