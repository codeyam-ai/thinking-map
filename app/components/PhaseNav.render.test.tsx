// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import PhaseNav from './PhaseNav';
import { PHASES, PHASE_LABELS } from '../lib/mapKinds';

// The one genuinely testable behavior the scrolling track ships with.
//
// Everything else about the narrow-width track is layout — an element wider
// than its container, a fade mask, a flex child that wraps — and jsdom has no
// layout engine, so `getBoundingClientRect` returns zeros and an assertion
// about overflow would pass whether or not the bug were present. Those are
// demonstrated by scenario capture instead. What IS testable is the effect:
// once the track scrolls, advancing a phase has to bring the new step into
// view on its own, or the active step can sit off-screen with nothing saying so.

afterEach(cleanup);

/** jsdom does not implement scrollIntoView, so the component guards for its
 *  absence. Installing a spy is what lets us observe the call it makes. */
function spyOnScrollIntoView() {
  const spy = vi.fn();
  (
    Element.prototype as unknown as { scrollIntoView?: unknown }
  ).scrollIntoView = spy;
  return spy;
}

describe('PhaseNav active-step visibility', () => {
  // A page can load with any phase active — a map resumed at Explore starts
  // with the track already scrolled past the start. If the pill were only
  // centered on CHANGE, that first paint would open scrolled to 01 with the
  // real position off-screen.
  it('scrolls the active pill into view on first render', () => {
    const spy = spyOnScrollIntoView();
    render(<PhaseNav active="explore" />);

    expect(spy).toHaveBeenCalledTimes(1);
    // Centering is what keeps the neighbouring steps visible on both sides,
    // which is how the track still reads as a map of the whole process.
    expect(spy).toHaveBeenCalledWith({ inline: 'center', block: 'nearest' });
  });

  // The behavior the narrow track exists for: advancing a phase has to bring
  // the new step into view on its own. Without it the active step can sit off
  // the right edge with nothing telling the reader it moved.
  it('scrolls the newly active pill into view when the phase advances', () => {
    const spy = spyOnScrollIntoView();
    const { rerender } = render(<PhaseNav active="idea" />);
    spy.mockClear();

    rerender(<PhaseNav active="next-steps" />);

    expect(spy).toHaveBeenCalledTimes(1);
  });

  // The effect is keyed on the phase, not on every render. A re-render from an
  // unrelated parent update must not yank the track back, which would fight a
  // reader who has just scrolled it by hand.
  it('does not re-scroll when the phase is unchanged', () => {
    const spy = spyOnScrollIntoView();
    const { rerender } = render(<PhaseNav active="map" />);
    spy.mockClear();

    rerender(<PhaseNav active="map" />);

    expect(spy).not.toHaveBeenCalled();
  });

  // The design decision this locks in: at narrow widths the track SCROLLS
  // rather than collapsing to a "3 of 5" summary, because it is a map of the
  // process rather than a progress bar. Every step stays in the DOM at every
  // width.
  //
  // Counted off PHASES rather than a literal: the loop has already been
  // renumbered once (deconstruct and map merged), and this test is about the
  // track showing ALL of whatever the loop is — not about there being five.
  it('renders every phase, so the whole process stays reachable', () => {
    spyOnScrollIntoView();
    render(<PhaseNav active="idea" />);

    expect(screen.getAllByText(/^\d\d /)).toHaveLength(PHASES.length);
  });

  // Exactly one pill carries `aria-current="step"` — the hook the scroll effect
  // targets and the only cue a screen reader gets, since the lime fill that
  // marks the active step visually says nothing on its own.
  it('marks only the active phase as the current step', () => {
    spyOnScrollIntoView();
    const { container } = render(<PhaseNav active="research" />);

    const current = container.querySelectorAll('[aria-current="step"]');
    expect(current).toHaveLength(1);
    // Read from the labels rather than hardcoded: research is 03 since the
    // merge, and pinning the number here would only re-break on the next one.
    expect(current[0].textContent).toContain(PHASE_LABELS.research);
  });
});
