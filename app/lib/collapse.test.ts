import { describe, expect, it } from 'vitest';
import { collapsedDescendantCount, visibleNodes } from './collapse';

// Folding is an operation on the layout's INPUT, so what these assert is which
// rows survive the filter — not what the map paints. A collapsed subtree that
// merely disappeared visually would leave the tree exactly as wide, and the
// whole point of folding is that the remaining tree re-tidies and gets narrower.

interface Row {
  id: string;
  parentId: string | null;
}

//        root
//      /      \
//    a          b
//   / \          \
//  a1  a2         b1
//      |
//      a2x
const TREE: Row[] = [
  { id: 'root', parentId: null },
  { id: 'a', parentId: 'root' },
  { id: 'b', parentId: 'root' },
  { id: 'a1', parentId: 'a' },
  { id: 'a2', parentId: 'a' },
  { id: 'a2x', parentId: 'a2' },
  { id: 'b1', parentId: 'b' },
];

const ids = (rows: Row[]) => rows.map((r) => r.id);

describe('visibleNodes', () => {
  // Nothing folded is the ordinary case and must not disturb the input.
  it('returns every node when nothing is collapsed', () => {
    expect(ids(visibleNodes(TREE, new Set()))).toEqual(ids(TREE));
  });

  // The folded node itself stays — it is what you click to unfold again.
  it('keeps the collapsed node and drops only what is under it', () => {
    const visible = ids(visibleNodes(TREE, new Set(['a'])));
    expect(visible).toContain('a');
    expect(visible).not.toContain('a1');
    expect(visible).not.toContain('a2');
    expect(visible).toEqual(['root', 'a', 'b', 'b1']);
  });

  // Folding is depth-unbounded: a grandchild goes with its parent's branch.
  it('drops descendants at every depth, not just direct children', () => {
    expect(ids(visibleNodes(TREE, new Set(['a'])))).not.toContain('a2x');
  });

  // Two folded branches are independent of each other.
  it('handles several collapsed branches at once', () => {
    expect(ids(visibleNodes(TREE, new Set(['a', 'b'])))).toEqual(['root', 'a', 'b']);
  });

  // Folding the root leaves the root alone on the map, not an empty map.
  it('leaves just the root when the root is collapsed', () => {
    expect(ids(visibleNodes(TREE, new Set(['root'])))).toEqual(['root']);
  });

  // A leaf has nothing underneath, so folding it is a no-op rather than an error.
  it('is a no-op for a node with no children', () => {
    expect(ids(visibleNodes(TREE, new Set(['b1'])))).toEqual(ids(TREE));
  });

  // An id that is not on the map must not disturb the result.
  it('ignores a collapsed id that matches no node', () => {
    expect(ids(visibleNodes(TREE, new Set(['ghost'])))).toEqual(ids(TREE));
  });

  // The map panel renders before any node exists, so folding must survive the
  // day-one map rather than assuming there is a tree to walk.
  it('returns an empty list for an empty map', () => {
    expect(visibleNodes([], new Set(['a']))).toEqual([]);
  });

  // The layout guards against a parentId cycle so a malformed map still draws;
  // folding has to survive the same input rather than spinning on it.
  it('terminates on a parentId cycle', () => {
    const cyclic: Row[] = [
      { id: 'x', parentId: 'y' },
      { id: 'y', parentId: 'x' },
      { id: 'z', parentId: null },
    ];
    expect(ids(visibleNodes(cyclic, new Set(['x'])))).toEqual(['x', 'z']);
  });
});

describe('collapsedDescendantCount', () => {
  // The count is the whole subtree, because that is what folding takes away.
  it('counts every descendant, not just direct children', () => {
    expect(collapsedDescendantCount(TREE, 'a')).toBe(3);
  });

  // The `+1` case, which is where an off-by-one in the walk would show first.
  it('counts a single-child branch', () => {
    expect(collapsedDescendantCount(TREE, 'b')).toBe(1);
  });

  // Zero is what makes the fold affordance stay off a leaf.
  it('is zero for a leaf', () => {
    expect(collapsedDescendantCount(TREE, 'a2x')).toBe(0);
  });

  // The starting node is excluded from its own count, so the root reports six
  // of the seven rows rather than all seven.
  it('counts everything below the root', () => {
    expect(collapsedDescendantCount(TREE, 'root')).toBe(6);
  });

  // A node deleted between render and count must read as zero rather than
  // throwing under the pill that asked.
  it('is zero for an id that is not on the map', () => {
    expect(collapsedDescendantCount(TREE, 'ghost')).toBe(0);
  });
});
