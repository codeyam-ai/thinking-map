'use client';

import MapConnectors from './MapConnectors';
import MapNodePill from './MapNodePill';
import { useFitToFrame } from '../hooks/useFitToFrame';
import { layoutMap, type FlatNode } from '../lib/mapLayout';

/**
 * The right-hand panel: the conversation rendered as structure.
 *
 * Composition only — layout geometry lives in mapLayout, the fit-and-centre
 * behaviour in useFitToFrame, and the two visual layers in their own
 * components.
 */
export default function ThinkingMapView({
  nodes,
  caption,
}: {
  nodes: FlatNode[];
  caption?: string;
}) {
  const layout = layoutMap(nodes);
  const { frameRef, scale, frameWidth } = useFitToFrame(
    layout.width,
    layout.height,
  );

  // `min-w-0` below is load-bearing: a flex item defaults to `min-width: auto`,
  // so without it the panel grows to the map's full width instead of scrolling,
  // and the overflow is silently clipped out of reach.
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col rounded-[20px] border border-line bg-surface p-6">
      <header className="mb-2 flex shrink-0 items-baseline gap-3">
        <span className="eyebrow">Live map</span>
        {caption ? (
          <span className="text-[12.5px] text-muted">{caption}</span>
        ) : null}
      </header>

      <div ref={frameRef} className="min-h-0 flex-1 overflow-auto">
        {layout.nodes.length === 0 ? (
          <p className="pt-16 text-center text-[13px] text-muted">
            The map fills in as you answer.
          </p>
        ) : (
          <div
            className="relative"
            style={{
              width: layout.width * scale,
              height: layout.height * scale,
              // Centre only while the map fits: an `auto` inline margin in a
              // scroll container pushes the left overflow out of reach.
              marginInline: layout.width * scale < frameWidth ? 'auto' : 0,
            }}
          >
            <div
              className="absolute left-0 top-0"
              style={{
                width: layout.width,
                height: layout.height,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <MapConnectors
                nodes={layout.nodes}
                width={layout.width}
                height={layout.height}
              />
              {layout.nodes.map((node) => (
                <MapNodePill key={node.id} node={node} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
