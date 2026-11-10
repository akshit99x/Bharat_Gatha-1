import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 11 — The Hill Forts. "Where Geography Is the General."
 *
 * The last chapter. Gilder and Eraser fuse: a battle painted entirely glorious
 * in one panel and entirely meaningless in the next. The water motif completes
 * here — no fort holds without a cistern — and the last comfort/open fork is
 * the most ordinary one in the game: whether to tidy a ledger.
 */
export const marathaStory: ChapterStory = {
  zoneId: 'maratha',
  title: 'Where Geography Is the General',
  hook: [
    {
      who: 'maitri',
      text: 'The last chapter. Forts, queens, spies, water, and a lot of historians arguing. Where geography is the general. Notice how many of the great stories here are really about hydrology.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'A glorious victory. One side, one story, no doubt.',
    },
    {
      who: 'ekarupa',
      mask: 'eraser',
      text: 'Or: it was only a skirmish. It means nothing. Which do you prefer?',
    },
    {
      who: 'maitri',
      text: 'It is using both voices at once now. It has run out of patience. So we are almost done.',
    },
  ],
  landing:
    'You began at the last panel. That is allowed. But you may find it makes more sense when you know how the other ten ended.',
  anchorNpcId: 'maratha-waterkeeper',
  anchorBeats: [
    {
      after: 'maratha-fortify',
      npcId: 'maratha-builder',
      text: 'I built ghats and wells and rest-houses across the country. People remember the battles. I am happy to be remembered for the wells.',
    },
    {
      after: 'maratha-shivaji',
      npcId: 'maratha-mawal',
      text: 'We did not fight like armies, because we were not armies. We fought like people who knew every stone of these hills. That is the whole method, and it was enough.',
    },
  ],
  plaques: [
    {
      id: 'maratha-haldighati',
      zoneId: 'maratha',
      near: 'maratha-tower',
      mask: 'gilder',
      claim: 'Haldighati was a clear and total victory for one side.',
      shown: 'text',
      verdict: 'debate',
      requires: ['haldighati'],
      correction:
        'Maharana Pratap of Mewar met a Mughal force commanded by Raja Man Singh of Amber in a narrow pass at Haldighati in June 1576. Both sides claimed the day; the battle was tactically inconclusive, Pratap escaped, and the Mughals took Gogunda but could not hold the countryside. What followed matters more: Pratap spent years fighting a mobile campaign from the hills and recovered most of Mewar before Pratap’s death in 1597. The two traditions remember it differently — Rajput bardic sources as a heroic stand, Mughal chronicles as a victory. Reading both is the only honest way to handle it.',
      nudge: {
        text: 'There are written sources, yes — but they disagree about who won. Which box holds a claim where the sources themselves conflict?',
        overstated: 'It is more than stretched: the sources actually disagree. What do you call an argument that cannot be settled by looking?',
      },
    },
    {
      id: 'maratha-bravery',
      zoneId: 'maratha',
      near: 'maratha-fort',
      mask: 'gilder',
      claim: 'Hill forts were held by courage alone. Water and stone had little to do with it.',
      shown: 'epic',
      verdict: 'archaeology',
      ask: 'The plaque says water did not matter. What do the forts themselves show?',
      requires: ['fort-water'],
      correction:
        'Every serious hill fort has cisterns cut into living rock — roofed or deeply sunk against evaporation, filled by the monsoon, and sized for a year or more of occupation. Raigad, Sinhagad, Kumbhalgarh and Chittorgarh all have substantial tank systems, and some are still full. That is why water is the first thing a besieger looks for and the first thing a fort architect solves. Walls can be repaired under fire; a dry cistern cannot be refilled in June. Most dramatic siege stories are, underneath, hydrology.',
      nudge: {
        epic: 'Ballads celebrate courage. But the cisterns are cut into the rock itself. What kind of evidence is that?',
        unsupported: 'You can see the tanks in the stone. That is a lot of evidence.',
      },
    },
    {
      id: 'maratha-regent',
      zoneId: 'maratha',
      near: 'maratha-temple',
      mask: 'eraser',
      claim: 'Ahilyabai Holkar was only a figurehead. The real work was done by the men around the throne, and almost nothing of Ahilyabai’s own survives.',
      shown: 'none',
      verdict: 'text',
      ask: 'The plaque says almost nothing of Ahilyabai’s own survives. What do the written sources say?',
      requires: ['ahilyabai'],
      correction:
        'Widowed and then bereaved of a son, Ahilyabai took over the Holkar state of Malwa and ruled it for nearly thirty years from Maheshwar on the Narmada. Ahilyabai is remembered almost entirely for public works: ghats, wells, roads, rest-houses and temples from Varanasi to Somnath to Rameswaram, including the rebuilding of the Kashi Vishwanath temple in 1780. Ahilyabai also held the state together militarily and administratively in a crowded and hostile Deccan, and heard petitions in person. The most durable things any of these rulers built were not victories.',
      nudge: {
        unsupported: 'There is a lot of evidence of Ahilyabai’s work. Look at the entry.',
        debate: 'Historians do not dispute that Ahilyabai ruled. The plaque is not about a contested point.',
      },
    },
  ],
  maker: {
    npcId: 'maratha-waterkeeper',
    who: 'The keepers of the cisterns',
    record:
      'A fort is only as strong as its water. The people who cleaned the tanks, patched the channels and watched the monsoon are almost never named in the chronicles, though the whole siege depended on them. Sakhubai stands for them. We know the cisterns existed and that they were sized for a year. We do not know their names.',
    source: 'archaeology',
  },
  trail: {
    id: 'maratha-ledger',
    title: 'The Bakhar Clerk',
    brief: 'Read the fort’s paperwork: who paid for it, who kept it, who wrote it down.',
    stops: [
      {
        npcId: 'maratha-clerk',
        say: 'Balaji keeps the ledger. A ledger is not a chronicle; it records what was spent, not what was felt. Now go and ask the armourer who the money was spent on: Sakharam.',
      },
      {
        npcId: 'maratha-smith',
        say: 'Sakharam’s work is on the ledger and nowhere else. Last stop: the hill scout, Yesaji, who knows what the ledger does not.',
      },
      { npcId: 'maratha-scout' },
    ],
    payoff:
      'A clerk, a smith, a scout. The ledger tells you what was spent. The scout tells you what it was spent on. Neither is the chronicle, and each corrects the other. Almost all history is that: someone checking one record against another.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The last panel is back: a fort on its hill, and beneath it a long, thin line that is the cistern. It runs the whole width of the panel. Water, writing and measure — you have been carrying three threads across ten panels without knowing it.',
    ask: 'The clerk offers to "tidy up" a discrepancy in the ledger, one small figure that does not match, so the fort’s account reads more heroically. Shall I let the clerk?',
    options: [
      {
        label: 'Tidy it. A clean account is a better story.',
        reply:
          'It would read better. It would also be the exact thing the Dhundh does, in the smallest possible way: one figure, nudged to flatter. I will keep the original in a note, so the nudge can be found.',
      },
      {
        label: 'Leave the discrepancy. It tells us something.',
        wise: true,
        reply:
          'Left. A figure that does not match is a clue: a repair, a loan, a mistake, a lie. Tidied, it would tell us nothing. Untidied, it still might.',
      },
    ],
    bridge:
      'That is the eleventh panel. All of them are hanging in the air around you, and they do not quite touch. Three threads run across all of them, in the wrong order, tangled. Now we find out what you have learned. Open the scroll and call the Sabha.',
  }),
  panel: {
    title: 'The Fort and the Cistern',
    caption: 'A hill fort above a long, thin cistern running the full width of the panel.',
    motif: 'fort',
    threads: ['water', 'writing', 'measure'],
    detail: 'All three threads — water, writing and measure — meet in the cistern line. It is the only place on the island where they cross.',
  },
  witness:
    'You want to know why the fort held? Ask what was in the tank. Everything else is a story we tell about the tank.',
};
