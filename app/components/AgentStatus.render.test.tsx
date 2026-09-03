// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AgentStatus from './AgentStatus';
import BridgeFixture from '../isolated-components/BridgeFixture';

// The headline is what this component is for and the scenarios show it. What a
// screenshot cannot defend is the thing that is DELIBERATELY ABSENT: the
// `r{revision}` badge that leaked out of debugging and into the product header,
// where beside "No agent attached" it read as a build tag on an error.
//
// A subtraction needs its own guard, because every presence assertion in the
// suite passes just as happily with the badge put back.

afterEach(cleanup);

describe('AgentStatus', () => {
  // The state the badge was worst in: "No agent attached" reads as a failure,
  // and an unexplained `r14` beside it reads as the build that failed. The
  // bridge is handed a revision here specifically so the header has one to leak.
  it('states presence without a revision badge beside it', () => {
    render(
      <BridgeFixture status="unavailable" revision={14}>
        <AgentStatus />
      </BridgeFixture>,
    );
    expect(screen.getByText('No agent attached')).toBeTruthy();
    // The counter is given to the bridge and must still not reach the header.
    // `BridgeReadout` is where a raw revision is the point; this is not it.
    expect(screen.queryByText(/^r\d+$/)).toBeNull();
  });

  // The removal was unconditional, not a fix scoped to the unavailable state —
  // a header that showed the counter only once an agent attached would pass the
  // test above and still put debugging output in front of a person.
  it('keeps the badge off an attached agent too', () => {
    render(
      <BridgeFixture status="connected" revision={14} tools={['read_map']}>
        <AgentStatus />
      </BridgeFixture>,
    );
    expect(screen.getByText(/Agent attached/)).toBeTruthy();
    expect(screen.queryByText(/^r\d+$/)).toBeNull();
  });

  // The same argument as the revision badge, applied to the tool count. "Agent
  // attached · 9 tools" answered a question nobody in front of a map asks, and
  // spent header room doing it. The number is not deleted — it is one click
  // away — so the guard has to be that it is absent UNTIL then.
  it('states presence without a tool count beside it', () => {
    render(
      <BridgeFixture
        status="connected"
        channel="webmcp"
        registered={['read_map', 'add_nodes']}
      >
        <AgentStatus />
      </BridgeFixture>,
    );
    expect(screen.getByText('Agent attached')).toBeTruthy();
    expect(screen.queryByText(/\d+ tools/)).toBeNull();
    expect(screen.queryByText('read_map')).toBeNull();
  });

  // The detail did not leave the product, it moved behind a click — so the
  // click has to work, both ways. A panel that opens over the map and cannot be
  // put away again would be worse than the permanent badge it replaced.
  it('opens the detail on click and closes it again', () => {
    render(
      <BridgeFixture
        status="connected"
        channel="webmcp"
        registered={['read_map', 'add_nodes']}
      >
        <AgentStatus />
      </BridgeFixture>,
    );
    const trigger = screen.getByRole('button', { name: /Agent attached/ });
    fireEvent.click(trigger);
    expect(screen.getByText('2 tools available')).toBeTruthy();
    expect(screen.getByText('read_map')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByText('2 tools available')).toBeNull();
  });

  // A map deleted underneath an open tab is the one reason that stays on the
  // line. Every other reason is context someone can go looking for; this is an
  // error they have to act on, and a page that knows the tab is dead must not
  // decline to say so.
  it('keeps a deleted map visible without a click', () => {
    render(
      <BridgeFixture status="unavailable" mapMissing>
        <AgentStatus />
      </BridgeFixture>,
    );
    expect(screen.getByText(/map deleted, reload/i)).toBeTruthy();
  });
});
