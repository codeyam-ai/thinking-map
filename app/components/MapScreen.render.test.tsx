// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BridgeFixture from '../isolated-components/BridgeFixture';

// The board is stubbed out deliberately, following BoardWorkspace.render.test.tsx:
// what is under test is whether the SCREEN composes the band, not the canvas, and
// rendering the real board drags in a router, a layout and a camera to assert
// nothing about any of them.
vi.mock('./BoardWorkspace', () => ({
  default: () => <div data-testid="board" />,
}));
vi.mock('./SummaryScreen', () => ({
  default: () => <div data-testid="summary" />,
}));

const { default: MapScreen } = await import('./MapScreen');

const props = {
  phase: 'idea' as const,
  seedIdea: 'A tool for tracking what I read',
  currentId: 'map-under-test',
  themes: [],
  nodes: [],
};

afterEach(cleanup);

describe('MapScreen', () => {
  // The regression this pins: the band was a dangling import for the whole of
  // the board redesign. It type-checked, and every AgentHandoff test kept
  // passing, because they all render the band directly. Nothing asserted the
  // screen put it on the page — so a person on a map with no agent got the
  // header's "No agent attached" and no route to change that.
  it('mounts the handoff band when no agent is attached', () => {
    render(
      <BridgeFixture status="unavailable" events={[]}>
        <MapScreen {...props} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
  });

  // The other half of the same contract: an attached agent means the band must
  // NOT be there, and a screen that never mounts it also passes that. Asserting
  // both is what makes the pair meaningful.
  it('leaves the band off when an agent is attached', () => {
    render(
      <BridgeFixture status="connected" events={[]}>
        <MapScreen {...props} />
      </BridgeFixture>,
    );
    expect(screen.queryByText(/No one is on this yet/i)).toBeNull();
  });

  // The brief travelled from the route to the band through this screen, and the
  // merge dropped the middle leg: `brief` was declared as a prop and never read.
  // `handoffCopy` is already pinned on both sides of `hasBrief`, so what is
  // untested without this is the WIRING — and the cost of getting it wrong is
  // handing someone a start prompt naming the wrong entry point.
  it('names read_brief in the start prompt when the map has a brief', () => {
    render(
      <BridgeFixture status="unavailable" events={[]}>
        <MapScreen {...props} brief={{ sourceName: 'discovery.pdf' }} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/read_brief/)).toBeTruthy();
  });

  // The control for the case above. Without it, a screen that hardcoded
  // `hasBrief` true would pass the brief assertion while getting every
  // brief-less map — most of them — wrong.
  it('names read_map when there is no brief', () => {
    render(
      <BridgeFixture status="unavailable" events={[]}>
        <MapScreen {...props} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/read_map/)).toBeTruthy();
  });
});
