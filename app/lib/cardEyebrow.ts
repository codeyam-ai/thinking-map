// The line a card uses to say what it is.
//
// Every node carries an eyebrow naming its kind — the design system's rule that
// lets the map read without a legend — and the card appends the other facts it
// knows about itself to the same line: who wrote it, whether it has been asked
// about, and which part of the brief it came from.
//
// Assembling that is string logic rather than rendering, and it is the piece
// most likely to be quietly wrong: an answered question that still says "Open"
// contradicts the answer printed directly underneath it. So it lives here where
// a test can hold it, not inside the card's JSX.

import { sectionLabel } from './briefFormat';
import { KIND_EYEBROW, type NodeKind } from './mapKinds';

export interface CardEyebrowFacts {
  kind: string;
  /** Which side of the exchange wrote the node. */
  origin?: string | null;
  /** The brief section this claim came from, when it came from one. */
  sourceRef?: string | null;
  /** The person has asked a question about this node. */
  asked?: boolean;
  /** This is a question and the log holds an answer for it. */
  answered?: boolean;
}

/**
 * The eyebrow for one card.
 *
 * The facts are appended in a fixed order — state, then who wrote it, then
 * whether it has been asked about, then the document it came from — so the line
 * reads the same way on every card. The brief reference goes last because it is
 * the only one of them about the DOCUMENT rather than the node.
 */
export function cardEyebrow({
  kind,
  origin,
  sourceRef,
  asked = false,
  answered = false,
}: CardEyebrowFacts): string {
  // An answered question must stop calling itself open. `KIND_EYEBROW` maps
  // `open-question` to "Open", which is right until somebody answers it — at
  // which point the card would be labelling its own answer as unanswered.
  const state =
    kind === 'open-question' && answered
      ? 'Answered'
      : (KIND_EYEBROW[kind as NodeKind] ?? kind);

  return [
    state,
    // The map is co-authored, so the parts the person wrote say so. This is the
    // same fact the tools read to avoid re-ingesting their own writes.
    origin === 'user' ? 'yours' : null,
    asked ? 'asked' : null,
    sourceRef ? sectionLabel(sourceRef) : null,
  ]
    .filter(Boolean)
    .join(' · ');
}
