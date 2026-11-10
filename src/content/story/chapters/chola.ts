import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 7 — The Chola Country. "Ballots from a Pot."
 *
 * The state measuring itself, in stone and in Tamil. The Gilder's most tempting
 * line is "the Cholas had democracy a thousand years ago", which the README
 * already refuses by name. The right answer is not "no" but "overstated": the
 * achievement — rule-bound, auditable, rotating local government — is real,
 * and bigger than the flattery.
 */
export const cholaStory: ChapterStory = {
  zoneId: 'chola',
  title: 'Ballots from a Pot',
  hook: [
    {
      who: 'maitri',
      text: 'A country that wrote its administration on the walls of its temples. Granite, bronze and village ballots drawn from a pot. This is the state measuring itself.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'The Cholas had a democracy a thousand years ago. Say it. It is such a pleasing sentence.',
    },
    {
      who: 'maitri',
      text: 'It is. Read the wall before you repeat it.',
    },
  ],
  landing:
    'You began among the temples. Good: this is the one place where the stone itself explains how the village chose its committees. Read the inscription before you read anyone’s summary of it.',
  anchorNpcId: 'chola-sthapati',
  anchorBeats: [
    {
      after: 'chola-lostwax',
      npcId: 'chola-caster',
      text: 'Wax, clay, fire, metal, and break the mould. Every bronze is one of a kind because the mould dies to make it. Remember that next time someone calls a thing "mass produced".',
    },
    {
      after: 'chola-ballot',
      npcId: 'chola-accountant',
      text: 'You saw the rule: anyone who had not submitted accounts was barred. Everyone who served had to be audited. That is the part I would carve in gold, if I were allowed.',
    },
  ],
  plaques: [
    {
      id: 'chola-democracy',
      zoneId: 'chola',
      near: 'chola-assembly',
      mask: 'gilder',
      claim: 'The Chola village assemblies were a democracy, just like ours.',
      shown: 'text',
      verdict: 'overstated',
      requires: ['uttaramerur'],
      correction:
        'The Uttaramerur inscriptions from about 920 CE set out how the village assembly chose its committees: wards, nominated candidates, palm-leaf tickets drawn from a pot by a young boy. The qualifications include owning tax-paying land and knowing prescribed texts. The disqualifications are longer and more revealing: anyone who had not submitted accounts, or whose relatives had not, or who had served in the last three years, was barred. So: written rules, property and literacy qualifications, compulsory audit, a lottery and term limits — in the tenth century. It is not universal suffrage, and calling it "ancient democracy" oversells it. The genuine achievement is rule-bound, auditable, rotating local government.',
      nudge: {
        text: 'The inscription is a written source — but does the plaque say more than the inscription does? Look at who was eligible.',
        archaeology: 'The wall is the evidence. But does the evidence say "democracy like ours"? Read the qualifications.',
        unsupported: 'There is a lot of evidence — enough to say something remarkable. The plaque only stretches it too far.',
      },
    },
    {
      id: 'chola-capstone',
      zoneId: 'chola',
      near: 'chola-temple',
      mask: 'gilder',
      claim: 'The tower of the great temple was lifted by a miracle. No engineering was involved.',
      shown: 'epic',
      verdict: 'archaeology',
      ask: 'The plaque says no engineering was involved. What do the stones themselves show?',
      requires: ['brihadeeswarar'],
      correction:
        'The vimana — about 66 m high, built of granite in diminishing storeys — has no mortar. The blocks are cut to interlock and held by weight and geometry, and the whole is crowned by a monolithic capstone on the order of 80 tonnes. Granite is not local to the Kaveri delta, so the stone was quarried and moved a considerable distance. Local tradition says the ramp used to raise the capstone began several kilometres away at a village still called Sarapallam, "the hollow of the scaffold". The temple has stood through earthquakes for over a thousand years. That is engineering, and the evidence for it is the building itself.',
      nudge: {
        epic: 'A miracle would be a story. The temple is a thing you can measure. What kind of evidence is a standing building?',
        debate: 'Is there any real disagreement that it was built by people with tools? The open arguments are about details, not about whether it needed engineering.',
      },
    },
    {
      id: 'chola-landlocked',
      zoneId: 'chola',
      near: 'chola-harbour',
      mask: 'eraser',
      claim: 'The Cholas never left the coast. Medieval South India had no navy and no overseas reach.',
      shown: 'none',
      verdict: 'text',
      ask: 'The plaque says there is no record of overseas reach. What do the written sources say?',
      requires: ['chola-navy'],
      correction:
        'Rajendra I sent a naval expedition across the Bay of Bengal against Srivijaya around 1025 CE. The Thanjavur inscriptions list the ports taken, which is how we know it happened. The target was the Strait of Malacca — the chokepoint for all China trade — and the aim was leverage over that trade, not settlement. The Cholas also took Sri Lanka, raided the Maldives and kept diplomatic contact with Song China, where Chola embassies are recorded. Behind the fleet stood the merchant guilds, whose inscriptions turn up as far as Sumatra. Medieval South India was a maritime power, which is the part most often left out of textbooks.',
      nudge: {
        unsupported: 'There is a good deal of evidence: inscriptions list the ports taken. Look at the entry.',
        archaeology: 'The inscriptions are stone, yes, but the entry files it under written source. What are they carrying?',
      },
    },
  ],
  maker: {
    npcId: 'chola-sthapati',
    who: 'Kunjaramallan Rajaraja Perunthachchan, and the accountants who recorded the work',
    record:
      'The great temple’s inscriptions credit a master builder by name — a rarity, and one of the few architects’ names we have from medieval India. Beside that name stand the people whose ledgers are how we know anything at all: the temple accountants, whose donation records fill the walls.',
    source: 'text',
  },
  trail: {
    id: 'chola-audit',
    title: 'Follow the Audit',
    brief: 'The temple pays, the accountant records, the assembly checks. Walk the chain.',
    stops: [
      {
        npcId: 'chola-ricefarmer',
        say: 'Ponni farms the delta. The harvest is taxed in rice. Now find the person who counts it: Karanattan, the temple accountant.',
      },
      {
        npcId: 'chola-accountant',
        say: 'Karanattan counts it, writes it and has it checked. Every figure on the wall is somebody’s signature on a promise. Go and ask the builder, Kunjaramallan, what the figures bought.',
      },
      { npcId: 'chola-sthapati' },
    ],
    payoff:
      'Field, ledger, temple. The surprise of this chapter is how much of its glory is bookkeeping. The Cholas built tanks and temples because they could count what they had, and prove it on a wall. That is a better compliment than the word democracy.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The seventh panel is back: granite and bronze, and a very small signature in the lower corner. Kunjaramallan’s. It is one of the smallest things on the whole island, and it is the one thing the panel could not do without.',
    ask: 'Someone suggests removing the signature so the temple looks like it was made by the god alone, with no human hand to distract. Shall I?',
    options: [
      {
        label: 'Remove it. A temple should look divine, not credited.',
        reply:
          'It would look more serene. It would also be less true, and the builder signed it for a reason. I will cover it with a cloth for the pilgrims, and keep the signature underneath.',
      },
      {
        label: 'Keep it. The signature is part of the record.',
        wise: true,
        reply:
          'Kept. The builder signed the stone, and then the temple stood for a thousand years. The signature outlived the argument about whether to put it there.',
      },
    ],
    bridge:
      'Among the donations on the wall, a bronze Nataraja stands over a note about a sundial. Navigators and astronomers lived in the same century as these temple builders, and on the other coast a temple has been built as a chariot for the sun. Go and read the shadow.',
  }),
  panel: {
    title: 'Granite and a Signature',
    caption: 'A temple tower in diminishing storeys with a tiny signature in the corner.',
    motif: 'granite',
    threads: ['water', 'measure'],
    detail: 'The signature is the same size as the smallest block in the tower. Find it before you open the next panel.',
  },
  witness:
    'I signed it. It is small, and it is there. I wanted whoever came after to know that a person had done this, and that the person knew what they were doing.',
};
