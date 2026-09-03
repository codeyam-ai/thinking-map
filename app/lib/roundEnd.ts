// When a round is over, and what to say when it is.
//
// Both answers were inline in `BoardWorkspace`, and both are the feature rather
// than plumbing, which is why they are here where they can be read and tested
// without mounting a board.
//
// The thing worth protecting is that a round ends on a STATE the board already
// knows, not on a clock. The clock only decides when to act on the state, and
// it lives in `useSelfEndingRound`; the state itself is `roundIsFinished`, and
// keeping the two apart is what makes "answering the last question ends the
// round" testable as a rule rather than as a timing accident.

import { PHASE_ASK, PHASE_LABELS, type Phase } from './mapKinds';

/**
 * Whether the person has just FINISHED a round, as opposed to merely looking at
 * a finished one.
 *
 * The middle clause is the load-bearing one and the easiest to drop. A board
 * with nothing open is the ordinary resting state of every map someone comes
 * back to, so `open === 0` alone would end a round on behalf of somebody who
 * had not touched anything yet — the automation firing at a reader rather than
 * at a participant. Requiring an answer given in THIS sitting is what makes it
 * the conclusion of work instead of a greeting.
 *
 * The wait check is not redundant with either: a round that has already been
 * handed to the partner is over, and re-ending it would write a second note
 * onto the log saying the same thing.
 */
export function roundIsFinished({
  open,
  answeredThisRound,
  waiting,
}: {
  /** Unanswered questions still on the board. */
  open: number;
  /** Questions the person has answered in this sitting. */
  answeredThisRound: number;
  /** Whether the board is already waiting on the partner. */
  waiting: boolean;
}): boolean {
  return open === 0 && answeredThisRound > 0 && !waiting;
}

/**
 * The note the board leaves when a round ends.
 *
 * It NAMES THE FORK, and that is the whole reason it is not a constant. The
 * note this replaced said only "Ready for the next round — bring what you have
 * made of this", which gives an agent no reason to ever stop adding cards: more
 * questions is always a valid response to "your turn". Whether the thinking
 * needs another row or is ready to be concluded is a judgement the page cannot
 * make — but the page CAN say that a judgement is due, and which two answers
 * are the ones on offer.
 *
 * The words come from `PHASE_ASK`, which is also where the button's label and
 * sentence come from, so what the page shows a person and what it tells their
 * partner cannot drift apart.
 *
 * The terminal phase gets its own sentence rather than a missing clause. It is
 * where the arc ENDS — `next-steps` has no `next` — so an invitation to move
 * on would point at nothing, and the honest instruction there is the opposite
 * one: stop opening questions and write the conclusion.
 */
export function roundEndNote(phase: Phase): string {
  const ask = PHASE_ASK[phase];
  const opening = `Everything on the board is answered. ${ask.sentence}`;

  return ask.next
    ? `${opening} So this is a decision, not another round: either add what is still missing here, or move the map on to ${PHASE_LABELS[ask.next]} and draw the conclusion.`
    : `${opening} There is no phase after this one — draw the conclusion rather than opening more questions.`;
}
