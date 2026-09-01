// Tidy-tree layout for the thinking map.
//
// The map is the product's signature, so its geometry is deliberate: a node is
// centered over its children, siblings never overlap, and the whole tree is
// measured in absolute pixels here so both the server render and the client
// scale-to-fit agree on one set of coordinates.

import type { NodeKind, NodeStatus } from './mapKinds';

export interface FlatNode {
  id: string;
  parentId: string | null;
  kind: string;
  label: string;
  detail: string | null;
  status: string;
  sourceUrl: string | null;
  order: number;
}

export interface LaidOutNode {
  id: string;
  parentId: string | null;
  kind: NodeKind;
  label: string;
  detail: string | null;
  status: NodeStatus;
  sourceUrl: string | null;
  depth: number;
  /** Top-left corner, in map pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface MapLayout {
  nodes: LaidOutNode[];
  width: number;
  height: number;
}

const H_GAP = 28;
const LEVEL_HEIGHT = 148;
const ROOT_WIDTH = 288;
const NODE_HEIGHT = 56;
const ROOT_HEIGHT = 62;
const PAD = 24;

/**
 * Node width grows with its label so long text stays on two lines at most,
 * which is what keeps the pill reading as a pill rather than a paragraph.
 */
function measureWidth(label: string, isRoot: boolean): number {
  if (isRoot) return ROOT_WIDTH;
  const estimate = label.length * 7.4 + 44;
  return Math.round(Math.min(268, Math.max(148, estimate)));
}

interface TreeNode {
  node: FlatNode;
  depth: number;
  children: TreeNode[];
  width: number;
  height: number;
  /** Width of this node's whole subtree, used to place siblings. */
  subtreeWidth: number;
  x: number;
}

/**
 * Build the layout. Nodes arrive flat from the database; the only edge we
 * store is parentId, so the tree is reconstructed here.
 *
 * Orphans (a parentId pointing at a node that is not in the set) are treated
 * as roots rather than dropped — a half-written map should still draw.
 */
export function layoutMap(flat: FlatNode[]): MapLayout {
  if (flat.length === 0) return { nodes: [], width: 0, height: 0 };

  const byId = new Map<string, TreeNode>();
  for (const node of flat) {
    byId.set(node.id, {
      node,
      depth: 0,
      children: [],
      width: 0,
      height: 0,
      subtreeWidth: 0,
      x: 0,
    });
  }

  const roots: TreeNode[] = [];
  for (const tn of byId.values()) {
    const parent = tn.node.parentId ? byId.get(tn.node.parentId) : undefined;
    if (parent) parent.children.push(tn);
    else roots.push(tn);
  }

  const sortByOrder = (a: TreeNode, b: TreeNode) =>
    a.node.order - b.node.order || a.node.id.localeCompare(b.node.id);
  roots.sort(sortByOrder);
  for (const tn of byId.values()) tn.children.sort(sortByOrder);

  // Depth, size, and subtree width in one post-order pass. Guard against a
  // parentId cycle so a malformed map cannot hang the render.
  const seen = new Set<string>();
  const measure = (tn: TreeNode, depth: number): number => {
    if (seen.has(tn.node.id)) {
      tn.children = [];
    }
    seen.add(tn.node.id);

    tn.depth = depth;
    const isRoot = depth === 0;
    tn.width = measureWidth(tn.node.label, isRoot);
    tn.height = isRoot ? ROOT_HEIGHT : NODE_HEIGHT;

    if (tn.children.length === 0) {
      tn.subtreeWidth = tn.width;
      return tn.subtreeWidth;
    }
    let childSpan = 0;
    for (const child of tn.children) {
      childSpan += measure(child, depth + 1) + H_GAP;
    }
    childSpan -= H_GAP;
    tn.subtreeWidth = Math.max(tn.width, childSpan);
    return tn.subtreeWidth;
  };
  for (const root of roots) measure(root, 0);

  // Place each subtree left-to-right, then center every parent over its span.
  const place = (tn: TreeNode, left: number) => {
    tn.x = left + (tn.subtreeWidth - tn.width) / 2;
    let cursor = left;
    if (tn.children.length > 0) {
      const childSpan = tn.children.reduce(
        (sum, c, i) => sum + c.subtreeWidth + (i > 0 ? H_GAP : 0),
        0,
      );
      cursor = left + (tn.subtreeWidth - childSpan) / 2;
      for (const child of tn.children) {
        place(child, cursor);
        cursor += child.subtreeWidth + H_GAP;
      }
    }
  };
  let rootCursor = 0;
  for (const root of roots) {
    place(root, rootCursor);
    rootCursor += root.subtreeWidth + H_GAP * 2;
  }

  const nodes: LaidOutNode[] = [];
  let maxX = 0;
  let maxY = 0;
  for (const tn of byId.values()) {
    const x = tn.x + PAD;
    const y = tn.depth * LEVEL_HEIGHT + PAD;
    maxX = Math.max(maxX, x + tn.width);
    maxY = Math.max(maxY, y + tn.height);
    nodes.push({
      id: tn.node.id,
      parentId: tn.node.parentId,
      kind: tn.node.kind as NodeKind,
      label: tn.node.label,
      detail: tn.node.detail,
      status: tn.node.status as NodeStatus,
      sourceUrl: tn.node.sourceUrl,
      depth: tn.depth,
      x,
      y,
      width: tn.width,
      height: tn.height,
    });
  }

  nodes.sort((a, b) => a.depth - b.depth || a.x - b.x);
  return { nodes, width: maxX + PAD, height: maxY + PAD };
}

/**
 * The orthogonal dotted connector from a parent down to one child: out of the
 * parent's bottom edge, across a shared horizontal bus, then down into the
 * child's top edge. The bus sits midway between the two levels so sibling
 * connectors share it, which is what makes the tree read as one structure.
 */
export function connectorPath(parent: LaidOutNode, child: LaidOutNode): string {
  const px = Math.round(parent.x + parent.width / 2);
  const py = parent.y + parent.height;
  const cx = Math.round(child.x + child.width / 2);
  const cy = child.y;
  const bus = Math.round(py + (cy - py) / 2);
  if (px === cx) return `M ${px} ${py} L ${px} ${cy}`;
  return `M ${px} ${py} L ${px} ${bus} L ${cx} ${bus} L ${cx} ${cy}`;
}
