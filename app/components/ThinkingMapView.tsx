'use client';

import { useMemo, useRef } from 'react';
import MapEmptyState from './MapEmptyState';
import MapRow from './MapRow';
import PendingRow from './PendingRow';
import RowFooter from './RowFooter';
import RowThreads from './RowThreads';
import { useOptionalWebMcpBridge } from './WebMcpBridge';
import { useBoundedWait } from '../hooks/useBoundedWait';
import { useFollowColumn } from '../hooks/useFollowColumn';
import { useMapAnswers } from '../hooks/useMapAnswers';
import { askedNodeIds } from '../lib/exchangeRail';
import type { Phase } from '../lib/mapKinds';
import { groupIntoRounds } from '../lib/mapRounds';
import { pendingRow, SETTLE_AFTER_MS } from '../lib/pendingRow';
import { roundProgress } from '../lib/roundProgress';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The map: a single column of rows, growing downward, scrolled like a page —
 * and reaching for the next row before anyone asks it to.
 *
 * It used to be a tidy tree on a zoomable plane. Zoom, pan, fit-to-frame,
 * drag-to-nudge and fold-a-branch all existed to make a large 2D tree navigable
 * — and a column that grows downward is navigated by scrolling, so all of it
 * went rather than being kept alive underneath. The tree is still in the data:
 * `parentId` and `order` are untouched and the tool contract is unchanged. Only
 * the drawing changed.
 *
 * Composition only. Which nodes arrived together lives in `mapRounds`, how far
 * through a round you are in `roundProgress`, what the page may honestly claim
 * while it waits in `pendingRow`, the clock that bounds that wait in
 * `useBoundedWait`, and following the column down in `useFollowColumn`.
 */
export default function ThinkingMapView({
  nodes,
  caption,
  mapId,
  phase = 'map',
}: {
  nodes: FlatNode[];
  caption?: string;
  /** Kept for the callers that pass it, though nothing here writes back any
   *  more — arrangement was the only thing this component ever wrote, and the
   *  column has no arrangement to persist. */
  mapId?: string;
  /** Which step the map is on, so the row footer can name the action that ends
   *  it. Defaults to `map` for an isolated scenario that has no route to read
   *  a phase from — the working view is only ever shown for a working phase. */
  phase?: Phase;
}) {
  // Optional because this same component renders in an isolated scenario, where
  // there is no exchange to write to. Without a bridge the map is fully
  // readable — it simply cannot be answered.
  const bridge = useOptionalWebMcpBridge();

  const events = useMemo(() => bridge?.events ?? [], [bridge?.events]);
  const askedIds = useMemo(() => askedNodeIds(events), [events]);
  const rounds = useMemo(() => groupIntoRounds(nodes, events), [nodes, events]);

  const { answers, answer } = useMapAnswers(events, bridge);

  // Progress is read off the NEWEST round only. A question skipped three rounds
  // ago stays answerable in place and stops gating — otherwise one abandoned
  // card holds the whole loop hostage.
  const newest = rounds.length > 0 ? rounds[rounds.length - 1]! : null;
  const progress = roundProgress(newest?.nodes ?? [], answers);
  const complete = rounds.length > 0 && progress.open === 0;

  // The wait restarts whenever a round arrives, because a new round means the
  // page is reaching for something new rather than still waiting on the old.
  const waitedMs = useBoundedWait(complete, SETTLE_AFTER_MS, rounds.length);

  const pending = pendingRow({
    roundCount: rounds.length,
    openInNewestRound: progress.open,
    phase,
    status: bridge?.status ?? 'unavailable',
    waitedMs,
  });

  const { scrollRef, endRef, onScroll } = useFollowColumn(
    rounds.length,
    complete,
  );

  // The box the threads are measured against and drawn over. It has to be the
  // element the ROWS live in, not the scroll container, so the overlay scrolls
  // with the content rather than sitting still over it.
  const columnRef = useRef<HTMLDivElement>(null);

  // `min-w-0` below is load-bearing: a flex item defaults to `min-width: auto`,
  // so without it a long card label can push the column wider than its parent
  // instead of wrapping inside it.
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[20px] border border-line bg-surface p-6">
      <header className="mb-4 flex shrink-0 items-baseline gap-3">
        <span className="eyebrow">Live map</span>
        {caption ? (
          <span className="text-[12.5px] text-muted">{caption}</span>
        ) : null}
      </header>

      {/* `dot-grid` on the scroll container rather than on the column inside
          it: the ground should fill the frame even when there is one card on
          it, which is also what makes the empty state read as a place waiting
          to be filled rather than as a blank panel. */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="dot-grid -mx-2 min-h-0 flex-1 overflow-y-auto px-2"
      >
        {rounds.length === 0 ? (
          <MapEmptyState />
        ) : (
          <div ref={columnRef} className="relative isolate">
            {/* Under the rows, so a thread passes BEHIND the cards it crosses
                on its way rather than over their text.

                `isolate` on the parent is load-bearing for that. The layer
                sits below the cards, which claim `z-10`, and without a
                stacking context here that ordering escapes this element
                entirely and the threads land behind the panel's own opaque
                background — invisible rather than merely low. */}
            <RowThreads rounds={rounds} containerRef={columnRef} />
            {rounds.map((round) => (
              <MapRow
                key={round.index}
                round={round}
                totalRounds={rounds.length}
                answers={answers}
                askedIds={askedIds}
                onAnswer={answer}
                /* Only the newest round animates in. Every round animating on
                   first paint would make an old map look like it had just been
                   written. */
                entering={round.index === rounds.length}
                // The two newest rounds stand forward; everything older steps
                // back a little. Two rather than one because the round you are
                // answering and the round that prompted it are both live.
                receded={round.index < rounds.length - 1}
              />
            ))}

            {/* The pending row goes ABOVE the footer on purpose. It is the
                answer to "why has nothing arrived?", and that has to be read
                before "here is what to do instead" makes any sense. */}
            <PendingRow state={pending} />

            <RowFooter
              phase={phase}
              answered={progress.answered}
              questions={progress.questions}
              pending={pending}
              mapId={mapId}
              contribute={bridge?.contribute}
            />

            <div ref={endRef} />
          </div>
        )}
      </div>
    </section>
  );
}
