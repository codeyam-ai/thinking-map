'use client';

// The far end of the board.
//
// The board's argument is left-to-right: one idea, several lines of thinking,
// back together at the far end. So the far end is exactly where a claim about
// the whole idea belongs, and this takes the coordinates `ConvergenceNode` had
// rather than floating over the board as a dock — which would be chrome
// competing with `BoardChat` — or opening a second region, which would say the
// board has two conclusions.
//
// What changes is the gating. The convergence node showed something only when
// every row was finished AND a question had been answered AND a themeless
// insight existed; before that it was a dashed ring, which is most of a
// session. A *suggestion* is not a conclusion — it is a hunch the partner is
// willing to be wrong about in front of you — and the honest way to show one is
// early and marked as provisional. The staleness marker each card carries is
// what does the marking, so nothing here has to be withheld to stay honest.

import { useState } from 'react';
import InsightCard, { type BoardInsight } from './InsightCard';
import InsightSectionLabel from './InsightSectionLabel';
import InsightStackEmpty from './InsightStackEmpty';
import { useBoundedWait } from '../hooks/useBoundedWait';
import { splitStack } from '../lib/boardInsights';
import { SETTLE_AFTER_MS } from '../lib/pendingRow';
import type { BridgeStatus } from './WebMcpBridge';

/** How many cards stand in the column before the rest go behind an
 *  affordance. The plane has bounds and a column that grew without limit would
 *  run past them; four is enough that the stack reads as a stack. */
const VISIBLE = 4;

export default function InsightStack({
  insights,
  status,
  hue = 62,
  onChoose,
}: {
  /** Newest first, as `insightStream` returns them. */
  insights: BoardInsight[];
  /** Whether an agent can reach this page. Only used for the empty state's
   *  sentence — once there is anything to show, what the bridge is doing is
   *  the status indicator's business, not this column's. */
  status: BridgeStatus;
  hue?: number;
  onChoose?: (choice: string) => void;
}) {
  const [showAll, setShowAll] = useState(false);

  // The same bounded wait the map column uses, rather than a second one. It
  // resets when an insight lands, so a board that has just been filled is not
  // still counting down from before.
  const waited = useBoundedWait(
    insights.length === 0,
    SETTLE_AFTER_MS,
    insights.length,
  );

  // Positioned around its parent's origin, and consistently so: the origin sits
  // at the vertical middle of the column and just inside its left edge, in
  // every state. `ConvergenceNode` disagreed with itself about this — its ring
  // was centred on the origin while its panel ran from 40px left of it — which
  // is what made its isolated fixture need a comment explaining where to put
  // the box.
  const shell = 'absolute -translate-y-1/2 w-[460px]';

  if (insights.length === 0) {
    return (
      <div className={shell} style={{ left: -40 }}>
        <InsightStackEmpty
          settled={waited >= SETTLE_AFTER_MS}
          status={status}
        />
      </div>
    );
  }

  const { shown, hidden } = splitStack(
    insights,
    showAll ? insights.length : VISIBLE,
  );

  return (
    <div className={shell} style={{ left: -40 }}>
      <InsightSectionLabel className="mb-3">
        What the partner is thinking
      </InsightSectionLabel>
      <div className="flex flex-col gap-3">
        {shown.map((insight) => (
          <InsightCard
            key={insight.id}
            insight={insight}
            hue={hue}
            onChoose={onChoose}
          />
        ))}
      </div>
      {hidden > 0 ? (
        <button
          type="button"
          data-no-pan
          onClick={() => setShowAll(true)}
          className="mt-3 rounded-full border border-white/15 px-4 py-2 text-[12px] text-white/60 transition hover:border-white/45 hover:text-white"
        >
          Show {hidden} older
        </button>
      ) : null}
    </div>
  );
}
