import { describe, expect, it } from 'vitest';
import {
  INSIGHT_STREAM_KINDS,
  TARGET_LIVE_INSIGHTS,
  answeredAt,
  insightStream,
  resolveCitations,
  type InsightNode,
} from './insightStream';

// The rules behind "the partner keeps supplying insights". They are worth
// pinning here rather than reading off the board because two different callers
// depend on them agreeing — the agent's `read_map` and the browser — and a
// disagreement between those two shows up as an insight counted in one place
// and drawn in the other, which is exactly the bug a shared module prevents.

const node = (over: Partial<InsightNode> & Pick<InsightNode, 'id' | 'kind'>): InsightNode => ({
  label: over.label ?? over.id,
  detail: null,
  themeId: null,
  status: 'answered',
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z',
  ...over,
});

/** A question the person has answered, settled at the given time. Created
 *  earlier than it was answered, because that gap is the thing several of
 *  these tests turn on. */
const answered = (id: string, at: string): InsightNode =>
  node({
    id,
    kind: 'open-question',
    status: 'answered',
    createdAt: '2026-01-01T09:00:00.000Z',
    updatedAt: at,
  });

describe('insightStream', () => {
  // Day one, and the state every capture actually produces. All zeros rather
  // than a thrown error or a partly-filled object, because the surface that
  // renders this has to read a brand-new map without a special case.
  it('returns all zeros for a map with nothing on it', () => {
    expect(insightStream([])).toEqual({
      insights: [],
      live: 0,
      stale: 0,
      answersSinceNewest: 0,
    });
  });

  // The rule the whole module exists to hold in ONE place. A themed node of an
  // insight kind is a card inside its row; only a themeless one is a claim
  // about the whole idea. Getting this wrong draws the same node twice.
  it('counts a themeless insight and ignores the same kind inside a theme', () => {
    const stream = insightStream([
      node({ id: 'loose', kind: 'suggestion' }),
      node({ id: 'inrow', kind: 'suggestion', themeId: 'th1' }),
    ]);
    expect(stream.insights.map((i) => i.id)).toEqual(['loose']);
    expect(stream.live).toBe(1);
  });

  // A node arriving over JSON carries `undefined` where the database row
  // carried null. An insight that silently stopped counting for that reason
  // would be the precise drift this module exists to prevent.
  it('treats an absent themeId the same as a null one', () => {
    const loose = node({ id: 'loose', kind: 'finding' });
    delete (loose as Partial<InsightNode>).themeId;
    expect(insightStream([loose]).live).toBe(1);
  });

  // A `problem` or a `goal` is a piece of the idea, not a claim about it. The
  // kind set is a design decision, so moving a kind in or out of it should have
  // to be done deliberately rather than by editing a filter.
  it('counts only the kinds that are a claim about the whole idea', () => {
    const nodes = ['problem', 'goal', 'open-question', 'idea', 'next-step'].map(
      (kind) => node({ id: kind, kind }),
    );
    expect(insightStream(nodes).insights).toHaveLength(0);

    const insights = [...INSIGHT_STREAM_KINDS].map((kind) => node({ id: kind, kind }));
    expect(insightStream(insights).insights).toHaveLength(INSIGHT_STREAM_KINDS.size);
  });

  // Staleness is "the thinking has moved on since this was written", and it is
  // read off timestamps rather than the event log — which is what lets this
  // module stay pure and serve both the server and the browser.
  it('marks an insight stale once answers have landed after it', () => {
    const stream = insightStream([
      node({ id: 'old', kind: 'finding', createdAt: '2026-01-01T10:00:00.000Z' }),
      answered('q1', '2026-01-01T11:00:00.000Z'),
      answered('q2', '2026-01-01T11:30:00.000Z'),
    ]);
    expect(stream.insights[0].answersSince).toBe(2);
    expect(stream.insights[0].stale).toBe(true);
    expect(stream.live).toBe(0);
    expect(stream.stale).toBe(1);
  });

  // The other half of the same rule: an answer given BEFORE the insight was
  // written is what the insight was drawn from, not something it is behind.
  it('does not count answers that predate the insight', () => {
    const stream = insightStream([
      answered('q1', '2026-01-01T09:30:00.000Z'),
      node({ id: 'fresh', kind: 'finding', createdAt: '2026-01-01T10:00:00.000Z' }),
    ]);
    expect(stream.insights[0].answersSince).toBe(0);
    expect(stream.live).toBe(1);
    expect(stream.stale).toBe(0);
  });

  // Nothing is hidden by being stale. An insight the thinking has moved past is
  // still worth reading, and dropping it would silently shrink the board.
  it('keeps a stale insight in the list rather than dropping it', () => {
    const stream = insightStream([
      node({ id: 'old', kind: 'risk', createdAt: '2026-01-01T10:00:00.000Z' }),
      answered('q1', '2026-01-01T11:00:00.000Z'),
    ]);
    expect(stream.insights.map((i) => i.id)).toEqual(['old']);
  });

  // The number the standing ask reports. It is measured from the NEWEST
  // insight, because that is what "how far behind are you" means — an old stale
  // insight should not make a board that was just topped up read as behind.
  it('measures answersSinceNewest from the newest insight only', () => {
    const stream = insightStream([
      node({ id: 'old', kind: 'finding', createdAt: '2026-01-01T10:00:00.000Z' }),
      answered('q1', '2026-01-01T11:00:00.000Z'),
      node({ id: 'new', kind: 'suggestion', createdAt: '2026-01-01T12:00:00.000Z' }),
    ]);
    expect(stream.insights[0].id).toBe('new');
    expect(stream.answersSinceNewest).toBe(0);
    expect(stream.live).toBe(1);
    expect(stream.stale).toBe(1);
  });

  // Newest first, which is the order both the ask and the board read.
  it('orders insights newest first', () => {
    const stream = insightStream([
      node({ id: 'first', kind: 'finding', createdAt: '2026-01-01T10:00:00.000Z' }),
      node({ id: 'second', kind: 'finding', createdAt: '2026-01-01T11:00:00.000Z' }),
      node({ id: 'third', kind: 'finding', createdAt: '2026-01-01T12:00:00.000Z' }),
    ]);
    expect(stream.insights.map((i) => i.id)).toEqual(['third', 'second', 'first']);
  });

  // A batch written in one transaction shares a timestamp to the millisecond.
  // `getMap` already ordered them, so a tie must leave them alone rather than
  // shuffling them by a tiebreak nobody chose.
  it('leaves insights written in the same instant in the order they arrived', () => {
    const at = '2026-01-01T10:00:00.000Z';
    const stream = insightStream([
      node({ id: 'a', kind: 'finding', createdAt: at }),
      node({ id: 'b', kind: 'suggestion', createdAt: at }),
      node({ id: 'c', kind: 'experiment', createdAt: at }),
    ]);
    expect(stream.insights.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  // The point of the provenance pointer: the person can see the thinking behind
  // a claim instead of taking it on trust.
  it('resolves the questions an insight came out of', () => {
    const stream = insightStream([
      answered('q1', '2026-01-01T09:30:00.000Z'),
      answered('q2', '2026-01-01T09:31:00.000Z'),
      node({
        id: 'i1',
        kind: 'suggestion',
        createdAt: '2026-01-01T10:00:00.000Z',
        fromNodeIds: ['q1', 'q2'],
      }),
    ]);
    expect(stream.insights[0].from).toEqual([
      { id: 'q1', label: 'q1' },
      { id: 'q2', label: 'q2' },
    ]);
  });

  // The server has the JSON string the column stores; the browser usually has
  // the array. Both have to work, or one of the two callers reads no provenance
  // at all while looking like it succeeded.
  it('accepts the stored JSON string as well as a parsed array', () => {
    const stream = insightStream([
      answered('q1', '2026-01-01T09:30:00.000Z'),
      node({
        id: 'i1',
        kind: 'finding',
        createdAt: '2026-01-01T10:00:00.000Z',
        fromNodeIds: JSON.stringify(['q1']),
      }),
    ]);
    expect(stream.insights[0].from).toEqual([{ id: 'q1', label: 'q1' }]);
  });

  // Read on every `read_map`. One bad row written by an older agent must not be
  // able to take down the map's entire rendering.
  it('yields no citations for a malformed or absent value rather than throwing', () => {
    for (const fromNodeIds of [null, undefined, 'not json', '{"a":1}', '[]'] as const) {
      const stream = insightStream([node({ id: 'i1', kind: 'finding', fromNodeIds })]);
      expect(stream.insights[0].from).toEqual([]);
    }
  });
});

describe('answeredAt', () => {
  // The rule this function exists to hold: a question is CREATED open and
  // UPDATED when it is answered, so `createdAt` dates the ASKING. Reading it
  // here would make every insight look current however far the thinking moved.
  it('dates an answer by when it was given, not when the question was asked', () => {
    expect(answeredAt([answered('q1', '2026-01-01T11:00:00.000Z')])).toEqual([
      Date.parse('2026-01-01T11:00:00.000Z'),
    ]);
  });

  // A question still open is not an answer, and an insight is not a question.
  it('ignores unanswered questions and everything that is not a question', () => {
    expect(
      answeredAt([
        node({ id: 'q1', kind: 'open-question', status: 'open' }),
        node({ id: 'i1', kind: 'finding', status: 'answered' }),
      ]),
    ).toEqual([]);
  });

  // Timestamps arrive as a Date from Prisma and as a string after a JSON round
  // trip. An unparseable one sorts as epoch rather than NaN, which would make
  // every comparison against it false and silently drop it from every count.
  it('reads a Date, an ISO string, and a value it cannot parse', () => {
    const at = new Date('2026-01-01T11:00:00.000Z');
    expect(
      answeredAt([
        node({ id: 'a', kind: 'open-question', updatedAt: at }),
        node({ id: 'b', kind: 'open-question', updatedAt: '2026-01-01T11:00:00.000Z' }),
        node({ id: 'c', kind: 'open-question', updatedAt: 'whenever' }),
      ]),
    ).toEqual([at.getTime(), at.getTime(), 0]);
  });
});

describe('resolveCitations', () => {
  const byId = new Map([['q1', node({ id: 'q1', kind: 'open-question', label: 'Who for?' })]]);

  // The tolerance `testsNodeId` is documented to have: the node an insight
  // named may since have been deleted, and an insight that stopped reading
  // because one of its sources is gone would be worse than one citing fewer.
  it('drops an id that names nothing and keeps the rest', () => {
    expect(resolveCitations(['q1', 'deleted-long-ago'], byId)).toEqual([
      { id: 'q1', label: 'Who for?' },
    ]);
  });

  // The ordinary case: most nodes cite nothing, so the empty path is the one
  // this runs down on nearly every read and must not throw or invent an entry.
  it('returns nothing for an empty list', () => {
    expect(resolveCitations([], byId)).toEqual([]);
  });
});

describe('TARGET_LIVE_INSIGHTS', () => {
  // Exported so the ask and any surface that wants to say "one short" read the
  // same number. A second copy of it somewhere else is the drift to prevent.
  it('is a positive target the ask can be measured against', () => {
    expect(TARGET_LIVE_INSIGHTS).toBeGreaterThan(0);
  });
});
