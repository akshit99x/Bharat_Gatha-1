import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 10 — Agra & Sikri. "Whose Hands Built the Tomb?"
 *
 * The Gilder's masterpiece: a monument to love, no one harmed, the builders all
 * happy. The chapter sets the signed hand against the unsigned hand — the
 * calligrapher who signed the Taj and the marble cutter who left no name — and
 * the choice offers the player the most seductive lie in the game: an invented,
 * beautiful name for someone the record has lost.
 */
export const agraStory: ChapterStory = {
  zoneId: 'agra',
  title: 'Whose Hands Built the Tomb?',
  hook: [
    {
      who: 'maitri',
      text: 'Marble geometry, a garden laid out as paradise, and an emperor who held debates. This is where the Gilder does its best work.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'A monument to love. Nobody was harmed. The builders were happy. Look at it! Who would ruin that?',
    },
    {
      who: 'maitri',
      text: 'The people who are not in the picture would, if they were asked. Let’s ask.',
    },
  ],
  landing:
    'You started at the Taj. It is the hardest place to look past, which is why it is the best place to practise. Look at the white, and then look at the edges.',
  anchorNpcId: 'agra-mason',
  anchorBeats: [
    {
      after: 'agra-pietradura',
      npcId: 'agra-stonecutter-girl',
      text: 'Every petal is cut to a hair. If it is off by a grain of sand, the whole border shows it. We learn it by doing it wrong for a year.',
    },
    {
      after: 'agra-ibadatkhana',
      npcId: 'agra-painter',
      text: 'I painted what I was shown. The court asked me to paint it kind. Ask yourself who commissions a picture, and who does not.',
    },
  ],
  plaques: [
    {
      id: 'agra-hands',
      zoneId: 'agra',
      near: 'agra-bazaar',
      mask: 'gilder',
      claim: 'Shah Jahan had the hands of the Taj Mahal’s workers cut off, so that nothing so beautiful could ever be made again.',
      shown: 'text',
      verdict: 'unsupported',
      requires: ['taj-workforce'],
      correction:
        'Contemporary accounts and surviving records describe a workforce of roughly twenty thousand over two decades: quarrymen at Makrana, bullock teams and ramps to move marble, masons, inlay specialists, calligraphers, scaffolders, water-carriers and the clerks who paid them. Some are named in the ledgers; most are not. A workmen’s settlement grew next to the site and became the neighbourhood still called Taj Ganj. The frequently repeated story that the workers’ hands were cut off has no contemporary evidence behind it and is rejected by historians. A building this famous attracts invented stories as reliably as it attracts visitors.',
      nudge: {
        text: 'The workforce is in the written record. But is there a written record of this particular claim? Search the entry for it.',
        epic: 'It sounds like a legend, and it is one. But the entry is clear on what the record actually shows about it.',
        debate: 'Do historians split on this? Read what the entry says about historians’ view of the claim.',
      },
    },
    {
      id: 'agra-charbagh-myth',
      zoneId: 'agra',
      near: 'agra-charbagh',
      mask: 'gilder',
      claim: 'The Taj’s gardens were designed from scratch for the Taj, and are purely decorative.',
      shown: 'text',
      verdict: 'overstated',
      requires: ['charbagh'],
      correction:
        'The charbagh — "four gardens" — is a square divided into quadrants by raised walkways carrying water channels, with a tank or pavilion where the axes cross. The form came from Persia and Timurid Central Asia and was adapted in India at Humayun’s Tomb and then at the Taj. It is irrigation as much as symbolism: the channels water the beds, the raised walkways keep feet dry. The Taj’s garden is a masterpiece within a tradition, not an invention from nothing. And at the Taj the tomb sits at the end of the garden rather than the centre, which is unusual and still argued over.',
      nudge: {
        text: 'Written plans survive, but the real question is whether the claim is accurate. Read the first paragraph of the entry for the history of the form.',
        unsupported: 'The garden is a real, documented feature. The plaque is not false, only stretched.',
      },
    },
    {
      id: 'agra-tolerance',
      zoneId: 'agra',
      near: 'agra-sikri',
      mask: 'gilder',
      claim: 'Akbar’s tolerance proves that Mughal rule was always tolerant.',
      shown: 'text',
      verdict: 'overstated',
      requires: ['akbar-sulh-i-kul'],
      correction:
        'Akbar convened scholars of several traditions — Muslim ulama, Brahmin pandits, Jain munis, Zoroastrian priests and Jesuits from Goa — for debates in the Ibadat Khana. Akbar abolished the pilgrimage tax and the jizya on non-Muslims and appointed Hindus including Raja Todar Mal and Raja Man Singh to the highest offices. The policy was sulh-i-kul, "peace with all". The limits matter as much as the achievement. This was the policy of one ruler, not a constitutional settlement, and Aurangzeb reimposed the jizya in 1679. A tolerance that depends on the character of a king is only ever on loan.',
      nudge: {
        text: 'Akbar’s policy is real and documented. But does it prove *always*? Look at what happened after.',
        unsupported: 'Akbar’s policy is real, and well attested. The plaque stretches it, not invents it.',
      },
    },
  ],
  maker: {
    npcId: 'agra-calligrapher',
    who: 'Amanat Khan, who signed the Taj — and Puran, who did not',
    record:
      'The calligrapher’s name is on the Taj: Amanat Khan signed the inscriptions. The marble cutters, the inlay workers and the water-carriers left no names, though some appear in ledgers. The comparison is the point. The same building holds the signed hand and the unsigned ones. Puran stands for the unsigned.',
    source: 'text',
  },
  trail: {
    id: 'agra-hands-trail',
    title: 'The Inlay Apprentice',
    brief: 'Follow the marble from quarry to monument, through the hands that did the work.',
    stops: [
      {
        npcId: 'agra-mason',
        say: 'Puran brings marble from Makrana and cuts it to size. Nobody put a name on it. Now find the apprentice who cuts the inlay: Zarina.',
      },
      {
        npcId: 'agra-stonecutter-girl',
        say: 'Zarina cuts the petals to a hair. The border will carry that work for four hundred years, and the name of its cutter nowhere. Last: Bhishti Ramzan, who carries the water that mortars every wall.',
      },
      { npcId: 'agra-water-carrier' },
    ],
    payoff:
      'Quarry, inlay, water. Nobody on this trail signed the building, and every one of them is in the record of what it took. The marble is one thing. The twenty thousand are another. The Taj is both.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The tenth panel is back: the Taj in white, and a section of the border left deliberately unpainted. A tiny label beneath it reads: "for Puran, and the others".',
    ask: 'A visitor offers to fill the blank with an invented name, a beautiful one, so the border looks finished. "It would be a kindness." Shall I?',
    options: [
      {
        label: 'Accept the beautiful name. It would be a kindness.',
        reply:
          'It would feel like one. But a name we invented is not a name the person had, and the next visitor would read it as a record. A lovely lie is still a lie. I will keep it as a story, not a signature.',
      },
      {
        label: 'Leave the blank. An honest blank is a better monument than a lovely lie.',
        wise: true,
        reply:
          'Blank, then, and labelled. Someone made this border, and we do not know who. Saying so is the only respect we can offer that is also true.',
      },
    ],
    bridge:
      'Bichitr’s miniature, in the last gallery of the atelier, shows a fort on a hill in the west, a man on a horse, and a cistern cut into the rock. It is not an emperor’s picture. Go and see it.',
  }),
  panel: {
    title: 'The Border Left Blank',
    caption: 'The Taj in white with a stretch of the border deliberately left unpainted, labelled for those whose names are lost.',
    motif: 'tomb',
    threads: ['writing', 'water'],
    detail: 'The unpainted stretch of border is the exact width of the label. The blank is as carefully measured as everything else.',
  },
  witness:
    'My name is on the gate. The marble-cutter’s is on nothing. When you walk away from here, remember the one who is not in the inscription.',
};
