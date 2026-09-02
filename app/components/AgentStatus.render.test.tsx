// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
});
