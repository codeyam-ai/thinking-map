// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFollowColumn } from './useFollowColumn';

// Two failures this guards against, both of which are the page being rude
// rather than the page being broken: jumping to the bottom before the person
// has read the top, and yanking someone down while they are re-reading an
// earlier round.

afterEach(() => vi.restoreAllMocks());

/** A container the hook can measure, positioned either at the bottom or well
 *  above it. jsdom reports zeros for real layout, so the geometry is supplied. */
function attach(
  hook: ReturnType<typeof renderHook<ReturnType<typeof useFollowColumn>, never>>,
  { scrollTop, scrollHeight = 2000, clientHeight = 500 }: { scrollTop: number; scrollHeight?: number; clientHeight?: number },
) {
  const el = document.createElement('div');
  Object.defineProperties(el, {
    scrollTop: { value: scrollTop, writable: true },
    scrollHeight: { value: scrollHeight, writable: true },
    clientHeight: { value: clientHeight, writable: true },
  });
  hook.result.current.scrollRef.current = el;

  const end = document.createElement('div');
  const scrollIntoView = vi.fn();
  (end as HTMLElement & { scrollIntoView: unknown }).scrollIntoView =
    scrollIntoView;
  hook.result.current.endRef.current = end;
  return scrollIntoView;
}

describe('useFollowColumn', () => {
  // The regression that shipped once: StrictMode double-invokes effects on
  // mount, so a "have I run yet" flag gets consumed by the first invocation and
  // the second one scrolls. Seeding from mount-time values means neither
  // invocation sees a transition.
  it('does not scroll on mount, even when the effect runs twice', () => {
    const hook = renderHook(() => useFollowColumn(3, true));
    const scrollIntoView = attach(hook, { scrollTop: 0 });

    // A second invocation with unchanged inputs, which is what StrictMode does.
    hook.rerender();

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // A round arriving is the page reacting, and that is what earns a scroll.
  it('scrolls when a new round arrives', () => {
    const hook = renderHook(({ n }) => useFollowColumn(n, false), {
      initialProps: { n: 2 },
    });
    const scrollIntoView = attach(hook, { scrollTop: 1500 });

    hook.rerender({ n: 3 });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  // The moment the last answer goes in, the map reaches for the next row — and
  // the column follows it down. This is "the app moves first" as a scroll.
  it('scrolls when the round completes and the page starts reaching', () => {
    const hook = renderHook(({ reaching }) => useFollowColumn(3, reaching), {
      initialProps: { reaching: false },
    });
    const scrollIntoView = attach(hook, { scrollTop: 1500 });

    hook.rerender({ reaching: true });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  // THE COURTESY. Someone who scrolled up to re-read round one is reading, and
  // a round arriving must not drag them back down.
  it('leaves a reader alone who has scrolled up', () => {
    const hook = renderHook(({ n }) => useFollowColumn(n, false), {
      initialProps: { n: 2 },
    });
    // Far from the bottom: 2000 - 100 - 500 = 1400px of column below them.
    const scrollIntoView = attach(hook, { scrollTop: 100 });
    hook.result.current.onScroll();

    hook.rerender({ n: 3 });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // And it picks them back up when they return to the bottom, rather than
  // giving up on following for the rest of the session.
  it('resumes following once the reader returns to the bottom', () => {
    const hook = renderHook(({ n }) => useFollowColumn(n, false), {
      initialProps: { n: 2 },
    });
    const scrollIntoView = attach(hook, { scrollTop: 100 });
    hook.result.current.onScroll();

    // Back to the bottom: 2000 - 1500 - 500 = 0px remaining.
    hook.result.current.scrollRef.current!.scrollTop = 1500;
    hook.result.current.onScroll();

    hook.rerender({ n: 3 });
    expect(scrollIntoView).toHaveBeenCalled();
  });

  // Nothing changed, so there is nothing to react to.
  it('does not scroll on a re-render that changes neither input', () => {
    const hook = renderHook(({ n }) => useFollowColumn(n, true), {
      initialProps: { n: 3 },
    });
    const scrollIntoView = attach(hook, { scrollTop: 1500 });

    hook.rerender({ n: 3 });
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  // The map renders in isolated scenarios with no scroll container measured;
  // reading the position must not throw there.
  it('survives being asked for a position with no container', () => {
    const hook = renderHook(() => useFollowColumn(1, false));
    expect(() => hook.result.current.onScroll()).not.toThrow();
  });
});
