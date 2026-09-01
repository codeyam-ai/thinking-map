import { describe, expect, it } from 'vitest';
import { planMapMutations } from './nodePlan';

const addNodes = (nodes: unknown[]) => ({ name: 'add_nodes', input: { nodes } });

// This is where a language model's output becomes map state. Everything it
// sends is untrusted, so these cases are mostly about what gets REJECTED.
describe('planMapMutations', () => {
  // The ordinary path: a valid node survives with its fields intact.
  it('plans an insert for a valid node', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'problem', label: 'Vocabulary' }]),
    ]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.inserts[0]).toMatchObject({
      ref: 'a',
      kind: 'problem',
      label: 'Vocabulary',
      status: 'answered',
    });
  });

  // A kind the map has no treatment for would render as an untyped blob, so
  // it is dropped rather than stored.
  it('drops a node whose kind the map cannot draw', () => {
    const plan = planMapMutations([
      addNodes([
        { ref: 'a', kind: 'sticky-note', label: 'Nope' },
        { ref: 'b', kind: 'goal', label: 'Yes' },
      ]),
    ]);
    expect(plan.inserts.map((n) => n.label)).toEqual(['Yes']);
  });

  // An empty pill is worse than no pill — it takes up map space saying nothing.
  it('drops a node with a blank label', () => {
    const plan = planMapMutations([
      addNodes([
        { ref: 'a', kind: 'goal', label: '   ' },
        { ref: 'b', kind: 'goal', label: 'Real' },
      ]),
    ]);
    expect(plan.inserts.map((n) => n.label)).toEqual(['Real']);
  });

  // An unrecognised status would fall through to the default treatment
  // silently; normalising it makes the fallback explicit.
  it('falls back to answered for an unknown status', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'goal', label: 'X', status: 'pending' }]),
    ]);
    expect(plan.inserts[0].status).toBe('answered');
  });

  // "updated" is how the map marks what just changed; it must survive intact.
  it('keeps a valid status', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'user', label: 'Teachers', status: 'updated' }]),
    ]);
    expect(plan.inserts[0].status).toBe('updated');
  });

  // A parent must be written before the child naming it, so the order the
  // model sent has to be preserved exactly.
  it('preserves insert order so parents precede their children', () => {
    const plan = planMapMutations([
      addNodes([
        { ref: 'p', kind: 'research', label: 'Parent' },
        { ref: 'c', parentRef: 'p', kind: 'finding', label: 'Child' },
      ]),
    ]);
    expect(plan.inserts.map((n) => n.ref)).toEqual(['p', 'c']);
    expect(plan.inserts[1].parentRef).toBe('p');
  });

  // Sibling position on screen comes from this index.
  it('numbers siblings in the order they arrive', () => {
    const plan = planMapMutations([
      addNodes([
        { ref: 'a', kind: 'approach', label: 'A' },
        { ref: 'b', kind: 'approach', label: 'B' },
        { ref: 'c', kind: 'approach', label: 'C' },
      ]),
    ]);
    expect(plan.inserts.map((n) => n.order)).toEqual([0, 1, 2]);
  });

  // A root idea has no parent, and must not invent one.
  it('leaves parentRef null when none is given', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'root', kind: 'idea', label: 'An idea' }]),
    ]);
    expect(plan.inserts[0].parentRef).toBeNull();
  });

  // Resolving an answered question is the most common update.
  it('plans an update with only the fields supplied', () => {
    const plan = planMapMutations([
      { name: 'update_node', input: { id: 'n-1', status: 'answered' } },
    ]);
    expect(plan.updates).toEqual([{ id: 'n-1', data: { status: 'answered' } }]);
  });

  // An update naming no real change would be a pointless write.
  it('ignores an update that carries no valid fields', () => {
    const plan = planMapMutations([
      { name: 'update_node', input: { id: 'n-1', status: 'bogus' } },
    ]);
    expect(plan.updates).toEqual([]);
  });

  // Without an id there is nothing to target.
  it('ignores an update with no id', () => {
    const plan = planMapMutations([
      { name: 'update_node', input: { label: 'orphaned' } },
    ]);
    expect(plan.updates).toEqual([]);
  });

  // The phase drives the nav and the summary-screen switch.
  it('records a valid phase change', () => {
    const plan = planMapMutations([
      { name: 'set_phase', input: { phase: 'research' } },
    ]);
    expect(plan.phase).toBe('research');
  });

  // An invalid phase must leave the map where it was rather than break the nav.
  it('ignores a phase that is not part of the loop', () => {
    const plan = planMapMutations([
      { name: 'set_phase', input: { phase: 'brainstorm' } },
    ]);
    expect(plan.phase).toBeNull();
  });

  // A turn that only talks changes nothing on the map.
  it('returns an empty plan for no calls', () => {
    expect(planMapMutations([])).toEqual({
      inserts: [],
      updates: [],
      phase: null,
    });
  });

  // A malformed tool call must not throw mid-turn and lose the whole reply.
  it('survives a call with a missing or malformed input', () => {
    const plan = planMapMutations([
      { name: 'add_nodes', input: undefined },
      { name: 'add_nodes', input: { nodes: 'not-an-array' } },
      { name: 'unknown_tool', input: {} },
    ]);
    expect(plan.inserts).toEqual([]);
  });

  // One turn routinely adds nodes, resolves a question, and moves the phase on.
  it('handles adds, updates and a phase change in one turn', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'gap', label: 'No parent involvement' }]),
      { name: 'update_node', input: { id: 'n-old', status: 'updated' } },
      { name: 'set_phase', input: { phase: 'explore' } },
    ]);
    expect(plan.inserts).toHaveLength(1);
    expect(plan.updates).toHaveLength(1);
    expect(plan.phase).toBe('explore');
  });
});
