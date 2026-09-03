// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';

// The live-refresh contract.
//
// WebMCP is pull-only: the page cannot be woken by an agent. So the board
// watches the bridge's revision and calls `router.refresh()` when it advances,
// and that one `useEffect` is the whole reason an answer or a newly-written
// question appears without a reload. It has three easy ways to be wrong — a
// refresh on mount that re-fetches the page you just loaded, a missed advance,
// and a loop — and none of the three is visible in a screenshot.
//
// The board's children are stubbed out. What is under test is the effect, not
// the canvas; rendering the real board would drag in a layout, a camera and a
// pile of refs to assert nothing about any of them.

const refresh = vi.fn();
let revision: number | null | undefined = null;

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

vi.mock('./WebMcpBridge', () => ({
  useWebMcpBridge: () => ({
    revision,
    status: 'unavailable',
    answer: vi.fn(),
    note: vi.fn(),
  }),
}));

// The board itself is stubbed — what is under test here is the workspace, not
// the canvas — but the stub PRINTS the insight stream it was handed. Without
// that the mock swallows the one thing this file cannot otherwise see: whether
// the workspace computes a stack at all and hands it down. A board mounted with
// no insight surface is exactly the shape of hole that let the handoff band go
// missing, and a stub that rendered a bare div would pass through it.
vi.mock('./GalaxyBoard', () => ({
  default: ({ insights }: { insights?: { id: string; label: string }[] }) => (
    <div data-testid="board">
      {(insights ?? []).map((insight) => (
        <span key={insight.id} data-testid="board-insight">
          {insight.label}
        </span>
      ))}
    </div>
  ),
}));
vi.mock('./BoardChat', () => ({ default: () => <div data-testid="chat" /> }));
vi.mock('./RoundControl', () => ({ default: () => <div data-testid="round" /> }));

const { default: BoardWorkspace } = await import('./BoardWorkspace');

const props = {
  seedIdea: 'Handover between shifts',
  mapId: 'map-galaxy',
  themes: [],
  nodes: [],
};

beforeEach(() => {
  refresh.mockClear();
  revision = null;
});
afterEach(cleanup);

