import BriefPanel from './BriefPanel';
import ExchangeColumn from './ExchangeColumn';
import ThinkingMapView from './ThinkingMapView';
import type { BriefCoverage } from '../lib/briefCoverage';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The working view: the map, the client's brief on one side, and the page's
 * half of the exchange on the other.
 *
 * The agent lives in the browser now, not in the app, so there is no
 * conversation here to render — the page cannot see it and under WebMCP never
 * will. The map keeps the frame, because the map is the artifact both sides are
 * working on; the column beside it is only what this page genuinely owns.
 *
 * The brief is a third pane rather than a takeover, and it is absent entirely
 * when the map has no brief — a map started from one line must look exactly as
 * it did before this pane existed.
 */
export default function MapWorkspace({
  nodes,
  caption,
  mapId,
  brief,
}: {
  nodes: FlatNode[];
  caption: string;
  /** Passed through so a nudged node can be written back. Optional the whole
   *  way down, so an isolated scenario mounts the map without inventing one. */
  mapId?: string;
  /** Present only when this map was started from a brief. Optional for the
   *  same reason `mapId` is: an isolated scenario mounts the map without
   *  having to invent a document for it. */
  brief?: { sourceName: string; coverage: BriefCoverage };
}) {
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      {brief ? (
        <BriefPanel sourceName={brief.sourceName} coverage={brief.coverage} />
      ) : null}
      <ThinkingMapView nodes={nodes} caption={caption} mapId={mapId} />
      <ExchangeColumn nodes={nodes} />
    </div>
  );
}
