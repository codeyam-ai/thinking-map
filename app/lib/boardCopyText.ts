// What each surface on the board puts on the clipboard.
//
// Dragging the board suppresses text selection, so the map's words cannot be
// swiped over any more — a copy button on each surface is what replaces that.
// What a surface copies is not the same as what it draws, though, and the
// difference is a rule rather than a rendering detail: an open question copies
// the question, an answered one copies the question AND your answer (an answer
// on its own has lost what it was answering), an insight copies its label and
// its detail. Three inline template literals in three components would drift
// apart the first time one of the three faces changed.
//
// So it lives here beside `cardPresentation` and `cardEyebrow`, whose job is
// the same shape, and it branches on `cardPresentation`'s own predicates rather
// than re-deriving the faces — or the text you copied and the card you copied
// it from could disagree about what kind of card it was.

import { isAnsweredCard, isInsightCard } from './cardPresentation';

/** The fields a board card carries that end up on the clipboard. A structural
 *  subset of `PlacedCard`, so geometry is not dragged into a text module. */
export interface CopyableCard {
  kind: string;
  status: string;
  label: string;
  detail: string | null;
  diagram?: unknown;
  imageUrl?: string | null;
}

/** Joins the parts that are actually present. Two blocks of prose are separated
 *  by a blank line, which is what survives a paste into anything. An absent
 *  part contributes nothing rather than a trailing gap. */
function block(...parts: (string | null | undefined)[]): string {
  return parts
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join('\n\n');
}

/**
 * One card.
 *
 * An open question is its label alone — there is no answer yet, and the
 * shortlist is a set of options rather than content. An answered one is the
 * question and the answer together. An insight is its label and its detail,
 * which is the same shape but means something different: the partner's claim
 * and its reasoning rather than a question and your reply.
 *
 * A card whose detail is empty copies just its label in every case, never a
 * label with a blank line hanging off it.
 */
export function cardCopyText(card: CopyableCard): string {
  if (isInsightCard(card)) return block(card.label, card.detail);
  if (isAnsweredCard(card)) return block(card.label, card.detail);
  return card.label.trim();
}

/**
 * What the copy control on a card calls itself.
 *
 * Here rather than as a ternary in the card's JSX, and immediately below
 * `cardCopyText`, because it is the same decision made twice: the name has to
 * promise exactly what the text delivers. Split across two files they can
 * drift, and a button that says "Copy this question" while copying the question
 * AND the answer is worse than either being wrong on its own — it is the kind
 * of mismatch only somebody using a screen reader would ever meet.
 *
 * Specific rather than a shared "Copy", because a dozen cards are on the board
 * at once and a dozen controls with one name between them is a list of
 * identical rows to anyone navigating by label.
 */
export function cardCopyLabel(card: CopyableCard): string {
  if (isInsightCard(card)) return 'Copy this insight';
  if (isAnsweredCard(card)) return 'Copy this question and your answer';
  return 'Copy this question';
}

/**
 * The core idea, and optionally the current reading of it.
 *
 * The reading never travels alone: "what that tells us" pasted into a document
 * on its own has lost the idea it is about, and nobody reading it later can
 * recover that.
 */
export function coreCopyText({
  seedIdea,
  insight,
}: {
  seedIdea: string;
  insight?: string | null;
}): string {
  return block(seedIdea, insight);
}

/**
 * The conclusion at the far end of the board, with the ways forward it offers.
 *
 * The choices come as a list because that is what they are on screen, and a
 * paragraph of comma-separated options would be a different thing from the
 * column of buttons the person is looking at.
 */
export function conclusionCopyText({
  label,
  detail,
  choices,
}: {
  label: string;
  detail?: string | null;
  choices?: string[] | null;
}): string {
  const ways = choices?.length
    ? ['Where next', ...choices.map((c) => `- ${c}`)].join('\n')
    : null;
  return block(label, detail, ways);
}
