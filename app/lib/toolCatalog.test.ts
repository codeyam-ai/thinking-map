import { describe, expect, it } from 'vitest';
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
  it('marks the two read-only tools as read-only', () => {
    expect(findTool('read_map')?.annotations?.readOnlyHint).toBe(true);
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
