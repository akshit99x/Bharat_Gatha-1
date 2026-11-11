import type { Zone } from '../types';

/**
 * Chapter 9 — Vijayanagara (Hampi).
 *
 * Hampi is the best place in the game to teach *historiography*: we know this
 * city from three very different kinds of source — its own inscriptions, the
 * standing ruins, and the reports of Persian and Portuguese visitors who had
 * their own reasons for exaggerating. Learning to cross-check them is the skill.
 */
export const hampi: Zone = {
  id: 'hampi',
  name: 'Vijayanagara',
  nameLocal: 'विजयनगर · ಹಂಪೆ',
  era: '1336–1565 CE',
  eraStart: 1336,
  eraEnd: 1565,
  chapter: 9,
  tagline: 'A city of granite boulders, canals still running, and one catastrophic afternoon.',
  blurb:
    'For two centuries the largest city in the region sprawled across a boulder field on the Tungabhadra: bazaars a kilometre long, aqueducts still irrigating fields today, and a stone chariot that was never meant to move. In 1565 a coalition of Deccan sultanates broke its army at Talikota, and the city was abandoned.',
  center: [-220, 470],
  radius: 330,
  plateau: 32,
  biome: 'deccanBoulder',
  raga: 'durga',
  tonic: 50,
  sealRequires: 3,
  palette: {
    ground: 0xa98f5e,
    rock: 0x9c8e7c,
    foliage: 0x5e7a3a,
    stone: 0xb0a08a,
    horizon: 0xffc98e,
    zenith: 0x4878b8,
    fog: 0xd8bf96,
    sun: 0xfff0c2,
    sunElevation: 52,
    sunAzimuth: 212,
  },

  landmarks: [
    {
      id: 'hampi-boulders',
      name: 'The Boulder Ridge',
      kind: 'boulderField',
      // Kept clear of the temple and the palace: a ridge beside them, not boulders in their halls.
      offset: [-160, -160],
      opts: { count: 52, spread: 105, scale: 2.1 },
      codexId: 'hampi-landscape',
      scanSeconds: 3,
      signposted: true,
    },
    {
      id: 'hampi-virupaksha',
      name: 'Virupaksha Temple',
      kind: 'dravidaTemple',
      offset: [0, -40],
      codexId: 'virupaksha',
      scanSeconds: 4,
      signposted: true,
      opts: { tiers: 9, gopuram: 1, vimanaHeight: 44, courtWidth: 100 },
    },
    {
      id: 'hampi-chariot',
      name: 'The Stone Chariot',
      kind: 'stoneChariot',
      offset: [96, 36],
      rotation: 20,
      codexId: 'stone-chariot',
      scanSeconds: 3.5,
      signposted: true,
    },
    {
      id: 'hampi-bazaar',
      name: 'The Temple Bazaar',
      kind: 'bazaarStreet',
      offset: [20, 56],
      rotation: 0,
      codexId: 'hampi-economy',
      scanSeconds: 3,
      signposted: true,
      opts: { stalls: 18, colonnade: 1, length: 150 },
    },
    {
      id: 'hampi-pushkarani',
      name: 'The Stepped Tank',
      kind: 'stepwell',
      offset: [-70, 92],
      opts: { stepped: 1, large: 1 },
      codexId: 'hampi-water',
      scanSeconds: 3,
      signposted: true,
    },
    {
      id: 'hampi-palace',
      name: 'The Royal Enclosure',
      kind: 'palaceCity',
      offset: [-150, 50],
      rotation: 10,
      codexId: 'vijayanagara-court',
      scanSeconds: 3.5,
      signposted: true,
      opts: { wings: 4, towerHeight: 24, courtWidth: 86, pillared: 1, lotus: 1 },
    },
    {
      id: 'hampi-village',
      name: 'Kamalapura Fields',
      kind: 'villageCluster',
      offset: [130, 150],
      opts: { count: 9, fields: 1 },
    },
    { id: 'hampi-pad', name: 'Landing Terrace', kind: 'vimanaPad', offset: [150, -120] },
  ],

  challenges: [
    {
      id: 'hampi-water',
      kind: 'assembly',
      name: 'Restore the Aqueduct',
      brief: 'Rebuild the water line from the river to the tank, in working order.',
      teaches:
        'Vijayanagara’s hydraulic engineering: a diversion weir, gravity-fed canals cut through rock, settling tanks, and distribution sluices — several of these canals still irrigate fields today.',
      offset: [-62, 80],
      vidya: 180,
      quizAfter: 2,
      prompt: 'Take up the mason’s tools',
      unlocks: ['hampi-water', 'deccan-irrigation'],
      config: {
        ordered: true,
        hint: 'Water will not climb. Start where the river is highest and end where the city drinks.',
        pieces: [
          { id: 'weir', label: 'River diversion weir (anicut)', size: [5, 1.2, 2.4], color: 0x8a8070 },
          { id: 'channel', label: 'Rock-cut gravity channel', size: [4.4, 0.8, 1.8], color: 0xa39682 },
          { id: 'aqueduct', label: 'Raised aqueduct span', size: [5, 2.6, 1.6], color: 0xb0a08a },
          { id: 'silt', label: 'Settling basin', size: [3.2, 1.2, 3.2], color: 0x7f8d7a },
          { id: 'sluice', label: 'Distribution sluice gate', size: [1.6, 1.8, 1.2], color: 0x6f6456 },
          { id: 'tank', label: 'Stepped tank (pushkarani)', size: [5.4, 1.4, 5.4], color: 0xa9a08e },
        ],
        sockets: [
          { id: 'w1', label: '1 · At the river', pos: [-13, 0.6, 0], accepts: 'weir' },
          { id: 'w2', label: '2 · Cut the channel', pos: [-8, 0.4, 0], accepts: 'channel' },
          { id: 'w3', label: '3 · Cross the low ground', pos: [-3, 1.3, 0], accepts: 'aqueduct' },
          { id: 'w4', label: '4 · Drop the silt', pos: [2, 0.6, 0], accepts: 'silt' },
          { id: 'w5', label: '5 · Control the flow', pos: [7, 0.9, 0], accepts: 'sluice' },
          { id: 'w6', label: '6 · Store and serve', pos: [12.5, 0.7, 0], accepts: 'tank' },
        ],
      },
    },
    {
      id: 'hampi-bazaar-trade',
      kind: 'trade',
      name: 'The Pagoda Market',
      brief: 'Make up a purse worth exactly 24 panam for the horse-dealer.',
      teaches:
        'Vijayanagara’s money: gold varaha (pagoda), smaller panam, and copper jital, with foreign traders converting at the bazaar gate.',
      offset: [28, 48],
      vidya: 150,
      quizAfter: 2,
      prompt: 'Haggle in the bazaar',
      unlocks: ['hampi-economy', 'horse-trade'],
      config: {
        goods: [
          { id: 'pepper', label: 'Malabar pepper (a sack)', unitMass: 3, glyph: '🫙' },
          { id: 'cotton', label: 'Printed cotton (a bale)', unitMass: 6, glyph: '🧵' },
          { id: 'diamond', label: 'Golconda rough diamond', unitMass: 12, glyph: '💎' },
          { id: 'horse', label: 'An Arabian horse', unitMass: 24, glyph: '🐎' },
        ],
        weights: [1, 2, 4, 6, 12, 24],
        note:
          'Horses were the single biggest import and the strategic one: the Deccan does not breed good cavalry mounts, so Vijayanagara and the sultanates competed for Arabian and Persian horses landed on the west coast. Portuguese traders worked out quickly that whoever controlled the horse supply had leverage over both sides.',
        target: 24,
      },
    },
    {
      id: 'hampi-identify',
      kind: 'scriptMatch',
      name: 'What Was This Building For?',
      brief: 'Match each standing ruin to its actual function.',
      teaches:
        'Archaeological interpretation: popular names for Hampi’s ruins are often wrong, and function is argued from plan, position and inscription.',
      offset: [-120, 30],
      vidya: 160,
      quizAfter: 3,
      prompt: 'Survey the enclosure',
      unlocks: ['hampi-interpretation', 'stone-chariot'],
      config: {
        note:
          'Several of these buildings carry names invented by nineteenth-century visitors, not by the people who built them. "Lotus Mahal" and "Queen’s Bath" are modern labels; archaeologists argue over them from the plans and the inscriptions, and sometimes change their minds.',
        left: [
          { id: 'stables', glyph: 'Elephant Stables', caption: 'Eleven tall domed chambers in a row, with a central pavilion' },
          { id: 'lotus', glyph: '"Lotus Mahal"', caption: 'A symmetrical pavilion mixing arches with Dravidian mouldings' },
          { id: 'dibba', glyph: 'Mahanavami Dibba', caption: 'A huge stepped stone platform carved with processions' },
          { id: 'chariot', glyph: 'The Stone Chariot', caption: 'A wheeled chariot carved from blocks of granite' },
          { id: 'pushkarani', glyph: 'Pushkarani', caption: 'A deep tank of precisely cut, numbered stone steps' },
          { id: 'pillars', glyph: 'The Musical Pillars', caption: 'Slender clustered colonettes in a temple hall' },
        ],
        right: [
          { id: 'stables', label: 'Housing for the state elephants — each chamber for one animal' },
          { id: 'lotus', label: 'A courtly pavilion; the name is modern and its exact use is disputed' },
          { id: 'dibba', label: 'A royal review platform used during the Mahanavami festival' },
          { id: 'chariot', label: 'A shrine to Garuda — a building shaped like a chariot, never meant to move' },
          { id: 'pushkarani', label: 'A water tank, assembled from pre-cut numbered blocks like a kit' },
          { id: 'pillars', label: 'Structural columns that also ring at different pitches when struck' },
        ],
      },
    },
    {
      id: 'hampi-sources',
      kind: 'dialogue',
      name: 'Three Witnesses',
      brief: 'A Persian envoy, a Portuguese horse-trader and a temple wall disagree. Who do you believe?',
      teaches:
        'Source criticism: every account has an author with interests. Cross-checking inscriptions, archaeology and travellers’ reports is how history is actually done.',
      offset: [-140, 66],
      vidya: 200,
      quizAfter: 3,
      prompt: 'Weigh the sources',
      unlocks: ['hampi-interpretation', 'talikota'],
      config: {
        speaker: { name: 'Dr. Shalini Deshpande', role: 'Field archaeologist, Vijayanagara survey', icon: '🧭' },
        nodes: [
          {
            id: 'start',
            text:
              'Three witnesses to this city. Abdur Razzaq, a Persian envoy in 1443, says he has never seen its like and counts the bazaars. Domingo Paes, a Portuguese horse-trader in the 1520s, says it is as large as Rome and the king’s jewels are beyond counting. And the temple walls, which record grants of land and oil and dancers’ wages. Which do you trust?',
            choices: [
              { label: 'The foreigners — they describe the whole city.', goto: 'foreign' },
              { label: 'The inscriptions — they are contemporary and official.', goto: 'epigraph' },
              { label: 'None of them alone. What do they agree on?', goto: 'triangulate', wise: true, note: 'Triangulation is the method.' },
            ],
          },
          {
            id: 'foreign',
            text:
              'They are vivid, and vividness is seductive. But ask why each man is writing. Razzaq is an ambassador reporting to a court that wants to know whether this kingdom is formidable. Paes sells horses and writes for people deciding whether to invest. Neither is lying, exactly. Both have a reason to make this place sound enormous.',
            choices: [
              { label: 'So check their numbers against something else.', goto: 'triangulate', wise: true },
              { label: 'Do the inscriptions help with that?', goto: 'epigraph' },
            ],
          },
          {
            id: 'epigraph',
            text:
              'Inscriptions are wonderful and narrow. They tell you precisely what the donor wanted recorded — this much land, this many lamps, this festival — and almost nothing about what the donor wanted hidden. They are dated, which is gold. But a wall full of pious grants will never mention a famine, a defeat or a tax riot.',
            choices: [
              { label: 'Then combine them with what is actually in the ground.', goto: 'triangulate', wise: true },
              { label: 'What does the archaeology add?', goto: 'triangulate' },
            ],
          },
          {
            id: 'triangulate',
            text:
              'Here is where it gets satisfying. Paes describes irrigation channels; the survey has mapped those channels and some still carry water to Kamalapura’s fields. The inscriptions record the Mahanavami festival; the Dibba platform matches the described procession. Razzaq describes long colonnaded bazaars; we have excavated them in front of the temples. Where all three converge, we are on firm ground. Where they conflict, that is where the interesting question is.',
            choices: [
              { label: 'And 1565 — what does each source say?', goto: 'talikota' },
              { label: 'Give me a case where they conflict.', goto: 'talikota' },
            ],
          },
          {
            id: 'talikota',
            text:
              'Talikota. The later chronicles describe a sudden, total catastrophe — one lost battle, a city stripped in months. The archaeology is messier: burning in some quarters, continuity in others, and Virupaksha temple never stopped being worshipped — there is a priest in it this morning. The abandonment of the capital was real, and it was a process, not a thunderclap. History almost always runs slower than the story about it.',
            end: true,
            vidya: 120,
            unlocks: ['talikota'],
          },
        ],
      },
    },
  ],

  npcs: [
    {
      id: 'hampi-stonemason',
      name: 'Mallappa',
      role: 'Stone mason',
      icon: '🔨',
      offset: [86, 28],
      color: 0xa89878,
      lines: [
        'The chariot is three pieces, not one. Look for the joints — they are there if you are honest about it.',
        'Those tank steps are numbered. Cut in one place, assembled in another. A kit of parts.',
        'Strike the pillar gently with your knuckle, not a hammer. Fools with hammers have cost us plenty.',
      ],
      unlocks: 'stone-chariot',
    },
    {
      id: 'hampi-merchant',
      name: 'Nuniz',
      role: 'Portuguese horse-trader',
      icon: '🐎',
      offset: [34, 62],
      color: 0xb08a5a,
      lines: [
        'Everyone wants cavalry and nobody here breeds it. That is my entire business model.',
        'I will write all this down when I am home. I will probably exaggerate. Everybody does.',
        'Pepper out, horses in, and a tax at every gate. The gates are where the real kingdom is.',
      ],
    },
  ],
};
