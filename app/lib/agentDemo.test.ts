import { describe, expect, it } from 'vitest';
import { DEMO_SEQUENCE, demoWouldOverwrite, resultText } from './agentDemo';

// The dev panel is the only way the exchange can be demonstrated at all — no
// real agent can attach inside a capture iframe — so what it shows has to be
// what the tools actually said.

describe('resultText', () => {
  // Tools answer in the MCP content shape, and the first text block is what an
  // agent would read. Showing anything else would make the panel a paraphrase.
  it('reads the first text block of an MCP response', () => {
    expect(
      resultText({ content: [{ type: 'text', text: 'Noted. Now at revision 15.' }] }),
    ).toBe('Noted. Now at revision 15.');
  });

  // A panel that silently renders nothing is worse than one that renders
  // something ugly: the raw shape is at least debuggable.
  it('falls back to raw JSON when there is no text block', () => {
    expect(resultText({ isError: true })).toBe('{"isError":true}');
    expect(resultText({ content: [] })).toBe('{"content":[]}');
    expect(resultText(null)).toBe('null');
  });
});

describe('DEMO_SEQUENCE', () => {
  // The sequence is the closest thing here to a written description of one
  // agent turn: say what you are about to do, orient on the brief, read, add,
  // ask, propose what to build, report back. Losing the ask would make it a
  // demo of writes rather than an exchange.
  it('walks a full turn including the question that waits on the person', () => {
    expect(DEMO_SEQUENCE.map((s) => s.name)).toEqual([
      'post_note',
      'read_brief',
      'read_map',
      'add_nodes',
      'ask_user',
      'add_nodes',
      'post_note',
    ]);
  });

  // The turn has to end somewhere a person can act, and the slice is where
  // WebMCP cannot bind — a preview has no live agent, so this scripted step is
  // the only way the slice path is exercisable at all.
  it('proposes a slice that names what it would settle', () => {
    const slices = DEMO_SEQUENCE.flatMap((step) => {
      const nodes = (step.input as { nodes?: { kind?: string }[] })?.nodes ?? [];
      return nodes.filter((n) => n.kind === 'slice');
    });
    expect(slices).toHaveLength(1);
    // The ref it names is created earlier in the SAME call, which is the
    // ordinary case and the reason the link goes through ref resolution.
    expect((slices[0] as { tests?: string }).tests).toBe('c');
  });

  // read_brief comes BEFORE read_map: an agent handed a long document orients
  // on its outline before deciding what to pull, and the scripted turn is the
  // only place that ordering is written down.
  it('orients on the brief before reading the map', () => {
    const names = DEMO_SEQUENCE.map((s) => s.name);
    expect(names.indexOf('read_brief')).toBeLessThan(names.indexOf('read_map'));
  });

  // Every step is a REAL call against the bound catalog, so a step with no
  // explanation would leave a viewer unable to tell what it demonstrated.
  it('explains every step it runs', () => {
    for (const step of DEMO_SEQUENCE) {
      expect(step.note.length).toBeGreaterThan(0);
    }
  });
});

/** A `read_map` reply carrying the whole log, as `sinceRevision: 0` returns it. */
const log = (...kinds: string[]) => ({
  structuredContent: {
    delta: true,
    revision: kinds.length,
    events: kinds.map((kind, i) => ({ kind, revision: i + 1 })),
  },
});

describe('demoWouldOverwrite', () => {
  // The state the sequence is FOR. `createMap` writes one root `node.added`,
  // and the first view change adds a `phase.set` — so a map nobody has touched
  // already carries two events, and a naive count would refuse every map.
  it('is false for a map holding only its root seed node', () => {
    expect(demoWouldOverwrite(log('node.added', 'phase.set'))).toBe(false);
  });

  // The narrowest true case: one node beyond the seed. The demo would sit its
  // two fixture assumptions next to something a person actually wrote.
  it('is true once anything else is on the map', () => {
    expect(demoWouldOverwrite(log('node.added', 'node.added'))).toBe(true);
  });

  // The reported case: a map with a research round already on it. This is the
  // map the sequence was replayed over.
  it('is true for a map with a full research round on it', () => {
    expect(
      demoWouldOverwrite(
        log(
          'node.added',
          'node.added',
          'node.added',
          'node.added',
          'node.added',
          'node.added',
          'node.added',
          'phase.set',
        ),
      ),
    ).toBe(true);
  });

  // A person's own note or answer is work too, even though it adds no node.
  // Counting only nodes would let the demo run over a conversation.
  it('counts a person’s own contribution as work', () => {
    expect(demoWouldOverwrite(log('node.added', 'user.note'))).toBe(true);
  });

  // Several view changes and nothing else is still an untouched map — phase is
  // where you are LOOKING, not something on the map.
  it('does not count repeated phase changes as work', () => {
    expect(
      demoWouldOverwrite(log('node.added', 'phase.set', 'phase.set', 'phase.set')),
    ).toBe(false);
  });

  // Fail SAFE, and this is the direction that matters: an unreadable reply
  // costs a sentence in the call log if we refuse wrongly, and somebody's
  // thinking with two invented nodes in it if we run wrongly.
  it('refuses when the reply cannot be read', () => {
    expect(demoWouldOverwrite(undefined)).toBe(true);
    expect(demoWouldOverwrite(null)).toBe(true);
    expect(demoWouldOverwrite({})).toBe(true);
    expect(demoWouldOverwrite({ structuredContent: {} })).toBe(true);
    expect(demoWouldOverwrite({ structuredContent: { events: 'nope' } })).toBe(true);
  });

  // An empty log is the one absence that is NOT treated like an unreadable
  // reply, and the difference is what "fail safe" actually means here. Safe is
  // not "always refuse" — it is "never write over something". An empty log is a
  // readable answer saying there is nothing here, so there is nothing to
  // protect; an unreadable one is us not knowing, which is the case that
  // refuses.
  it('permits an empty log rather than treating absence as work', () => {
    expect(demoWouldOverwrite(log())).toBe(false);
  });
});
