import { describe, expect, it } from 'vitest';
import {
  CARD_SIZE,
  layOutGalaxy,
  type GalaxyNodeInput,
  type GalaxyTheme,
} from './galaxyLayout';

// Where everything sits on the board.
//
// The layout is a pure function from nodes to coordinates, which is exactly
// where a real regression hides: a wide card that fails to push its neighbours
// along, a conclusion drawn on top of the last card of the longest row. None of
// that is a type error and none of it is caught by a screenshot of the one
// board that happens to look fine.
//
// Deliberately NOT screenshot diffing: it is slow, it is flaky, and it would go
// red on every intentional design tweak. What is asserted here is the
// RELATIONSHIPS between placements, never the pixel values, so the fan can be
// retuned without rewriting the suite.

const theme = (id: string, order: number, hue = 318): GalaxyTheme => ({
  id,
  label: id,
  hue,
  order,
});

const node = (
  id: string,
  themeId: string | null,
  over: Partial<GalaxyNodeInput> = {},
): GalaxyNodeInput => ({
  id,
  themeId,
  kind: 'open-question',
  label: id,
  detail: null,
  status: 'open',
  ...over,
});

describe('layOutGalaxy', () => {
  // The running-sum accumulator, and the single most breakable line in the
  // file. Placing each card at `index * constant` looks identical on a board
  // where every card is the standard width and silently overlaps the moment one
  // of them is wide.
  it('runs a theme’s cards left to right from its hub', () => {
    const layout = layOutGalaxy(
      [theme('t', 0)],
      [node('a', 't'), node('b', 't'), node('c', 't')],
    );
    const [cluster] = layout.clusters;
    const xs = cluster.cards.map((c) => c.x);

    expect(xs).toHaveLength(3);
    expect(xs[0]).toBeGreaterThan(cluster.x);
    expect(xs[1]).toBeGreaterThan(xs[0]);
    expect(xs[2]).toBeGreaterThan(xs[1]);
  });

  // The regression the accumulator exists to prevent, stated directly: the gap
  // after a wide card must be at least that card's own width, or its neighbour
  // is drawn on top of it.
  it('lets a wide card push its neighbour along instead of overlapping it', () => {
    const layout = layOutGalaxy(
      [theme('t', 0)],
      [
        node('wide', 't', { diagram: { steps: ['one', 'two'] } }),
        node('after', 't'),
      ],
    );
    const [wide, after] = layout.clusters[0].cards;

    expect(after.x - wide.x).toBeGreaterThanOrEqual(wide.w);
    expect(after.x).toBeGreaterThanOrEqual(wide.x + wide.w);
  });

  // `widthFor` is not exported, so its rule is asserted through the placement
  // it produces — which is the thing that actually matters anyway. A card that
  // gained a diagram but kept the narrow column is the regression: the content
  // is then squeezed into a strip.
  it('gives a card carrying a diagram or a picture the wider column', () => {
    const layout = layOutGalaxy(
      [theme('t', 0)],
      [
        node('plain', 't'),
        node('drawn', 't', { diagram: { steps: ['one'] } }),
        node('shown', 't', { imageUrl: 'https://example.test/a.png' }),
      ],
    );
    const [plain, drawn, shown] = layout.clusters[0].cards;

    expect(plain.w).toBe(CARD_SIZE.width);
    expect(drawn.w).toBeGreaterThan(plain.w);
    expect(shown.w).toBe(drawn.w);
  });

  // Rows stack in the theme's declared order and are centred on the idea, so a
  // two-theme map is balanced rather than looking like a three-theme map that
  // lost one.
  it('stacks themes in order and centres them on the idea', () => {
    const layout = layOutGalaxy(
      [theme('a', 0), theme('b', 1), theme('c', 2)],
      [],
    );
    const ys = layout.clusters.map((c) => c.y);

    expect(layout.clusters.map((c) => c.theme.id)).toEqual(['a', 'b', 'c']);
    expect(ys[0]).toBeLessThan(ys[1]);
    expect(ys[1]).toBeLessThan(ys[2]);
    // The middle row of an odd number of rows sits on the idea's own line.
    expect(ys[1]).toBe(layout.core.y);
  });

  // Order is a property of the theme, not of the array it arrived in — the
  // agent may write them in any order and a reload may return them in another.
  it('sorts by declared order rather than by array position', () => {
    const layout = layOutGalaxy(
      [theme('last', 2), theme('first', 0), theme('middle', 1)],
      [],
    );

    expect(layout.clusters.map((c) => c.theme.id)).toEqual([
      'first',
      'middle',
      'last',
    ]);
  });

  // A theme with no cards is a line of thinking that has not produced questions
  // yet, not an absent one. Dropping its hub would make the board silently
  // forget a direction the partner had already opened.
  it('still places a hub for a theme that has no cards yet', () => {
    const layout = layOutGalaxy(
      [theme('empty', 0), theme('full', 1)],
      [node('a', 'full')],
    );
    const empty = layout.clusters.find((c) => c.theme.id === 'empty');

    expect(empty).toBeDefined();
    expect(empty?.cards).toEqual([]);
    expect(Number.isFinite(empty?.x)).toBe(true);
    expect(Number.isFinite(empty?.y)).toBe(true);
  });

  // Asserted as a RELATIONSHIP against rows of different lengths, never against
  // a hardcoded number: the conclusion must clear the longest run, and a
  // constant that happened to clear the longest run in one fixture would pass
  // while overlapping in every board with more cards.
  it('puts the convergence clear of the longest row', () => {
    const layout = layOutGalaxy(
      [theme('short', 0), theme('long', 1)],
      [
        node('s1', 'short'),
        node('l1', 'long'),
        node('l2', 'long'),
        node('l3', 'long'),
        node('l4', 'long'),
      ],
    );

    const furthest = Math.max(
      ...layout.clusters.flatMap((c) => c.cards.map((k) => k.x + k.w)),
    );
    expect(layout.convergence.x).toBeGreaterThan(furthest);
    // It sits on the idea's line, which is what makes the rows read as coming
    // back TOGETHER rather than as bending toward one of them.
    expect(layout.convergence.y).toBe(layout.core.y);
  });

  // A node belongs to exactly one row, and one that names no theme — the root
  // idea — belongs to none of them. Leaking it into a cluster would draw the
  // idea twice, once in the middle and once as a card.
  it('puts each card only in its own theme, and themeless nodes in none', () => {
    const layout = layOutGalaxy(
      [theme('a', 0), theme('b', 1)],
      [node('rootish', null), node('a1', 'a'), node('b1', 'b')],
    );

    expect(layout.clusters[0].cards.map((c) => c.id)).toEqual(['a1']);
    expect(layout.clusters[1].cards.map((c) => c.id)).toEqual(['b1']);
    expect(
      layout.clusters.flatMap((c) => c.cards.map((k) => k.id)),
    ).not.toContain('rootish');
  });

  // The card carries its theme's hue so a renderer never has to hold both
  // collections to draw one card — and so a card can never be drawn in a colour
  // its own row is not.
  it('copies the owning theme’s hue onto every card', () => {
    const layout = layOutGalaxy(
      [theme('a', 0, 318), theme('b', 1, 96)],
      [node('a1', 'a'), node('b1', 'b')],
    );

    expect(layout.clusters[0].cards[0].hue).toBe(318);
    expect(layout.clusters[1].cards[0].hue).toBe(96);
  });

  // The day-one board. An empty map has to frame on something real: seeded from
  // an inverted-infinity box the bounds come back as ±Infinity and the camera
  // has nothing to fit to, so the board opens blank.
  it('returns a renderable layout for a map with nothing on it', () => {
    const layout = layOutGalaxy([], []);

    expect(layout.clusters).toEqual([]);
    expect(layout.core).toBeDefined();
    for (const v of [
      layout.bounds.minX,
      layout.bounds.minY,
      layout.bounds.maxX,
      layout.bounds.maxY,
      layout.convergence.x,
    ]) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(layout.bounds.maxX).toBeGreaterThan(layout.bounds.minX);
    expect(layout.bounds.maxY).toBeGreaterThan(layout.bounds.minY);
  });

  // Bounds are what the opening zoom is computed from, so a card outside them
  // is a card the board opens with off-screen.
  it('grows its bounds to contain every card it placed', () => {
    const layout = layOutGalaxy(
      [theme('a', 0), theme('b', 1)],
      [node('a1', 'a'), node('a2', 'a'), node('b1', 'b')],
    );

    for (const card of layout.clusters.flatMap((c) => c.cards)) {
      expect(card.x).toBeGreaterThanOrEqual(layout.bounds.minX);
      expect(card.x + card.w).toBeLessThanOrEqual(layout.bounds.maxX);
      expect(card.y).toBeGreaterThanOrEqual(layout.bounds.minY);
      expect(card.y + CARD_SIZE.height).toBeLessThanOrEqual(layout.bounds.maxY);
    }
  });
});