describe('BoardWorkspace live refresh', () => {
  // The first revision it sees only SEEDS the reference. Refreshing on mount
  // would re-fetch the page the person just loaded — a wasted round trip on
  // every single board open, and a visible flash for nothing.
  it('does not refresh on the first revision it sees', () => {
    revision = 7;
    render(<BoardWorkspace {...props} />);

    expect(refresh).not.toHaveBeenCalled();
  });

  // The contract itself: the map moved, so the server component has to re-run.
  // Exactly once — this is the only thing that makes the board live.
  it('refreshes once when the revision advances', () => {
    revision = 7;
    const { rerender } = render(<BoardWorkspace {...props} />);

    revision = 8;
    rerender(<BoardWorkspace {...props} />);

    expect(refresh).toHaveBeenCalledTimes(1);
  });

  // A poll that returns the same revision is the NORMAL case — it is what the
  // bridge reports most of the time. Refreshing on it would put the page in a
  // permanent refresh loop driven by its own polling.
  it('does not refresh when the revision repeats', () => {
    revision = 7;
    const { rerender } = render(<BoardWorkspace {...props} />);

    revision = 7;
    rerender(<BoardWorkspace {...props} />);
    revision = 7;
    rerender(<BoardWorkspace {...props} />);

    expect(refresh).not.toHaveBeenCalled();
  });

  // A retried or out-of-order poll can report a revision BEHIND the one already
  // seen. Treating that as a change would refresh backwards and then forwards
  // again on the next poll — the loop, arrived at from the other direction.
  it('does not refresh when the revision goes backwards', () => {
    revision = 9;
    const { rerender } = render(<BoardWorkspace {...props} />);

    revision = 4;
    rerender(<BoardWorkspace {...props} />);

    expect(refresh).not.toHaveBeenCalled();
  });

  // No agent is bound inside an iframe, which is the state EVERY preview and
  // capture genuinely produces — so an unbound bridge is the common case, not
  // an edge one. Read as zero it would look like a revision, and every board
  // that later bound an agent would refresh spuriously.
  it('ignores an unbound bridge rather than reading it as zero', () => {
    revision = null;
    const { rerender } = render(<BoardWorkspace {...props} />);

    revision = undefined;
    rerender(<BoardWorkspace {...props} />);

    expect(refresh).not.toHaveBeenCalled();
  });

  // The sequence a real session produces: bind, then several advances. Each one
  // is a refresh, and none of them is a double.
  it('refreshes once per advance across a run of them', () => {
    revision = 1;
    const { rerender } = render(<BoardWorkspace {...props} />);

    for (const r of [2, 3, 4]) {
      revision = r;
      rerender(<BoardWorkspace {...props} />);
    }

    expect(refresh).toHaveBeenCalledTimes(3);
  });

  // Binding late is the ordinary path: the page renders, then the bridge
  // reports a revision for the first time. That first real number is a seed,
  // not an advance — refreshing on it is the mount bug wearing a hat.
  it('treats the first real revision after an unbound start as a seed', () => {
    revision = null;
    const { rerender } = render(<BoardWorkspace {...props} />);

    revision = 12;
    rerender(<BoardWorkspace {...props} />);

    expect(refresh).not.toHaveBeenCalled();

    revision = 13;
    rerender(<BoardWorkspace {...props} />);
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});

// What the board is handed to draw at its far end.
//
// This suite exists because nothing asserted the workspace mounted an insight
// surface at ALL. The stack is the whole feature and it is fed by one memo; a
// board rendered with an empty stream looks, in every screenshot of a map that
// has no insights yet, exactly like a board rendered correctly.

const insightNode = (over: { id: string; label: string; themeId?: string }) => ({
  kind: 'suggestion',
  detail: null,
  status: 'answered',
  themeId: null,
  ...over,
});

describe('BoardWorkspace insight stream', () => {
  // The claim the feature rests on: a themeless insight reaches the board,
  // with no round finished and nothing answered anywhere on the map.
  it('hands the board an insight before any round is finished', () => {
    const { getAllByTestId } = render(
      <BoardWorkspace
        {...props}
        nodes={[
          insightNode({
            id: 'i-1',
            label: 'The whiteboard is a symptom of an ownership gap',
          }),
        ]}
      />,
    );

    expect(getAllByTestId('board-insight').map((el) => el.textContent)).toEqual([
      'The whiteboard is a symptom of an ownership gap',
    ]);
  });

  // A map with nothing at the far end yet hands down an EMPTY stream rather
  // than omitting the prop — the stack's own empty state is what draws the
  // honest marker, and it can only do that if it is mounted.
  it('hands the board an empty stream on a map with no insights', () => {
    const { getByTestId, queryAllByTestId } = render(
      <BoardWorkspace
        {...props}
        nodes={[
          insightNode({
            id: 'q-1',
            label: 'Who is carrying it?',
            themeId: 't-who',
          }),
        ]}
      />,
    );

    expect(getByTestId('board')).toBeTruthy();
    expect(queryAllByTestId('board-insight')).toHaveLength(0);
  });

  // The rule the stack rests on, asserted through the workspace rather than
  // only through `insightStream`: a node of an insight kind that lives inside a
  // theme is a card in that row, not a claim about the whole idea. Get this
  // wrong and the same node is drawn twice on one plane.
  it('leaves a themed insight in its row rather than on the stack', () => {
    const { queryAllByTestId } = render(
      <BoardWorkspace
        {...props}
        nodes={[
          insightNode({
            id: 'i-themed',
            label: 'The tools outlast the people who bought them',
            themeId: 't-keeping',
          }),
        ]}
      />,
    );

    expect(queryAllByTestId('board-insight')).toHaveLength(0);
  });
});
