'use client';

import { useCallback, useMemo, useState } from 'react';
import MapConnectors from './MapConnectors';
import MapNodePill from './MapNodePill';
import MapViewportControls from './MapViewportControls';
import { useMapViewport } from '../hooks/useMapViewport';
import { collapsedDescendantCount, visibleNodes } from '../lib/collapse';
import { layoutMap, type FlatNode } from '../lib/mapLayout';

/**
 * The right-hand panel: the conversation rendered as structure, and now
 * something the person can actually handle.
 *
 * Composition only — layout geometry lives in mapLayout, the viewport in
 * useMapViewport, folding in collapse, and the two visual layers in their own
 * components. What lives here is the wiring between them, and the two pieces of
 * state neither side should own: which branches this viewer has folded, and the
 * nudges they have made but the server has not confirmed yet.
 */
export default function ThinkingMapView({
  nodes,
  caption,
  mapId,
}: {
  nodes: FlatNode[];
  caption?: string;
  /** Absent in an isolated scenario, where there is no map to write back to.
   *  Without it the map is still fully manipulable — the arrangement simply
   *  does not outlive the page. */
  mapId?: string;
}) {
  // Collapse is per-viewer and deliberately unpersisted: it is a reading
  // posture, not a property of the map. Two people can reasonably want
  // different branches folded at the same moment, and an agent has no business
  // seeing a subtree disappear.
  const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(new Set());
  // A nudge is optimistic — the pill has to land where it was dropped, not a
  // round trip later.
  const [nudges, setNudges] = useState<Record<string, { x: number; y: number }>>({});
  // The drag currently in flight. It lives here rather than inside the pill so
  // that it feeds the layout: the node and its dotted connector are then two
  // readings of one position and travel together, instead of the pill sliding
  // away from an edge that only catches up on release.
  const [dragging, setDragging] = useState<{
    id: string;
    dx: number;
    dy: number;
  } | null>(null);

  const arranged = useMemo(
    () =>
      nodes.map((node) => {
        const pending = nudges[node.id];
        const live = dragging?.id === node.id ? dragging : null;
        if (!pending && !live) return node;
        const baseX = pending?.x ?? node.offsetX ?? 0;
        const baseY = pending?.y ?? node.offsetY ?? 0;
        return {
          ...node,
          offsetX: baseX + (live?.dx ?? 0),
          offsetY: baseY + (live?.dy ?? 0),
        };
      }),
    [nodes, nudges, dragging],
  );

  // Folding filters the layout's INPUT, so the remaining tree genuinely
  // re-tidies and gets narrower. That is what lets an oversized map scale back
  // up above the legibility floor; hiding pills after layout would leave the
  // holes and keep the map just as wide.
  const layout = useMemo(
    () => layoutMap(visibleNodes(arranged, collapsed)),
    [arranged, collapsed],
  );

  const {
    frameRef,
    planeRef,
    scale,
    frameWidth,
    isCustom,
    panning,
    zoomIn,
    zoomOut,
    fitToMap,
    onPointerDown,
  } = useMapViewport(layout.width, layout.height);

  const toggleCollapse = useCallback((id: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  const dragMove = useCallback(
    (id: string, dx: number, dy: number) => setDragging({ id, dx, dy }),
    [],
  );

  const nudge = useCallback(
    (id: string, dx: number, dy: number) => {
      setDragging(null);
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      const base = nudges[id];
      const offsetX = Math.round((base?.x ?? node.offsetX ?? 0) + dx);
      const offsetY = Math.round((base?.y ?? node.offsetY ?? 0) + dy);
      setNudges((current) => ({ ...current, [id]: { x: offsetX, y: offsetY } }));

      if (!mapId) return;
      // Fire-and-forget, and deliberately not an exchange event: the activity
      // rail records what the two sides thought, and rearranging furniture is
      // not that. A failed write leaves the optimistic position standing until
      // the next load, which is the right cost for a move.
      void fetch(`/api/maps/${mapId}/positions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ nodeId: id, offsetX, offsetY }]),
      }).catch(() => {});
    },
    [mapId, nodes, nudges],
  );

  // Counted over the whole map rather than the visible slice, so a folded
  // branch keeps reporting how much it is holding.
  const hiddenCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const node of layout.nodes) {
      counts.set(node.id, collapsedDescendantCount(arranged, node.id));
    }
    return counts;
  }, [layout.nodes, arranged]);

  // `min-w-0` below is load-bearing: a flex item defaults to `min-width: auto`,
  // so without it the panel grows to the map's full width instead of scrolling,
  // and the overflow is silently clipped out of reach.
  return (
    <section className="relative flex min-h-0 min-w-0 flex-1 flex-col rounded-[20px] border border-line bg-surface p-6">
      <header className="mb-2 flex shrink-0 items-baseline gap-3">
        <span className="eyebrow">Live map</span>
        {caption ? (
          <span className="text-[12.5px] text-muted">{caption}</span>
        ) : null}
      </header>

      <div
        ref={frameRef}
        className="min-h-0 flex-1 overflow-auto"
        style={{ cursor: panning ? 'grabbing' : undefined }}
        onPointerDown={onPointerDown}
      >
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
              ref={planeRef}
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
                <MapNodePill
                  key={node.id}
                  node={node}
                  scale={scale}
                  collapsed={collapsed.has(node.id)}
                  hiddenCount={hiddenCounts.get(node.id) ?? 0}
                  onDragMove={dragMove}
                  onNudge={nudge}
                  onToggleCollapse={toggleCollapse}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* An empty map has nothing to zoom, drag or fold, and controls that
          implied otherwise would be a promise the map cannot keep. */}
      {layout.nodes.length > 0 ? (
        <MapViewportControls
          scale={scale}
          isCustom={isCustom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onFit={fitToMap}
        />
      ) : null}
    </section>
  );
}
