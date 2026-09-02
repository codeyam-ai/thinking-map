'use client';

import MapCardAnswer from './MapCardAnswer';
import MapCardEyebrow from './MapCardEyebrow';
import MapCardHeader from './MapCardHeader';
import { parseOptions } from '../lib/mapAnswers';
import { nodeShellClasses } from '../lib/nodeAppearance';
import type { FlatNode } from '../lib/mapLayout';

/**
 * One node on the map, as a card.
 *
 * The card replaces the pill because a pill could only ever hold a label — and
 * the thing a question most needs to hold is the answer to it. So the body is
 * one of three things: what a statement node says, the affordance for a
 * question nobody has answered, or the answer to one somebody has.
 *
 * Composition only: the eyebrow's wording, the family icon, and the whole
 * answering affordance each live in their own file. What is here is the card's
 * shape and the choice of what goes in its body.
 *
 * Fill is no longer neutral. Every card wears its FAMILY's line and tint, so
 * the map can be read as categories from across the room and as sentences up
 * close — and the treatment comes from `nodeShellClasses`, which is where the
 * status-beats-kind precedence is written down. That matters more than it
 * looks: the rule that an unanswered question stays dashed and unfilled
 * whatever it is about, and that exactly one card wears the lime, is enforced
 * by the ordering inside that function rather than by anything here.
 */
export default function MapCard({
  node,
  round,
  totalRounds,
  answer,
  asked = false,
  onAnswer,
  entering = false,
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
  /** This card belongs to the round that just arrived. The animation runs once
   *  on mount, and a card is keyed by node id, so a round genuinely lands
   *  rather than being redrawn on every poll. */
  entering?: boolean;
}) {
  const isRoot = node.parentId === null;
  const isQuestion = node.kind === 'open-question';
  // A question is answered when the log has an answer for it, even if the node
  // status has not caught up — the log is where the answer actually lives.
  const answered = answer !== null && answer !== undefined;

  return (
    <article
      // The thread layer measures cards by this attribute rather than by refs
      // threaded down through the row — it draws over the WHOLE column and has
      // no other way to find a card's box in that one coordinate space.
      data-node-id={node.id}
      // Border width comes from the shell too, not from here — root and the
      // just-updated card are doubled and everything else is a hairline, and
      // two competing width utilities on one element resolve by stylesheet
      // order rather than by intent.
      className={`flex min-h-[240px] w-full min-w-[220px] max-w-[300px] flex-col rounded-[20px] p-5 ${nodeShellClasses(
        { kind: node.kind, status: node.status, isRoot },
      )} ${entering ? 'node-in' : ''}`}
    >
      <MapCardHeader
        kind={node.kind}
        round={round}
        totalRounds={totalRounds}
        isRoot={isRoot}
      />

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
