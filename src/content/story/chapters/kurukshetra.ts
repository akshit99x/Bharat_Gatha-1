import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 5 — Kurukshetra. "A Family That Could Not Talk."
 *
 * Closes Act II. The anchor is Sanjaya, the epic's own reliable-narrator
 * problem: someone who sees the whole war from a distance and reports it. The
 * uncomfortable half is left in on purpose — Ekalavya's thumb sits next to
 * Drona's test.
 */
export const kurukshetraStory: ChapterStory = {
  zoneId: 'kurukshetra',
  title: 'A Family That Could Not Talk',
  hook: [
    {
      who: 'maitri',
      text: 'Dawn over the two camps. Eighteen days of war, and the longest poem in the world is really about a family that could not talk to itself. Read what Sanjaya actually says.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'Good side, bad side. Eighteen days. Easy. Why would anyone want it complicated?',
    },
    {
      who: 'maitri',
      text: 'Because it was complicated. You have heard that voice now at three borders. It does not get cleverer. It gets tidier.',
    },
  ],
  landing:
    'You came down on the field itself. Most people meet the Gita first. Notice that the poem takes eighteen days to get to the part everyone quotes, and then it spends a whole book on a conversation.',
  anchorNpcId: 'kuru-sanjaya',
  anchorBeats: [
    {
      after: 'kuru-gita',
      npcId: 'kuru-sanjaya',
      text: 'I told the king what I saw and what I heard. I did not tell the king what to feel. That was the part the king could not forgive.',
    },
    {
      after: 'kuru-calledshot',
      npcId: 'kuru-fletcher',
      text: 'The bird’s eye. Fine. But I made the arrows, and nobody asked what I saw. Ask about Ekalavya, and what the teacher demanded. That is the other half of this lesson.',
    },
  ],
  plaques: [
    {
      id: 'kuru-date',
      zoneId: 'kurukshetra',
      near: 'kuru-gate',
      mask: 'gilder',
      claim: 'The Mahabharata war happened in 3102 BCE. It is a fixed, proven date.',
      shown: 'text',
      verdict: 'debate',
      requires: ['hastinapura'],
      correction:
        'Traditional Puranic reckoning gives 3102 BCE. Astronomical reconstructions from eclipse and planetary references in the text give dates anywhere from the thirty-first to the ninth century BCE, and most academic historians place the material setting in the later Vedic period around 1000 BCE while declining to date the events at all. The honest summary is that the question is open — and that the astronomical arguments depend on assuming the verses are precise observational records, which is exactly what is in doubt.',
      nudge: {
        text: 'The date appears in a written tradition, yes. But do historians agree that it is the date? Look at how far apart the proposed dates are.',
        epic: 'The war is epic. But this plaque makes a claim about a specific date. Is that settled?',
      },
    },
    {
      id: 'kuru-heroes',
      zoneId: 'kurukshetra',
      near: 'kuru-camp-pandava',
      mask: 'gilder',
      claim: 'The epic is a simple story of heroes and villains. It never questions its own side.',
      shown: 'epic',
      verdict: 'unsupported',
      ask: 'Does the poem actually behave this way? Check the evidence before answering.',
      requires: ['drona-test'],
      correction:
        'Drona sets a wooden bird in a tree and tests the students; Arjuna sees only the bird’s eye. It is a lesson in focus. The same teacher provides the epic’s harshest counter-story: Ekalavya, a forest-dwelling prince refused instruction because of birth, teaches from a clay image of Drona and becomes the better archer, and Drona has Ekalavya give up the bow-thumb to protect Arjuna’s pre-eminence. The epic narrates this without softening it. A poem that includes that is not a poem that never questions its heroes.',
      nudge: {
        epic: 'This plaque is about the epic, yes — but is its claim true of the epic? What does the Ekalavya episode do to it?',
        debate: 'Is this one of those places where scholars split? Or does the poem simply contradict the plaque?',
      },
    },
    {
      id: 'kuru-narrator',
      zoneId: 'kurukshetra',
      near: 'kuru-vyasa',
      mask: 'eraser',
      claim: 'The Gita is a transcript, taken down word for word on the battlefield.',
      shown: 'archaeology',
      verdict: 'text',
      ask: 'The plaque claims a transcript. What does the written source say about how we received it?',
      requires: ['vyasa-transmission'],
      correction:
        'The Mahabharata is obsessively layered in narrators. Vyasa composes it, Ganesha is said to write it down, the bard Ugrashravas recites it to sages, and much of the war reaches us through Sanjaya narrating to the blind king Dhritarashtra. The Gita comes to the reader as Sanjaya reporting a conversation Sanjaya did not take part in. That is not clumsiness: a chain of narrators keeps reminding you that you are receiving an account, not witnessing an event. For a student it is a free lesson in reading sources — always ask who is speaking and what they can actually know.',
      nudge: {
        archaeology: 'Nobody has dug up a transcript. The question is about the form of the written text we have.',
        epic: 'It is epic, but this plaque is about how the text itself says it reached us. The text answers that question directly.',
      },
    },
  ],
  maker: {
    npcId: 'kuru-smith',
    who: 'The chariot-wrights and camp followers',
    record:
      'The epic is about warriors, but wars run on supply: chariots built and repaired, arrows fletched, wounds treated, meals cooked. The poem lets these people appear at its edges — Takshaka, the chariot-wright, and Uttara, of the camp followers, stand for them here. We do not know their real names. We know the war could not have happened without them.',
    source: 'epic',
  },
  trail: {
    id: 'kuru-supply',
    title: 'The Army Marches on Its Stomach',
    brief: 'Follow the war back to the people who made it possible.',
    stops: [
      {
        npcId: 'kuru-smith',
        say: 'Takshaka builds and mends the chariots. A chariot without a wright is a cart without a wheel. Now ask who fits the shafts of the arrows: the fletcher.',
      },
      {
        npcId: 'kuru-fletcher',
        say: 'Arrows, thousands of them, and every one made by a person. Take that to the healer who mends what the arrows do: Ashvini, the battlefield surgeon.',
      },
      { npcId: 'kuru-physician' },
    ],
    payoff:
      'A chariot, an arrow, a wound. Three people, and not one of them has a verse of their own. The epic is about the heroes. The war is about everyone behind them. The Dhundh would like you to forget that.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The fifth panel is back: a wide field with two armies painted in the same colour. No side is marked as good. Beneath it, in thin script, a line in Sanjaya’s voice.',
    ask: 'The panel looks unsettled. I could tint one army gold and the other grey. It would be much easier to look at. Shall I?',
    options: [
      {
        label: 'Tint them. The story is clearer when someone is the villain.',
        reply:
          'It is clearer. It is also not what the poem does. I will do it if you like — but I will remember that I did, and I will not be able to tell you the panel is faithful.',
      },
      {
        label: 'Leave them the same colour. The discomfort is the point.',
        wise: true,
        reply:
          'The same colour, then. The poem knows what it is doing: the family that could not talk to itself loses the argument on both sides. Let the panel keep saying that.',
      },
      {
        label: 'Ask Sanjaya. Sanjaya was there.',
        wise: true,
        reply:
          'A good instinct, and Sanjaya would say the same: tell what you saw, do not tell people what to feel. I will not repaint a witness.',
      },
    ],
    bridge:
      'Act II is done. You have handled the three hardest stories on this island without turning any of them into a lie. That is the whole method. Sanjaya hands you a rolled leaf: "Take this to the one who put regrets in stone." Now you meet the people who wrote things down on purpose.',
  }),
  panel: {
    title: 'Two Armies, One Colour',
    caption: 'A battlefield with both armies painted the same colour and a thin line of text below.',
    motif: 'field',
    threads: ['writing'],
    detail: 'The two armies share one banner colour. Look for the single figure who stands between them.',
  },
  witness:
    'I will tell you what I saw and what I heard. I will not tell you what to feel about it. That was never my job.',
};
