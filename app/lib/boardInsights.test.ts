import { describe, expect, it } from 'vitest';
import { boardInsightStream, splitStack } from './boardInsights';
import type { GalaxyNodeInput } from './galaxyLayout';

function node(over: Partial<GalaxyNodeInput> & { id: string }): GalaxyNodeInput {
  return {
    themeId: null,
    kind: 'suggestion',
    label: 'The whiteboard is a symptom of an ownership gap',
    detail: null,
    status: 'answered',
    ...over,
  };
}

describe('boardInsightStream', () => {
  // The board's own nodes carry no timestamps in a fixture. Every one of them
  // gets the SAME stand-in, so nothing was written after anything and nothing
  // reads as stale — staleness would be a claim about answers nobody gave.
  it('reads an undated map as one cohort in which nothing is stale', () => {
    const stream = boardInsightStream([
      node({ id: 'i-1' }),
      node({
        id: 'q-1',
        themeId: 't-who',
        kind: 'open-question',
        label: 'Who is carrying it?',
        status: 'answered',
      }),
    ]);

    expect(stream.insights).toHaveLength(1);
    expect(stream.insights[0]?.stale).toBe(false);
    expect(stream.answersSinceNewest).toBe(0);
  });

  // A themed node of an insight kind is a card in that row, not a claim about
  // the whole idea. This is the rule the whole stack rests on, so it is checked
  // through the board's own entry point and not only through insightStream.
  it('leaves a themed insight in its row rather than putting it on the stack', () => {
    const stream = boardInsightStream([
      node({ id: 'i-loose' }),
      node({ id: 'i-themed', themeId: 't-keeping' }),
    ]);

    expect(stream.insights.map((i) => i.id)).toEqual(['i-loose']);
  });

  // Real rows carry real dates, and staleness has to survive the trip through
  // the board's node shape: an answer that landed AFTER an insight was written
  // puts the insight behind the thinking.
  it('marks a dated insight the person has since answered past', () => {
    const stream = boardInsightStream([
      node({
        id: 'i-early',
        createdAt: '2026-08-30T10:00:00.000Z',
        updatedAt: '2026-08-30T10:00:00.000Z',
      }),
      node({
        id: 'q-later',
        themeId: 't-who',
        kind: 'open-question',
        label: 'Who is carrying it?',
        status: 'answered',
        createdAt: '2026-08-30T09:00:00.000Z',
        updatedAt: '2026-08-30T11:00:00.000Z',
      }),
    ]);

    expect(stream.insights[0]?.answersSince).toBe(1);
    expect(stream.insights[0]?.stale).toBe(true);
  });

  // The citations the card renders as "What this came out of" arrive as a
  // parsed array on the board, where the server hands the stream a raw string.
  it('resolves the citations the board passes as an array', () => {
    const stream = boardInsightStream([
      node({ id: 'i-1', fromNodeIds: ['q-1', 'q-gone'] }),
      node({
        id: 'q-1',
        themeId: 't-who',
        kind: 'open-question',
        label: 'Who is carrying it?',
      }),
    ]);

    // The dangling id is dropped rather than rendered blank — the node it names
    // may since have been deleted.
    expect(stream.insights[0]?.from).toEqual([
      { id: 'q-1', label: 'Who is carrying it?' },
    ]);
  });

  // Day one: a board with nothing on it at all. This is the state every capture
  // produces, so it must be a clean empty rather than a throw.
  it('reads an empty board as an empty stream', () => {
    const stream = boardInsightStream([]);
    expect(stream.insights).toEqual([]);
    expect(stream.live).toBe(0);
    expect(stream.stale).toBe(0);
  });
});

describe('splitStack', () => {
  // Fewer than the limit: everything stands and there is no affordance to draw.
  it('shows everything and hides nothing when the stack is short', () => {
    expect(splitStack(['a', 'b'], 4)).toEqual({ shown: ['a', 'b'], hidden: 0 });
  });

  // Exactly the limit is the boundary that produces a phantom "show 0 older"
  // if the arithmetic is wrong by one.
  it('draws no affordance when the stack is exactly full', () => {
    expect(splitStack(['a', 'b', 'c', 'd'], 4)).toEqual({
      shown: ['a', 'b', 'c', 'd'],
      hidden: 0,
    });
  });

  // Over the limit: four stand, the rest are counted for the affordance's label.
  it('counts the overflow so the affordance can name it', () => {
    expect(splitStack(['a', 'b', 'c', 'd', 'e', 'f'], 4)).toEqual({
      shown: ['a', 'b', 'c', 'd'],
      hidden: 2,
    });
  });

  // An empty stack never reaches this — the empty state renders instead — but
  // it must not produce a negative hidden count if it ever does.
  it('hides nothing on an empty stack', () => {
    expect(splitStack([], 4)).toEqual({ shown: [], hidden: 0 });
  });

  // A zero or negative limit is a misconfiguration, not a request to show
  // everything: it collapses the column entirely rather than defeating the
  // bound the limit exists to enforce.
  it('collapses the column rather than unbounding it on a zero limit', () => {
    expect(splitStack(['a', 'b'], 0)).toEqual({ shown: [], hidden: 2 });
  });
});
