import PhaseNav from './PhaseNav';
import Wordmark from './Wordmark';
import type { Phase } from '../lib/mapKinds';

/**
 * Wordmark left, phase track right. Shared by the landing and map screens.
 *
 * `status` is the map screen's slot for agent presence, which belongs beside
 * the phase nav rather than buried in the exchange column. The landing screen
 * passes nothing — there is no map for an agent to be attached to yet.
 */
export default function AppHeader({
  phase,
  status,
}: {
  phase: Phase;
  status?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-8">
      <Wordmark />
      <div className="flex items-center gap-6">
        {status}
        <PhaseNav active={phase} />
      </div>
    </header>
  );
}
