import type { Zone } from '../types';

/**
 * Chapter 11 — the hill forts: Mewar and the Sahyadri.
 *
 * The teaching here is that a fort is an argument about terrain. Rajput
 * giri-durgas and Maratha Sahyadri forts solve the same problem — how does a
 * smaller force survive a larger one — with bent gateways, flanking bastions,
 * rock-cut cisterns and, in Shivaji's case, a navy nobody expected.
 */
export const maratha: Zone = {
  id: 'maratha',
  name: 'The Hill Forts',
  nameLocal: 'गिरि-दुर्ग · सह्याद्री',
  era: 'c. 1300–1818 CE',
  eraStart: 1300,
  eraEnd: 1818,
  chapter: 11,
  tagline: 'Where geography is the general.',
  blurb:
    'Chittorgarh covers 280 hectares on a plateau; Kumbhalgarh’s wall runs for 36 kilometres. Two centuries later Shivaji turned the Sahyadri ridges into a network of forts, fought by movement rather than by pitched battle, and built sea forts because he understood that a coast is a frontier.',
  center: [-580, 110],
  radius: 320,
  plateau: 62,
  biome: 'hillGhats',
  raga: 'durga',
  tonic: 49,
  sealRequires: 3,
  palette: {
    ground: 0x5f7a3c,
    rock: 0x6e6356,
    foliage: 0x2f5c2c,
    stone: 0x7d7265,
    horizon: 0xe8b894,
    zenith: 0x3f6aa8,
    fog: 0xaebb9e,
    sun: 0xffe4b8,
    sunElevation: 30,
    sunAzimuth: 248,
  },

  landmarks: [
    {
      id: 'maratha-fort',
      name: 'The Hill Fort',
      kind: 'hillFort',
      offset: [0, -30],
      codexId: 'hill-forts',
      scanSeconds: 4.5,
      signposted: true,
      opts: { wallRadius: 110, towers: 9, height: 22, bentGate: 1 },
    },
    {
      id: 'maratha-tower',
      name: 'The Tower of Victory',
      kind: 'nagaraTemple',
      offset: [-40, -60],
      stack: true, // on the fort's summit terrace
      rotation: 15,
      codexId: 'vijaya-stambha',
      scanSeconds: 3.5,
      signposted: true,
      opts: { shikharaHeight: 37, tower: 1, storeys: 9 },
    },
    {
      id: 'maratha-seafort',
      name: 'The Sea Fort',
      kind: 'lankaFort',
      offset: [190, 180],
      rotation: 25,
      codexId: 'maratha-navy',
      scanSeconds: 3.5,
      signposted: true,
      opts: { towers: 5, wallRadius: 54, height: 18, sea: 1 },
    },
    {
      id: 'maratha-cistern',
      name: 'The Rock-Cut Cisterns',
      kind: 'stepwell',
      // At the foot of the hill beside the stair: a stepwell dug into the fort's own mound would be hidden by it.
      offset: [156, 8],
      opts: { stepped: 1, rockCut: 1 },
      codexId: 'fort-water',
      scanSeconds: 3,
      signposted: true,
    },
    {
      id: 'maratha-village',
      name: 'The Mawal Villages',
      kind: 'villageCluster',
      offset: [-130, 120],
      opts: { count: 12, terraced: 1 },
      codexId: 'maratha-society',
      scanSeconds: 2.5,
      signposted: true,
    },
    {
      id: 'maratha-bazaar',
      name: 'The Fort Bazaar',
      kind: 'bazaarStreet',
      // At the foot of the hill, beside the road to the gate (it used to be half inside the mound).
      offset: [150, 78],
      rotation: 40,
      opts: { stalls: 10, length: 90 },
    },
    {
      id: 'maratha-temple',
      name: 'Ahilyabai’s Ghat Shrine',
      kind: 'nagaraTemple',
      offset: [150, -110],
      rotation: 200,
      codexId: 'ahilyabai',
      scanSeconds: 3,
      signposted: true,
      opts: { shikharaHeight: 24 },
    },
    { id: 'maratha-pad', name: 'Landing Terrace', kind: 'vimanaPad', offset: [-160, -150] },
  ],

  challenges: [
    {
      id: 'maratha-fortify',
      kind: 'assembly',
      name: 'Design the Approach',
      brief: 'Lay out the defences from the valley road up to the citadel, in the order an attacker meets them.',
      teaches:
        'Fort design logic: force the attacker onto a long exposed climb, bend the gateway so nothing can charge it, flank it from a bastion, and store water inside the rock.',
      offset: [-16, -18],
      vidya: 190,
      quizAfter: 3,
      prompt: 'Plan the defences',
      unlocks: ['hill-forts', 'fort-water'],
      config: {
        ordered: true,
        hint: 'Think like the enemy walking up. What do they hit first?',
        pieces: [
          { id: 'road', label: 'The long exposed approach road', size: [6, 0.4, 2], color: 0x8a7f6e },
          { id: 'outer', label: 'Outer gate (Maha Darwaza)', size: [3, 3.4, 1.2], color: 0x75695c },
          { id: 'bend', label: 'The right-angled turn inside the gate', size: [3.4, 2.6, 3.4], color: 0x6c6154 },
          { id: 'bastion', label: 'Flanking bastion (buruj)', size: [2.6, 3.8, 2.6], color: 0x7d7265 },
          { id: 'inner', label: 'Inner gate with spiked doors', size: [2.6, 3, 1.1], color: 0x655a4e },
          { id: 'cistern', label: 'Rock-cut water cistern', size: [3.4, 1, 3.4], color: 0x4f6b74 },
          { id: 'balekilla', label: 'The citadel (balekilla)', size: [4.4, 3.6, 4.4], color: 0x857a6c },
        ],
        sockets: [
          { id: 'f1', label: '1 · The climb', pos: [-14, 0.3, 0], accepts: 'road' },
          { id: 'f2', label: '2 · First gate', pos: [-9.5, 1.7, 0], accepts: 'outer' },
          { id: 'f3', label: '3 · The turn', pos: [-5, 1.3, 0], accepts: 'bend' },
          { id: 'f4', label: '4 · Fire from above', pos: [-0.5, 1.9, 0], accepts: 'bastion' },
          { id: 'f5', label: '5 · Second gate', pos: [4, 1.5, 0], accepts: 'inner' },
          { id: 'f6', label: '6 · The water', pos: [8.5, 0.5, 0], accepts: 'cistern' },
          { id: 'f7', label: '7 · The last stand', pos: [13, 1.8, 0], accepts: 'balekilla' },
        ],
      },
    },
    {
      id: 'maratha-shivaji',
      kind: 'dialogue',
      name: 'Ganimi Kava',
      brief: 'The Chhatrapati explains why he will not give you the battle you want.',
      teaches:
        'Asymmetric warfare as doctrine: mobility, forts, intelligence, and a navy — plus a revenue policy designed so villages were not plundered.',
      offset: [20, -8],
      vidya: 210,
      quizAfter: 3,
      prompt: 'Attend the Chhatrapati',
      unlocks: ['ganimi-kava', 'maratha-navy', 'ashta-pradhan'],
      config: {
        speaker: { name: 'Shivaji Bhonsle', role: 'Chhatrapati, at Raigad', icon: '⚔️' },
        nodes: [
          {
            id: 'start',
            text:
              'Every envoy who comes up this hill asks me the same thing: why do I not meet the imperial army in the open field, as a king should? They have forty thousand horse and artillery trains and more money than I will ever see. Tell me what you would have me do with my light cavalry and my four hundred ridges.',
            choices: [
              { label: 'Meet them. A king who avoids battle loses legitimacy.', goto: 'honour' },
              { label: 'Never give them a target. Use the hills, hit the supply lines, vanish.', goto: 'ganimi', wise: true, note: 'This is the doctrine he actually named and used.' },
              { label: 'Why so many forts?', goto: 'forts' },
            ],
          },
          {
            id: 'honour',
            text:
              'Legitimacy is what you have left after you survive. An army that fights only where the enemy is strongest is not honourable; it is obliging. And I have not avoided fighting — ask at Pratapgad, ask at Sinhagad. I avoid fighting on ground chosen by someone else. There is a difference, and it is the whole difference.',
            goto: 'ganimi',
            next: 'ganimi',
          },
          {
            id: 'ganimi',
            text:
              'We call it ganimi kava. Move at night, strike the baggage and the paymaster, never the armoured centre. Hold the passes, let the monsoon do half the work — their cavalry and guns sink in the ghats from June to September while my infantry walks. The Mawal men know every goat track on these ridges because they were born on them. That is not a tactic. That is a home.',
            choices: [
              { label: 'And when they besiege your forts?', goto: 'forts' },
              { label: 'Does this not simply ruin the countryside?', goto: 'revenue' },
            ],
          },
          {
            id: 'forts',
            text:
              'A single fort is a trap. Three hundred forts within signalling distance are a system — lose one and the garrison walks to the next. Water decides everything: cisterns cut into the rock, enough for a year. Gates turned at right angles so no elephant can build momentum. Bastions placed to shoot along the wall, not out from it. Torna was the first I took, at sixteen. Raigad is where I was crowned.',
            choices: [
              { label: 'And the sea? Nobody here builds a navy.', goto: 'navy', wise: true, note: 'He did — and it is the most under-taught part of the story.' },
              { label: 'How do you pay for all of it?', goto: 'revenue' },
            ],
          },
          {
            id: 'navy',
            text:
              'Which is exactly why I built one. The Siddis sit at Janjira, the Portuguese at Goa, the English at Bombay, and every one of them can land where they please while the land powers watch. So: Sindhudurg and Vijaydurg on the rocks, cruisers to escort our own merchants, and a Sarkhel to command them. Later Kanhoji Angre will hold this coast against three European navies at once. A kingdom with a coast and no fleet has a door with no latch.',
            choices: [
              { label: 'And the revenue question?', goto: 'revenue' },
              { label: 'Who actually runs the state while you campaign?', goto: 'council' },
            ],
          },
          {
            id: 'council',
            text:
              'Eight ministers — the Ashta Pradhan. Peshwa for administration, Amatya for accounts, Sachiv for correspondence, Mantri for intelligence, Senapati for the army, Sumant for foreign affairs, Nyayadhish for justice, Panditrao for religious endowments. Offices, not hereditary gifts — that was the intention, though my successors did not keep to it. I also had the court records put into Marathi and Sanskrit instead of Persian.',
            goto: 'revenue',
            next: 'revenue',
          },
          {
            id: 'revenue',
            text:
              'By taxing, not looting — and I am strict about this. Chauth and sardeshmukhi are assessed shares, collected on a measurement of the land, with written receipts. My orders to my own commanders forbid touching the standing crop, the cattle or the women of a village, and I have had officers punished for it. A soldier who burns a village has destroyed next year’s revenue to feed himself today. That is not ferocity. That is arithmetic.',
            end: true,
            vidya: 130,
            unlocks: ['ganimi-kava'],
          },
        ],
      },
    },
    {
      id: 'maratha-archery',
      kind: 'archery',
      name: 'Ranging from the Bastion',
      brief: 'Find the range on the marked posts along the approach. Score 80 with ten arrows.',
      teaches:
        'Why flanking bastions work: fire along the wall covers the ground an attacker must cross, and marked range posts turn guesswork into drill.',
      offset: [-34, -4],
      vidya: 150,
      quizAfter: 2,
      prompt: 'Take the bastion',
      unlocks: ['hill-forts'],
      config: {
        arrows: 10,
        passScore: 80,
        targets: [
          { pos: [-10, 2.6, -18], radius: 2.0, points: 5, label: '40 paces' },
          { pos: [2, 2.4, -26], radius: 1.6, points: 10, label: '60 paces' },
          { pos: [-6, 2.2, -34], radius: 1.3, points: 15, label: '80 paces' },
          { pos: [9, 2.6, -40], radius: 1.1, points: 20, label: '100 paces' },
          { pos: [-2, 3, -48], radius: 0.9, points: 25, label: 'The gate turn', moving: true },
          { pos: [14, 3.4, -30], radius: 1.4, points: 10, label: 'Flank post' },
        ],
      },
    },
    {
      id: 'maratha-sequence',
      kind: 'sequence',
      name: 'Five Centuries of Resistance',
      brief: 'Order the events from the Rajput sieges to the end of Maratha power.',
      teaches:
        'Chronology across two traditions of hill-fort warfare, and the fact that both ended against artillery and logistics, not against courage.',
      offset: [90, 30],
      vidya: 160,
      quizAfter: 3,
      prompt: 'Read the bardic record',
      unlocks: ['haldighati', 'ahilyabai', 'panipat-1761'],
      config: {
        note:
          'Two patterns worth noticing. First, hill forts beat cavalry and lose to sustained siege artillery. Second, the most durable Maratha achievements are administrative — Ahilyabai Holkar’s public works outlasted most of the battles.',
        items: [
          { id: 'khalji', label: 'Alauddin Khalji besieges Chittorgarh', when: '1303', detail: 'The first of the three great sieges in Mewar’s memory.' },
          { id: 'kumbha', label: 'Rana Kumbha builds the Vijaya Stambha', when: '1448', detail: 'A nine-storey tower of victory at Chittorgarh; he is also credited with Kumbhalgarh.' },
          { id: 'haldighati', label: 'The Battle of Haldighati', when: '1576', detail: 'Maharana Pratap against Mughal forces under Man Singh. Tactically inconclusive; Pratap then fights a long campaign from the hills.' },
          { id: 'pratapgad', label: 'Shivaji at Pratapgad', when: '1659', detail: 'Afzal Khan’s much larger force is drawn into the ghats and destroyed in close country.' },
          { id: 'coronation', label: 'Shivaji crowned Chhatrapati at Raigad', when: '6 June 1674', detail: 'A formal sovereign state, with the Ashta Pradhan council and records kept in Marathi and Sanskrit.' },
          { id: 'angre', label: 'Kanhoji Angre commands the fleet', when: 'c. 1698–1729', detail: 'As Sarkhel he holds the Konkan coast against Portuguese, Dutch and English squadrons.' },
          { id: 'panipat', label: 'The third battle of Panipat', when: '1761', detail: 'A catastrophic Maratha defeat, driven as much by supply lines and alliances as by fighting.' },
          { id: 'ahilyabai', label: 'Ahilyabai Holkar rules from Maheshwar', when: '1767–1795', detail: 'Roads, wells, ghats and temples from Varanasi to Somnath; remembered for administration, not conquest.' },
          { id: 'end', label: 'The last Anglo-Maratha war ends', when: '1818', detail: 'Siege artillery and company finance end the fort system that cavalry never could.' },
        ],
      },
    },
  ],

  npcs: [
    {
      id: 'maratha-mawal',
      name: 'Tanaji',
      role: 'Mawal infantry captain',
      icon: '🪢',
      offset: [12, -12],
      color: 0x6f7a4a,
      lines: [
        'Give me sixty men who grew up on this ridge over six hundred who did not.',
        'We climb at night. Ropes, bare feet, no lamps. The wall is only as strong as the hour it is watched.',
        'They ask how many we are. The honest answer is: fewer than you, and in better places.',
      ],
      unlocks: 'ganimi-kava',
    },
    {
      id: 'maratha-waterkeeper',
      name: 'Sakhubai',
      role: 'Keeper of the cisterns',
      icon: '🪣',
      offset: [26, 16],
      color: 0x6f8f98,
      lines: [
        'Count the cisterns, not the cannon. A fort falls when the water runs out, not when the wall cracks.',
        'Cut into living rock, roofed against the sun, filled by the monsoon. A year’s supply if nobody is wasteful.',
        'Every siege story is really a story about water.',
      ],
      unlocks: 'fort-water',
    },
    {
      id: 'maratha-builder',
      name: 'Ahilyabai Holkar',
      role: 'Queen of Malwa, at Maheshwar',
      icon: '🪔',
      offset: [144, -104],
      color: 0xc9a05a,
      lines: [
        'Battles are remembered. Wells are used. I would rather be useful.',
        'Ghats at Varanasi, the temple at Somnath, roads for pilgrims, rest-houses. Stone outlives armies.',
        'They call me a widow queen as though it were a limitation. I have thirty years of accounts that say otherwise.',
      ],
      unlocks: 'ahilyabai',
    },
  ],
};
