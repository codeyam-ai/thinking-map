// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AgentSimulator from './AgentSimulator';
import type { AgentDriver } from '../lib/webmcp';
import type { McpToolResponse } from '../lib/toolCatalog';

// What the panel does BEFORE it writes anything.
//
// The panel drives `window.__thinkingMapAgent`, the same bound catalog a real
// agent calls, so "Run the demo sequence" is seven real writes against whatever
// map is open. That is the whole point of the panel and it is also how a demo
// run put two invented nodes and an open question onto somebody's real map.
// These tests pin the guard that now stands in front of it.
//
// The driver is stubbed rather than mounted through the bridge: what is under
// test is which calls the panel DECIDES to make, and a stub is the only way to
// see a call that was correctly never made.

const toolCall = (text: string, structured?: Record<string, unknown>) =>
  ({
    content: [{ type: 'text', text }],
    ...(structured ? { structuredContent: structured } : {}),
  }) as McpToolResponse;

/** A log as `read_map` with `sinceRevision: 0` returns it. */
const logOf = (...kinds: string[]) => ({
  delta: true,
  revision: kinds.length,
  events: kinds.map((kind, i) => ({ kind, revision: i + 1 })),
});

function stubDriver(events: ReturnType<typeof logOf>) {
  const callTool = vi.fn(
    async (name: string): Promise<McpToolResponse> =>
      name === 'read_map'
        ? toolCall('revision: 8', events)
        : toolCall('ok'),
  );
  window.__thinkingMapAgent = {
    mapId: 'map-under-test',
    listTools: () => [],
    callTool,
  } satisfies AgentDriver;
  return callTool;
}

afterEach(() => {
  cleanup();
  delete window.__thinkingMapAgent;
});

describe('AgentSimulator', () => {
  // The panel opens collapsed. Rendering it at all is now an opt-in the map page
  // makes deliberately, so once it IS rendered the launcher must be there —
  // otherwise the opt-in leads nowhere.
  it('renders the launcher collapsed', () => {
    stubDriver(logOf('node.added', 'phase.set'));
    render(<AgentSimulator />);
    expect(screen.getByText(/agent panel/i)).toBeTruthy();
    expect(screen.queryByText(/Run the demo sequence/i)).toBeNull();
  });

  // The reported failure, pinned: on a map that already holds real work, the
  // sequence must say why it declined and must NOT write. Asserting the log line
  // alone would pass even if the writes went out anyway, so the assertion that
  // matters is the one about `callTool`.
  it('declines the demo sequence on a map with real work, writing nothing', async () => {
    const callTool = stubDriver(
      logOf('node.added', 'node.added', 'node.added', 'phase.set'),
    );
    render(<AgentSimulator />);

    fireEvent.click(screen.getByText(/agent panel/i));
    fireEvent.click(screen.getByRole('button', { name: /Run the demo sequence/i }));

    await waitFor(() => expect(screen.getByText(/Not running/i)).toBeTruthy());

    // Exactly one call, and it was the read. No `add_nodes`, no `post_note`.
    expect(callTool).toHaveBeenCalledTimes(1);
    expect(callTool.mock.calls[0]?.[0]).toBe('read_map');
  });

  // The guard has to REFUSE the wrong map without refusing every map — a demo
  // that never runs is as broken as one that always does, and it is the failure
  // mode a fail-safe default invites.
  it('runs the sequence on a map holding only its seed', async () => {
    const callTool = stubDriver(logOf('node.added', 'phase.set'));
    render(<AgentSimulator />);

    fireEvent.click(screen.getByText(/agent panel/i));
    fireEvent.click(screen.getByRole('button', { name: /Run the demo sequence/i }));

    await waitFor(() =>
      expect(
        callTool.mock.calls.some(([name]) => name === 'add_nodes'),
      ).toBe(true),
    );
    expect(screen.queryByText(/Not running/i)).toBeNull();
  });
});
