import { describe, expect, it } from 'vitest';
import { connectorPath, layoutMap, type FlatNode } from './mapLayout';

const n = (
  id: string,
  parentId: string | null,
  order = 0,
  label = id,
): FlatNode => ({
  id,
  parentId,
  kind: parentId ? 'problem' : 'idea',
  label,
  detail: null,
  status: 'answered',
  sourceUrl: null,
  order,
});

const centre = (node: { x: number; width: number }) => node.x + node.width / 2;

describe('layoutMap', () => {
  // The map panel renders before any node exists, so the empty case must be a
  // clean zero rather than NaN bounds.
  it('returns an empty layout for no nodes', () => {
    expect(layoutMap([])).toEqual({ nodes: [], width: 0, height: 0 });
  });

  // Depth is what puts a node on the right row; the database stores only
  // parentId, so the tree has to be reconstructed correctly.
  it('assigns depth by ancestry', () => {
    const { nodes } = layoutMap([n('root', null), n('a', 'root'), n('b', 'a')]);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    expect(byId.root.depth).toBe(0);
    expect(byId.a.depth).toBe(1);
    expect(byId.b.depth).toBe(2);
  });

  // A tree reads as a tree only if each generation sits below the last.
  it('puts each level on its own row', () => {
    const { nodes } = layoutMap([n('root', null), n('a', 'root'), n('b', 'a')]);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    expect(byId.a.y).toBeGreaterThan(byId.root.y);
    expect(byId.b.y).toBeGreaterThan(byId.a.y);
  });

  // Centring is what makes the map look deliberate rather than left-piled; it
  // is the single most visible property of the layout.
  it('centres a parent over its children', () => {
    const { nodes } = layoutMap([
      n('root', null),
      n('a', 'root', 0),
      n('b', 'root', 1),
      n('c', 'root', 2),
    ]);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    const kids = [byId.a, byId.b, byId.c].map(centre);
    const span = (Math.min(...kids) + Math.max(...kids)) / 2;
    expect(Math.abs(centre(byId.root) - span)).toBeLessThanOrEqual(1);
  });

  // Overlapping pills would make the map unreadable, and long labels are the
  // case most likely to cause it.
  it('never overlaps siblings', () => {
    const { nodes } = layoutMap([
      n('root', null),
      n('a', 'root', 0, 'a short one'),
      n('b', 'root', 1, 'a considerably longer sibling label'),
      n('c', 'root', 2, 'c'),
    ]);
    const row = nodes.filter((node) => node.depth === 1).sort((p, q) => p.x - q.x);
    for (let i = 1; i < row.length; i += 1) {
      expect(row[i].x).toBeGreaterThanOrEqual(row[i - 1].x + row[i - 1].width);
    }
  });

  // Rows arrive from the database in creation order, so left-to-right position
  // has to come from the stored order instead.
  it('orders siblings by their order field, not insertion order', () => {
    const { nodes } = layoutMap([
      n('root', null),
      n('third', 'root', 2),
      n('first', 'root', 0),
      n('second', 'root', 1),
    ]);
    const row = nodes.filter((node) => node.depth === 1).sort((p, q) => p.x - q.x);
    expect(row.map((node) => node.id)).toEqual(['first', 'second', 'third']);
  });

  // Node width tracks its label so text stays on two lines at most, but an
  // unbounded label must not stretch the pill into a paragraph.
  it('widens a node to fit a longer label, up to a cap', () => {
    const { nodes } = layoutMap([
      n('root', null),
      n('short', 'root'),
      n('long', 'root', 1, 'x'.repeat(200)),
    ]);
    const byId = Object.fromEntries(nodes.map((node) => [node.id, node]));
    expect(byId.long.width).toBeGreaterThan(byId.short.width);
    expect(byId.long.width).toBeLessThanOrEqual(268);
  });

  // A half-written map should still draw; losing nodes silently would be worse
  // than showing an extra root.
  it('treats a node whose parent is missing as a root rather than dropping it', () => {
    const { nodes } = layoutMap([n('root', null), n('orphan', 'ghost')]);
    expect(nodes).toHaveLength(2);
    expect(nodes.find((node) => node.id === 'orphan')?.depth).toBe(0);
  });

  // A malformed parent chain must not hang the render — the map is drawn on
  // every keystroke of the conversation.
  it('terminates on a parent cycle instead of hanging', () => {
    const { nodes } = layoutMap([n('a', 'b'), n('b', 'a')]);
    expect(nodes).toHaveLength(2);
  });

  // The reported bounds drive the scale-to-fit calculation, so a node outside
  // them would be clipped out of view.
  it('reports bounds that contain every node', () => {
    const layout = layoutMap([n('root', null), n('a', 'root'), n('b', 'root', 1)]);
    for (const node of layout.nodes) {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x + node.width).toBeLessThanOrEqual(layout.width);
      expect(node.y + node.height).toBeLessThanOrEqual(layout.height);
    }
  });
});

describe('connectorPath', () => {
  const parent = { x: 100, y: 0, width: 100, height: 50 } as never;
  const child = { x: 300, y: 150, width: 100, height: 50 } as never;

  // An aligned pair should get a straight line, not a degenerate dog-leg with
  // zero-length segments.
  it('drops straight down when parent and child share a centre', () => {
    const aligned = { x: 100, y: 150, width: 100, height: 50 } as never;
    expect(connectorPath(parent, aligned)).toBe('M 150 50 L 150 150');
  });

  // Siblings share that bus, which is what makes the tree read as one
  // structure rather than a set of unrelated lines.
  it('routes through a horizontal bus midway between the two levels', () => {
    expect(connectorPath(parent, child)).toBe(
      'M 150 50 L 150 100 L 350 100 L 350 150',
    );
  });

  // A connector that started inside the parent pill or stopped short of the
  // child would leave visible gaps against the dotted stroke.
  it('starts at the parent bottom edge and ends at the child top edge', () => {
    const path = connectorPath(parent, child);
    expect(path.startsWith('M 150 50')).toBe(true);
    expect(path.endsWith('150')).toBe(true);
  });
});
