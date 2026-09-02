// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import PhaseNav from './PhaseNav';
import { PHASES, PHASE_LABELS } from '../lib/mapKinds';

// What jsdom can and cannot settle about the scrolling track.
//
// It cannot LAY THE TRACK OUT: there is no layout engine, so nothing here can
// establish that six pills really are wider than a half screen, or that the
// fade lands over the pixels it should. Those are demonstrated by scenario
// capture, and the scenarios under `app/isolated-components/PhaseNav` are where
// the mask is actually looked at.
//
// It CAN settle the two decisions the component makes in JavaScript. First, the
// scroll effect: advancing a phase has to bring the new step into view on its
// own. Second — and this is only testable because the fade stopped being a
// static CSS decoration — which mask the track chooses, given a scroll
// position. That choice is a pure function of three numbers, and a number is
// something jsdom will happily hand back if you tell it what to say.

afterEach(cleanup);

/** The layout metrics the mask is derived from. jsdom reports every one of
 *  them as 0, which is why the track's own widths have to be dictated rather
 *  than measured — the point is the DECISION made from them, not the layout. */
const metrics = { scrollWidth: 0, clientWidth: 0, scrollLeft: 0 };

beforeEach(() => {
  for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
    Object.defineProperty(HTMLElement.prototype, key, {
      configurable: true,
      get: () => metrics[key],
    });
  }
});

afterEach(() => {
  for (const key of Object.keys(metrics)) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[key];
  }
});

/** The track's mask class, or undefined when it carries none. The always-on
 *  `lg:` variant is excluded deliberately: above `lg` the track never
 *  overflows, so that one says nothing about the scroll-state decision. */
function maskClassOf(container: HTMLElement) {
  const nav = container.querySelector('nav');
  return [...(nav?.classList ?? [])].find((c) => c.startsWith('[mask-image:'));
}

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

// Which edge the track fades, given where it is scrolled to.
//
// The bug this fixes: the fade was a static decoration applied to every track
// narrower than `lg`, so it washed out whatever sat at the right edge whether
// or not anything was hidden behind it — and when the last phase is active,
// what sits there is the one pill that has to read clearly.
//
// The widths below are dictated, not measured. That is the whole point: the
// component's job is to decide correctly GIVEN a scroll position, and these
// pin the decision. Whether a real track at a real width actually overflows is
// a layout question, and the captured scenarios are what answer it.
describe('PhaseNav edge fades', () => {
  const START = '[mask-image:linear-gradient(to_right,transparent,black_15%)]';
  const END = '[mask-image:linear-gradient(to_right,black_85%,transparent)]';
  const BOTH =
    '[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]';

  /** A track wide enough to overflow its 240px frame, parked where asked. */
  function overflowingAt(scrollLeft: number) {
    Object.assign(metrics, { scrollWidth: 420, clientWidth: 240, scrollLeft });
  }

  // The reported case, and the reason this plan exists. A track that fits has
  // nothing hidden past either edge, so a fade there is a promise of content
  // that does not exist — and it is drawn straight over the active lime pill.
  it('applies no fade at all when the whole track fits', () => {
    spyOnScrollIntoView();
    Object.assign(metrics, { scrollWidth: 240, clientWidth: 240, scrollLeft: 0 });

    const { container } = render(<PhaseNav active="next-steps" />);

    expect(maskClassOf(container)).toBeUndefined();
  });

  // Parked at the start of a track that genuinely does overflow: there is more
  // to the right and nothing to the left, so exactly one edge should say so.
  it('fades only the trailing edge at the start of an overflowing track', () => {
    spyOnScrollIntoView();
    overflowingAt(0);

    const { container } = render(<PhaseNav active="idea" />);

    expect(maskClassOf(container)).toBe(END);
  });

  // Content is cut off both ways, so both edges earn a fade. This is the state
  // the mask exists for, and the only one where the old behaviour was right.
  it('fades both edges mid-track', () => {
    spyOnScrollIntoView();
    overflowingAt(90);

    const { container } = render(<PhaseNav active="research" />);

    expect(maskClassOf(container)).toBe(BOTH);
  });

  // The mirror of the reported bug. Scrolled hard against the end, the trailing
  // fade has to go — otherwise the active pill is washed out again, this time
  // on a track where the fade looked justified.
  it('drops the trailing fade once the track is scrolled to the end', () => {
    spyOnScrollIntoView();
    overflowingAt(180);

    const { container } = render(<PhaseNav active="next-steps" />);

    expect(maskClassOf(container)).toBe(START);
  });

  // Sub-pixel widths mean scrollLeft rarely lands exactly on its maximum, so a
  // strict equality check would leave the trailing fade stuck on at an end the
  // reader has visibly reached. Half a pixel short still counts as the end.
  it('treats a sub-pixel gap at the end as the end', () => {
    spyOnScrollIntoView();
    overflowingAt(179.5);

    const { container } = render(<PhaseNav active="next-steps" />);

    expect(maskClassOf(container)).toBe(START);
  });

  // The decision has to track the reader, not just the first paint. Without the
  // scroll listener the fade would be frozen at whatever was true on mount,
  // which is the static-decoration bug wearing a different disguise.
  it('re-derives the fade when the reader scrolls the track', () => {
    spyOnScrollIntoView();
    overflowingAt(0);
    const { container } = render(<PhaseNav active="idea" />);
    expect(maskClassOf(container)).toBe(END);

    overflowingAt(180);
    fireEvent.scroll(container.querySelector('nav')!);

    expect(maskClassOf(container)).toBe(START);
  });

  // A window can cross the fits / does-not-fit boundary without any scrolling
  // at all. Left to the scroll listener alone, a track that just became wide
  // enough to fit would keep a fade it no longer has any content to justify.
  it('drops the fade when a resize makes the track fit', () => {
    spyOnScrollIntoView();
    overflowingAt(0);
    const { container } = render(<PhaseNav active="idea" />);
    expect(maskClassOf(container)).toBe(END);

    Object.assign(metrics, { scrollWidth: 420, clientWidth: 420, scrollLeft: 0 });
    fireEvent(window, new Event('resize'));

    expect(maskClassOf(container)).toBeUndefined();
  });
});
