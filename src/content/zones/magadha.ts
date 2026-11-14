import type { Zone } from '../types';

/**
 * Chapter 6 — Magadha: the Mauryan empire and, later, Nalanda.
 *
 * This is the zone where India starts speaking to us in its own voice, because
 * Ashoka's edicts are the first substantial Indian texts we can read in the
 * original on the original stone. The Brahmi matching game is therefore the
 * third act of a deliberate three-part lesson: unreadable (Indus), readable
 * (cuneiform), and readable-because-someone-worked-it-out (Brahmi).
 */
export const magadha: Zone = {
  id: 'magadha',
  name: 'Magadha',
  nameLocal: 'मगध',
  era: 'c. 321 BCE – 1200 CE',
  eraStart: -321,
  eraEnd: 1200,
  chapter: 6,
  tagline: 'Where an emperor carved his regrets into rock, and a university grew.',
  blurb:
    'Pataliputra, the pillars, the Great Stupa at Sanchi and the brick halls of Nalanda. Ashoka’s edicts are the oldest Indian writing we can actually read — and one of them is an apology.',
  center: [700, -300],
  radius: 340,
  plateau: 24,
  biome: 'gangeticPlain',
  raga: 'kafi',
  tonic: 50,
  sealRequires: 3,
  palette: {
    ground: 0x7d8c48,
    rock: 0x9b8f72,
    foliage: 0x3b6b34,
    stone: 0xcfc4a6,
    horizon: 0xffd9a0,
    zenith: 0x4e82c2,
    fog: 0xbfd0a4,
    sun: 0xfff0cc,
    sunElevation: 48,
    sunAzimuth: 160,
  },

  landmarks: [
    {
      id: 'magadha-stupa',
      name: 'The Great Stupa',
      kind: 'stupa',
      offset: [-40, -60],
      codexId: 'sanchi-stupa',
      scanSeconds: 4,
      signposted: true,
      opts: { radius: 26, domeHeight: 18, toranas: 4 },
    },
    {
      id: 'magadha-pillar',
      name: 'The Ashokan Pillar',
      kind: 'ashokaPillar',
      offset: [20, -8],
      codexId: 'ashoka-edicts',
      scanSeconds: 3.5,
      signposted: true,
      opts: { height: 13 },
    },
    {
      id: 'magadha-nalanda',
      name: 'Nalanda Mahavihara',
      kind: 'nalandaVihara',
      offset: [150, 110],
      rotation: 8,
      codexId: 'nalanda',
      scanSeconds: 4,
      signposted: true,
      opts: { blocks: 6, stories: 3 },
    },
    {
      id: 'magadha-gate',
      name: 'Gate of Pataliputra',
      kind: 'cityGate',
      offset: [-10, 130],
      codexId: 'pataliputra',
      scanSeconds: 3,
      signposted: true,
      opts: { width: 44, height: 26, timber: 1 },
    },
    {
      id: 'magadha-palace',
      name: 'The Mauryan Court',
      kind: 'palaceCity',
      offset: [-120, 90],
      rotation: 24,
      codexId: 'arthashastra',
      scanSeconds: 3.5,
      signposted: true,
      opts: { wings: 4, towerHeight: 30, courtWidth: 76, pillared: 1 },
    },
    {
      id: 'magadha-village',
      name: 'A Taxed Village',
      kind: 'villageCluster',
      offset: [120, -140],
      opts: { count: 11 },
      codexId: 'mauryan-economy',
      scanSeconds: 2.5,
    },
    {
      id: 'magadha-stepwell',
      name: 'The Monastery Tank',
      kind: 'stepwell',
      offset: [186, 160],
    },
    { id: 'magadha-pad', name: 'Landing Terrace', kind: 'vimanaPad', offset: [-150, -140] },
  ],

  challenges: [
    {
      id: 'magadha-brahmi',
      kind: 'scriptMatch',
      name: 'Reading the Edict',
      brief: 'Match the Brahmi letters to their sounds, then the edict reads itself.',
      teaches:
        'Brahmi is the ancestor of most Indian scripts and of several Southeast Asian ones. James Prinsep worked it out in 1837 by comparing short bilingual coin legends.',
      offset: [28, -2],
      vidya: 150,
      quizAfter: 2,
      prompt: 'Read the pillar edict',
      unlocks: ['brahmi-script', 'ashoka-edicts'],
      config: {
        note:
          'Brahmi is an abugida: each consonant carries an inherent "a", and vowel marks change it. Devanagari, Tamil, Bengali, Telugu, Kannada, Malayalam, Odia, Gurmukhi, Sinhala, Thai, Khmer, Burmese and Javanese scripts all descend from it. Prinsep cracked it using coins that gave the same king’s name in both Brahmi and Greek.',
        left: [
          { id: 'ka', glyph: 'क / ka', caption: 'A simple cross-stroke in Brahmi' },
          { id: 'ma', glyph: 'म / ma', caption: 'A loop on a vertical stem' },
          { id: 'dha', glyph: 'ध / dha', caption: 'An open bowl shape' },
          { id: 'sa', glyph: 'स / sa', caption: 'A hook over a stem' },
          { id: 'ya', glyph: 'य / ya', caption: 'A three-pronged fork' },
          { id: 'na', glyph: 'न / na', caption: 'A plain vertical with a foot' },
        ],
        right: [
          { id: 'ka', label: 'The "k" sound — as in Kalinga' },
          { id: 'ma', label: 'The "m" sound — as in Magadha' },
          { id: 'dha', label: 'The "dh" sound — as in dhamma' },
          { id: 'sa', label: 'The "s" sound — as in Sanchi' },
          { id: 'ya', label: 'The "y" sound — as in yashti' },
          { id: 'na', label: 'The "n" sound — as in Nalanda' },
        ],
      },
    },
    {
      id: 'magadha-stupa-build',
      kind: 'assembly',
      name: 'Raise the Stupa',
      brief: 'Build the stupa from the ground up, naming each part as you set it.',
      teaches:
        'Stupa architecture and its vocabulary: medhi, anda, harmika, yashti, chhatra, vedika, torana — and the reason the plan is a circle you walk around.',
      offset: [-34, -50],
      vidya: 180,
      quizAfter: 3,
      prompt: 'Take charge of the works',
      unlocks: ['sanchi-stupa', 'stupa-grammar'],
      config: {
        ordered: true,
        hint: 'Bottom to top, then enclose it. The umbrella cannot float.',
        pieces: [
          { id: 'medhi', label: 'Medhi — the circular drum', size: [6, 1.4, 6], color: 0xc9bb9a },
          { id: 'anda', label: 'Anda — the hemispherical dome', size: [5, 2.6, 5], color: 0xd6c9a8 },
          { id: 'harmika', label: 'Harmika — the square railing on top', size: [1.8, 0.9, 1.8], color: 0xb9a981 },
          { id: 'yashti', label: 'Yashti — the central mast', size: [0.4, 3.2, 0.4], color: 0x8e7a55 },
          { id: 'chhatra', label: 'Chhatra — the tiered parasols', size: [2.2, 0.3, 2.2], color: 0xe0d2ae },
          { id: 'vedika', label: 'Vedika — the stone railing', size: [7.5, 1.6, 0.5], color: 0xc3b48f },
          { id: 'torana', label: 'Torana — the carved gateway', size: [3.4, 4.6, 0.7], color: 0xcabb94 },
        ],
        sockets: [
          { id: 'p1', label: '1 · Drum', pos: [-12, 0.7, 0], accepts: 'medhi' },
          { id: 'p2', label: '2 · Dome', pos: [-8, 0.9, 0], accepts: 'anda' },
          { id: 'p3', label: '3 · Harmika', pos: [-4, 0.9, 0], accepts: 'harmika' },
          { id: 'p4', label: '4 · Mast', pos: [0, 1.6, 0], accepts: 'yashti' },
          { id: 'p5', label: '5 · Parasols', pos: [4, 1.2, 0], accepts: 'chhatra' },
          { id: 'p6', label: '6 · Railing', pos: [8, 0.8, 0], accepts: 'vedika' },
          { id: 'p7', label: '7 · Gateway', pos: [12.5, 2.3, 0], accepts: 'torana' },
        ],
      },
    },
    {
      id: 'magadha-ashoka',
      kind: 'dialogue',
      name: 'After Kalinga',
      brief: 'The emperor wants to know what to carve on the rock.',
      teaches:
        'Ashoka’s Major Rock Edict 13 records public remorse for the Kalinga war — an almost unique act for an ancient ruler — and defines dhamma as conduct, not creed.',
      offset: [-70, 20],
      vidya: 190,
      quizAfter: 3,
      prompt: 'Advise the emperor',
      unlocks: ['ashoka-kalinga', 'ashokan-dhamma'],
      config: {
        speaker: { name: 'Devanampiya Piyadasi', role: 'Ashoka, emperor of Magadha', icon: '🦁' },
        nodes: [
          {
            id: 'start',
            text:
              'I have taken Kalinga. The scribes give me a number: a hundred and fifty thousand deported, a hundred thousand killed, many times that number dead afterwards of hunger and sickness. I have never been given numbers after a victory before. I asked for them. Now my stonecutters wait, and I do not know what to tell them to write.',
            choices: [
              { label: 'Write the victory. Numbers like those are a warning to your enemies.', goto: 'victory' },
              { label: 'Write nothing. Let it be forgotten.', goto: 'silence' },
              { label: 'Write what you just told me — including the regret.', goto: 'remorse', wise: true, note: 'This is what Rock Edict 13 actually does.' },
            ],
          },
          {
            id: 'victory',
            text:
              'Every king before me has done exactly that. Mine would be one more boast in one more language on one more rock, and the kings who read it would copy it. But I have begun to think that a king who can only be obeyed out of fear has to keep producing fear, and the supply is finite.',
            choices: [
              { label: 'Then say it plainly and say it everywhere.', goto: 'remorse', wise: true },
              { label: 'What else could stone be for?', goto: 'remorse' },
            ],
          },
          {
            id: 'silence',
            text:
              'Forgetting is a luxury of the people who were not there. And I find I cannot. The edict I am considering contains a sentence no royal inscription has contained before: that the emperor feels remorse. My advisors think it is weakness. I think it is the only durable thing I own.',
            goto: 'remorse',
            next: 'remorse',
          },
          {
            id: 'remorse',
            text:
              'Then that is what the rock will say. And I will go further. The edicts will not be in the court’s Sanskrit but in the Prakrit people actually speak, in Brahmi where it is read and in Kharosthi in the north-west, and in Greek and Aramaic where my subjects read those. An order nobody can read is not an order. It is decoration.',
            choices: [
              { label: 'And what will dhamma mean, concretely?', goto: 'dhamma' },
              { label: 'Will you require everyone to follow your religion?', goto: 'tolerance' },
            ],
          },
          {
            id: 'tolerance',
            text:
              'No. Read Rock Edict 12 when it is cut. It says that one should not praise one’s own sect and disparage another’s, that whoever does so from devotion damages the very thing they are devoted to. I pay for Buddhist, Brahmanical, Jain and Ajivika establishments alike. I am a Buddhist layman; my edicts are not a conversion order.',
            goto: 'dhamma',
            next: 'dhamma',
          },
          {
            id: 'dhamma',
            text:
              'Concretely: obedience to parents and elders, decent treatment of servants and the poor, generosity to ascetics of every sect, restraint in speech, and non-injury to living beings. I have planted shade trees and dug wells along the roads, set up rest-houses, appointed dhamma-mahamatras to inspect. I have given up the royal hunt. Judge me by the wells, not by the verbs.',
            end: true,
            vidya: 100,
            unlocks: ['ashokan-dhamma'],
          },
        ],
      },
    },
    {
      id: 'magadha-sequence',
      kind: 'sequence',
      name: 'From Pataliputra to Nalanda',
      brief: 'Order fifteen centuries of Magadha.',
      teaches: 'Chronology of the Mauryan, Gupta and post-Gupta periods in the same river valley.',
      offset: [120, 97],
      vidya: 140,
      quizAfter: 2,
      prompt: 'Study the dynastic record',
      unlocks: ['gupta-period', 'nalanda'],
      config: {
        note:
          'All of this happens within a few days’ walk along one river. Magadha’s advantage was iron, elephants, river transport and fertile land — geography compounding over centuries.',
        items: [
          { id: 'chandragupta', label: 'Chandragupta Maurya takes Magadha', when: 'c. 321 BCE', detail: 'Advised by Kautilya; soon afterwards he fights Seleucus and gains the north-west.' },
          { id: 'megasthenes', label: 'Megasthenes at the Mauryan court', when: 'c. 302 BCE', detail: 'A Greek ambassador’s account, the Indica, survives only in fragments quoted by later writers.' },
          { id: 'kalinga', label: 'The Kalinga war and the edicts', when: 'c. 261 BCE', detail: 'Ashoka’s inscriptions are cut on rocks and pillars across the subcontinent.' },
          { id: 'sanchi', label: 'Sanchi’s carved gateways added', when: 'c. 1st century BCE', detail: 'The core stupa is Ashokan; the famous toranas are Satavahana-period work.' },
          { id: 'gupta', label: 'The Gupta period', when: 'c. 320–550 CE', detail: 'Aryabhata, Kalidasa, Varahamihira; decimal place-value notation matures.' },
          { id: 'nalandafound', label: 'Nalanda Mahavihara founded', when: '5th century CE', detail: 'Under Gupta patronage; it runs for roughly 700 years.' },
          { id: 'xuanzang', label: 'Xuanzang studies at Nalanda', when: 'c. 637 CE', detail: 'His travel account is one of our best descriptions of the place.' },
          { id: 'nalandaend', label: 'Nalanda is sacked', when: 'c. 1193 CE', detail: 'Attacked during the Ghurid campaigns in Bihar; the libraries are destroyed.' },
        ],
      },
    },
  ],

  npcs: [
    {
      id: 'magadha-stonecutter',
      name: 'Sunita',
      role: 'Stonecutter of the pillar works',
      icon: '⛏️',
      offset: [26, 4],
      color: 0xa89878,
      lines: [
        'Chunar sandstone. One block, thirteen metres, no joints. Getting it here was the hard part.',
        'The polish is the signature. Run your hand across it — two thousand years and still like glass.',
        'The lion capital from Sarnath is on your money now, I am told. We only carved it.',
      ],
      unlocks: 'ashoka-edicts',
    },
    {
      id: 'magadha-monk',
      name: 'Bhikkhu Dharmapala',
      role: 'Teacher at Nalanda',
      icon: '📚',
      offset: [140, 96],
      color: 0xc08a3a,
      lines: [
        'Students come from Tibet, China, Korea, Java, Sri Lanka. The entrance debate turns most of them away.',
        'Logic, grammar, medicine, metaphysics, mathematics. And yes, the Buddha’s teaching — but you must argue it, not recite it.',
        'Nine storeys of manuscripts in the Dharmaganja. Copying is a form of prayer here.',
      ],
      unlocks: 'nalanda',
    },
    {
      id: 'magadha-official',
      name: 'Amatya Rudradaman',
      role: 'Revenue officer',
      icon: '🧾',
      offset: [-100, 76],
      color: 0x7d8fb0,
      lines: [
        'One-sixth of the harvest, by the book. Kautilya has a chapter on what to do when it is not paid.',
        'The Arthashastra is not a book about ethics. It is a book about what works, which is why it is uncomfortable.',
        'Spies, granaries, roads, irrigation. An empire is logistics wearing a crown.',
      ],
      unlocks: 'arthashastra',
    },
  ],
};
