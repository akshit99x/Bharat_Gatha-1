import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 4 — The Setu & Lanka. "The Hardest Choice."
 *
 * The oldest design trick in the game, made literal: two witnesses across time
 * who never meet. Nala builds the causeway in the epic; Dr. Meena Fernando
 * surveys the shoal in the present. They ask the same question — what holds it
 * up? — and the player carries answers between them.
 */
export const setuLankaStory: ChapterStory = {
  zoneId: 'setu-lanka',
  title: 'The Hardest Choice',
  hook: [
    {
      who: 'maitri',
      text: 'Low tide. Look down the line of the shoal. Two people on this shore are asking the same question, an age apart. Your job is to carry the answers between them.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'The bridge is definitely man-made. Scientists agree. Why not simply say so? Everyone will be so pleased.',
    },
    {
      who: 'maitri',
      text: 'Do they agree? Go and ask the person with the sounding line.',
    },
  ],
  landing:
    'You began at the water’s edge. It is a hard place to start — two kinds of truth meet here, and the Dhundh wants you to merge them.',
  anchorNpcId: 'setu-geologist',
  anchorBeats: [
    {
      after: 'setu-build',
      npcId: 'setu-engineer',
      text: 'We did not conjure it. We surveyed, we gathered, we organised teams. A causeway is a piece of logistics. The poet understood that, which is why the poem spends so long on it.',
    },
    {
      after: 'setu-vibhishana',
      npcId: 'setu-cook',
      text: 'Vibhishana crossed the water to the other side. Whatever you think of the reasons, that took more courage than anything the soldiers did. Ask yourself who fed them.',
    },
  ],
  plaques: [
    {
      id: 'setu-manmade',
      zoneId: 'setu-lanka',
      near: 'setu-boulders',
      mask: 'gilder',
      claim: 'Adam’s Bridge is a man-made structure built thousands of years ago. Science has proved it.',
      shown: 'archaeology',
      verdict: 'unsupported',
      requires: ['adams-bridge-geology'],
      correction:
        'Between Rameswaram and Mannar runs a chain of shoals, sandbanks and coral roughly 48 km long, in water mostly 1–10 m deep. Cores and surveys describe it as a natural formation: old beach ridges, sand spits and coral built up along a shallow ridge during periods of lower sea level. No survey has produced evidence of construction. The epic account of a crossing is culturally important, and the shoal is a natural feature. Both statements can be true. Keeping them in separate boxes is the whole skill.',
      nudge: {
        epic: 'The epic story of the crossing belongs in that box. But this plaque says science proved the shoal itself was built. What did the surveys find?',
        debate: 'Ask what the surveys actually produced: any trace of building, or the reverse?',
      },
    },
    {
      id: 'setu-nothing',
      zoneId: 'setu-lanka',
      near: 'setu-bridge',
      mask: 'eraser',
      claim: 'The bridge in the Ramayana is just an invention. It tells us nothing worth knowing.',
      shown: 'none',
      verdict: 'epic',
      ask: 'The plaque says the episode is worthless. What kind of source is it, and what is it good for?',
      requires: ['ram-setu'],
      correction:
        'In the Yuddha Kanda the alliance has to cross from the mainland to Lanka. Valmiki names an engineer, Nala, who directs the work: the sea is petitioned, then surveyed; materials are gathered and teams organised; the crossing takes days. What is interesting is how procedural it is — the epic treats a feat of logistics as worth narrating at length. It is not a survey report. It is cultural truth: a poem that thinks organisation and engineering are as heroic as a battle.',
      nudge: {
        unsupported: 'The story exists, it is old, and it carries a view of the world. That is something. What box holds a story like that?',
        archaeology: 'There is no dig behind this passage. It is a poem. What does the codex call that?',
      },
    },
    {
      id: 'setu-lanka-where',
      zoneId: 'setu-lanka',
      near: 'setu-lankafort',
      mask: 'gilder',
      claim: 'Ravana’s Lanka was a real city, found and mapped, exactly where the poem says.',
      shown: 'archaeology',
      verdict: 'epic',
      requires: ['lanka-city'],
      correction:
        'Valmiki describes Lanka as a wealthy, well-governed, strongly fortified capital: ramparts and moats, ordered streets, gardens, music and a court of learned counsellors. Ravana is given a formidable education — a scholar, a musician, an astrologer — which is what makes the character a tragedy rather than a monster. That characterisation is deliberate. The poem’s argument is that learning and power do not immunise anyone against a single ungoverned appetite. It is a poet’s city, built for a reason.',
      nudge: {
        archaeology: 'Is there a find, a site, a plan you can walk? Or is the city described to make a point?',
        text: 'It is written down, certainly. But the poem describes Lanka to make a moral point, not to give a survey. Which box fits a description that serves a story?',
      },
    },
  ],
  maker: {
    npcId: 'setu-engineer',
    who: 'The engineers whose names the tradition kept',
    record:
      'The epic does something unusual: it names its engineer. Nala directs the work, and the passage spends time on the surveying, gathering and team organisation. Whether Nala existed is not a question the evidence can answer. That the poem thought the engineer worth remembering says something about the people who told it.',
    source: 'epic',
  },
  trail: {
    id: 'setu-soundings',
    title: 'Depth Soundings',
    brief: 'Carry the question — what holds it up? — between three people on the shore.',
    stops: [
      {
        npcId: 'setu-surveyor',
        say: 'Nila reads the sounding line: shallow, then shallower, then a ridge. That is data. Now ask the geologist what the ridge is made of.',
      },
      {
        npcId: 'setu-geologist',
        say: 'Dr. Fernando says: old beach ridges, sand, coral. Natural. Now take that to the engineer, Nala, and see what the poem makes of the same sea.',
      },
      { npcId: 'setu-engineer' },
    ],
    payoff:
      'One shore, two questions, and no contradiction. The geologist says what the shoal is. The poet says what crossing it means. Neither is a worse kind of truth, only a different kind. Never ask one to do the other’s job.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The fourth panel is back: a sea in the middle, and across it the Setu drawn as a faint dotted line — half bridge, half shoal, exactly as the evidence leaves it.',
    ask: 'Someone asks me to firm up the dotted line into a solid one. "Just so it looks like a bridge." Shall I?',
    options: [
      {
        label: 'Make it solid. It will look better, and people will remember it.',
        reply:
          'It would look better. People would remember it. And the next person who read the panel would think the surveyors had found a built bridge, which they have not. I will draw it as the evidence leaves it.',
      },
      {
        label: 'Leave it dotted. The panel should show the shoal and the story both.',
        wise: true,
        reply:
          'Dotted it stays. Notice how much that one line carries: the shoal that is there, the crossing the poem narrates, and the gap between them that we promised to keep honest.',
      },
    ],
    bridge:
      'Nala’s last word: "Every stone in that bridge was carried by someone. Remember that before the next battlefield." Beyond the strait the ground rises to a field where two armies stand facing each other.',
  }),
  panel: {
    title: 'The Dotted Causeway',
    caption: 'A sea with the Setu shown half as a bridge and half as a shoal.',
    motif: 'causeway',
    threads: ['water'],
    detail: 'The dotted line is exactly as long as the shoal in the geology entry. Count the dots.',
  },
  witness:
    'I will tell you what holds it up: sand, coral and a very old ridge. And I will tell you what the poet says holds it up: teams, planning and nerve. Neither of us is lying.',
};
