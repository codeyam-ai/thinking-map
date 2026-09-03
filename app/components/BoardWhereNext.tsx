'use client';

// The far end of the map: where the thinking goes next.
//
// This was a SUMMARY, and twice over it was the wrong thing. It was a separate
// screen, so reaching it replaced the board and said the thinking was over.
// And it opened with a declaration — "I didn't build the product yet" — which
// is a statement about a finish line, on a tool whose whole argument is that
// there is not one. Someone arriving here had produced a document, not a next
// move.
//
// So it stands where the lines already converge, and it leads with what to DO.
// Something to try, and what trying it would settle. A direction to take, which
// is a button. What the thinking has turned up so far, and what it still has
// not. None of it is a conclusion; all of it is material for the next round,
// and the map behind it is still there, still answerable, still pannable.
//
// The order is deliberate and it is not the order a report would use. A report
// leads with findings and ends with recommendations. This leads with the moves,
// because someone who opens the far end of their own map is asking "what now",
// and the evidence is what they read to decide between the answers.

import { buildSequence } from '../lib/buildSequence';
import { groupSummaryNodes, type SummaryNode } from '../lib/summaryGroups';
import { KIND_EYEBROW } from '../lib/mapKinds';
import type { Insight } from '../lib/insightStream';
import BoardWhereNextPanel from './BoardWhereNextPanel';
import BoardWhereNextEmpty from './BoardWhereNextEmpty';
import BoardWhereNextTry from './BoardWhereNextTry';
import BoardWhereNextDirections from './BoardWhereNextDirections';
import BoardWhereNextBullets from './BoardWhereNextBullets';

/** The column's width in board units. Deliberately the same 460 the insight
 *  stack occupies: `layOutGalaxy` reserves exactly that much room past the
 *  convergence point when it computes the board's bounds, so standing here at
 *  the same width means "frame the whole board" keeps framing the whole board. */
const WIDTH = 460;

/** The partner's offerings that are things to DO rather than things to know. */
const TRY_KINDS = new Set(['experiment', 'suggestion']);

export default function BoardWhereNext({
  nodes,
  insights = [],
  changed,
  onChoose,
  onAskMore,
}: {
  nodes: SummaryNode[];
  /** The partner's own thinking, as the stack that stood on this point was
   *  showing it. It does not disappear because the map reached its last phase
   *  — an experiment worth running is worth running most of all at the point
   *  someone thinks they are finished. */
  insights?: Insight[];
  /** What arrived here while the person was answering elsewhere. Marked, not
   *  filtered: the point is to say what is new WITHIN the column, so it can be
   *  read against everything that was already there. */
  changed?: ReadonlySet<string>;
  /** Taking a direction. Optional so an isolated fixture can mount the column
   *  with nothing wired behind the buttons. */
  onChoose?: (choice: string) => void;
  /** Asking for another round of questions.
   *
   *  The way back INTO the loop, which the far end did not have. Everything
   *  here is a reading of what has been said so far, so the honest response to
   *  a thin column is not to stare at it — it is to give the partner more to
   *  work with. Without this the only way to do that was to type a request in
   *  your own words and hope it was read as one. */
  onAskMore?: () => void;
}) {
  const { known, unknown, directions, steps } = groupSummaryNodes(nodes);
  const sequence = buildSequence(nodes);

  const experiments = insights.filter((i) => TRY_KINDS.has(i.kind));
  const learned = insights.filter((i) => i.kind === 'finding');
  const gaps = insights.filter((i) => i.kind === 'gap');

  return (
    // Grows DOWNWARD from the convergence point rather than being centred on
    // it. A column centred on its own middle has its top edge at a position
    // nothing can compute without measuring it, and the camera has to frame
    // that top edge — this is long, it is read from the beginning, and
    // "somewhere above the convergence point" is not an address.
    //
    // `data-no-pan` throughout: the column is read and pressed, and without it
    // every attempt to take a direction would drag the board out from under
    // the pointer.
    <div
      className="absolute -left-10 flex flex-col gap-4"
      style={{ width: WIDTH }}
      data-no-pan
    >
      <div>
        <h2 className="text-[22px] font-bold leading-tight text-white">
          Insights &amp; experiments
        </h2>
        <p className="mt-1.5 text-[13px] leading-snug text-white/50">
          Nothing here is finished. Take a direction, try one of these, or go
          back and give it more to work with.
        </p>

        {/* The way back INTO the loop. Everything below is a reading of what
            has been said so far, so the honest response to a thin column is
            not to stare at it — it is to answer more. */}
        {onAskMore ? (
          <button
            type="button"
            onClick={onAskMore}
            className="mt-3 rounded-full border border-white/25 px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:border-white/60 hover:bg-white/8"
          >
            Ask me more questions
          </button>
        ) : null}
      </div>

      <BoardWhereNextTry
        experiments={experiments}
        sequence={sequence}
        changed={changed}
        eyebrowFor={(kind) =>
          KIND_EYEBROW[kind as keyof typeof KIND_EYEBROW] ?? kind
        }
      />

      <BoardWhereNextDirections items={directions} onChoose={onChoose} />

      <BoardWhereNextPanel title="What we're learning">
        <BoardWhereNextBullets
          items={[...known.map((n) => n.label), ...learned.map((i) => i.label)]}
        />
      </BoardWhereNextPanel>

      <BoardWhereNextPanel title="Still open">
        <BoardWhereNextBullets
          items={[...unknown.map((n) => n.label), ...gaps.map((i) => i.label)]}
        />
      </BoardWhereNextPanel>

      <BoardWhereNextPanel title="And then">
        <ol className="flex flex-col gap-2.5">
          {steps.map((node, index) => (
            <li key={node.id} className="flex gap-3">
              <span className="w-4 shrink-0 pt-0.5 text-[11px] uppercase tracking-[0.14em] text-white/40">
                {index + 1}
              </span>
              <span className="text-[13.5px] font-semibold leading-snug text-white/85">
                {node.label}
              </span>
            </li>
          ))}
          {steps.length === 0 ? <BoardWhereNextEmpty /> : null}
        </ol>
      </BoardWhereNextPanel>
    </div>
  );
}
