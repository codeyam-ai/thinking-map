import AgentHandoff from './AgentHandoff';
import AgentStatus from './AgentStatus';
import AppHeader from './AppHeader';
import MapWorkspace from './MapWorkspace';
import SummaryScreen from './SummaryScreen';
import type { BriefCoverage } from '../lib/briefCoverage';
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
  brief,
  seedIdea,
}: {
  phase: Phase;
  nodes: FlatNode[] & SummaryNode[];
  /** Only the working view needs it — the summary has no map to arrange. */
  mapId?: string;
  /** Only the working view takes it too: the plan view has no map to
   *  annotate, so brief coverage has nothing to sit beside there. */
  brief?: { sourceName: string; coverage: BriefCoverage };
  /** Quoted back by the handoff panel, so a person whose idea nobody has picked
   *  up can see it was kept. Optional the whole way down, matching `brief`, so
   *  an isolated scenario can mount the map without inventing one. */
  seedIdea?: string;
}) {
  return (
    <main className="flex h-screen flex-col gap-3 px-4 py-4 sm:px-6 lg:gap-6 lg:px-10 lg:py-8">
      <AppHeader phase={phase} status={<AgentStatus />} />
      {mapId ? (
        <AgentHandoff
          mapId={mapId}
          seedIdea={seedIdea}
          hasBrief={brief !== undefined}
        />
      ) : null}
      {phase === 'next-steps' ? (
        <SummaryScreen nodes={nodes} />
      ) : (
        <MapWorkspace
          nodes={nodes}
          caption={mapCaption(nodes)}
          mapId={mapId}
          brief={brief}
          phase={phase}
        />
      )}
    </main>
  );
}
