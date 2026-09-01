import AgentAvatar from './AgentAvatar';
import ExchangeNote from './ExchangeNote';
import type { RailEntry } from '../lib/exchangeRail';

/**
 * One thing that happened to the map.
 *
 * A row is a record, not a turn in a conversation — so it is one line, marked
 * with the side that caused it, and it does not invite a reply.
 */
export default function ExchangeRow({ entry }: { entry: RailEntry }) {
  return (
    <li className="flex gap-2.5 py-2">
      {entry.origin === 'agent' ? (
        <AgentAvatar />
      ) : (
        // The person's rows get a hollow counterpart to the agent's disc — same
        // size and same top margin, so the rail reads as one column of events.
        <span
          className="mt-1 block h-6 w-6 shrink-0 rounded-full border border-line"
          aria-hidden="true"
        />
      )}

      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-snug text-ink">{entry.text}</p>
        {entry.note ? <ExchangeNote text={entry.note} /> : null}
      </div>
    </li>
  );
}
