import type { Zone } from '../types';

/**
 * Chapter 5 — Kurukshetra (the Mahabharata).
 *
 * The Mahabharata is not primarily a war story; it is an argument about how to
 * act when every available choice is wrong. The zone is built so that the
 * archery and formation challenges are the *easy* part, and the Gita dialogue
 * is the real content.
 */
export const kurukshetra: Zone = {
  id: 'kurukshetra',
  name: 'Kurukshetra',
  nameLocal: 'कुरुक्षेत्र',
  era: 'Epic tradition · text c. 400 BCE – 400 CE',
  eraStart: -400,
  eraEnd: 400,
  chapter: 5,
  tagline: 'The longest poem in the world, and it is about a family that could not talk.',
  blurb:
    'Eighteen days, eighteen books, and a conversation between a warrior and his charioteer that became the most-read philosophical text in India. Roughly 100,000 verses — about ten times the Iliad and Odyssey combined.',
  center: [-90, -1000],
  radius: 320,
  plateau: 22,
  biome: 'dryPlains',
  raga: 'malkauns',
  tonic: 45,
  sealRequires: 3,
  palette: {
    ground: 0xa89367,
    rock: 0x8d7f69,
    foliage: 0x6b7340,
    stone: 0xa39a84,
    horizon: 0xe4a06a,
    zenith: 0x4a5a86,
    fog: 0xc6ad8e,
    sun: 0xffc98a,
    sunElevation: 11,
    sunAzimuth: 104,
  },

  landmarks: [
    {
      id: 'kuru-camp-pandava',
      name: 'The Pandava Camp',
      kind: 'warCamp',
      offset: [-120, 60],
      rotation: 10,
      codexId: 'mahabharata-overview',
      scanSeconds: 3.5,
      signposted: true,
      opts: { tents: 12, banner: 0x3f6bbf },
    },
    {
      id: 'kuru-camp-kaurava',
      name: 'The Kaurava Camp',
      kind: 'warCamp',
      offset: [130, -70],
      rotation: 190,
      opts: { tents: 14, banner: 0xb04040 },
      codexId: 'kuru-dynasty',
      scanSeconds: 3,
      signposted: true,
    },
    {
      id: 'kuru-chariots',
      name: 'The Chariot Line',
      kind: 'chariotLine',
      offset: [0, 10],
      codexId: 'epic-warfare',
      scanSeconds: 3,
      signposted: true,
      opts: { count: 9 },
    },
    {
      id: 'kuru-shrine',
      name: 'The Field Shrine',
      kind: 'kuruShrine',
      offset: [-18, -54],
      codexId: 'bhagavad-gita',
      scanSeconds: 4,
      signposted: true,
    },
    {
      id: 'kuru-gate',
      name: 'Gate of Hastinapura',
      kind: 'cityGate',
      offset: [60, 180],
      rotation: 180,
      codexId: 'hastinapura',
      scanSeconds: 2.5,
      signposted: true,
      opts: { width: 40, height: 24 },
    },
    {
      id: 'kuru-vyasa',
      name: 'Vyasa’s Retreat',
      kind: 'hermitage',
      offset: [-170, -140],
      opts: { huts: 3 },
      codexId: 'vyasa-transmission',
      scanSeconds: 3,
      signposted: true,
    },
    { id: 'kuru-pad', name: 'Landing Terrace', kind: 'vimanaPad', offset: [120, 120] },
  ],

  challenges: [
    {
      id: 'kuru-gita',
      kind: 'dialogue',
      name: 'The Conversation Between the Armies',
      brief: 'Arjuna has put down his bow. Work through the argument that follows.',
      teaches:
        'The Bhagavad Gita’s core move: act according to your duty without grasping at the results. It answers despair with discipline, not with enthusiasm for war.',
      offset: [-12, -46],
      vidya: 200,
      quizAfter: 3,
      prompt: 'Listen between the armies',
      unlocks: ['bhagavad-gita', 'karma-yoga'],
      config: {
        speaker: { name: 'The Charioteer', role: 'Krishna, between the armies', icon: '🪈' },
        nodes: [
          {
            id: 'start',
            text:
              'Look at him. The finest archer of the age, sitting down in his own chariot with his bow on the floor. He says: these are my teachers and my cousins, and I would rather be killed than win this. The whole poem — seven hundred verses, eighteen chapters — begins from that collapse. What would you say to him?',
            choices: [
              { label: '"Fight anyway. You swore an oath."', goto: 'oath' },
              { label: '"Walk away. Refusing a wrong war is also a duty."', goto: 'walk' },
              { label: '"Why exactly have you stopped? Name the fear."', goto: 'fear', wise: true, note: 'The Gita starts by diagnosing, not by commanding.' },
            ],
          },
          {
            id: 'oath',
            text:
              'That is the crude reading, and it is the one people reach for when they have only heard of the text. The Gita never says "a promise is a promise, go kill". It spends its first chapters taking Arjuna’s grief seriously. An argument that does not take the objection seriously is not an argument; it is an order.',
            choices: [
              { label: 'Then what does it take seriously?', goto: 'fear' },
              { label: 'Why is grief the starting point?', goto: 'fear' },
            ],
          },
          {
            id: 'walk',
            text:
              'Hold that thought, because the poem does consider it. Arjuna proposes exactly this and Krishna calls it what it is: not renunciation but paralysis dressed as virtue. Here is the trap — Arjuna is not choosing between acting and not acting. Standing still at Kurukshetra is itself an act with consequences for everyone behind him. There is no neutral square on this board.',
            choices: [
              { label: 'So inaction is also a choice with costs.', reply: 'That is the hinge of the whole argument.', goto: 'fear', wise: true, note: 'Chapter 3: you cannot escape action merely by refusing to move.' },
              { label: 'Surely sometimes walking away is right.', goto: 'renounce' },
            ],
          },
          {
            id: 'renounce',
            text:
              'Sometimes, yes — and the text respects genuine renunciation deeply. But it distinguishes it from flinching. True renunciation gives up the *fruit* of the action, not the action. The sannyasi who walks into the forest and the warrior who does his work without craving the prize are doing the same inner thing. Arjuna is not doing either yet; he is frozen.',
            goto: 'fear',
            next: 'fear',
          },
          {
            id: 'fear',
            text:
              'Then listen to what he actually says. His mouth is dry, his skin burns, his bow slips, he cannot stand. He is not reasoning — he is in shock, and the shock is about outcome: who will die, what will be destroyed, what people will say of him. Krishna’s answer goes straight at that. Do the work that is yours to do. Release your grip on the result. "Yoga-sthah kuru karmani" — established in steadiness, perform your actions.',
            choices: [
              { label: 'Is that just "don’t care about consequences"?', goto: 'nishkama' },
              { label: 'How is that supposed to help him?', goto: 'nishkama' },
            ],
          },
          {
            id: 'nishkama',
            text:
              'No — and this is where most summaries go wrong. You still choose the right action, carefully, by your duty and your conscience. What you let go of is the craving and the dread that distort the choosing. The surgeon who wants to be praised operates worse than the surgeon who wants the patient to live. That is nishkama karma: action without the hunger for its fruit.',
            choices: [
              { label: 'So it is about clarity, not indifference.', reply: 'Exactly. Equanimity sharpens judgement; it does not switch it off.', goto: 'paths', wise: true, note: 'Chapter 2.47–2.48.' },
              { label: 'And if the duty itself is wrong?', goto: 'duty' },
            ],
          },
          {
            id: 'duty',
            text:
              'Then you have the Mahabharata’s other hundred thousand verses, which are largely about exactly that. The epic is full of people who obey badly chosen duties and are ruined — Bhishma’s vow, Karna’s loyalty, Dhritarashtra’s silence. The poem does not hand you a rule. It hands you the hardest cases and refuses to make them easy.',
            goto: 'paths',
            next: 'paths',
          },
          {
            id: 'paths',
            text:
              'And it offers more than one road. Karma yoga, the discipline of action. Jnana yoga, the discipline of knowledge. Bhakti yoga, the discipline of devotion. Dhyana, the discipline of meditation. The text does not insist that everyone is a warrior. It insists that everyone has work, and that how you hold your work matters as much as what the work is.',
            end: true,
            vidya: 110,
            unlocks: ['karma-yoga'],
          },
        ],
      },
    },
    {
      id: 'kuru-calledshot',
      kind: 'archery',
      name: 'Drona’s Test',
      brief: 'Only the bird’s eye counts. Hit anything else and the arrow is wasted.',
      teaches:
        'The called shot: in Drona’s famous test the answer that matters is what the student can still see when they aim.',
      offset: [-70, 24],
      vidya: 150,
      quizAfter: 2,
      prompt: 'Accept Drona’s test',
      unlocks: ['drona-test'],
      config: {
        arrows: 6,
        passScore: 50,
        calledShot: 'eye',
        targets: [
          { pos: [0, 10.5, -32], radius: 0.55, points: 25, label: 'eye' },
          { pos: [-1.6, 10.2, -32], radius: 1.3, points: 0, label: 'The bird’s body' },
          { pos: [2.4, 11.4, -32], radius: 1.1, points: 0, label: 'A branch' },
          { pos: [-5, 7, -30], radius: 1.8, points: 0, label: 'Leaves' },
          { pos: [5.5, 8.4, -31], radius: 1.6, points: 0, label: 'Leaves' },
        ],
      },
    },
    {
      id: 'kuru-chakravyuha',
      kind: 'pattern',
      name: 'The Chakravyuha',
      brief: 'Complete the wheel formation. It must have rotational symmetry — a gap is a breach.',
      teaches:
        'The Chakravyuha is a layered rotating formation; its whole defensive logic depends on symmetry, which is why one missing unit lets an attacker in.',
      offset: [40, 50],
      vidya: 170,
      quizAfter: 2,
      prompt: 'Order the formation',
      unlocks: ['chakravyuha'],
      config: {
        gridSize: 7,
        symmetry: 'rotational',
        palette: [0x3f6bbf, 0xb04040, 0xe8b44b, 0x5f9e6b],
        given: [
          [3, 0, 0],
          [4, 1, 1],
          [5, 2, 2],
          [4, 3, 3],
          [2, 2, 0],
          [3, 1, 2],
        ],
        hint:
          'Abhimanyu’s story turns on this: he was taught how to enter the formation but not how to come out. Rotate what you are given around the centre.',
      },
    },
    {
      id: 'kuru-sequence',
      kind: 'sequence',
      name: 'Eighteen Days',
      brief: 'Order the turning points of the war.',
      teaches: 'The war’s structure, and the fact that each turning point involves a broken rule rather than a clever tactic.',
      offset: [100, 10],
      vidya: 130,
      quizAfter: 2,
      prompt: 'Read the herald’s record',
      unlocks: ['epic-warfare'],
      config: {
        note:
          'Watch what actually decides this war. Almost every turning point is somebody breaking the agreed rules of engagement — attacking after sundown, ganging up on a boy, striking a man whose weapon is down. The epic notices every single one and never lets the winners off.',
        items: [
          { id: 'rules', label: 'The rules of war are agreed', when: 'Day 0', detail: 'No fighting after sunset, no striking the unarmed, no attacking non-combatants. Nearly all of these will be broken.' },
          { id: 'bhishma', label: 'Bhishma falls', when: 'Day 10', detail: 'The Kaurava commander is brought down after revealing the condition of his own defeat.' },
          { id: 'abhimanyu', label: 'Abhimanyu is surrounded', when: 'Day 13', detail: 'A sixteen-year-old is trapped inside the Chakravyuha and killed by many warriors at once — a clear breach.' },
          { id: 'jayadratha', label: 'Arjuna’s vow against Jayadratha', when: 'Day 14', detail: 'Revenge now drives the war; the fighting continues into the night.' },
          { id: 'drona', label: 'Drona is killed', when: 'Day 15', detail: 'He lays down his weapons on hearing of his son’s death, and is struck anyway.' },
          { id: 'karna', label: 'Karna falls', when: 'Day 17', detail: 'Killed while his chariot wheel is stuck — the epic marks it as unfair, and marks his loyalty as tragic.' },
          { id: 'duryodhana', label: 'Duryodhana’s last duel', when: 'Day 18', detail: 'A mace fight ended by a blow below the waist, another breach of the rules.' },
          { id: 'aftermath', label: 'The mourning', when: 'After', detail: 'The Stri Parva gives the women of both sides the field. The victors inherit an empty country.' },
        ],
      },
    },
  ],

  npcs: [
    {
      id: 'kuru-sanjaya',
      name: 'Sanjaya',
      role: 'Narrator to the blind king',
      icon: '👁️',
      offset: [48, 160],
      color: 0xa0a0b8,
      lines: [
        'I describe this field to a king who cannot see it. He asks for details and then asks me to stop.',
        'The whole poem reaches you through someone retelling it. Remember that.',
        'Dhritarashtra’s first question is not who won. It is what my sons did.',
      ],
      unlocks: 'vyasa-transmission',
    },
    {
      id: 'kuru-smith',
      name: 'Takshaka',
      role: 'Chariot-wright',
      icon: '🛠️',
      offset: [16, 26],
      color: 0x8a6b4a,
      lines: [
        'Spoked wheel, bent-wood rim, two horses or four. A chariot is a workshop that someone decided to fight from.',
        'They praise the archer. Nobody praises the axle, and the axle decides the battle.',
        'Karna’s wheel sank in soft ground. That is not fate. That is drainage.',
      ],
      unlocks: 'epic-warfare',
    },
  ],
};
