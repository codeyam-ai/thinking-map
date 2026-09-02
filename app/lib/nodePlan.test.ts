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

// `create_themes` — the door the galaxies come through.
//
// It arrived with the board redesign and had no coverage at all: before these
// cases the word "theme" appeared in this file exactly once, in the empty-plan
// assertion. What an agent sends here is untrusted in the same way node input
// is, so these are mostly about what gets REJECTED.
const createThemes = (themes: unknown[]) => ({
  name: 'create_themes',
  input: { themes },
});

describe('planMapMutations — create_themes', () => {
  // The ordinary path: a valid theme survives with both the ref a node will
  // name it by and the label its cluster is drawn with.
  it('plans a theme with its ref and label intact', () => {
    const plan = planMapMutations([
      createThemes([{ ref: 'ctx', label: 'What actually gets lost' }]),
    ]);

    expect(plan.themes).toHaveLength(1);
    expect(plan.themes[0]).toMatchObject({
      ref: 'ctx',
      label: 'What actually gets lost',
    });
  });

  // A theme with no ref is unreachable — no node could ever name it — so it
  // would be a galaxy on the board with nothing able to orbit it.
  it('drops a theme that no node could name', () => {
    const plan = planMapMutations([
      createThemes([
        { label: 'Nameless' },
        { ref: '', label: 'Also nameless' },
        { ref: 'ok', label: 'Reachable' },
      ]),
    ]);

    expect(plan.themes.map((t) => t.ref)).toEqual(['ok']);
  });

  // A theme with no label draws a hub captioned nothing, and a cluster you
  // cannot identify is worse than a cluster that is not there.
  it('drops a theme that would render as an unlabelled cluster', () => {
    const plan = planMapMutations([
      createThemes([
        { ref: 'a', label: '   ' },
        { ref: 'b' },
        { ref: 'c', label: 'Named' },
      ]),
    ]);

    expect(plan.themes.map((t) => t.ref)).toEqual(['c']);
  });

  // The order they were opened in is also the order they are drawn down the
  // board, so it has to survive planning.
  it('keeps the themes in the order they were sent', () => {
    const plan = planMapMutations([
      createThemes([
        { ref: 'a', label: 'First' },
        { ref: 'b', label: 'Second' },
        { ref: 'c', label: 'Third' },
      ]),
    ]);

    expect(plan.themes.map((t) => t.label)).toEqual([
      'First',
      'Second',
      'Third',
    ]);
  });

  // NO HUE IS ASSIGNED HERE, and the absence is the point. The hue depends on
  // how many themes the map already has, which this pure function cannot see —
  // and the split (the agent names the theme, the app colours it) is the whole
  // reason the palette stays mutually distinguishable however many themes an
  // agent invents. This case exists to stop someone "helpfully" adding one.
  it('assigns no colour, leaving that to the app', () => {
    const plan = planMapMutations([
      createThemes([{ ref: 'ctx', label: 'What actually gets lost' }]),
    ]);

    expect(plan.themes[0]).not.toHaveProperty('hue');
  });

  // A node may name a theme created in the SAME turn, which is how a round
  // normally arrives: open the galaxies, then hang the questions off them.
  it('keeps a node’s reference to a theme from the same turn', () => {
    const plan = planMapMutations([
      createThemes([{ ref: 'ctx', label: 'What actually gets lost' }]),
      addNodes([
        {
          ref: 'q1',
          kind: 'open-question',
          label: 'What goes missing?',
          themeRef: 'ctx',
        },
      ]),
    ]);

    expect(plan.themes[0]!.ref).toBe('ctx');
    expect(plan.inserts[0]!.themeRef).toBe('ctx');
  });

  // A node naming no theme is the root idea, which belongs to no galaxy
  // precisely because it is what every galaxy orbits.
  it('leaves a node that names no theme unattached', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'goal', label: 'Stop losing call-backs' }]),
    ]);

    expect(plan.inserts[0]!.themeRef).toBeNull();
  });

  // Malformed input has to survive the way it does for nodes: a non-array, a
  // null entry or a junk scalar produces no themes rather than a throw that
  // would take the whole turn down with it.
  it('survives malformed theme input rather than throwing', () => {
    expect(
      planMapMutations([{ name: 'create_themes', input: { themes: 'nope' } }])
        .themes,
    ).toEqual([]);
    expect(planMapMutations([createThemes([null, undefined, 42])]).themes).toEqual(
      [],
    );
    expect(
      planMapMutations([{ name: 'create_themes', input: {} }]).themes,
    ).toEqual([]);
  });
});

