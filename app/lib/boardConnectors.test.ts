import { describe, expect, it } from 'vitest';
import { fanPath, joinPath, rowDone } from './boardConnectors';
import type { PlacedCard, PlacedCluster } from './galaxyLayout';

// The lines between things on the board.
//
// String math, which is the reason it is worth testing at all: a wrong control
// point yields a kinked or backwards curve, and neither the type checker nor a
// screenshot of a board that happens to look fine will say so.

const card = (over: Partial<PlacedCard> = {}): PlacedCard => ({
  id: 'c',
  themeId: 't',
  kind: 'open-question',
  label: 'c',
  detail: null,
  status: 'open',
  hue: 318,
  x: 1000,
  y: 0,
  w: 300,
  ...over,
});

const cluster = (over: Partial<PlacedCluster> = {}): PlacedCluster => ({
  theme: { id: 't', label: 't', hue: 318, order: 0 },
  x: 1180,
  y: 620,
  cards: [],
  ...over,
});

/** Every coordinate in a path string, in order. */
const numbersIn = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('fanPath', () => {
  // The curve has to LEAVE the idea flat and ARRIVE at the row flat — that is
  // what makes a bundle of them splay rather than read as loose diagonals. Flat
  // at both ends means the first control point shares the idea's y and the
  // second shares the row's.
  it('leaves the idea flat and arrives at the row flat', () => {
    const d = fanPath(250, 66, { x: 1180, y: 620 });
    const [, startY, , c1y, , c2y, , endY] = numbersIn(d);

    expect(startY).toBe(0);
    expect(c1y).toBe(0);
    expect(c2y).toBe(620);
    expect(endY).toBe(620);
  });

  // It must start on the idea's rim and stop at the hub's, not at either
  // centre — a curve drawn to the centre disappears under the circle it is
  // pointing at.
  it('runs rim to rim rather than centre to centre', () => {
    const d = fanPath(250, 66, { x: 1180, y: 620 });
    const n = numbersIn(d);

    expect(n[0]).toBe(250);
    expect(n[6]).toBe(1180 - 66);
  });

  // Both control points share one x, midway along the run. That symmetry is
  // what keeps the curve from leaning toward either end.
  it('places both control points midway along the run', () => {
    const d = fanPath(250, 66, { x: 1180, y: 620 });
    const n = numbersIn(d);
    const mid = (250 + 1180) / 2;

    expect(n[2]).toBe(mid);
    expect(n[4]).toBe(mid);
  });

  // A row on the idea's own line is the middle row of an odd-numbered board,
  // and its connector is a straight run rather than a special case.
  it('handles a row level with the idea', () => {
    const d = fanPath(250, 66, { x: 1180, y: 0 });

    expect(numbersIn(d).filter((_, i) => i % 2 === 1).every((y) => y === 0)).toBe(
      true,
    );
  });

  // Rows above the idea have negative y, and the curve is the MIRROR of a row
  // below rather than a clamped or flattened version of it — a clamp would send
  // every upper row to the idea's own line and stack them on each other.
  it('mirrors for a row above the idea', () => {
    const above = numbersIn(fanPath(250, 66, { x: 1180, y: -620 }));
    const below = numbersIn(fanPath(250, 66, { x: 1180, y: 620 }));

    // Same horizontals: the curve's shape along x does not depend on which side
    // of the idea the row sits.
    expect([above[0], above[2], above[4], above[6]]).toEqual([
      below[0],
      below[2],
      below[4],
      below[6],
    ]);
    // Opposite verticals at the two ends that actually carry the row's y.
    expect(above[5]).toBe(-below[5]);
    expect(above[7]).toBe(-below[7]);
    expect(above[7]).toBe(-620);
  });
});

describe('joinPath', () => {
  // The return curve starts at the RIGHT EDGE of the last card, not its origin
  // — starting at the origin would draw the line back through the card.
  it('leaves from the far edge of the last card', () => {
    const c = cluster({ cards: [card({ x: 1000, w: 300 })] });
    const d = joinPath(c, 3000);

    expect(numbersIn(d!)[0]).toBe(1300);
  });

  // It arrives flat on the idea's line, which is what makes the rows read as
  // coming back TOGETHER rather than as converging on one of them.
  it('arrives flat on the conclusion’s line', () => {
    const c = cluster({ y: 620, cards: [card({ x: 1000, w: 300 })] });
    const n = numbersIn(joinPath(c, 3000)!);

    expect(n[1]).toBe(620);
    expect(n[5]).toBe(0);
    expect(n[7]).toBe(0);
  });

  // Nothing to leave FROM. A curve drawn from the hub instead would promise a
  // conclusion this line of thinking has not reached.
  it('draws nothing for a row with no cards', () => {
    expect(joinPath(cluster({ cards: [] }), 3000)).toBeNull();
  });

  // The wide card case again, from the other end: the join must start past the
  // card's own width or it begins underneath it.
  it('accounts for the last card’s width, not just its position', () => {
    const narrow = joinPath(cluster({ cards: [card({ x: 1000, w: 300 })] }), 3000);
    const wide = joinPath(cluster({ cards: [card({ x: 1000, w: 420 })] }), 3000);

    expect(numbersIn(wide!)[0]).toBeGreaterThan(numbersIn(narrow!)[0]);
  });
});

describe('rowDone', () => {
  // The whole point: the line to the conclusion is only drawn once every
  // question in the row has an answer.
  it('is done when every question in the row is answered', () => {
    const c = cluster({
      cards: [
        card({ id: 'a', status: 'answered' }),
        card({ id: 'b', status: 'answered' }),
      ],
    });

    expect(rowDone(c)).toBe(true);
  });

  // One open question is enough to keep the row unfinished — a conclusion drawn
  // over an unanswered question claims something the board cannot show.
  it('is not done while any question is still open', () => {
    const c = cluster({
      cards: [card({ id: 'a', status: 'answered' }), card({ id: 'b', status: 'open' })],
    });

    expect(rowDone(c)).toBe(false);
  });

  // An empty row has not STARTED, and "every question is answered" is vacuously
  // true of no questions — which would run a conclusion line off a line of
  // thinking nobody has said anything in.
  it('is not done when the row has no questions at all', () => {
    expect(rowDone(cluster({ cards: [] }))).toBe(false);
  });

  // Insights are the partner's own thinking, not something anyone was asked.
  // A row holding only those has still not been answered.
  it('does not count insights as answered questions', () => {
    const c = cluster({
      cards: [card({ id: 'a', kind: 'assumption', status: 'answered' })],
    });

    expect(rowDone(c)).toBe(false);
  });

  // Insights sitting alongside questions must not dilute the check either way:
  // what decides it is the questions.
  it('judges a mixed row on its questions alone', () => {
    const done = cluster({
      cards: [
        card({ id: 'i', kind: 'finding', status: 'open' }),
        card({ id: 'q', status: 'answered' }),
      ],
    });
    expect(rowDone(done)).toBe(true);

    const notDone = cluster({
      cards: [
        card({ id: 'i', kind: 'finding', status: 'answered' }),
        card({ id: 'q', status: 'open' }),
      ],
    });
    expect(rowDone(notDone)).toBe(false);
  });
});
