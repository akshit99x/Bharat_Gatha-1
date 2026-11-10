import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 1 — Sindhu-Sarasvati. "The Silent City."
 *
 * The clearest air on the island, because there is nothing written for the
 * Dhundh to gild or erase. The lesson is what archaeology can establish with no
 * readable text at all — and the honest blank where the script should be.
 * Every claim below is grounded in the codex entries it `requires`.
 */
export const sindhuStory: ChapterStory = {
  zoneId: 'sindhu',
  title: 'The Silent City',
  hook: [
    {
      who: 'maitri',
      text: 'Look how clear the air is. Nobody here left anything we can read, so the Dhundh has nothing to gild or erase. It just waits.',
    },
    {
      who: 'maitri',
      text: 'Start with the ground. Hold the lens on what you find, and ask of everything: how do we know that?',
    },
    {
      who: 'ekarupa',
      mask: 'eraser',
      text: 'No writing, no names, no kings. What is there to know? Enjoy the view, and leave it at that.',
    },
  ],
  landing:
    'You chose the oldest panel to begin with. Good. Everything else on this island learns its habits from here.',
  anchorNpcId: 'sindhu-sweeper',
  anchorBeats: [
    {
      after: 'sindhu-drains',
      npcId: 'sindhu-sweeper',
      text: 'You set the slabs back in the right order. That is the whole secret of this city, you know. Not the Great Bath. The people who lift the slabs.',
    },
    {
      after: 'sindhu-weights',
      npcId: 'sindhu-beadmaker',
      text: 'Thirty-two units, no more, no less. The same weights turn up in towns a long walk apart. Somebody agreed on that, and kept agreeing.',
    },
  ],
  plaques: [
    {
      id: 'sindhu-massacre',
      zoneId: 'sindhu',
      near: 'sindhu-citadel',
      mask: 'gilder',
      claim: 'Invaders massacred the people of Mohenjo-daro and ended the Indus civilisation.',
      shown: 'archaeology',
      verdict: 'unsupported',
      requires: ['indus-decline'],
      correction:
        'No destruction layer has been found, and the skeletons once read as massacre victims come from different periods and mostly show no battle injuries. The cities faded as the monsoon weakened, rivers shifted and trade thinned — people moved east and south into smaller villages. Migrations into the subcontinent in the second millennium BCE are well supported, but that is a different claim from "an invasion destroyed the cities", and the two should not be confused.',
      nudge: {
        debate:
          'What ended the cities is argued over. But this plaque names one specific cause, a massacre. Is that particular claim backed by anything?',
        archaeology:
          'The plaque is wearing the archaeology label. Ask what the dig actually found: a burnt, battered destruction layer, or not?',
      },
    },
    {
      id: 'sindhu-unplanned',
      zoneId: 'sindhu',
      near: 'sindhu-lowertown',
      mask: 'eraser',
      claim: 'The Indus cities were never planned. They just grew, like any other old town.',
      shown: 'none',
      verdict: 'archaeology',
      ask: 'The plaque says there is nothing to learn here. What kind of evidence says otherwise?',
      requires: ['indus-townplan'],
      correction:
        'Grids have to be surveyed before anything is built. Mohenjo-daro, Harappa, Dholavira and Rakhigarhi share a plan — a raised western mound with public buildings and a larger lower town on streets that meet at right angles — across sites more than 500 km apart. That is a decision, enforced for centuries. We have no palace, temple or royal tomb to say who took it, and that gap is real. The planning is not in doubt.',
      nudge: {
        debate:
          'There is a real mystery here — who decided? — but the grid itself is not argued over. Streets are either at right angles or they are not.',
        unsupported:
          'Something does support it: you can walk the grid. The streets are still there to measure.',
      },
    },
    {
      id: 'sindhu-lothal',
      zoneId: 'sindhu',
      near: 'sindhu-dock',
      mask: 'gilder',
      claim: 'Lothal had the oldest dockyard in the world, and that is settled fact.',
      shown: 'archaeology',
      verdict: 'debate',
      requires: ['lothal-dock'],
      correction:
        'The brick-lined basin at Lothal is real, and its excavator, S. R. Rao, read it as a tidal dockyard. Others read it as an irrigation or water-storage tank, arguing that the silting and channel dimensions do not suit seagoing craft. The site also produced a bead factory, a Persian Gulf seal and warehouse platforms, so Lothal was certainly a trading town. What the basin itself did is unsettled — one structure can be solid evidence and contested interpretation at the same time.',
      nudge: {
        archaeology:
          'The brick is archaeology. But the plaque claims something about what the basin was for. Do the people who dug it, and the people who criticised them, agree?',
      },
    },
  ],
  maker: {
    npcId: 'sindhu-sweeper',
    who: 'The people who kept the drains clear',
    record:
      'We have no names from the Indus cities. But the drains have a deliberate gradient, removable slabs and soak-pits — a system that only works if somebody clears it, again and again, for centuries. Whether they were paid is inference. That someone did it is not. Bhadra stands for them.',
    source: 'archaeology',
  },
  trail: {
    id: 'sindhu-cotton',
    title: 'Cotton, from Field to Dock',
    brief: 'Follow a bale of cotton from the floodplain to the harbour.',
    stops: [
      {
        npcId: 'sindhu-farmer',
        say: 'Hemaka sows into the mud the flood leaves behind, and cotton leaves the field as raw fibre. Follow it to the weaver in the lower town: Sujata.',
      },
      {
        npcId: 'sindhu-weaver',
        say: 'Spun, woven, dyed with madder — and not made for the city. Cloth like this goes out in bales. Take it down to the dock, to Kaushi.',
      },
      { npcId: 'sindhu-dockmaster' },
    ],
    payoff:
      'Follow the cloth and you have followed the whole economy: field, loom, quay, boat. Every handover was a trade, and every trade needed a weight both sides trusted. Hold that thought. The next place is where somebody wrote it all down.',
    vidya: 120,
  },
  restoration: restoration({
    recap:
      'That is the first panel mended. Look at what it shows: a seal pressed into red clay, an animal and a short row of signs — and underneath, one line left blank. Unread. I could paint a reading into it. People have, for a century.',
    ask: 'Shall I paint one in?',
    options: [
      {
        label: 'Paint in the best guess. A blank looks unfinished.',
        reply:
          'Many have. The trouble is that a guess painted in becomes the next person’s evidence. I will leave the clay as it is for now — but I understand the pull. A blank is uncomfortable.',
      },
      {
        label: 'Leave it blank. An honest blank is part of the record.',
        wise: true,
        reply:
          'Then it stays. "We cannot read this" is a finding, and one of the most honest sentences in archaeology.',
      },
      {
        label: 'Which readings are on offer, and what would each one predict?',
        wise: true,
        reply:
          'Better still. Each reading claims something about the language behind the signs, and we can test those claims against the signs themselves. None has survived the test yet. Leave the line blank and we lose nothing.',
      },
    ],
    bridge:
      'Hiranya has pressed a carnelian bead into your hand, etched, with a little boat on it. Beads like it turn up in Mesopotamia. That boat is going somewhere. Follow it across the water, to people who wrote everything down — and see what they say about us.',
  }),
  panel: {
    title: 'The Unread Seal',
    caption: 'A seal pressed into red clay, with one line left deliberately blank.',
    motif: 'seal',
    threads: ['measure', 'water'],
    detail: 'Look at the bottom edge. The blank is not damage. It is a decision.',
  },
  witness:
    'Ask me what the drains say and I can tell you. Ask me what the seals say, and I will tell you the truth: nobody knows. That is not the same as nothing.',
};
