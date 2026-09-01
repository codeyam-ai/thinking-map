// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBoundedWait } from './useBoundedWait';

// A shimmer that never ends is a claim the page cannot back. This is the clock
// that ends it, and the two things worth pinning are that it DOES end and that
// it starts over when the page is reaching for something new.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useBoundedWait', () => {
  // Nothing has elapsed at the moment the wait begins.
  it('starts at zero', () => {
    const { result } = renderHook(() => useBoundedWait(true, 20_000));
    expect(result.current).toBe(0);
  });

  // It reports a step rather than a running total: re-rendering the map column
  // once a frame to move a decision that flips once would be pure waste.
  it('stays at zero until the limit, then reports the limit', () => {
    const { result } = renderHook(() => useBoundedWait(true, 20_000));

    act(() => void vi.advanceTimersByTime(19_999));
    expect(result.current).toBe(0);

    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(20_000);
  });

  // Inactive means there is nothing being waited on, so no clock runs.
  it('never elapses while inactive', () => {
    const { result } = renderHook(() => useBoundedWait(false, 20_000));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current).toBe(0);
  });

  // A round that goes back to being unanswered — the person pressed Edit — is
  // not still waiting, and must not carry its old elapsed time forward.
  it('resets when the wait stops being active', () => {
    const { result, rerender } = renderHook(
      ({ active }) => useBoundedWait(active, 20_000),
      { initialProps: { active: true } },
    );
    act(() => void vi.advanceTimersByTime(20_000));
    expect(result.current).toBe(20_000);

    rerender({ active: false });
    expect(result.current).toBe(0);
  });

  // The one that matters for a live map: a new round arrived, so the page is
  // reaching for the NEXT thing and the wait starts over rather than being
  // already expired.
  it('restarts the wait when the reset key changes', () => {
    const { result, rerender } = renderHook(
      ({ round }) => useBoundedWait(true, 20_000, round),
      { initialProps: { round: 2 } },
    );
    act(() => void vi.advanceTimersByTime(20_000));
    expect(result.current).toBe(20_000);

    rerender({ round: 3 });
    expect(result.current).toBe(0);

    act(() => void vi.advanceTimersByTime(19_999));
    expect(result.current).toBe(0);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe(20_000);
  });

  // An unmounted map must not leave a timer running.
  it('clears its timer on unmount', () => {
    const clear = vi.spyOn(globalThis, 'clearTimeout');
    const { unmount } = renderHook(() => useBoundedWait(true, 20_000));
    unmount();
    expect(clear).toHaveBeenCalled();
  });
});
