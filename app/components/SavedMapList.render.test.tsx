// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import SavedMapList from './SavedMapList';
import type { SavedMap } from './SavedMapRow';

// The list demoted from a section to a strip.
//
// The change it exists to protect is a trade: the landing screen gets its
// question back, and someone with many saved maps gives up seeing all of them
// at once. That trade is only acceptable if the rest stay reachable — a cap
// that silently swallowed the fourth map would be a data-loss bug wearing a
// layout change's clothes.

afterEach(cleanup);

function maps(count: number): SavedMap[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `m${i + 1}`,
    title: `Map number ${i + 1}`,
    phase: 'idea',
    _count: { nodes: 3 },
  }));
}

describe('SavedMapList', () => {
  // Usually empty, and an empty strip is still a heading and a gap — so it
  // renders nothing rather than reserving space for nothing.
  it('renders nothing when no maps are saved', () => {
    const { container } = render(<SavedMapList maps={[]} />);
    expect(container.firstChild).toBeNull();
  });

  // Under the cap there is nothing to disclose, so the control must not appear.
  it('shows every map and no disclosure when it fits', () => {
    render(<SavedMapList maps={maps(3)} />);

    expect(screen.getByText('Map number 3')).toBeTruthy();
    expect(screen.queryByText(/Show all/)).toBeNull();
  });

  // The cap itself: three rows, and the count in the control tells you what you
  // are not seeing rather than hiding that there is more.
  it('caps the strip at three and says how many there are', () => {
    render(<SavedMapList maps={maps(7)} />);

    expect(screen.getByText('Map number 3')).toBeTruthy();
    expect(screen.queryByText('Map number 4')).toBeNull();
    expect(screen.getByText('Show all 7')).toBeTruthy();
  });

  // The reachability half of the trade — nothing is lost, only folded.
  it('reveals the rest on request', () => {
    render(<SavedMapList maps={maps(7)} />);

    fireEvent.click(screen.getByText('Show all 7'));

    expect(screen.getByText('Map number 7')).toBeTruthy();
    // Once everything is shown the control has nothing left to offer.
    expect(screen.queryByText(/Show all/)).toBeNull();
  });
});
