// How far through a round the person is.
//
// Pulled out of the map view because it is the definition the whole feature
// gates on: the footer's count, whether the next row is reached for at all, and
// whether the phase's action appears are all this one answer. Inline arithmetic
// inside a component made the rule visible only by reading JSX, and the rule
// has a genuinely load-bearing subtlety in it.
//
// That subtlety: only ANSWERABLE cards count. A node can carry
// `status: 'open'` without being a question the person can do anything about —
// a goal the agent has not filled in yet reads as open on the map caption, but
// there is no answer box on it. Counting those would leave the loop permanently
// one short and the next row never reached for.

import type { FlatNode } from './mapLayout';

export interface RoundProgress {
  /** Questions this round asked. Zero for a round of pure statements. */
  questions: number;
  /** How many of them have an answer. */
  answered: number;
  /** Still waiting on the person. */
  open: number;
}

/**
 * Progress through one round.
 *
 * `answers` is keyed by node id and comes from the log plus anything this tab
 * has written optimistically — so a question counts as answered the moment the
 * person sends it, not when the poll catches up.
 */
export function roundProgress(
  nodes: FlatNode[],
  answers: ReadonlyMap<string, string>,
): RoundProgress {
  const questions = nodes.filter((node) => node.kind === 'open-question');
  const answered = questions.filter((node) => answers.has(node.id)).length;
  return {
    questions: questions.length,
    answered,
    open: questions.length - answered,
  };
}
