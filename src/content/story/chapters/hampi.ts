import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 9 — Vijayanagara (Hampi). "One Catastrophic Afternoon."
 *
 * Opens Act IV, where the question shifts from "how do we know?" to "who was
 * left out?". Ekarupa stops whispering. The anchor is two eyewitnesses with
 * different interests, because the chapter's core skill is weighing testimony.
 */
export const hampiStory: ChapterStory = {
  zoneId: 'hampi',
  title: 'One Catastrophic Afternoon',
  hook: [
    {
      who: 'maitri',
      text: 'The most beautiful and the most dangerous place on the island. A city of granite boulders, canals still running, and one catastrophic afternoon. Be careful which of those three you let write the story.',
    },
    {
      who: 'ekarupa',
      mask: 'eraser',
      text: 'This city fell in an afternoon. What is the point of knowing it? It is gone. Let it be gone.',
    },
  ],
  landing:
    'You started in the ruin. Of all places to begin — it is the one with an afternoon in it. Walk gently, and remember the water is still running.',
  anchorNpcId: 'hampi-stonemason',
  anchorBeats: [
    {
      after: 'hampi-water',
      npcId: 'hampi-water-keeper',
      text: 'The canals were never abandoned. We have been keeping the water since before the city fell. Ask the people who write about the fall how many of them have walked a canal at dawn.',
    },
    {
      after: 'hampi-sources',
      npcId: 'hampi-merchant',
      text: 'I wrote down what I saw, which was a rich city at the height of a king’s power, and I wrote it for people who wanted horses sold. Keep that in mind when you read me.',
    },
  ],
  plaques: [
    {
      id: 'hampi-monolith',
      zoneId: 'hampi',
      near: 'hampi-chariot',
      mask: 'gilder',
      claim: 'The Stone Chariot at Hampi is carved from a single block of granite.',
      shown: 'archaeology',
      verdict: 'unsupported',
      requires: ['stone-chariot'],
      correction:
        'In the Vittala temple courtyard the famous stone chariot is in fact a shrine to Garuda, built in the shape of a processional chariot. It is not carved from a single block, as is often claimed: it is assembled from several granite pieces, and the joints are visible once you know to look. Its wheels were once able to turn; they have since been fixed in place to prevent damage. It is still extraordinary, and it does not need the monolith story to be.',
      nudge: {
        archaeology: 'It is archaeology, yes — but does the physical evidence support a single block? Look at the joints.',
        overstated: 'The chariot is real and impressive. But the single-block claim is not just stretched: the stone itself contradicts it.',
      },
    },
    {
      id: 'hampi-afternoon',
      zoneId: 'hampi',
      near: 'hampi-palace',
      mask: 'eraser',
      claim: 'Vijayanagara was wiped out in a single afternoon in 1565, and nothing of it survived.',
      shown: 'text',
      verdict: 'overstated',
      requires: ['talikota'],
      correction:
        'In January 1565 a coalition of the Deccan sultanates defeated the Vijayanagara army at the battle usually called Talikota. The commander was killed, the army broke and the capital was plundered — there is a true core here. But the later chronicles describe one total catastrophe, and the archaeology is more complicated: heavy burning and deliberate destruction in some quarters, continuity in others, and worship at Virupaksha that never stopped. The dynasty itself continued from Penukonda and Chandragiri for decades. The abandonment was real, and it was a process. History usually runs slower than the story told about it afterwards.',
      nudge: {
        text: 'The chronicles do say it fell. But does the dig back up the single-afternoon version?',
        debate: 'There is a real argument about the details. But the plaque makes a sweeping claim. Is that stretched, or is it only a different view?',
        unsupported: 'Something happened in 1565: that part is solid. The plaque stretches it. What is the word for that?',
      },
    },
    {
      id: 'hampi-water-myth',
      zoneId: 'hampi',
      near: 'hampi-pushkarani',
      mask: 'eraser',
      claim: 'The water canals of Vijayanagara are a legend. Nothing like them has been found.',
      shown: 'none',
      verdict: 'archaeology',
      ask: 'The plaque says nothing has been found. What does the ground actually show?',
      requires: ['hampi-water'],
      correction:
        'Vijayanagara depended on engineered water. A diversion weir on the Tungabhadra fed gravity canals, some cut through solid rock, carrying water to fields, tanks and the royal centre. Raised aqueducts crossed low ground; settling basins dropped silt; sluices distributed the flow. Inside the royal enclosure, the stepped tank excavated in the 1980s is built from pre-cut blocks carrying mason’s numbers — a kit assembled on site. Several canals were never abandoned and still irrigate the fields around Kamalapura. For a city famous for being destroyed, its most durable legacy turns out to be its plumbing.',
      nudge: {
        unsupported: 'You can stand in the canal. What kind of evidence is a channel that still carries water?',
        text: 'No chronicle is needed here: the excavated tank and canals are the evidence themselves.',
      },
    },
  ],
  maker: {
    npcId: 'hampi-water-keeper',
    who: 'The canal keepers',
    record:
      'The most durable thing Vijayanagara left was not a temple. It was a canal system that kept working after the city fell, kept alive by the people who cleaned it, opened its sluices and settled the quarrels over water. Hampamma stands for them. We have no names. We have the fields they kept green for five hundred years.',
    source: 'archaeology',
  },
  trail: {
    id: 'hampi-witnesses',
    title: 'What the Poet Left Out',
    brief: 'Compare what three people wrote, and what none of them wrote.',
    stops: [
      {
        npcId: 'hampi-telugu-poet',
        say: 'Allasani Peddana sings the court — and a court poet does not sing about the canal-keeper. Remember what is missing. Now ask the foreigner: the envoy from Herat, Abdur Razzaq.',
      },
      {
        npcId: 'hampi-persian-envoy',
        say: 'An envoy sees the city as a stranger does, and writes for a ruler at home. Two witnesses, two different silences. Last: the horse-trader, Nuniz.',
      },
      { npcId: 'hampi-merchant' },
    ],
    payoff:
      'A poet, an envoy and a trader. Each tells the truth, each for a different reader, and none of them mentions the canal-keeper. A source is not just what it says. It is also what its author had no reason to say.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The ninth panel is back, and it is half-painted on purpose: the city before, and the ruin after, with a single stitched line of canal running through both.',
    ask: 'I could paint over the join, so the city and the ruin look like one continuous picture. It would be easier on the eye. Shall I?',
    options: [
      {
        label: 'Paint over it. People prefer a single story.',
        reply:
          'They do. That is why the afternoon story lasted. But it would hide the one line that runs through both halves, and that line is the most important thing on the panel. I will leave a hairline.',
      },
      {
        label: 'Leave the join. The panel should show that it took time.',
        wise: true,
        reply:
          'Left as it is. The canal runs through the join because it kept running. That is what the evidence says, and the evidence is better than the afternoon.',
      },
    ],
    bridge:
      'I will tell you something, and then I will go quiet for a while. You can mend a ruin on a panel. You cannot mend a ruin. Bichitr’s miniature in the next court shows a white dome, a garden and a great many people. Go and ask who built it.',
  }),
  panel: {
    title: 'Before and After, One Canal',
    caption: 'A city and a ruin painted side by side with a single canal running through both.',
    motif: 'ruin',
    threads: ['water'],
    detail: 'The stitched line of canal crosses the join between the two halves. It is the only part of the panel that is the same in both.',
  },
  witness:
    'I cut stone. Ask me about the afternoon and I will tell you what I saw, which was people carrying water in the evening, same as always.',
};
