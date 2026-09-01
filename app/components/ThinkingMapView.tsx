'use client';

import { useMemo } from 'react';
import MapEmptyState from './MapEmptyState';
import MapRow from './MapRow';
import { useOptionalWebMcpBridge } from './WebMcpBridge';
import { useMapAnswers } from '../hooks/useMapAnswers';
import { askedNodeIds } from '../lib/exchangeRail';
import { groupIntoRounds } from '../lib/mapRounds';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The map: a single column of rows, growing downward, scrolled like a page.
 *
 * It used to be a tidy tree on a zoomable plane. Zoom, pan, fit-to-frame,
 * drag-to-nudge and fold-a-branch all existed to make a large 2D tree navigable
 * — and a column that grows downward is navigated by scrolling, so all of it
 * went rather than being kept alive underneath. The tree is still in the data:
 * `parentId` and `order` are untouched and the tool contract is unchanged. Only
 * the drawing changed.
 *
 * Composition only. Which nodes arrived together lives in `mapRounds`, what the
 * person has answered lives in `useMapAnswers`, and the card and row draw
 * themselves.
 */
export default function ThinkingMapView({
  nodes,
  caption,
  mapId,
}: {
  nodes: FlatNode[];
  caption?: string;
  /** Kept for the callers that pass it, though nothing here writes back any
   *  more — arrangement was the only thing this component ever wrote, and the
   *  column has no arrangement to persist. */
  mapId?: string;
}) {
  // Optional because this same component renders in an isolated scenario, where
  // there is no exchange to write to. Without a bridge the map is fully
  // readable — it simply cannot be answered.
  const bridge = useOptionalWebMcpBridge();

  const events = useMemo(() => bridge?.events ?? [], [bridge?.events]);
  const askedIds = useMemo(() => askedNodeIds(events), [events]);
  const rounds = useMemo(() => groupIntoRounds(nodes, events), [nodes, events]);

  const { answers, answer } = useMapAnswers(events, bridge);

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

      <div className="min-h-0 flex-1 overflow-y-auto">
        {rounds.length === 0 ? (
          <MapEmptyState />
        ) : (
          rounds.map((round) => (
            <MapRow
              key={round.index}
              round={round}
              totalRounds={rounds.length}
              answers={answers}
              askedIds={askedIds}
              onAnswer={answer}
            />
          ))
        )}
      </div>
    </section>
  );
}
