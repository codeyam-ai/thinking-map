// Which of its three faces a board card shows.
//
// A card is one of three things and each looks different enough that the board
// reads at a glance without a legend: an open question (saturated, carrying a
// field), an answered one (near-black, your words in white), or an insight —
// the partner's own thinking rather than something being asked of you.
//
// Choosing between them is a rule about the node, not about rendering, so it
// lives here where a test can hold it. It was inline in `QuestionCard` and had
// a hole in it: see `isInsightCard` below.

/** Kinds that are the partner's own thinking rather than a question for you. */
const INSIGHT_KINDS = new Set([
  'assumption',
  'finding',
  'gap',
  'risk',
  'pro',
  'direction',
  'known',
  'unknown',
  // Both are the partner telling you what it would do, not asking you
  // anything. Without them here a suggestion renders as an unanswered
  // question: a saturated card with a field asking the person to answer
  // something nobody asked.
  'suggestion',
  'experiment',
]);

export interface CardFace {
  kind: string;
  status: string;
  diagram?: unknown;
  imageUrl?: string | null;
}

/**
 * Whether this card is showing you something rather than asking you something.
 *
 * The kind list is the obvious half. The other half is that a card CARRYING
 * something — a drawn shape, a picture — is showing it to you whatever its
 * kind, and that half was missing: `widthFor` in the layout already hands
 * exactly these cards the wide column on that reasoning, so without the same
 * rule here a card got the width and then rendered none of the content that
 * earned it. An `approach` with a diagram was laid out at 420px, drawn as an
 * answered question, and its diagram dropped on the floor.
 */
export function isInsightCard(card: CardFace): boolean {
  return INSIGHT_KINDS.has(card.kind) || Boolean(card.diagram || card.imageUrl);
}

/** An answered question: your words are the content, the question its label.
 *  An insight is never "answered" in this sense however its status reads —
 *  nobody asked you anything, so there is nothing for you to have answered. */
export function isAnsweredCard(card: CardFace): boolean {
  return card.status === 'answered' && !isInsightCard(card);
}

/** Still asking something of you, and so still carrying a field. */
export function isOpenCard(card: CardFace): boolean {
  return !isAnsweredCard(card) && !isInsightCard(card);
}
