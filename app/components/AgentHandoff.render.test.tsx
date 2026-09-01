// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import AgentHandoff from './AgentHandoff';
import BridgeFixture from '../isolated-components/BridgeFixture';
import type { ExchangeEvent } from '../lib/exchange';

// WHEN this panel appears, which is the whole of its logic — the wording it
// shows is pinned in handoffCopy.test.ts.
//
// The two rules it enforces cannot be seen from a screenshot of the good case:
// a bridge mid-tool-call still counts as attached, and a map an agent has
// already worked is not waiting for one. Both are cases where the panel must
// render NOTHING, and nothing is exactly what a passing capture of the other
// state also looks like.
//
// Mounted through BridgeFixture because an isolated render can only ever
// produce `unavailable` on its own — every other bridge state has to be given.

const MAP_ID = 'map-under-test';

const agentEvent = (): ExchangeEvent => ({
  id: 'e1',
  revision: 2,
  kind: 'agent.note',
  origin: 'agent',
  payload: { text: 'I have started on this' },
  createdAt: new Date(),
});

const userEvent = (): ExchangeEvent => ({
  id: 'e0',
  revision: 1,
  kind: 'node.added',
  origin: 'user',
  payload: { label: 'A chore app' },
  createdAt: new Date(),
});

afterEach(cleanup);

describe('AgentHandoff', () => {
  // The reported case: someone submitted an idea, nothing is attached, and the
  // log holds only their own root node.
  it('renders when nothing is attached and no agent has worked the map', () => {
    render(
      <BridgeFixture status="unavailable" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
  });

  // An attached agent makes the panel wrong: something IS on this.
  it('renders nothing when an agent is connected', () => {
    const { container } = render(
      <BridgeFixture status="connected" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(container.textContent).toBe('');
  });

  // The case that would drift. `working` means a tool is mid-flight, and that
  // agent still sees this map when its turn comes round — so it counts as
  // attached, exactly as askPresence treats it. If this and the node-question
  // composer ever disagreed, one page would contradict itself.
  it('renders nothing when an agent is mid-tool-call', () => {
    const { container } = render(
      <BridgeFixture status="working" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(container.textContent).toBe('');
  });

  // Reopening a map an agent has already contributed to, in a browser with no
  // agent. Bridge status alone would wrongly show the panel here.
  it('renders nothing when the log already carries an agent-origin event', () => {
    const { container } = render(
      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(container.textContent).toBe('');
  });

  // No provider at all — an isolated scenario. useOptionalWebMcpBridge returns
  // null rather than throwing, and absence is honest absence.
  it('renders without a bridge provider at all', () => {
    render(<AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />);
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
  });

  // The prompt is the useful part, and it is useless without the id.
  it('shows a start prompt naming this map', () => {
    render(
      <BridgeFixture status="unavailable" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
      </BridgeFixture>,
    );
    expect(screen.getByText(new RegExp(MAP_ID))).toBeTruthy();
  });

  // A brief-started map has no sentence, so the panel must not render empty
  // quote marks where the person's words would go.
  it('shows no quoted idea for a map started from a brief', () => {
    const { container } = render(
      <BridgeFixture status="unavailable" events={[userEvent()]}>
        <AgentHandoff mapId={MAP_ID} hasBrief />
      </BridgeFixture>,
    );
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
    expect(container.textContent).not.toMatch(/“”/);
  });
});
