import { describe, expect, it } from 'vitest';
import { DEMO_SEQUENCE, resultText } from './agentDemo';

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
