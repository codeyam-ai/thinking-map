// Folding a branch away, as an operation on the layout's INPUT.
//
// A collapsed subtree is removed from the array handed to layoutMap, so the
// remaining tree genuinely re-tidies and gets narrower — which is what lets the
// fit scale it back up above the legibility floor. Hiding nodes after layout
// would leave the holes behind and keep the map exactly as wide, delivering
// none of the benefit.
//
// Pure and separate from the layout so it is testable without a DOM, in the
// same spirit as mapCaption and nodeShellClasses.

interface Nodeish {
  id: string;
  parentId: string | null;
}

/** Children by parent id, for walking down from a node. */
function childIndex<T extends Nodeish>(nodes: readonly T[]): Map<string, T[]> {
  const byParent = new Map<string, T[]>();
  for (const node of nodes) {
    if (node.parentId === null) continue;
    const siblings = byParent.get(node.parentId);
    if (siblings) siblings.push(node);
    else byParent.set(node.parentId, [node]);
  }
  return byParent;
}

/**
 * Every descendant of `id`, at any depth. The starting node is not included.
 *
 * Guards against a parentId cycle the same way the layout does — a malformed
 * map should still fold rather than hang.
 */
function descendants<T extends Nodeish>(
  byParent: Map<string, T[]>,
  id: string,
): Set<string> {
  const found = new Set<string>();
  const queue = [id];
  while (queue.length > 0) {
    const current = queue.pop() as string;
    for (const child of byParent.get(current) ?? []) {
      if (found.has(child.id)) continue;
      found.add(child.id);
      queue.push(child.id);
    }
  }
  return found;
}

/**
 * The nodes still on the map once `collapsedIds` are folded.
 *
 * A collapsed node stays — folding hides what is under a node, not the node
 * itself, and the pill is what you click to unfold it again.
 */
export function visibleNodes<T extends Nodeish>(
  nodes: readonly T[],
  collapsedIds: ReadonlySet<string>,
): T[] {
  if (collapsedIds.size === 0) return [...nodes];

  const byParent = childIndex(nodes);
  const hidden = new Set<string>();
  for (const id of collapsedIds) {
    for (const descendant of descendants(byParent, id)) hidden.add(descendant);
  }
  // A collapsed node is never hidden by its own fold. Ordinarily that is
  // already true, but a parentId cycle makes a node its own descendant — and
  // folding must never remove the pill you would click to unfold again.
  for (const id of collapsedIds) hidden.delete(id);

  return nodes.filter((node) => !hidden.has(node.id));
}

/**
 * How much is underneath a node, so a folded pill can say so.
 *
 * Counts the whole subtree, not just direct children: "8 hidden" is the honest
 * answer to what folding this branch took off the map.
 */
export function collapsedDescendantCount<T extends Nodeish>(
  nodes: readonly T[],
  id: string,
): number {
  return descendants(childIndex(nodes), id).size;
}
