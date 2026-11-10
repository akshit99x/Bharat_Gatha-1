import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 8 — Konark & the Observatory. "A Chariot for the Sun."
 *
 * Closes Act III with the measure motif made literal as time. The Gilder here
 * is the "ancient India knew everything" line; the Eraser is "it's pretty, it
 * means nothing". The anchor is a scholar who worked across traditions, because
 * the honest story is that knowledge moved both ways.
 */
export const konarkStory: ChapterStory = {
  zoneId: 'konark',
  title: 'A Chariot for the Sun',
  hook: [
    {
      who: 'maitri',
      text: 'A temple built as a chariot, and instruments that tell the time by shadow. Look at those wheels. They are clocks.',
    },
    {
      who: 'ekarupa',
      mask: 'eraser',
      text: 'Pretty carving. It does not mean anything. Take a photograph and move on.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'Or: ancient India knew everything. Aircraft, atoms, all of it. Why check?',
    },
  ],
  landing:
    'You began with the wheels. The two voices you hear here are the same voice talking from opposite ends. Notice that they both tell you not to check.',
  anchorNpcId: 'konark-observer',
  anchorBeats: [
    {
      after: 'konark-wheel',
      npcId: 'konark-timekeeper',
      text: 'The spokes are exact. If they were uneven, the shadow would read a different hour on each side. A pretty thing that is wrong is not pretty to me. It is a broken clock.',
    },
    {
      after: 'konark-aryabhata',
      npcId: 'konark-observer',
      text: 'Aryabhata was contradicted, and rightly in places. That is how a tradition stays honest. Anyone who tells you Aryabhata was never wrong has not read the people who corrected the work.',
    },
  ],
  plaques: [
    {
      id: 'konark-everything',
      zoneId: 'konark',
      near: 'konark-jantar',
      mask: 'gilder',
      claim: 'Ancient Indian astronomers already knew everything modern science knows.',
      shown: 'text',
      verdict: 'overstated',
      requires: ['aryabhata'],
      correction:
        'Aryabhata wrote the Aryabhatiya at twenty-three: four chapters, 121 verses. In it Aryabhata argues that the apparent daily rotation of the heavens is caused by the Earth turning on its own axis, and gives the length of the sidereal day accurately. The text explains eclipses as shadows, rejecting the demon-swallowing account; gives a sine table; and gives π as 3.1416, labelled asanna, "approximate". That is a remarkable record, and it is a record, with limits. The work was not uncontradicted: Brahmagupta, a century later, attacked several of Aryabhata’s positions, and some criticisms were right. That argument is the evidence that this was a working scientific tradition rather than a set of pronouncements.',
      nudge: {
        text: 'The achievements are real and well recorded. But the plaque says *everything*. Does the entry say anything about limits, or about being corrected?',
        unsupported: 'Not so: there is a lot to admire. The plaque goes too far, but it starts from something true.',
      },
    },
    {
      id: 'konark-decoration',
      zoneId: 'konark',
      near: 'konark-temple',
      mask: 'eraser',
      claim: 'The wheels of the Sun Temple are decoration. They carry no information.',
      shown: 'none',
      verdict: 'archaeology',
      ask: 'The plaque says the wheels do nothing. What do the wheels themselves show?',
      requires: ['shadow-timekeeping'],
      correction:
        'Konark’s wheels are about 3 m across, with eight broad major spokes and eight slender minor spokes between them. Place a finger or a rod at the axle and the shadow it throws across the rim marks time: the major spokes divide the daylight into eight parts of roughly three hours, and the minor spokes halve those again. A dial whose spokes are unevenly spaced reads a different time on each side — so the precision of the carving is not decoration, it is calibration. Local guides still demonstrate the reading, and visitors still check it against their phones.',
      nudge: {
        unsupported: 'It is easy to check: put a finger at the axle in sunlight. What kind of evidence is a thing you can test in person?',
        text: 'No old book is needed to read a sundial. The carved stone is the evidence.',
      },
    },
    {
      id: 'konark-zero',
      zoneId: 'konark',
      near: 'konark-village',
      mask: 'eraser',
      claim: 'Zero is not an Indian idea. The numerals only came to Europe by accident.',
      shown: 'none',
      verdict: 'archaeology',
      ask: 'The plaque says there is nothing Indian in the story of zero. What do the inscriptions show?',
      requires: ['zero-and-place-value'],
      correction:
        'Place-value notation needs a symbol for an empty position, and treating that symbol as a number in its own right is a further step. Brahmagupta’s Brahmasphutasiddhanta (628 CE) is the first known text to set out the arithmetic of zero and negative quantities. For the written symbol, the Gwalior inscription of 876 CE gives a clear decimal zero as a digit; the Bakhshali manuscript contains dot-zeros but its date is contested across several centuries. From India the system passed to the Islamic world, and from there to Europe, where Fibonacci popularised it in 1202. English still calls the digits Hindu-Arabic, which is an unusually accurate piece of naming.',
      nudge: {
        debate: 'Some details (the date of the Bakhshali manuscript) are contested. But the plaque’s main claim — that nothing Indian is in the story — does the evidence leave that open?',
        text: 'There are written sources, certainly. But there is also a stone: the Gwalior inscription carries a clear zero. What does the entry call that?',
      },
    },
  ],
  maker: {
    npcId: 'konark-sculptor',
    who: 'Bisu Maharana, and the Maharanas — the guild of temple sculptors',
    record:
      'Odisha’s temple sculptors worked as a hereditary guild. The famous story of twelve hundred sculptors and a boy architect is a legend. It belongs in the epic-and-folklore drawer, not the archaeology one. What the carving itself shows is a workshop of astonishing skill and discipline. The guild, not a single genius, built this.',
    source: 'archaeology',
  },
  trail: {
    id: 'konark-shadow',
    title: 'A Day on the Sundial',
    brief: 'Read the same shadow with three people who read it differently.',
    stops: [
      {
        npcId: 'konark-timekeeper',
        say: 'Divakara reads the wheel by its shadow. Fine — that is the stone. Ask the almanac-maker what the sky says: Panchangi Ratna.',
      },
      {
        npcId: 'konark-calendarist',
        say: 'Panchangi Ratna compares the shadow with the almanac and finds them in agreement. Now find the instrument-maker who builds the dial: Kesari.',
      },
      { npcId: 'konark-instrument-mason' },
    ],
    payoff:
      'A shadow, a table, a stone dial. Three ways of agreeing on what time it is, and all three have to match. That is what measurement means: an agreement that anyone can test. You can test this one with your hand.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The eighth panel is back: a great stone wheel, and in its rim a thin shadow-line that moves with the sun. It is the only panel on the island that is never quite the same twice.',
    ask: 'A visitor asks whether I could freeze the shadow at noon. "Noon looks best in photographs." Shall I?',
    options: [
      {
        label: 'Freeze it at noon. A still image is easier to share.',
        reply:
          'It is easier. But it turns a working instrument into a picture of one. I will make a copy for photographs and leave the real one moving.',
      },
      {
        label: 'Let it move. A sundial that does not move is a sculpture.',
        wise: true,
        reply:
          'Let it move. The wheel is only true while it is working, and the same is true of most of what we have been looking at.',
      },
    ],
    bridge:
      'Act III is done. Three chapters of people who wrote things down on purpose, and look how much even the scribes left out. Carved into the temple floor, a single line: "Ask who laid the stone."',
  }),
  panel: {
    title: 'The Wheel and Its Shadow',
    caption: 'A stone sun-wheel whose shadow-line follows the real sun of the island.',
    motif: 'wheel',
    threads: ['measure'],
    detail: 'The shadow-line is not painted. It is drawn from the sun’s real position in the sky above the island.',
  },
  witness:
    'We translated Euclid and the Almagest into Sanskrit, and we argued with all of it. A tradition that cannot be argued with is not a tradition. It is a monument.',
};
