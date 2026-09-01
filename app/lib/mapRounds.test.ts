import { describe, expect, it } from 'vitest';
import { groupIntoRounds, roundEyebrow } from './mapRounds';
import type { ExchangeEvent } from './exchange';
import type { FlatNode } from './mapLayout';

// A row on the map is a ROUND — the batch of nodes one write produced — and
// the entire reason this module exists is that grouping by tree depth looks
// equivalent and is not. The `two batches at the same depth` case below is the
// one that motivates every other decision here; if it ever passes by
// collapsing into one row, the map has stopped recording that the conversation
// had two turns.

let seq = 0;

function event(partial: Partial<ExchangeEvent>): ExchangeEvent {
  seq += 1;
  return {
    id: `e${seq}`,
    revision: seq,
    kind: 'node.added',
    origin: 'agent',
    payload: {},
    createdAt: new Date('2026-01-01T00:00:00Z'),
    ...partial,
  } as ExchangeEvent;
}

/** An event at an explicit revision, for the runs that must NOT be contiguous. */
function at(revision: number, partial: Partial<ExchangeEvent>): ExchangeEvent {
  return { ...event(partial), revision };
}

function node(id: string, parentId: string | null, order = 0): FlatNode {
  return {
    id,
    parentId,
    kind: parentId ? 'open-question' : 'idea',
    label: id,
    detail: null,
    status: 'open',
    sourceUrl: null,
    order,
  };
}

const added = (id: string, parentId: string | null) => ({ id, parentId });

