import type { DialogueNode } from '../types';

/**
 * Build the panel-restoration conversation.
 *
 * Every chapter ends the same way: Maitri describes the restored panel, asks one
 * question where the comfortable answer and the open-minded answer differ, and
 * hands the player on. Writing that as a raw node graph eleven times invites
 * typos in `goto` ids, so chapters fill in the four pieces and this assembles
 * the graph. The options marked `wise` are the open-minded ones; the engine
 * counts them, and nothing is ever deducted for the other kind.
 */
export function restoration(spec: {
  /** Maitri on the panel that has just come back. */
  recap: string;
  /** The question. */
  ask: string;
  options: Array<{ label: string; wise?: boolean; reply: string }>;
  /** The hand-off to the next place. */
  bridge: string;
}): DialogueNode[] {
  const nodes: DialogueNode[] = [
    { id: 'start', text: spec.recap, goto: 'ask' },
    {
      id: 'ask',
      text: spec.ask,
      choices: spec.options.map((option, i) => ({
        label: option.label,
        goto: `reply-${i}`,
        ...(option.wise ? { wise: true } : {}),
      })),
    },
    ...spec.options.map((option, i): DialogueNode => ({ id: `reply-${i}`, text: option.reply, goto: 'bridge' })),
    { id: 'bridge', text: spec.bridge, end: true, vidya: 60 },
  ];
  return nodes;
}
