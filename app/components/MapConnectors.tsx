import { connectorPath, type LaidOutNode } from '../lib/mapLayout';

/**
 * The dotted edge layer beneath the node pills.
 *
 * Dotted because the structure is provisional — this is thinking in progress,
 * not an org chart.
 */
export default function MapConnectors({
  nodes,
  width,
  height,
}: {
  nodes: LaidOutNode[];
  width: number;
  height: number;
}) {
  const byId = new Map(nodes.map((n) => [n.id, n]));

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      width={width}
      height={height}
      aria-hidden="true"
    >
      {nodes.map((node) => {
        const parent = node.parentId ? byId.get(node.parentId) : undefined;
        if (!parent) return null;
        return (
          <g key={`edge-${node.id}`}>
            <path
              d={connectorPath(parent, node)}
              fill="none"
              stroke="var(--thread)"
              strokeWidth={1.5}
              strokeDasharray="3 4"
              strokeLinecap="round"
            />
            <circle
              cx={Math.round(node.x + node.width / 2)}
              cy={node.y}
              r={3}
              fill="var(--thread)"
            />
          </g>
        );
      })}
    </svg>
  );
}
