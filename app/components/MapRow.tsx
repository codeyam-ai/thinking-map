'use client';

import MapCard from './MapCard';
import { roundEyebrow, type Round } from '../lib/mapRounds';

/**
 * One round of thinking, as a row.
 *
 * The row is the map's unit of time: everything in it arrived together, and the
 * next one appears below it. That is the whole of what "the map builds
 * downward" means.
 *
 * The band wraps rather than scrolling sideways, which is what makes one layout
 * work at every width — two cards abreast in half a screen, four on a desktop,
 * with no breakpoint deciding which is which.
 */
export default function MapRow({
  round,
  totalRounds,
  answers,
  askedIds,
  onAnswer,
  entering = false,
}: {
  round: Round;
  totalRounds: number;
  answers: Map<string, string>;
  askedIds: ReadonlySet<string>;
  onAnswer?(id: string, label: string, answer: string): Promise<void>;
  /** This round is the one that just arrived, so its cards land rather than
   *  appear. */
  entering?: boolean;
}) {
  return (
    <section className="mb-8">
      <h3 className="eyebrow mb-3">{roundEyebrow(round, totalRounds)}</h3>

      {/* `items-start` rather than `items-stretch`: a card is as tall as what
          it holds, so a question with three suggested answers is taller than one
          with two and neither is padded out to match.

          The cards were briefly staggered, the way the plan's reference image
          steps its band. It was removed: that reference's cards are a uniform
          height, so the offset there reads as rhythm, while ours vary with their
          content — and a deliberate offset on top of varying heights reads as
          two cards that failed to line up rather than as a designed band. The
          row already announces itself with its eyebrow, and the differing
          heights give it texture without costing the shared top edge that makes
          a row scannable. */}
      <div className="flex flex-wrap items-start gap-4">
        {round.nodes.map((node) => (
          <div key={node.id} className="flex min-w-[220px] max-w-[300px] flex-1">
            <MapCard
              node={node}
              round={round.index}
              totalRounds={totalRounds}
              answer={answers.get(node.id) ?? null}
              asked={askedIds.has(node.id)}
              onAnswer={onAnswer}
              entering={entering}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
