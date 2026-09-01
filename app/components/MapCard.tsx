'use client';

import MapCardAnswer from './MapCardAnswer';
import MapCardEyebrow from './MapCardEyebrow';
import NodeAccentMark from './NodeAccentMark';
import { parseOptions } from '../lib/mapAnswers';
import type { FlatNode } from '../lib/mapLayout';

/**
 * One node on the map, as a card.
 *
 * The card replaces the pill because a pill could only ever hold a label — and
 * the thing a question most needs to hold is the answer to it. So the body is
 * one of three things: what a statement node says, the affordance for a
 * question nobody has answered, or the answer to one somebody has.
 *
 * Composition only: the eyebrow's wording, the accent mark, and the whole
 * answering affordance each live in their own file. What is here is the card's
 * shape and the choice of what goes in its body.
 *
 * Fill is deliberately neutral on every card. The status precedence that drove
 * the pill's treatment is right and transfers intact, but which card wears the
 * lime is the card-visual plan's question, not this one's.
 */
export default function MapCard({
  node,
  round,
  totalRounds,
  answer,
  asked = false,
  onAnswer,
}: {
  node: FlatNode;
  /** Which round this card belongs to, and how many there are — the `2/4`
   *  marker the reference puts in the corner. */
  round: number;
  totalRounds: number;
  /** What the person answered, when this is a question they have answered. */
  answer?: string | null;
  /** The person has already asked about this node. */
  asked?: boolean;
  onAnswer?(id: string, label: string, answer: string): Promise<void>;
}) {
  const isRoot = node.parentId === null;
  const isQuestion = node.kind === 'open-question';
  // A question is answered when the log has an answer for it, even if the node
  // status has not caught up — the log is where the answer actually lives.
  const answered = answer !== null && answer !== undefined;

  return (
    <article className="flex min-h-[240px] w-full min-w-[220px] max-w-[300px] flex-col rounded-[20px] border border-line bg-surface p-5">
      <header className="flex items-start justify-between gap-3">
        <span className="text-[12px] font-bold tabular-nums text-muted">
          {round}/{totalRounds}
        </span>
        <NodeAccentMark kind={node.kind} />
      </header>

      {/* The reference pushes the reading matter to the bottom of the card and
          leaves the top open. The spacer is what does that, and it is why the
          card has a minimum height at all. */}
      <div className="flex-1" />

      <MapCardEyebrow
        kind={node.kind}
        origin={node.origin}
        sourceRef={node.sourceRef}
        asked={asked}
        answered={answered}
      />

      <h3
        className={`mb-2 line-clamp-3 leading-snug ${
          isRoot ? 'text-[17px] font-extrabold' : 'text-[15px] font-bold'
        } text-ink`}
      >
        {node.label}
      </h3>

      {isQuestion ? (
        <MapCardAnswer
          id={node.id}
          label={node.label}
          options={parseOptions(node.options)}
          answer={answered ? answer! : null}
          onAnswer={onAnswer}
        />
      ) : node.detail ? (
        <p className="text-[13px] leading-[1.5] text-ink-soft">{node.detail}</p>
      ) : null}
    </article>
  );
}
