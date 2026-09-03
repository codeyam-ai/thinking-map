import { describe, expect, it } from 'vitest';
import {
  conclusionCamera,
  navQuestionsOf,
  nextOpenAfter,
  openQuestionsOf,
  summaryNodesOf,
} from './boardNav';
import type {
  GalaxyNodeInput,
  PlacedCard,
  PlacedCluster,
} from './galaxyLayout';

const card = (
  id: string,
  over: Partial<PlacedCard> = {},
): PlacedCard => ({
  id,
  themeId: 't1',
  kind: 'open-question',
  label: `Question ${id}`,
  detail: null,
  status: 'open',
  x: 0,
  y: 0,
  w: 300,
  hue: 200,
  ...over,
});

const cluster = (cards: PlacedCard[], hue = 200): PlacedCluster => ({
  theme: { id: 't1', label: 'A line of thinking', hue, order: 0 },
  x: 0,
  y: 0,
  cards,
});

describe('openQuestionsOf', () => {
  // The ordinary case, and the order the bar's "next" walks.
  it('reads row by row, left to right, the way the board reads', () => {
    const clusters = [
      cluster([card('a'), card('b')]),
      { ...cluster([card('c')]), theme: { id: 't2', label: 'B', hue: 40, order: 1 } },
    ];

    expect(openQuestionsOf(clusters).map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  // An answered card is not waiting on anybody, so it must not be counted as
  // waiting — this is the difference between the bar telling the truth and the
  // bar being a node counter.
  it('drops answered cards', () => {
    const clusters = [
      cluster([card('a'), card('b', { status: 'answered' })]),
    ];

    expect(openQuestionsOf(clusters).map((c) => c.id)).toEqual(['a']);
  });

  // The partner's own thinking is shown TO you rather than asked OF you. A
  // gap or a finding sitting on the board with status 'open' would otherwise
  // be counted as a question waiting for an answer nobody asked for.
  it('drops the partner’s own thinking even when its status reads open', () => {
    const clusters = [
      cluster([
        card('a'),
        card('gap', { kind: 'gap' }),
        card('finding', { kind: 'finding' }),
        card('risk', { kind: 'risk' }),
      ]),
    ];

    expect(openQuestionsOf(clusters).map((c) => c.id)).toEqual(['a']);
  });

  // A card CARRYING something — a drawn shape, a picture — is showing it to
  // you whatever its kind. `isOpenCard` already encodes that; this holds the
  // bar to the same rule so a diagram card is not counted as a question.
  it('drops a card that carries a diagram or a picture', () => {
    const clusters = [
      cluster([
        card('a'),
        card('drawn', { diagram: { steps: ['one', 'two'] } }),
        card('shot', { imageUrl: 'https://example.test/a.png' }),
      ]),
    ];

    expect(openQuestionsOf(clusters).map((c) => c.id)).toEqual(['a']);
  });

  // A board before the partner has drawn anything, which is every map's first
  // few seconds. It must read as none rather than throwing on the empty fan.
  it('is empty on a board with no clusters at all', () => {
    expect(openQuestionsOf([])).toEqual([]);
  });
});

describe('nextOpenAfter', () => {
  const cards = [card('a'), card('b'), card('c')];

  // The ordinary press: one step along the row you are already reading.
  it('goes to the one after where you are', () => {
    expect(nextOpenAfter(cards, 'a')?.id).toBe('b');
  });

  // The clause that makes the count a loop rather than a dead end: pressing it
  // on the last question has to come back round, not stop.
  it('wraps from the last back to the first', () => {
    expect(nextOpenAfter(cards, 'c')?.id).toBe('a');
  });

  // The first press of a session, before anyone has touched a card.
  it('starts at the beginning when nothing is focused', () => {
    expect(nextOpenAfter(cards, null)?.id).toBe('a');
  });

  // The state after answering: the focused card leaves the open list, so the
  // id no longer resolves. Starting over is the only honest answer — anything
  // derived from the missing card's old position would send someone to a
  // question chosen by where a card they just finished used to be.
  it('starts at the beginning when the focused card is no longer open', () => {
    expect(nextOpenAfter(cards, 'answered-and-gone')?.id).toBe('a');
  });

  // Null rather than a throw or a wrap onto nothing: the caller reads it as
  // "stay put", which is the right answer on a board with nothing open.
  it('has nowhere to go on an empty board', () => {
    expect(nextOpenAfter([], 'a')).toBeNull();
  });

  // One question is a legitimate board, and pressing the count there must not
  // hang or throw — it re-lands on the same card.
  it('re-lands on the only question there is', () => {
    expect(nextOpenAfter([card('only')], 'only')?.id).toBe('only');
  });
});

describe('navQuestionsOf', () => {
  // The list carries the card's OWN colour so a question in the list and the
  // question on the board are visibly the same object.
  it('carries each question’s words and its card’s colour', () => {
    expect(
      navQuestionsOf([card('a', { label: 'Who is it for?', hue: 318 })]),
    ).toEqual([{ id: 'a', label: 'Who is it for?', hue: 318 }]);
  });
});

describe('summaryNodesOf', () => {
  const node = (over: Partial<GalaxyNodeInput> = {}): GalaxyNodeInput => ({
    id: 'n1',
    themeId: null,
    kind: 'known',
    label: 'Vocabulary fits ages 6-8',
    detail: null,
    status: 'open',
    ...over,
  });

  // The two fields the far-end column needs and the board's own nodes carry,
  // so the column and the cards behind it are one reading of one map.
  it('carries the fields the plan groups and orders by', () => {
    expect(summaryNodesOf([node({ order: 3, testsNodeId: 'n9' })])).toEqual([
      {
        id: 'n1',
        kind: 'known',
        label: 'Vocabulary fits ages 6-8',
        detail: null,
        order: 3,
        testsNodeId: 'n9',
        tradeoffs: null,
      },
    ]);
  });

  // An isolated fixture has no reason to invent an order for every node. One
  // cohort in which nothing sorts ahead of anything is the right reading of
  // that, and it keeps the plan's regions in a stable order rather than an
  // arbitrary one.
  it('puts undated nodes in one cohort rather than sorting them at random', () => {
    const [a, b] = summaryNodesOf([node({ id: 'a' }), node({ id: 'b' })]);
    expect(a.order).toBe(0);
    expect(b.order).toBe(0);
  });

  // A node that never named a target is not a broken link — it is a slice that
  // settles nothing, which the far end marks rather than hides.
  it('reads a missing testsNodeId as settling nothing', () => {
    expect(summaryNodesOf([node()])[0].testsNodeId).toBeNull();
  });
});

describe('conclusionCamera', () => {
  const convergence = { x: 1000, y: 0 };

  // The plan is read from its beginning, so the camera frames the TOP of the
  // column — which means looking at a point half a viewport below it.
  it('looks half a viewport below the column’s top edge', () => {
    const { y } = conclusionCamera({ convergence, viewportHeight: 900 });
    expect(y).toBeGreaterThan(convergence.y);
  });

  // The regression this function exists to hold. Framing the column's top edge
  // at the top of the SCREEN puts it under the bar, which is pinned there —
  // the headline was cut in half. The camera has to look further down by the
  // bar's height, so the plan starts BELOW it.
  it('leaves the bar room, rather than framing the headline underneath it', () => {
    const withBar = conclusionCamera({ convergence, viewportHeight: 900 });
    const flushToTop = convergence.y + 900 / 2 / withBar.scale;
    expect(withBar.y).toBeLessThan(flushToTop);
  });

  // The column hangs off the convergence point rather than being centred on
  // it, so aiming at the point itself would frame its left edge.
  it('centres on the column rather than on the convergence point itself', () => {
    expect(conclusionCamera({ convergence, viewportHeight: 900 }).x).toBeGreaterThan(
      convergence.x,
    );
  });

  // Reading size, not fit-everything size. A finished map often lays out as one
  // core card and a column a long way from it, and framing both renders the
  // plan's type at a size nobody can read.
  it('holds a reading scale whatever the viewport', () => {
    expect(conclusionCamera({ convergence, viewportHeight: 400 }).scale).toBe(
      conclusionCamera({ convergence, viewportHeight: 1600 }).scale,
    );
  });
});
