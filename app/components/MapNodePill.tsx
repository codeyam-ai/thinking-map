import { ACCENT_KINDS, KIND_EYEBROW } from '../lib/mapKinds';
import { nodeShellClasses } from '../lib/nodeAppearance';
import type { LaidOutNode } from '../lib/mapLayout';

/**
 * One node on the map. Every node carries an eyebrow naming its kind, so the
 * map reads without a legend; the shell treatment comes from nodeShellClasses,
 * where the status-precedence rule lives.
 */
export default function MapNodePill({ node }: { node: LaidOutNode }) {
  const isRoot = node.kind === 'idea' && node.depth === 0;
  const accent = ACCENT_KINDS[node.kind];
  const shell = nodeShellClasses({
    kind: node.kind,
    status: node.status,
    isRoot,
  });

  return (
    <div
      className="node-in absolute flex flex-col"
      style={{ left: node.x, top: node.y, width: node.width }}
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
        className={`flex items-center justify-center rounded-full border px-4 text-center ${shell}`}
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
      </div>
    </div>
  );
}
