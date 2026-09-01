import AgentStatus from './AgentStatus';
import AppHeader from './AppHeader';
import MapWorkspace from './MapWorkspace';
import SummaryScreen from './SummaryScreen';
import { mapCaption } from '../lib/mapCaption';
import type { Phase } from '../lib/mapKinds';
import type { FlatNode } from '../lib/mapLayout';
import type { SummaryNode } from '../lib/summaryGroups';

/**
 * The whole map surface: the header, and whichever view the phase calls for.
 *
 * The two views are the same map at different moments — the working tree while
 * the thinking is live, the plan once it has run out — so choosing between them
 * belongs here rather than in the route, which should only fetch and mount.
 */
export default function MapScreen({
  phase,
  nodes,
  mapId,
}: {
  phase: Phase;
  nodes: FlatNode[] & SummaryNode[];
  /** Only the working view needs it — the summary has no map to arrange. */
  mapId?: string;
}) {
  return (
    <main className="flex h-screen flex-col gap-6 px-10 py-8">
      <AppHeader phase={phase} status={<AgentStatus />} />
      {phase === 'next-steps' ? (
        <SummaryScreen nodes={nodes} />
      ) : (
        <MapWorkspace nodes={nodes} caption={mapCaption(nodes)} mapId={mapId} />
      )}
    </main>
  );
}
