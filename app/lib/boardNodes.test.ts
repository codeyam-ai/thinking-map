import { describe, expect, it } from 'vitest';
import { boardNodesOf, type StoredNode } from './boardNodes';

const stored = (over: Partial<StoredNode> = {}): StoredNode => ({
  id: 'n1',
  kind: 'open-question',
  label: 'Who is this for?',
  detail: null,
  status: 'open',
  order: 0,
  ...over,
});

const one = (over: Partial<StoredNode> = {}) => boardNodesOf([stored(over)])[0];

describe('boardNodesOf', () => {
  // The flat fields, straight through. Nothing clever happens to them, and the
  // point of asserting it is that nothing SHOULD.
  it('carries the fields the board draws a card from', () => {
    const node = one({ themeId: 't1', detail: 'Small clinics' });
    expect(node.id).toBe('n1');
    expect(node.themeId).toBe('t1');
    expect(node.kind).toBe('open-question');
    expect(node.label).toBe('Who is this for?');
    expect(node.detail).toBe('Small clinics');
    expect(node.status).toBe('open');
  });

  // Themeless is a real state, not a missing value: it is how the far end's
  // own nodes and the partner's insights are distinguished from row cards.
  it('reads a node with no theme as belonging to no line of thinking', () => {
    expect(one().themeId).toBeNull();
  });
});

describe('boardNodesOf — choices', () => {
  // SQLite has no array column, so a shortlist arrives as a JSON string.
  it('reads a stored shortlist', () => {
    expect(one({ choices: '["Teachers","Parents"]' }).choices).toEqual([
      'Teachers',
      'Parents',
    ]);
  });

  // The degrade-to-null contract. A card that cannot render its options is
  // still a question worth asking, so a broken value must leave an open-ended
  // question rather than take the board down.
  it('degrades unparseable options to an open-ended question', () => {
    expect(one({ choices: '{not json' }).choices).toBeNull();
    expect(one({ choices: '"a string, not a list"' }).choices).toBeNull();
  });

  // A list of blanks is not a shortlist of blanks — it is no shortlist, which
  // leaves an open-ended question rather than a card of empty pills.
  it('reads a list that is empty once trimmed as no shortlist at all', () => {
    expect(one({ choices: '["","   "]' }).choices).toBeNull();
  });

  // The option becomes a pill and, once taken, part of the recorded answer, so
  // stray spacing would travel all the way into what the partner reads back.
  it('trims the options it keeps', () => {
    expect(one({ choices: '["  Teachers  "]' }).choices).toEqual(['Teachers']);
  });
});

describe('boardNodesOf — cited sources', () => {
  // The ordinary case: an insight naming the questions it came out of, which
  // is what lets the far end show its own provenance.
  it('reads the ids an insight was drawn out of', () => {
    expect(one({ fromNodeIds: '["a","b"]' }).fromNodeIds).toEqual(['a', 'b']);
  });

  // This one matters more than the others: an insight whose sources cannot be
  // read is still a claim worth showing, so a malformed value yields no
  // citations rather than throwing away the insight carrying it.
  it('keeps the insight and drops only the unreadable citations', () => {
    expect(one({ fromNodeIds: '{broken' }).fromNodeIds).toBeNull();
    expect(one({ fromNodeIds: '[1, null, ""]' }).fromNodeIds).toBeNull();
  });

  // One bad entry written by an older agent must cost that entry, not the
  // whole citation list — partial provenance beats none.
  it('keeps the usable ids out of a mixed list', () => {
    expect(one({ fromNodeIds: '["a", 2, "", "b"]' }).fromNodeIds).toEqual([
      'a',
      'b',
    ]);
  });
});

describe('boardNodesOf — diagram', () => {
  // The ordinary diagram: a sequence of stages and the one line under it.
  it('reads a drawn shape and its note', () => {
    expect(
      one({ diagram: '{"steps":["Ask","Answer"],"note":"per round"}' }).diagram,
    ).toEqual({ steps: ['Ask', 'Answer'], note: 'per round' });
  });

  // A single step is not a flow. Drawing one would be a diagram making a claim
  // about a sequence it does not have.
  it('refuses to draw a flow with fewer than two steps', () => {
    expect(one({ diagram: '{"steps":["Only one"]}' }).diagram).toBeNull();
  });

  // A caption of whitespace still draws a caption's worth of space under the
  // diagram, which reads as a line somebody forgot to write.
  it('drops a blank note rather than drawing an empty caption', () => {
    expect(one({ diagram: '{"steps":["A","B"],"note":"  "}' }).diagram).toEqual({
      steps: ['A', 'B'],
    });
  });

  // Same contract as the other two columns: a shape that will not draw costs
  // the shape, never the card that was carrying it.
  it('degrades an unparseable diagram to the card’s text', () => {
    expect(one({ diagram: 'nonsense' }).diagram).toBeNull();
  });
});

describe('boardNodesOf — what the plan reads', () => {
  // The plan stands at the far end of the same board, so the fields it groups
  // and orders by have to ride along on these nodes rather than be fetched
  // again — two readings of one map is how the two came to disagree.
  it('carries the ordering and the slice’s claim through to the board', () => {
    const node = one({ kind: 'slice', order: 4, testsNodeId: 'n9' });
    expect(node.order).toBe(4);
    expect(node.testsNodeId).toBe('n9');
  });

  // Null rather than the empty string, so `buildSequence` can tell "named
  // nothing" from "named something that has since been deleted" — two states
  // the far end reports differently.
  it('reads a slice that names nothing as settling nothing', () => {
    expect(one({ kind: 'slice' }).testsNodeId).toBeNull();
  });
});