describe('groupIntoRounds', () => {
  // Nothing to group is not an error state — an empty map renders its invitation.
  it('returns no rounds for a map with no nodes', () => {
    expect(groupIntoRounds([], [])).toEqual([]);
  });

  // The seed idea alone, which is every map on day one.
  it('puts a lone root in a single round', () => {
    const rounds = groupIntoRounds([node('root', null)], []);
    expect(rounds).toHaveLength(1);
    expect(rounds[0]!.index).toBe(1);
    expect(rounds[0]!.nodes.map((n) => n.id)).toEqual(['root']);
  });

  // One add_nodes call writes its events inside one transaction, so they share
  // a contiguous revision run and one origin — that run is one row.
  it('groups one contiguous run of adds into one round', () => {
    const nodes = [node('root', null), node('q1', 'root', 0), node('q2', 'root', 1)];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
      at(3, { kind: 'node.added', payload: added('q2', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ['root'],
      ['q1', 'q2'],
    ]);
  });

  // THE case this module exists for. Both batches are children of the root, so
  // both sit at depth 1; grouping by depth would merge them into one row and
  // lose the fact that the agent asked twice.
  it('keeps two batches at the same tree depth as two separate rounds', () => {
    const nodes = [
      node('root', null),
      node('q1', 'root', 0),
      node('q2', 'root', 1),
      node('q3', 'root', 2),
      node('q4', 'root', 3),
    ];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
      at(3, { kind: 'node.added', payload: added('q2', 'root') }),
      // The question.asked between the batches is what breaks contiguity —
      // exactly as ask_user writes it in real life.
      at(4, { kind: 'question.asked', payload: { questions: [] } }),
      at(5, { kind: 'node.added', payload: added('q3', 'root') }),
      at(6, { kind: 'node.added', payload: added('q4', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ['root'],
      ['q1', 'q2'],
      ['q3', 'q4'],
    ]);
  });

  // The map is co-authored, so the person's own contribution is a round of its
  // own rather than being folded into whichever agent batch it fell between.
  it('gives a user-added node its own round between two agent batches', () => {
    const nodes = [
      node('root', null),
      node('q1', 'root', 0),
      node('mine', 'root', 1),
      node('q2', 'root', 2),
    ];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
      at(3, { kind: 'user.node', origin: 'user', payload: added('mine', 'root') }),
      at(4, { kind: 'node.added', payload: added('q2', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ['root'],
      ['q1'],
      ['mine'],
      ['q2'],
    ]);
  });

  // A seeded scenario, or a map written before any of this shipped, has no log
  // to read. It must still draw as rows rather than as nothing.
  it('falls back to grouping by depth when there is no event log', () => {
    const nodes = [
      node('root', null),
      node('a', 'root', 0),
      node('b', 'root', 1),
      node('a1', 'a', 0),
    ];
    const rounds = groupIntoRounds(nodes, []);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ['root'],
      ['a', 'b'],
      ['a1'],
    ]);
  });

  // The log may account for some of the map and not the rest — a seeded map
  // that was then worked on. The explained part keeps its rounds and the
  // remainder is appended by depth rather than dropped.
  it('appends nodes the log never mentioned after the rounds it explained', () => {
    const nodes = [node('root', null), node('q1', 'root', 0), node('ghost', 'root', 1)];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ['root'],
      ['q1'],
      ['ghost'],
    ]);
  });

  // An id in the log with no node on the map is a node deleted since. It must
  // not produce an empty row, and must not take the rest of its round with it.
  it('ignores logged ids whose nodes are no longer on the map', () => {
    const nodes = [node('root', null), node('q1', 'root', 0)];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
      at(3, { kind: 'node.added', payload: added('deleted', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([['root'], ['q1']]);
  });

  // The root is the map's subject, not one of its answers. A row that mixed it
  // in with the first batch would read as though somebody had asked it.
  it('keeps the root alone even when its add is contiguous with the next batch', () => {
    const nodes = [node('root', null), node('q1', 'root', 0)];
    const events = [
      at(1, { kind: 'node.added', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([['root'], ['q1']]);
  });

  // Sibling order is the map's own, so a row reads left to right the way the
  // agent meant it to rather than in whatever order the log happened to land.
  it('orders the cards in a round by their sibling order', () => {
    const nodes = [node('root', null), node('second', 'root', 1), node('first', 'root', 0)];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('second', 'root') }),
      at(3, { kind: 'node.added', payload: added('first', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds[1]!.nodes.map((n) => n.id)).toEqual(['first', 'second']);
  });

  // A phase set immediately after a round is what that round moved the thinking
  // to, so the row can name itself after the phase instead of its number.
  it('attributes a phase set immediately after a round to that round', () => {
    const nodes = [node('root', null), node('q1', 'root', 0)];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
      at(3, { kind: 'phase.set', payload: { phase: 'explore' } }),
    ];
    expect(groupIntoRounds(nodes, events)[1]!.phase).toBe('explore');
  });

  // A phase set further downstream belongs to whatever round actually preceded
  // it, so an unrelated round must not claim it.
  it('does not attribute a distant phase set to an earlier round', () => {
    const nodes = [node('root', null), node('q1', 'root', 0)];
    const events = [
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
      at(9, { kind: 'phase.set', payload: { phase: 'explore' } }),
    ];
    expect(groupIntoRounds(nodes, events)[1]!.phase).toBeNull();
  });

  // The log arrives ordered in practice, but the grouping must not depend on
  // the caller having sorted it — contiguity is about revisions, not position.
  it('groups by revision even when the events arrive out of order', () => {
    const nodes = [node('root', null), node('q1', 'root', 0), node('q2', 'root', 1)];
    const events = [
      at(3, { kind: 'node.added', payload: added('q2', 'root') }),
      at(1, { kind: 'node.added', origin: 'user', payload: added('root', null) }),
      at(2, { kind: 'node.added', payload: added('q1', 'root') }),
    ];
    const rounds = groupIntoRounds(nodes, events);
    expect(rounds.map((r) => r.nodes.map((n) => n.id))).toEqual([
      ['root'],
      ['q1', 'q2'],
    ]);
  });
});

describe('roundEyebrow', () => {
  const round = (index: number, nodes: FlatNode[], phase: string | null = null) => ({
    index,
    nodes,
    phase,
  });

  // The first row is the map's subject, and calling it "Round 1 of 4" would
  // describe the idea as though somebody had asked for it.
  it('names the opening round after the idea rather than numbering it', () => {
    expect(roundEyebrow(round(1, [node('root', null)]), 4)).toBe('The idea');
  });

  // A round that is all questions says so — "three questions" is what the
  // person is actually being asked to deal with.
  it('counts questions when every card in the round is one', () => {
    const nodes = [node('q1', 'root', 0), node('q2', 'root', 1)];
    expect(roundEyebrow(round(2, nodes), 4)).toBe('Round 2 of 4 · 2 questions');
  });

  // The singular has to be right; "1 questions" is exactly the kind of thing
  // that makes an interface look unfinished.
  it('uses the singular for a round holding one question', () => {
    expect(roundEyebrow(round(3, [node('q1', 'root')]), 3)).toBe(
      'Round 3 of 3 · 1 question',
    );
  });

  // A mixed round counts nodes instead: naming the majority kind would
  // misdescribe what is actually in the row.
  it('counts nodes rather than questions when the round is mixed', () => {
    const finding = { ...node('f', 'root', 0), kind: 'finding' };
    const nodes = [finding, node('q1', 'root', 1)];
    expect(roundEyebrow(round(2, nodes), 2)).toBe('Round 2 of 2 · 2 nodes');
  });

  // Once a round opened a phase, the phase is the more useful name for it than
  // its position in the sequence.
  it('names a round after the phase it opened', () => {
    const nodes = [node('q1', 'root', 0)];
    // The phase's own LABEL with its number stripped, not the raw stored
    // string with its dashes swapped — so the row and the activity rail call
    // the same phase by the same name.
    expect(roundEyebrow(round(2, nodes, 'next-steps'), 4)).toBe(
      'Next steps · 1 question',
    );
  });

  // A round recorded before the phases merged carries `deconstruct`, which the
  // nav no longer shows. A row naming a step the person cannot find anywhere
  // is worse than one naming its number, so the alias resolves here too.
  it('names a round stored under the retired phase after the phase that replaced it', () => {
    const nodes = [node('q1', 'root', 0)];
    expect(roundEyebrow(round(2, nodes, 'deconstruct'), 4)).toBe(
      'Map · 1 question',
    );
  });

  // An unrecognised phase still prints itself rather than vanishing into the
  // round-number fallback, which would hide that the map holds something odd.
  it('falls back to printing an unknown phase rather than dropping it', () => {
    const nodes = [node('q1', 'root', 0)];
    expect(roundEyebrow(round(2, nodes, 'brainstorm'), 4)).toBe(
      'brainstorm · 1 question',
    );
  });
});
