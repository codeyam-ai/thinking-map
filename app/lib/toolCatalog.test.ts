import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { INSIGHT_STREAM_KINDS, TARGET_LIVE_INSIGHTS } from './insightStream';
import {
  DEFAULT_TIMEOUT_SECONDS,
  MAX_TIMEOUT_SECONDS,
  TOOL_CATALOG,
  findTool,
  timeoutMsFrom,
} from './toolCatalog';

// The catalog is the contract three front doors share. These tests pin the
// parts a drifting door would break first: the tool set itself, and the clamp
// that keeps a waiting tool bounded.

describe('the shared tool catalog', () => {
  // If a door registers a different set, agents get different capabilities
  // depending on how they connected — the drift this catalog exists to prevent.
  it('exposes exactly the tools every front door shares', () => {
    expect(TOOL_CATALOG.map((t) => t.name)).toEqual([
      'read_map',
      'create_themes',
      'read_brief',
      // Beside read_brief, not inside read_map: both are things the map is
      // carrying that are far too big to inline into a call made every turn.
      'read_attachment',
      'add_nodes',
      'update_node',
      'set_phase',
      'post_note',
      'ask_user',
      'await_user_activity',
    ]);
  });

  // A page is already scoped to one map, so these two would be meaningless
  // there. They belong to the server doors only.
  it('leaves the whole-collection tools out of the shared set', () => {
    const names = TOOL_CATALOG.map((t) => t.name);
    expect(names).not.toContain('list_thinking_maps');
    expect(names).not.toContain('create_thinking_map');
  });

  // An agent decides whether it may call a tool speculatively from this hint.
  // read_brief is one of them: an agent should feel free to call it on any
  // turn, which is the whole reason it answers with an outline by default.
  it('marks the three read-only tools as read-only', () => {
    expect(findTool('read_map')?.annotations?.readOnlyHint).toBe(true);
    expect(findTool('read_brief')?.annotations?.readOnlyHint).toBe(true);
    expect(findTool('await_user_activity')?.annotations?.readOnlyHint).toBe(true);
    expect(findTool('add_nodes')?.annotations?.readOnlyHint).toBeUndefined();
  });

  // Every door resolves tools through this lookup, and an unknown name must
  // come back empty so the caller can answer rather than crash.
  it('finds a tool by name and reports nothing for an unknown one', () => {
    expect(findTool('post_note')?.title).toBe('Say what you changed and why');
    expect(findTool('delete_everything')).toBeUndefined();
  });

  // Every tool needs a description the agent can act on — an empty one makes
  // the tool unusable however correct its implementation is.
  it('gives every tool a title and a description', () => {
    for (const tool of TOOL_CATALOG) {
      expect(tool.title.length).toBeGreaterThan(0);
      expect(tool.description.length).toBeGreaterThan(20);
    }
  });
});

describe('timeoutMsFrom', () => {
  // Most agents will not pass one, so the default is the value that actually
  // governs how long a person has to answer.
  it('falls back to the default when the agent names no timeout', () => {
    expect(timeoutMsFrom(undefined)).toBe(DEFAULT_TIMEOUT_SECONDS * 1000);
  });

  // The one number in this file with a hard external constraint on it. The
  // default must stay inside the SMALLEST tool-call budget an agent host
  // imposes — tens of seconds for a browser agent, 60s for a stock MCP client —
  // because a call the host aborts cannot deliver the `timedOut` result, and the
  // agent reads a transport failure instead of looping. This was 300, and the
  // loop was broken the whole time it was. Patience comes from re-calling.
  it('keeps a single wait well inside a host’s tool-call timeout', () => {
    expect(DEFAULT_TIMEOUT_SECONDS).toBe(25);
    expect(DEFAULT_TIMEOUT_SECONDS).toBeLessThan(30);
  });

  // An agent that knows its own patience should get exactly what it asked for.
  it('uses the agent’s timeout when it is reasonable', () => {
    expect(timeoutMsFrom(45)).toBe(45_000);
  });

  // The cap is what stops a confused agent pinning a connection open forever.
  it('caps a timeout longer than the ceiling', () => {
    expect(timeoutMsFrom(99_999)).toBe(MAX_TIMEOUT_SECONDS * 1000);
  });

  // A zero or negative wait would make the tool a busy-loop rather than a wait.
  it('floors a zero or negative timeout at one second', () => {
    expect(timeoutMsFrom(0)).toBe(1000);
    expect(timeoutMsFrom(-30)).toBe(1000);
  });
});

// `add_nodes` is the only tool that writes nodes, so the standing ask has to
// reach the agent through its schema and description or it does not reach the
// agent at all.
describe('add_nodes carries the ask for insights', () => {
  const addNodes = findTool('add_nodes')!;
  // Through the real schema, because the failure worth pinning happens INSIDE
  // the parse: Zod strips what a schema does not declare, so a field missing
  // from `nodeShape` disappears here with no error anywhere downstream.
  const parse = (node: Record<string, unknown>) => {
    const parsed = (addNodes.inputSchema as z.ZodTypeAny).parse({
      nodes: [node],
    }) as { nodes: Record<string, unknown>[] };
    return parsed.nodes[0];
  };

  const insight = {
    ref: 'i1',
    kind: 'suggestion',
    label: 'Start from the doc they already keep',
  };

  // The failure this pins is silent and total: Zod STRIPS keys a schema does
  // not declare, so a `fromRefs` missing from `nodeShape` would be dropped
  // before the planner ever saw it — every citation lost, no error anywhere.
  it('accepts the sources an insight cites and passes them through', () => {
    expect(parse({ ...insight, fromRefs: ['q1', 'q2'] }).fromRefs).toEqual([
      'q1',
      'q2',
    ]);
  });

  // An insight drawn from the whole map has no single source, so the field has
  // to be genuinely optional rather than a required empty list.
  it('leaves the field off entirely when the agent cites nothing', () => {
    expect('fromRefs' in parse(insight)).toBe(false);
  });

  // The vocabulary the schema binds to is NODE_KINDS, so the two new kinds
  // reach the agent for free — but "for free" is exactly the kind of claim
  // worth a test, since a hand-maintained enum here would silently reject them.
  it('accepts the two kinds an insight is usually written as', () => {
    expect(parse({ ...insight, kind: 'suggestion' }).kind).toBe('suggestion');
    expect(parse({ ...insight, kind: 'experiment' }).kind).toBe('experiment');
  });

  // The ask itself. It is prose, and prose is easy to delete by accident — but
  // it is the only thing telling the agent there is a target at all, so these
  // pin the three claims it has to keep making.
  it('states the target, what a themeless node means, and how to cite', () => {
    // Against the CONSTANT, not a typed-out "3": the description interpolates
    // it precisely so the agent can never be told a target the code has
    // stopped counting against.
    expect(addNodes.description).toContain(
      `at least ${TARGET_LIVE_INSIGHTS} live insights`,
    );
    expect(addNodes.description).toContain('no themeRef');
    expect(addNodes.description).toContain('fromRefs');
    for (const kind of INSIGHT_STREAM_KINDS) {
      expect(addNodes.description).toContain(kind);
    }
  });
});
