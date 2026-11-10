import type { Ending } from './types';

/**
 * Three endings, all kind. Which one the player hears is read from two counters
 * (comfort picks and open picks) and from how many plaques they got right first
 * time. None of it reduces Vidya, and none of it is shown as a score.
 */
export const ENDINGS: Record<Ending['id'], Ending> = {
  open: {
    id: 'open',
    title: 'You doubt kindly',
    body: 'You left blanks where the evidence left blanks, and you asked who was speaking before you decided what to believe. That is rarer than it sounds. Most people find it easier to be sure.',
  },
  changed: {
    id: 'changed',
    title: 'You changed your mind with evidence',
    body: 'You took the comfortable road early on. So did I, in my first season. Then you read the entry and thought again. Most people cannot do that at all, and it is the whole of the method.',
  },
  storyteller: {
    id: 'storyteller',
    title: 'You like a good story',
    body: 'You reached for the tidy version more often than not. So do I. Now you can tell which parts are the story, and which parts are the stone. Keep both. That is what the Gatha was always for.',
  },
};

/**
 * The Keeper's Log: the people who held the scroll before Maitri.
 *
 * The reveal is that the job has never been done by anyone special. It has been
 * done by ordinary people who asked good questions. The player becomes the
 * forty-second. Forty-one lines, one profession each, no names.
 */
export const KEEPERS: readonly string[] = [
  'A temple clerk who copied a ledger faithfully, including the error',
  'A boatwoman who kept a tally of every crossing',
  'A schoolteacher who let the class argue',
  'A tax assessor who kept two sets of notes, one of what was said and one of what was seen',
  'A potter who dated the kilns by the layers they left',
  'A copyist who noted in the margin: "here the source is damaged"',
  'A ferryman who remembered which bank each story came from',
  'A midwife who wrote down what worked and what did not',
  'A surveyor who re-measured the thing before believing the number',
  'A merchant’s daughter who learned three scripts to read three sets of accounts',
  'A shepherd who could tell a boundary stone that had been moved',
  'A librarian who refused to throw anything away',
  'A monk who preferred the footnote to the sermon',
  'A drummer who knew which verses were older than the tune',
  'A stonecutter who signed the back of the stone',
  'A weaver who could tell a repair from the original thread',
  'A court scribe who recorded the defeat as carefully as the victory',
  'A well-digger who knew the water table of three centuries',
  'A translator who said "I am not sure" aloud, in two languages',
  'A grain-seller whose scales were checked by strangers',
  'A runner who delivered the bad news first',
  'A storyteller who always said where the story came from',
  'A cartographer who left the unknown parts blank',
  'A herbalist who listed what was not known alongside what was',
  'A schoolboy who asked "but how do you know?" and would not stop',
  'A bell-founder who kept the moulds for the next generation',
  'A widow who kept the household accounts for forty years and was never wrong by a paisa',
  'A tailor who could date a coat by its stitches',
  'A night-watchman who wrote down what was seen and nothing else',
  'A priest who read the other faith’s texts and said so',
  'A bard who changed the story when the facts changed',
  'A porter who carried books and read a few',
  'A fisherman who knew the tides by the old charts and the new',
  'A mapmaker’s apprentice who erased one line and corrected it',
  'A weigher of gold who took pride in every honest weight',
  'A cook who kept a recipe book and annotated every failure',
  'A road-mender who wrote the distances on the milestones',
  'A judge who gave reasons',
  'A midwife’s granddaughter who learned to ask for sources',
  'A librarian’s assistant who cross-checked the catalogue',
  'A student who closed the book, thought, and opened it again',
];
