import { describe, expect, it } from 'vitest';
import { cardThreads } from './cardThreads';
import type { Round } from './mapRounds';
import type { FlatNode } from './mapLayout';

const node = (
  id: string,
  parentId: string | null,
  kind = 'open-question',
): FlatNode => ({
  id,
  parentId,
  kind,
  label: id,
  detail: null,
  status: 'answered',
  sourceUrl: null,
  order: 0,
});

const round = (index: number, nodes: FlatNode[]): Round => ({
  index,
  nodes,
  phase: null,
});

// A thread says "this card came out of that one". Drawing one where that is
// not true is worse than drawing none, because the map's whole claim is that
// the connections it shows are real.
describe('cardThreads', () => {
  // The ordinary case: the round above prompted the round below.
  it('threads a card to its parent in the round directly above', () => {
    const threads = cardThreads([
      round(1, [node('root', null, 'idea')]),
      round(2, [node('a', 'root'), node('b', 'root')]),
    ]);

    expect(threads.map((t) => t.childId)).toEqual(['a', 'b']);
    expect(threads.every((t) => t.parentId === 'root')).toBe(true);
  });

  // A line spanning several rounds is a claim about ancestry that the rows
  // already record and that no reader could follow across the cards between.
  it('draws nothing when the parent is more than one round back', () => {
    const threads = cardThreads([
      round(1, [node('root', null, 'idea')]),
      round(2, [node('a', 'root')]),
      round(3, [node('c', 'root')]),
    ]);

    expect(threads.map((t) => t.childId)).toEqual(['a']);
  });

  // The root has nothing above it, and a node the agent added without a parent
  // is legitimately unattached. Both draw nothing rather than reaching.
  it('draws nothing for a card with no parent', () => {
    const threads = cardThreads([
      round(1, [node('root', null, 'idea')]),
      round(2, [node('orphan', null)]),
    ]);

    expect(threads).toEqual([]);
  });

  // A parent that is not on the map at all — a half-written or partly-loaded
  // map — must not produce a thread to nowhere.
  it('draws nothing when the parent is missing from the map', () => {
    const threads = cardThreads([
      round(1, [node('root', null, 'idea')]),
      round(2, [node('a', 'ghost')]),
    ]);

    expect(threads).toEqual([]);
  });

  // A whole round of user-added nodes attached to nothing is a real shape, and
  // it should be silent rather than half-drawn.
  it('draws nothing for a round where nothing has a parent above', () => {
    const threads = cardThreads([
      round(1, [node('root', null, 'idea')]),
      round(2, [node('a', null), node('b', null)]),
    ]);

    expect(threads).toEqual([]);
  });

  // The thread is coloured by the CHILD's family — the card the eye is
  // travelling toward — so the child's kind has to come back with it.
  it('carries the child kind, not the parent kind', () => {
    const threads = cardThreads([
      round(1, [node('root', null, 'idea')]),
      round(2, [node('a', 'root', 'finding')]),
    ]);

    expect(threads[0]!.childKind).toBe('finding');
  });

  // The drawing layer needs every id in the child's round to work out which
  // cards ended up on the row's first line after a wrap.
  it('carries the ids of every card in the child round', () => {
    const threads = cardThreads([
      round(1, [node('root', null, 'idea')]),
      round(2, [node('a', 'root'), node('b', 'root'), node('c', null)]),
    ]);

    expect(threads[0]!.roundIds).toEqual(['a', 'b', 'c']);
  });

  // A map with only the root, and an empty map, are both ordinary states.
  it('draws nothing for a map with a single round', () => {
    expect(cardThreads([round(1, [node('root', null, 'idea')])])).toEqual([]);
    expect(cardThreads([])).toEqual([]);
  });
});
