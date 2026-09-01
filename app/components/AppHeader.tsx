import PhaseNav from './PhaseNav';
import Wordmark from './Wordmark';
import type { Phase } from '../lib/mapKinds';

/**
 * Wordmark left, phase track right. Shared by the landing and map screens.
 *
 * `status` is the map screen's slot for agent presence, which belongs beside
 * the phase nav rather than buried in the exchange column. The landing screen
 * passes nothing — there is no map for an agent to be attached to yet.
 *
 * Below `lg` the wordmark and the track cannot share a line with the status, so
 * the status drops to its own full-width row underneath rather than competing
 * with the track for the same space.
 */
export default function AppHeader({
  phase,
  status,
}: {
  phase: Phase;
  status?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:gap-8">
      <Wordmark />
      {/* Under `lg` the status is its own full-width row, ordered last; from
          `lg` it rejoins the track on the right-hand side. */}
      {status ? (
        <div className="order-last basis-full lg:order-none lg:basis-auto">
          {status}
        </div>
      ) : null}
      {/* `min-w-0` so the track can actually shrink: a flex item defaults to
          `min-width: auto`, the same trap documented on ThinkingMapView. */}
      <div className="flex min-w-0 items-center gap-3 lg:order-last lg:gap-6">
        <PhaseNav active={phase} />
      </div>
    </header>
  );
}
