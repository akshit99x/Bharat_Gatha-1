import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 2 — Sumer & Dilmun. "The Neighbours Who Wrote It All Down."
 *
 * The counter-lesson to Chapter 1. Here the record is readable, so the Eraser's
 * move changes: not "nothing can be known" but "if it is not on a tablet, it
 * did not happen". And this is where the Indus world first appears in somebody
 * else's ledger.
 */
export const meluhhaStory: ChapterStory = {
  zoneId: 'meluhha',
  title: 'The Neighbours Who Wrote It All Down',
  hook: [
    {
      who: 'maitri',
      text: 'Same centuries, same trade routes, opposite problem. These people wrote everything down. Tens of thousands of tablets, and still the Dhundh finds a way in.',
    },
    {
      who: 'maitri',
      text: 'Notice how it feels to hold a source you can actually check. Keep that feeling. You will want it back later.',
    },
    {
      who: 'ekarupa',
      mask: 'eraser',
      text: 'Writing settles everything. If it is not on a tablet, it did not happen. Those drains you admired? Unwritten. Forget them.',
    },
  ],
  landing:
    'You came to the writing end of the Gulf first. Remember this panel when you reach the Indus: this is what a readable record looks like.',
  anchorNpcId: 'meluhha-merchant',
  anchorBeats: [
    {
      after: 'meluhha-cuneiform',
      npcId: 'meluhha-scribe',
      text: 'You read it! Years, that takes us. We start at seven. And what we practise is mostly lists: barley, beer, sheep. The poetry comes later.',
    },
    {
      after: 'meluhha-barter',
      npcId: 'meluhha-merchant',
      text: 'Carnelian from Meluhha, copper from Magan, silver from the north. Weigh it right and nobody writes me a complaint. I have had one. Once.',
    },
  ],
  plaques: [
    {
      id: 'meluhha-poetry',
      zoneId: 'meluhha',
      near: 'meluhha-scribes',
      mask: 'gilder',
      claim: 'Writing was invented to record poetry, prayers and the deeds of kings.',
      shown: 'epic',
      verdict: 'archaeology',
      requires: ['writing-origins'],
      correction:
        'The sequence from Mesopotamia is unusually clear: clay tokens standing for commodities, then tablets with impressed pictures and number signs — accounts of barley, beer, sheep and labour — then wedge strokes, then phonetic signs. Only after all that do literary texts appear. The earliest substantial writing anywhere is administrative: who owes what to whom. Poetry moved in later and took over the house.',
      nudge: {
        epic: 'Epic tradition is something told. These are objects pulled from the ground, in order. What kind of evidence is a layered sequence of tablets?',
        text: 'The tablets are writing, yes — but what lets us place them in a sequence from token to tablet is the digging. Which box is that?',
      },
    },
    {
      id: 'meluhha-sixty',
      zoneId: 'meluhha',
      near: 'meluhha-ziggurat',
      mask: 'eraser',
      claim: 'There is no reason for sixty minutes in an hour. It is arbitrary, and nobody knows where it came from.',
      shown: 'none',
      verdict: 'text',
      ask: 'The plaque says nobody knows. What kind of evidence says otherwise?',
      requires: ['base-sixty'],
      correction:
        'Mesopotamian mathematics used a base-60 place-value system. Sixty divides exactly by 2, 3, 4, 5, 6, 10, 12, 15, 20 and 30, so most everyday fractions come out whole. Sixty shekels made a mina and sixty minas a talent. That choice outlived the civilisation that made it: sixty seconds, sixty minutes, 360 degrees — Babylonian inheritances, passed on through Greek astronomy. We know because their mathematical texts survive and can be read.',
      nudge: {
        unsupported:
          'There is plenty behind it: the mathematical tablets themselves. Written sources you can read are exactly the thing we are asking about.',
        debate: 'Historians are not split on this one. The tablets say what they say.',
      },
    },
    {
      id: 'meluhha-meluhha',
      zoneId: 'meluhha',
      near: 'meluhha-harbour',
      mask: 'gilder',
      claim: 'Mesopotamia and the Indus were one civilisation under two names.',
      shown: 'text',
      verdict: 'unsupported',
      ask: 'The plaque stretches a real connection into something it does not say. Is there evidence for this claim?',
      requires: ['meluhha-trade'],
      correction:
        'Cuneiform records name three eastern trading partners — Dilmun, Magan and Meluhha, which most scholars identify with the Indus region — and the archaeology matches: etched carnelian beads, Indus-style weights and a few Indus seals turn up in Mesopotamia and the Gulf, and Gulf-type seals appear at Indus sites. That shows a connected world of traders. It does not show one civilisation. The two had different scripts, different cities and different ways of using a seal.',
      nudge: {
        text: 'The tablets do name Meluhha — but naming a trading partner is not the same as being the same people. Does any source say they were one civilisation?',
        archaeology:
          'The beads and seals are real. What they show is trade between two societies, not that they were one.',
      },
    },
  ],
  maker: {
    npcId: 'meluhha-scribe',
    who: 'The child scribes of the Tablet House',
    record:
      'Most surviving tablets are not literature. They are school exercises, receipts and lists, copied again and again by children learning the trade. Nin-shubur stands for them. The record of a civilisation is mostly made of the boring parts, and the boring parts were made by apprentices.',
    source: 'archaeology',
  },
  trail: {
    id: 'meluhha-ledger',
    title: 'Following the Ledger',
    brief: 'Trace a consignment from the harbour, through the merchant, to the scribe who records it.',
    stops: [
      {
        npcId: 'meluhha-sailor',
        say: 'Ur-sin brings the goods in. But goods without a record are a rumour. Find the man who pays for them: Ea-nasir.',
      },
      {
        npcId: 'meluhha-merchant',
        say: 'Ea-nasir weighs it, prices it, and then it must be written down or it never happened. Take it to the Tablet House and find Nin-shubur.',
      },
      { npcId: 'meluhha-scribe' },
    ],
    payoff:
      'Sailor, merchant, scribe. Notice that the scribe is last — and is the only reason we know any of it. A famous complaint tablet to this very merchant has survived nearly four thousand years. Ordinary grievances last longer than kings do.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The second panel is back: a clay tablet in wedge-writing, and pressed beside it, the same sealed bead you carried from the Indus. Two panels, one thread between them. The first stitch.',
    ask: 'Someone has scratched a second line under the bead on the tablet: "The Indus traders were honest." Do we leave it there?',
    options: [
      {
        label: 'Leave it. It sounds like a nice thing to know.',
        reply:
          'It does sound nice. But who wrote it, and what did they know? A nice line with no source behind it is just a smudge with good manners. I will note it as a comment, not a record.',
      },
      {
        label: 'Ask who wrote it before deciding.',
        wise: true,
        reply:
          'Quite right. The first question about any line is who is speaking and what they could actually know. The tablets give us names, dates and prices. Honesty is a character reference. Show me the receipt.',
      },
    ],
    bridge:
      'The last tablet in the pile is damp and chipped. A traveller’s note, copied from a trader, about a far land across the sea. It is not an account. It is a story. Different evidence, different rules. Time to learn the difference between a tablet and a tale.',
  }),
  panel: {
    title: 'The Tablet and the Bead',
    caption: 'A wedge-written tablet with an Indus bead pressed beside it — the first thread joining two panels.',
    motif: 'tablet',
    threads: ['writing', 'measure'],
    detail: 'The bead’s etched boat overlaps the tablet’s border. That is where the two panels are stitched.',
  },
  witness:
    'You want to know whether a thing happened? Find the receipt. And then ask who wrote the receipt, and why.',
};
