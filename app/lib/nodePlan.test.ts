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
      themes: [],
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

  // A slice carries the node it would settle. Like parentRef this stays a REF
  // here — resolving it to a real id is applyToolCalls' job — so the plan must
  // hand it through untouched rather than validating it against a map it
  // cannot see.
  it('carries a slice tests ref through as testsRef', () => {
    const plan = planMapMutations([
      addNodes([
        { ref: 'a', kind: 'assumption', label: 'People reread their notes' },
        { ref: 'b', kind: 'slice', label: 'Capture-only build', tests: 'a' },
      ]),
    ]);
    expect(plan.inserts[1].testsRef).toBe('a');
  });

  // An increment that settles nothing is a real state the summary screen
  // reports, so the absent link must survive as null rather than being
  // invented or dropped.
  it('leaves testsRef null when a slice names nothing', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'slice', label: 'Admin console' }]),
    ]);
    expect(plan.inserts[0].testsRef).toBeNull();
  });

  // A slice's purpose usually sharpens once the whole sequence is laid out, so
  // the link is editable after the fact.
  it('plans an update to what a slice settles', () => {
    const plan = planMapMutations([
      { name: 'update_node', input: { id: 'n-b1', tests: 'n-u2' } },
    ]);
    expect(plan.updates[0].data.testsNodeId).toBe('n-u2');
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

// The suggested answers a question can carry. The field is optional and
// additive, so the cases that matter are the ones where it must produce NO
// options at all — a question with an empty array stored on it would render a
// chip row with nothing in it.
describe('planMapMutations suggested answers', () => {
  const optionsOf = (node: unknown) =>
    planMapMutations([addNodes([node])]).inserts[0]!.options;

  // The ordinary path: a shortlist survives as the JSON array the column holds.
  it('serialises a question’s suggested answers to a JSON array', () => {
    const options = optionsOf({
      ref: 'q',
      kind: 'open-question',
      label: 'Who is it for?',
      options: ['Just me', 'The whole street'],
    });
    expect(JSON.parse(options!)).toEqual(['Just me', 'The whole street']);
  });

  // Most questions have no obvious shortlist, and that is not a degraded case.
  it('stores nothing when the model offered no options', () => {
    expect(optionsOf({ ref: 'q', kind: 'open-question', label: 'Why?' })).toBeNull();
  });

  // An empty array must not become a stored empty array — that would render a
  // chip row holding nothing.
  it('stores nothing for an empty option list', () => {
    expect(
      optionsOf({ ref: 'q', kind: 'open-question', label: 'Why?', options: [] }),
    ).toBeNull();
  });

  // A list of blanks is the same situation as an empty list.
  it('stores nothing when every option is blank', () => {
    expect(
      optionsOf({
        ref: 'q',
        kind: 'open-question',
        label: 'Why?',
        options: ['', '   '],
      }),
    ).toBeNull();
  });

  // Non-strings are dropped rather than coerced: a numeric option is a mistake,
  // and rendering it as "1" would hide the mistake behind a plausible chip.
  it('drops non-string options rather than stringifying them', () => {
    const options = optionsOf({
      ref: 'q',
      kind: 'open-question',
      label: 'Why?',
      options: ['Keep', 7, null, { a: 1 }],
    });
    expect(JSON.parse(options!)).toEqual(['Keep']);
  });

  // Anything that is not a list at all is not a shortlist.
  it('stores nothing when options is not an array', () => {
    expect(
      optionsOf({
        ref: 'q',
        kind: 'open-question',
        label: 'Why?',
        options: 'Just me',
      }),
    ).toBeNull();
  });

  // The field is additive: every node the model already knew how to send still
  // plans exactly as it did, carrying no options.
  it('leaves a node that predates the field unchanged', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'finding', label: 'Two keyholders' }]),
    ]);
    expect(plan.inserts[0]!.options).toBeNull();
    expect(plan.inserts[0]!.label).toBe('Two keyholders');
  });
});
