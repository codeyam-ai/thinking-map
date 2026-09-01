'use client';

import NodeFoldToggle from './NodeFoldToggle';
import { useNodeDrag } from '../hooks/useNodeDrag';
import { ACCENT_KINDS, KIND_EYEBROW } from '../lib/mapKinds';
import { nodeShellClasses } from '../lib/nodeAppearance';
import type { LaidOutNode } from '../lib/mapLayout';

/**
 * One node on the map. Every node carries an eyebrow naming its kind, so the
 * map reads without a legend; the shell treatment comes from nodeShellClasses,
 * where the status-precedence rule lives.
 *
 * Presentational, deliberately: a drag reports a delta upward and a fold
 * reports a toggle, rather than either reaching for a store. What a nudge
 * *means* — an offset from the tidy position, not a coordinate — is the
 * caller's business, not this component's.
 */
export default function MapNodePill({
  node,
  scale = 1,
  collapsed = false,
  hiddenCount = 0,
  onDragMove,
  onNudge,
  onToggleCollapse,
}: {
  node: LaidOutNode;
  /** The plane's zoom, so pointer travel on screen becomes travel in map
   *  pixels. Without it a nudge would drift further the further you zoom in. */
  scale?: number;
  collapsed?: boolean;
  /** How much this node is hiding, when folded. */
  hiddenCount?: number;
  /** A drag in flight, as a delta in map pixels. Fires on every move so the
   *  caller can re-lay-out and the node's connector travels with it. */
  onDragMove?: (id: string, dx: number, dy: number) => void;
  /** A committed drag, as a delta in map pixels. */
  onNudge?: (id: string, dx: number, dy: number) => void;
  onToggleCollapse?: (id: string) => void;
}) {
  const isRoot = node.kind === 'idea' && node.depth === 0;
  const accent = ACCENT_KINDS[node.kind];
  const shell = nodeShellClasses({
    kind: node.kind,
    status: node.status,
    isRoot,
  });

  const { dragging, onPointerDown } = useNodeDrag({
    id: node.id,
    scale,
    onDragMove,
    onNudge,
  });

  // `hiddenCount` is the whole subtree, counted before any folding, so it stays
  // truthful while the branch is folded and the affordance does not vanish
  // under the person the moment they use it.
  const foldable = onToggleCollapse !== undefined && hiddenCount > 0;

  return (
    <div
      className="node-in absolute flex flex-col"
      style={{
        // `left`/`top` rather than a transform, deliberately: `.node-in`
        // animates `transform` with `animation-fill-mode: both`, so its final
        // keyframe keeps applying after the animation ends — and an animated
        // property beats an inline one in the cascade, which silently swallowed
        // a translate and left the node pinned until pointerup.
        left: node.x,
        top: node.y,
        width: node.width,
        // A dragged node rides above its neighbours, so it is never lost behind
        // one on the way to where it is going.
        zIndex: dragging ? 20 : undefined,
        cursor: onNudge ? (dragging ? 'grabbing' : 'grab') : undefined,
        // Otherwise the browser claims the gesture as a scroll or a selection
        // and the drag dies a few pixels in.
        touchAction: onNudge ? 'none' : undefined,
      }}
      onPointerDown={onPointerDown}
    >
      <span
        className="eyebrow mb-1.5 block truncate pl-1"
        style={
          node.status === 'updated' ? { color: 'var(--lime-deep)' } : undefined
        }
      >
        {KIND_EYEBROW[node.kind] ?? node.kind}
        {node.status === 'updated' ? ' · just updated' : ''}
        {/* The map is co-authored, so the parts the person wrote say so. This
            is the same fact the tools read to avoid re-ingesting their own
            writes — badge and tool contract agree by construction. */}
        {node.origin === 'user' ? ' · yours' : ''}
      </span>
      <div
        className={`relative flex items-center justify-center rounded-full border px-4 text-center ${shell}`}
        style={{ height: node.height }}
        title={node.detail ?? undefined}
      >
        {accent === 'find' ? (
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            className="mr-2 shrink-0"
            aria-hidden="true"
          >
            <circle
              cx="6"
              cy="6"
              r="4.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="M9.2 9.2 L12.5 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        ) : null}
        <span
          className={`line-clamp-2 leading-tight ${
            isRoot ? 'text-[15px] font-bold' : 'text-[14px] font-semibold'
          }`}
        >
          {node.label}
        </span>

        {foldable ? (
          <NodeFoldToggle
            label={node.label}
            collapsed={collapsed}
            hiddenCount={hiddenCount}
            onToggle={() => onToggleCollapse?.(node.id)}
          />
        ) : null}
      </div>
    </div>
  );
}
