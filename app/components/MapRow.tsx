'use client';

import MapCard from './MapCard';
import { isResearchRound, roundEyebrow, type Round } from '../lib/mapRounds';

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
 *
 * A research round gets its own TERRITORY rather than just its own colour: a
 * tinted ground behind the whole row and a hairline enclosing it, so what
 * already exists is legible as a region before any card in it is read. Because
 * a row is already a round, that costs almost nothing here — which is a good
 * sign the round was the right seam to have cut.
 */
export default function MapRow({
  round,
  totalRounds,
  answers,
  askedIds,
  onAnswer,
  entering = false,
  receded = false,
}: {
  round: Round;
  totalRounds: number;
  answers: Map<string, string>;
  askedIds: ReadonlySet<string>;
  onAnswer?(id: string, label: string, answer: string): Promise<void>;
  /** This round is the one that just arrived, so its cards land rather than
   *  appear. */
  entering?: boolean;
  /** An older round, stepped back so the newest thinking sits forward of it. */
  receded?: boolean;
}) {
  const research = isResearchRound(round);

  return (
    <section
      // `mb-14` rather than the `mb-8` the rows had before the threads: the
      // curve between two rows lives entirely in this gap, and at 32px it had
      // nowhere to bend, so every thread flattened into a sagging cable. The
      // gap is now the thread's drawing space as much as it is breathing room.
      //
      // Note what is NOT here: the recession. It is on the cards below rather
      // than on this section, because `opacity` makes a stacking context and a
      // stacking context here would trap the cards underneath the thread layer
      // — a receded row would have its threads drawn over its own card text.
      className={`mb-14 ${
        research
          ? // Negative margin so the band bleeds to the same edge the unbanded
            // rows sit at — otherwise the enclosure indents its cards and the
            // column loses its left edge exactly where it is drawing attention.
            'rounded-[18px] border border-fam-found-line/35 bg-fam-found-band -mx-3 px-3 py-3'
          : ''
      }`}
    >
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
          // `z-10` puts every card above the thread layer, which sits at `z-0`
          // so that it in turn clears the research band's ground. Three layers,
          // bottom to top: the band, the threads, the cards — which is what
          // lets a thread cross the band it lands on and still pass behind the
          // card it lands at.
          <div
            key={node.id}
            className={`relative z-10 flex min-w-[220px] max-w-[300px] flex-1 ${
              receded ? 'round-receded' : ''
            }`}
          >
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
