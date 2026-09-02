'use client';

import BriefPanel from './BriefPanel';
import ContributionBar from './ContributionBar';
import Disclosure from './Disclosure';
import ExchangeRail from './ExchangeRail';
import ThinkingMapView from './ThinkingMapView';
import { useWebMcpBridge } from './WebMcpBridge';
import type { BriefCoverage } from '../lib/briefCoverage';
import type { Phase } from '../lib/mapKinds';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The working view: the map, and beneath it the two things that are not
 * questions.
 *
 * This used to be a split — the map on one side, a column of questions on the
 * other — and the argument for it was that the map is the artifact and the
 * column beside it is what the page owns. The answer changed: the page owns the
 * map AND the answering, and they are the same surface now. A question is
 * answered on its own card, so there is no column of questions left to put
 * anywhere.
 *
 * What did not fit on a card stays, folded away: somewhere to volunteer
 * something nobody asked for, and the record of what has happened. Both are
 * closed by default, because the map is what you came to look at.
 *
 * The brief is still a pane rather than a takeover, and still absent entirely
 * when the map has no brief.
 */
export default function MapWorkspace({
  nodes,
  caption,
  mapId,
  brief,
  phase,
}: {
  nodes: FlatNode[];
  caption: string;
  /** Passed straight down to the map, which is where the round footer needs it
   *  to name the action that ends the phase. */
  phase?: Phase;
  /** Passed through to the map. Optional the whole way down, so an isolated
   *  scenario mounts the map without inventing one. */
  mapId?: string;
  /** Present only when this map was started from a brief. */
  brief?: { sourceName: string; coverage: BriefCoverage };
}) {
  const { events } = useWebMcpBridge();

  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {brief ? (
        <BriefPanel sourceName={brief.sourceName} coverage={brief.coverage} />
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
        <ThinkingMapView
          nodes={nodes}
          caption={caption}
          mapId={mapId}
          phase={phase}
        />

        <Disclosure summary="Add something of your own">
          <ContributionBar />
        </Disclosure>

        <Disclosure summary={`Activity · ${events.length}`}>
          <div className="max-h-[280px] overflow-y-auto">
            <ExchangeRail events={events} />
          </div>
        </Disclosure>
      </div>
    </div>
  );
}
