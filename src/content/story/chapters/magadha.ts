import type { ChapterStory } from '../types';
import { restoration } from '../author';

/**
 * Chapter 6 — Magadha. "An Emperor's Apology."
 *
 * Opens Act III, the written sources. The Brahmi matching game completes the
 * writing motif's trilogy — unreadable (Indus), readable (cuneiform),
 * readable-because-someone-worked-it-out (Brahmi) — and the maker the chapter
 * restores is the stonecutter, not the emperor.
 */
export const magadhaStory: ChapterStory = {
  zoneId: 'magadha',
  title: 'An Emperor’s Apology',
  hook: [
    {
      who: 'maitri',
      text: 'Finally an Indian voice we can read in the original, on the original stone. Ashoka’s edicts are the oldest Indian writing we can actually read. One of them is an apology.',
    },
    {
      who: 'ekarupa',
      mask: 'gilder',
      text: 'An emperor. Of course the emperor was perfect. Why spoil a good monument with details?',
    },
    {
      who: 'maitri',
      text: 'The edict spoils it for you, and that is the point of the edict. Go and read it.',
    },
  ],
  landing:
    'You began where the writing starts to speak in its own voice. This is the panel that finishes the thought the Indus panel began: what it takes for a script to be read.',
  anchorNpcId: 'magadha-stonecutter',
  anchorBeats: [
    {
      after: 'magadha-brahmi',
      npcId: 'magadha-stonecutter',
      text: 'It took someone with a coin in one hand and a Greek legend in the other to read it again, many centuries later. We cut it. They read it back. I think we are even.',
    },
    {
      after: 'magadha-ashoka',
      npcId: 'magadha-dhamma-officer',
      text: 'I walk the roads with the edict in my head. Wells, shade trees, rest-houses. Judge the dhamma by the wells, the emperor says. I have counted them. The emperor is not wrong.',
    },
  ],
  plaques: [
    {
      id: 'magadha-conversion',
      zoneId: 'magadha',
      near: 'magadha-pillar',
      mask: 'gilder',
      claim: 'Ashoka ordered every subject to become Buddhist.',
      shown: 'text',
      verdict: 'unsupported',
      requires: ['ashokan-dhamma'],
      correction:
        'The dhamma of the edicts is conduct, not creed: respect for parents and elders, decent treatment of servants and the poor, generosity to ascetics of every sect, truthfulness, restraint in speech and non-injury to living beings. Rock Edict 12 instructs people not to praise their own sect while disparaging another’s, and says that whoever does so out of devotion damages the thing they are devoted to. Ashoka was a Buddhist layman and patronised Buddhist institutions, but the edicts are not a conversion order — Brahmanical, Jain and Ajivika establishments were funded too.',
      nudge: {
        text: 'It is a written source — but what does the written source actually say? Does any edict order conversion?',
        overstated: 'There is a true core: Ashoka was Buddhist and patronised Buddhists. But does any source say that anyone was ordered to convert?',
      },
    },
    {
      id: 'magadha-numbers',
      zoneId: 'magadha',
      near: 'magadha-palace',
      mask: 'eraser',
      claim: 'The Kalinga casualty figures were invented by later chroniclers. Ashoka never confessed to anything.',
      shown: 'none',
      verdict: 'text',
      ask: 'The plaque says it is all later invention. What kind of source puts the confession on the rock?',
      requires: ['ashoka-kalinga'],
      correction:
        'Ashoka’s thirteenth Major Rock Edict records the conquest of Kalinga and then does something no other ancient royal inscription does: it gives casualty figures and expresses regret. Around 150,000 deported, about 100,000 killed, and many times that number dead afterwards. Historians debate how much of the later policy was genuine conversion and how much was statecraft — both readings are defensible. What is not in doubt is the text itself: carved in public, in the language of the subjects. It is not a later chronicle. It is the emperor’s own inscription.',
      nudge: {
        debate: 'Historians debate what Ashoka’s motives were. But do they debate whether the edict says what it says?',
        archaeology: 'It is carved in stone, yes. But the codex files this under written source. What does the stone carry?',
      },
    },
    {
      id: 'magadha-sanchi',
      zoneId: 'magadha',
      near: 'magadha-stupa',
      mask: 'gilder',
      claim: 'Ashoka built the whole of the Great Stupa at Sanchi, gateways and all.',
      shown: 'archaeology',
      verdict: 'overstated',
      requires: ['sanchi-stupa'],
      correction:
        'The core of Stupa 1 is Ashokan brick. It was enlarged in stone in the second century BCE, and the four carved gateways that everyone photographs are later still — Satavahana-period work around the first century BCE. So there is a true core: the stupa is Ashokan at its heart. The claim stretches it over everything. The carvings are a primary source in their own right, and hundreds of short donor inscriptions name the people who paid for them — many of them women, merchants and ordinary monks rather than kings.',
      nudge: {
        archaeology: 'It is archaeology — but is it accurate to say Ashoka built *all* of it? Look at the dates in the entry.',
        unsupported: 'Not so fast: the core is genuinely Ashokan. The plaque is not false, only stretched.',
      },
    },
  ],
  maker: {
    npcId: 'magadha-stonecutter',
    who: 'The stonecutters of the pillar works',
    record:
      'Ashoka’s edicts are cut on rocks and pillars across the subcontinent, in several scripts and languages. The emperor’s name is on every one. The names of the people who cut them are on none. Sunita stands for them: one block of polished sandstone, thirteen metres, no joints, and nobody wrote down who did it.',
    source: 'archaeology',
  },
  trail: {
    id: 'magadha-state',
    title: 'Whose Language?',
    brief: 'Follow the edict outward: who cut it, who read it, who administered it.',
    stops: [
      {
        npcId: 'magadha-stonecutter',
        say: 'Sunita cuts the stone. But stone does nothing until someone reads it. Find the one who walks the roads: Mahamatra Devi, the dhamma inspector.',
      },
      {
        npcId: 'magadha-dhamma-officer',
        say: 'Devi inspects. Inspecting needs records, and records need clerks. Go and find the revenue officer, Amatya Rudradaman.',
      },
      { npcId: 'magadha-official' },
    ],
    payoff:
      'Cutter, inspector, accountant. An order nobody can read is not an order — it is decoration, as the emperor himself says. All the work of an empire is the work of people in the middle. You have just walked through it.',
    vidya: 100,
  },
  restoration: restoration({
    recap:
      'The sixth panel is back: a pillar with an inscription, and at its base a real line of Brahmi, the oldest Indian writing we can read. Look closely. Beside it, in very small letters, there is a scratch where someone has tried to add a word.',
    ask: 'The extra word is "mighty". I could leave it there. Many modern descriptions of this edict use it. Shall I?',
    options: [
      {
        label: 'Leave it. Ashoka was a great emperor; the word fits.',
        reply:
          'It fits a lot of things. But the edict is not a boast. It is the opposite: a public apology. I will keep the word as a comment on the panel, not on the stone.',
      },
      {
        label: 'Remove it. The edict does not say that, and the whole point is that it does not.',
        wise: true,
        reply:
          'Scratched off. An emperor chose to have regret carved in public in the language of the subjects. No other ancient royal inscription does that. The panel should be as honest as the stone.',
      },
    ],
    bridge:
      'A single line is picked out across the floor of the court, pointing south: "There is a country that kept its records on the walls of its temples. Every boundary, every tax, every ballot, carved in Tamil. Go and read it."',
  }),
  panel: {
    title: 'The Edict and the Cutter',
    caption: 'An Ashokan pillar with a real line of Brahmi at its base — and a faint, unsigned chisel mark beside it.',
    motif: 'pillar',
    threads: ['writing'],
    detail: 'The chisel mark beside the inscription is the stonecutter’s. It is the only signature on the pillar.',
  },
  witness:
    'The emperor’s name is on every pillar. Mine is on none. I am not complaining. I am pointing out which of us was holding the chisel.',
};
