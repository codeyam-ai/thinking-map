'use client';

import { useEffect, useRef } from 'react';
import ExchangeRailEmpty from './ExchangeRailEmpty';
import ExchangeRow from './ExchangeRow';
import { railEntries } from '../lib/exchangeRail';
import type { ExchangeEvent } from '../lib/exchange';

/**
 * What has happened to this map, oldest first.
 *
 * This is the half of the exchange the page legitimately owns. It cannot see
 * the agent's conversation and never will, so it does not pretend to — it
 * records what was done to the artifact, from both sides, in one ordered
 * column.
 */
export default function ExchangeRail({ events }: { events: ExchangeEvent[] }) {
  const entries = railEntries(events);
  const endRef = useRef<HTMLDivElement>(null);

  // Newest last, so the end is where the attention goes.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [entries.length]);

  return (
    <section className="flex min-h-0 flex-1 flex-col">
      <h2 className="eyebrow mb-1 shrink-0">Activity</h2>

      {entries.length === 0 ? (
        <ExchangeRailEmpty />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="divide-y divide-line">
            {entries.map((entry) => (
              <ExchangeRow key={entry.id} entry={entry} />
            ))}
          </ul>
          <div ref={endRef} />
        </div>
      )}
    </section>
  );
}
