// How the log reads to an agent.
//
// The exchange is pull-only, so this rendering is the whole of what an agent
// learns about everything that happened while it was not looking. Pure and
// separate from the tools because the wording is the interface — it is worth
// pinning with tests rather than discovering a regression through a confused
// agent.

import type { ExchangeEvent } from './exchange';

/** The payload field worth showing for each event kind, in preference order.
 *  Different kinds carry their human-readable part under different names, and
 *  an agent reading a wall of bare kinds learns nothing. */
const SUMMARY_FIELDS = ['label', 'text', 'phase', 'answer'] as const;

function summarize(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const record = payload as Record<string, unknown>;
  for (const field of SUMMARY_FIELDS) {
    const value = record[field];
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return '';
}

/**
 * Render events as one line each: revision, kind, origin, and the gist.
 *
 * The revision leads every line because it is what the agent passes back as a
 * cursor — a pretty list without it would be a dead end.
 */
export function renderEvents(events: ExchangeEvent[]): string {
  if (events.length === 0) return '(nothing new)';
  return events
    .map((event) => {
      const gist = summarize(event.payload);
      return `r${event.revision} ${event.kind} (${event.origin})${gist ? ` — ${gist}` : ''}`;
    })
    .join('\n');
}
