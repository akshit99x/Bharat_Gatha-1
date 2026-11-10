import type { StoryLine } from './types';

/**
 * The vimana log. Plays during the opening crossing, as non-blocking captions,
 * so the ride is never frozen for a conversation. The flight is about 52
 * seconds; five lines at roughly eight seconds each fill it.
 */
export const PROLOGUE: StoryLine[] = [
  { who: 'maitri', text: 'Gathak. Good — it worked. I was not sure anyone would answer.' },
  {
    who: 'maitri',
    text: 'Look down. That is the Gatha: a scroll of eleven painted panels, laid out as an island. Eleven eras, side by side. Most of it is clear. Some of it is not.',
  },
  {
    who: 'maitri',
    text: 'The grey is the Dhundh. It does one of two things to a story: gilds it into a fairy tale, or erases it into a shrug. It cannot survive one question: how do we know that?',
  },
  {
    who: 'maitri',
    text: 'You carry three things. The bow, for what needs precision. The shilpa tools, for what was broken. And the Pramana lens. Hold right-click on anything old, and it will tell you how we know it, not just what it is.',
  },
  { who: 'ekarupa', mask: 'gilder', text: 'No need to check. Just enjoy the view.' },
  { who: 'maitri', text: 'Do not listen to that. Land.' },
];
