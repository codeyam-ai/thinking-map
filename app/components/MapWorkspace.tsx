import ExchangeColumn from './ExchangeColumn';
import ThinkingMapView from './ThinkingMapView';
import type { FlatNode } from '../lib/mapLayout';

/**
 * The working view: the map, and the page's half of the exchange beside it.
 *
 * The agent lives in the browser now, not in the app, so there is no
 * conversation here to render — the page cannot see it and under WebMCP never
 * will. The map gets the frame, because the map is the artifact both sides are
 * working on; the column beside it is only what this page genuinely owns.
 */
export default function MapWorkspace({
  nodes,
  caption,
  mapId,
}: {
  nodes: FlatNode[];
  caption: string;
  /** Passed through so a nudged node can be written back. Optional the whole
   *  way down, so an isolated scenario mounts the map without inventing one. */
  mapId?: string;
}) {
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <ThinkingMapView nodes={nodes} caption={caption} mapId={mapId} />
      <ExchangeColumn nodes={nodes} />
    </div>
  );
}
