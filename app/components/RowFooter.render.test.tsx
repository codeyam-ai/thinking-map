// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import RowFooter from './RowFooter';

// The footer's whole job is choosing which of two things belongs under a round.
// Two of the three outcomes are visible and have scenarios; the third is
// "render nothing", which no screenshot can evidence — a blank frame looks
// identical to a broken one. So it is pinned here.

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {} }) }));

afterEach(cleanup);

describe('RowFooter', () => {
  // While questions are open the cards are the action, so the footer counts and
  // offers nothing to press.
  it('counts while the round is still being answered', () => {
    render(
      <RowFooter
        phase="map"
        answered={2}
        questions={3}
        pending={{ kind: 'hidden' }}
        mapId="map-1"
      />,
    );
    expect(screen.getByText(/2 of 3 answered/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  // THE ONE A SCREENSHOT CANNOT MAKE. The round is done and the map is still
  // reaching, so the shimmering row above is already explaining the wait.
  // Anything here would be the same thing said twice, one line apart — which is
  // exactly what the first build of this did, and what looked wrong on screen.
  it('renders nothing while the map is still reaching for the next round', () => {
    const { container } = render(
      <RowFooter
        phase="map"
        answered={3}
        questions={3}
        pending={{ kind: 'waiting' }}
        mapId="map-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  // Once the wait has settled, the action takes over from the count.
  it('offers the phase action once the wait has settled', () => {
    render(
      <RowFooter
        phase="map"
        answered={3}
        questions={3}
        pending={{ kind: 'settled', note: 'No agent can reach this page.' }}
        mapId="map-1"
      />,
    );
    expect(screen.getByRole('button').textContent).toContain(
      'Ready to research',
    );
  });

  // A round of statements was never something to answer, so it must not show a
  // "0 of 0 answered" line on its way to the action.
  it('shows no count for a round that asked nothing', () => {
    render(
      <RowFooter
        phase="map"
        answered={0}
        questions={0}
        pending={{ kind: 'settled', note: 'No agent can reach this page.' }}
        mapId="map-1"
      />,
    );
    // Matched on the COUNT's shape, not on the word "answered" — the phase
    // sentence beside the button legitimately contains that word.
    expect(screen.queryByText(/\d+ of \d+ answered/)).toBeNull();
    expect(screen.getByRole('button')).toBeTruthy();
  });

  // The end of the loop has no further step, so there is nothing to offer even
  // though the round is finished and settled.
  it('offers nothing at the end of the loop', () => {
    const { container } = render(
      <RowFooter
        phase="next-steps"
        answered={0}
        questions={0}
        pending={{ kind: 'settled', note: 'No agent can reach this page.' }}
        mapId="map-1"
      />,
    );
    expect(container.firstChild).toBeNull();
  });
});
