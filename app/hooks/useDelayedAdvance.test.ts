// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDelayedAdvance } from './useDelayedAdvance';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDelayedAdvance', () => {
  // The pause is the point. Moving the instant the answer is recorded takes
  // the card away before the person has seen their own words land on it, which
  // reads as the board having eaten the answer.
  it('waits before moving on, so the card can turn over first', () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() => useDelayedAdvance(onAdvance, 1000));

    act(() => result.current.arm());
    expect(onAdvance).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(1000));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  // Someone who takes hold of the board has overruled the automation. Moving
  // the view out from under a person who is doing something is the failure
  // this cancel exists to prevent.
  it('does not move on if it was cancelled first', () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() => useDelayedAdvance(onAdvance, 1000));

    act(() => result.current.arm());
    act(() => result.current.cancel());
    act(() => vi.advanceTimersByTime(5000));

    expect(onAdvance).not.toHaveBeenCalled();
  });

  // Answering two cards quickly must not queue two jumps — the second answer
  // replaces the first one's pending move rather than adding to it.
  it('re-arming replaces the pending move rather than queueing another', () => {
    const onAdvance = vi.fn();
    const { result } = renderHook(() => useDelayedAdvance(onAdvance, 1000));

    act(() => result.current.arm());
    act(() => vi.advanceTimersByTime(600));
    act(() => result.current.arm());
    act(() => vi.advanceTimersByTime(600));

    // The first arming's deadline has passed in wall-clock terms; only the
    // second one is still owed, and it is not owed yet.
    expect(onAdvance).not.toHaveBeenCalled();

    act(() => vi.advanceTimersByTime(400));
    expect(onAdvance).toHaveBeenCalledTimes(1);
  });

  // A pending jump firing after the board has gone would move a camera that no
  // longer exists.
  it('drops a pending move when the board unmounts', () => {
    const onAdvance = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDelayedAdvance(onAdvance, 1000),
    );

    act(() => result.current.arm());
    unmount();
    act(() => vi.advanceTimersByTime(5000));

    expect(onAdvance).not.toHaveBeenCalled();
  });

  // The callback is re-created on every render of the component that owns it,
  // so a hook that captured the first one would keep calling a stale closure —
  // moving to a question chosen from a board several answers out of date.
  it('calls the newest callback, not the one captured when it was armed', () => {
    const stale = vi.fn();
    const fresh = vi.fn();
    const { result, rerender } = renderHook(
      ({ fn }) => useDelayedAdvance(fn, 1000),
      { initialProps: { fn: stale } },
    );

    act(() => result.current.arm());
    rerender({ fn: fresh });
    act(() => vi.advanceTimersByTime(1000));

    expect(stale).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledTimes(1);
  });
});
