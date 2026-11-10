import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 3 — Kosala & Dandaka. "Three Hundred Ramayanas."
 *
 * Act II is the delicate one. The epic is a living culture and the story treats
 * it as one. The Dhundh's lie here is never "this is sacred"; it is only ever
 * "this is a dig report" (the Gilder) or "this is nothing" (the Eraser).
 * Ekarupa speaks directly to the player for the first time.
 */
export const kosalaStory: ChapterStory = {
  zoneId: 'kosala',
  title: 'Three Hundred Ramayanas',
  hook: [
    {
      who: 'maitri',
      text: 'Different kind of evidence now. This is not a tablet and not a dig. It is a story, told for two thousand years by people who loved it. We are going to treat it exactly as that.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'There it is. One story. Why would you want three hundred of them?',
    },
    {
      who: 'maitri',
      text: 'Because that is how it lived. Don’t answer it. It cannot hurt you if you do not answer.',
    },
  ],
  landing:
    'You started inside the epic. Fine — it is a good place to learn that a story can be true in a way a tablet cannot, and false in ways a tablet can.',
  anchorNpcId: 'kosala-potter',
  anchorBeats: [
    {
      after: 'kosala-manyramayanas',
      npcId: 'kosala-potter',
      text: 'My grandmother’s Ramayana was not my neighbour’s. Both of us were sure we had it right. We were both telling the truth about what the story was for.',
    },
    {
      after: 'kosala-herbs',
      npcId: 'kosala-physician',
      text: 'Some of what you picked is named in the text. Some of it has been identified by people with hand lenses and herbaria. Keep those two lists apart in your head.',
    },
  ],
  plaques: [
    {
      id: 'kosala-report',
      zoneId: 'kosala',
      near: 'kosala-ayodhya',
      mask: 'gilder',
      claim: 'The Ramayana is a news report. Every detail in it has been confirmed by archaeology.',
      shown: 'archaeology',
      verdict: 'epic',
      requires: ['ramayana-overview'],
      correction:
        'The Sanskrit Ramayana attributed to Valmiki runs to roughly 24,000 verses in seven books. Scholars date its core somewhere between the fifth century BCE and the third century CE, composed and reworked over many generations rather than written once. It is a sustained examination of obligation — to a parent, a promise, a spouse, a subject, an ally, an enemy. That makes it cultural truth of a very high order. It does not make it a dig report, and treating it as one does the poem no favours.',
      nudge: {
        archaeology: 'Look at what the codex says about how the poem was composed. Is that how a dig report comes into being?',
        text: 'It is certainly written down. But the question is what kind of thing it is. A reworked, retold, many-generation tradition — which box does that belong in?',
      },
    },
    {
      id: 'kosala-one',
      zoneId: 'kosala',
      near: 'kosala-ashram',
      mask: 'eraser',
      claim: 'There is only one Ramayana. All the others are corruptions of it.',
      shown: 'none',
      verdict: 'text',
      ask: 'The plaque says the others do not count. What does the written record show?',
      requires: ['many-ramayanas'],
      correction:
        'Kamban’s Tamil Ramavataram, Molla’s Telugu Ramayanam, Krittibas’s Bengali version, Tulsidas’s Ramcharitmanas in Awadhi, the Jain Paumacariya with its more dignified Ravana — they survive on paper, and they disagree on purpose. Some centre Sita’s suffering and judge Rama for it; some omit the last book. The scholar A. K. Ramanujan argued there is no single original with later copies, but a field of tellings in conversation. The useful question about any version is not "is it accurate?" but "what is this teller trying to say?"',
      nudge: {
        epic: 'The tradition is epic, yes. But this plaque makes a claim about texts — how many versions exist and how they relate. We can check that on the page.',
        unsupported: 'There is a great deal behind the many versions: they survive, in print and manuscript. Look at the list in the entry.',
      },
    },
    {
      id: 'kosala-abroad',
      zoneId: 'kosala',
      near: 'kosala-village',
      mask: 'eraser',
      claim: 'The story never left India. It is a local tale with no wider life.',
      shown: 'none',
      verdict: 'text',
      ask: 'The plaque says the story stayed home. What kind of evidence says it did not?',
      requires: ['ramayana-abroad'],
      correction:
        'Thailand has the Ramakien, painted along the galleries of the royal temple in Bangkok. Java has the Old Javanese Kakawin Ramayana and an all-night wayang tradition; Cambodia the Reamker, carved at Angkor Wat; Laos, Malaysia, Myanmar and the Philippines have their own tellings. None of it was imposed by conquest. It travelled with traders, monks and scholars across the Bay of Bengal, and each culture localised it. It is one of the clearest examples anywhere of a story becoming shared heritage rather than a cultural export.',
      nudge: {
        epic: 'Careful: the story is epic, but this plaque is about whether it travelled. We know it travelled because of surviving texts and carvings.',
        archaeology: 'The carvings at Angkor are archaeology, yes — but the entry rests mostly on named, dated written versions. Which fits better?',
      },
    },
  ],
  maker: {
    npcId: 'kosala-reciter',
    who: 'The reciters who carried the poem on their tongues',
    record:
      'A tradition this old was kept alive less by any one author than by thousands of people who learned it, performed it and changed it a little. Lava, the young reciter at the ashram, stands for them. We do not have their names. We have what they kept.',
    source: 'epic',
  },
  trail: {
    id: 'kosala-clay',
    title: 'Who Tells It Best',
    brief: 'Ask three people in Ayodhya which version they grew up with.',
    stops: [
      {
        npcId: 'kosala-potter',
        say: 'Revati grew up with a grandmother’s version. Fair enough. Now ask someone whose job is the forest: Guha, the boatman on the Sarayu.',
      },
      {
        npcId: 'kosala-forester',
        say: 'Guha’s version lingers on the river crossing, naturally. Two versions already, and neither one is wrong. One more: the young reciter, Lava.',
      },
      { npcId: 'kosala-reciter' },
    ],
    payoff:
      'Three people, three tellings, one story. Nobody got it "wrong". Each told it from where they stood. That is how this kind of evidence behaves, and it is not a flaw. It is the thing you are reading.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The third panel is back, and it is the strangest one yet: the same scene painted three times in three styles, side by side, none of them marked as the original.',
    ask: 'A child at the edge of the panel asks which of the three is the real one. What do I tell them?',
    options: [
      {
        label: 'Tell them the one you like best is the real one.',
        reply:
          'That is exactly what most of us do, and it is why the tradition has survived: we each keep the one we love. But it would be a small lie to call it the only one. I will tell them it is their favourite.',
      },
      {
        label: 'Tell them all three are tellings, and each says something different about the story.',
        wise: true,
        reply:
          'That is the answer, and it is better than a ranking. Three tellings, three teachers, three reasons. They can love one and still read the other two.',
      },
    ],
    bridge:
      'Guha rows you across the strait. At low tide the next shore has a causeway that does not quite break the surface. Is it a bridge, or a shoal? Ask the person who measured it, and then ask the person who tells the story. They are not the same person, and they do not need to be.',
  }),
  panel: {
    title: 'One Scene, Three Hands',
    caption: 'The same scene painted three times in three styles, none marked as the original.',
    motif: 'threeStyles',
    threads: ['writing'],
    detail: 'The three borders are different colours. The child at the edge is the only figure that appears in all three.',
  },
  witness:
    'You are asking me whether it is true. I can tell you what it is for. If you want to know whether it is a dig report, you have already been to the dig.',
};