// The diagram a model asks for, on its way to becoming a drawn shape.
//
// Reached through `planMapMutations` because it is not exported — which is the
// right level to test it at anyway, since what matters is what survives into
// the plan. A card that announces a diagram and then draws nothing is worse
// than one that never claimed to have it, so the validation here is what stops
// a half-formed shape reaching the board at all.
describe('planMapMutations — a node carrying a diagram', () => {
  const withDiagram = (diagram: unknown) =>
    planMapMutations([
      addNodes([
        { ref: 'a', kind: 'approach', label: 'A handover list', diagram },
      ]),
    ]).inserts[0]!;

  // The ordinary case: steps survive in order, and the note with them.
  it('keeps a well-formed shape, steps in order', () => {
    const node = withDiagram({
      steps: ['A call-back is promised', 'It joins the list', 'Someone closes it'],
      note: 'The wipe is what deletes the state today.',
    });

    expect(node.diagram).toEqual({
      steps: ['A call-back is promised', 'It joins the list', 'Someone closes it'],
      note: 'The wipe is what deletes the state today.',
    });
  });

  // One step is not a flow — it is a sentence, and it would draw as a single
  // box with an arrow pointing at nothing.
  it('rejects a shape too short to be a flow', () => {
    expect(withDiagram({ steps: ['Only this'] }).diagram).toBeNull();
    expect(withDiagram({ steps: [] }).diagram).toBeNull();
  });

  // Blank steps are dropped before the length is judged, so three steps of
  // which two are whitespace is still not a flow.
  it('drops blank steps and judges the length after', () => {
    expect(withDiagram({ steps: ['Real', '   ', ''] }).diagram).toBeNull();
    expect(
      withDiagram({ steps: ['Real', '  ', 'Also real'] }).diagram,
    ).toEqual({ steps: ['Real', 'Also real'] });
  });

  // The note is optional, and its absence must not leave the key present with
  // an empty value — the card renders a caption line for anything truthy.
  it('omits the note entirely rather than carrying an empty one', () => {
    const node = withDiagram({ steps: ['One', 'Two'], note: '   ' });

    expect(node.diagram).toEqual({ steps: ['One', 'Two'] });
    expect(node.diagram).not.toHaveProperty('note');
  });

  // Anything that is not a shape at all produces no diagram rather than a
  // throw that would take the whole turn down with it.
  it('survives junk where a shape was expected', () => {
    for (const junk of [null, undefined, 'steps', 42, [], { steps: 'one,two' }]) {
      expect(withDiagram(junk).diagram).toBeNull();
    }
  });

  // A node that never mentioned a diagram is the ordinary case and must come
  // through carrying none.
  it('leaves a node with no diagram alone', () => {
    const plan = planMapMutations([
      addNodes([{ ref: 'a', kind: 'finding', label: 'Two keyholders' }]),
    ]);

    expect(plan.inserts[0]!.diagram).toBeNull();
  });
});

// The provenance an insight carries. Modelled on `testsRef` — carried through
// as refs and resolved by `applyToolCalls`, which is the only place that can
// see the ids the database just minted — so what these pin is the NORMALISING,
// not the resolution.
describe('planMapMutations — the sources an insight cites', () => {
  const withRefs = (fromRefs: unknown) =>
    planMapMutations([
      addNodes([
        { ref: 'i1', kind: 'suggestion', label: 'Start from the doc', fromRefs },
      ]),
    ]).inserts[0]!;

  // Carried verbatim, refs and all. Resolving them here is impossible: a ref
  // usually names a node created moments earlier in this same call, whose real
  // id does not exist until the write.
  it('carries the refs through untouched for applyToolCalls to resolve', () => {
    expect(withRefs(['q1', 'q2']).fromRefs).toEqual(['q1', 'q2']);
  });

  // The `serialiseOptions` convention: a node that named nothing must be
  // indistinguishable from one that never had the field, rather than carrying
  // an empty array nobody can render.
  it('normalises an empty or all-blank list to null', () => {
    expect(withRefs([]).fromRefs).toBeNull();
    expect(withRefs(['', '   ']).fromRefs).toBeNull();
  });

  // Non-strings are filtered rather than stringified. `[1, 2]` is a mistake,
  // and turning it into `"1"` would store a citation pointing at nothing while
  // looking like it had worked.
  it('drops non-strings and blanks rather than coercing them', () => {
    expect(withRefs(['q1', 42, null, '  ', 'q2']).fromRefs).toEqual(['q1', 'q2']);
  });

  // The ordinary case, and every node written before this field existed.
  it('leaves a node that cited nothing carrying null', () => {
    expect(withRefs(undefined).fromRefs).toBeNull();
    expect(withRefs('q1').fromRefs).toBeNull();
  });
});

// Two kinds joined the vocabulary so the partner has somewhere to put a move
// worth making and an experiment small enough to run. They reach the tool
// schema through NODE_KINDS, so what this pins is that the planner accepts
// them rather than dropping them as a kind the map cannot draw.
describe('planMapMutations — the forward-looking kinds', () => {
  // An unknown kind is DROPPED here rather than stored, so a kind added to the
  // vocabulary but not reaching this guard would vanish silently — the agent
  // told the write succeeded, and nothing on the board to show for it.
  it('accepts a suggestion and an experiment as real nodes', () => {
    const plan = planMapMutations([
      addNodes([
        { ref: 's', kind: 'suggestion', label: 'Start from the doc' },
        { ref: 'e', kind: 'experiment', label: 'Paste one real doc' },
      ]),
    ]);
    expect(plan.inserts.map((i) => i.kind)).toEqual(['suggestion', 'experiment']);
  });
});
