// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useSelfEndingRound } from './useSelfEndingRound';

// The round ending itself is the one thing on this board that happens without
// anyone asking for it, so what has to be pinned is not only that it fires but
// that every stated way of stopping it actually stops it — and that the thing
// most likely to break it in production, a re-render storm, does not.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const SECONDS = 10;

describe('useSelfEndingRound', () => {
  // Nothing counts down until the board says the round is finished. This is
  // what keeps a board with open questions on it completely still.
  it('reports nothing while disarmed', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useSelfEndingRound({ armed: false, seconds: SECONDS, onExpire }),
    );

    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current.remaining).toBeNull();
    expect(onExpire).not.toHaveBeenCalled();
  });

  // The number is the whole point of counting down in the open rather than
  // firing at once — someone has to be able to see how long they have.
  it('counts down in whole seconds once armed', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useSelfEndingRound({ armed: true, seconds: SECONDS, onExpire }),
    );

    expect(result.current.remaining).toBe(SECONDS);

    act(() => void vi.advanceTimersByTime(3_000));
    expect(result.current.remaining).toBe(7);
  });

  // The headline behaviour: left alone, the round ends on its own.
  it('fires once when the countdown runs out', () => {
    const onExpire = vi.fn();
    renderHook(() =>
      useSelfEndingRound({ armed: true, seconds: SECONDS, onExpire }),
    );

    act(() => void vi.advanceTimersByTime(SECONDS * 1000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  // Ticks keep arriving after expiry until the caller disarms. Firing on each
  // one would write a fresh note onto the shared log four times a second.
  it('does not fire again on the ticks after it expires', () => {
    const onExpire = vi.fn();
    renderHook(() =>
      useSelfEndingRound({ armed: true, seconds: SECONDS, onExpire }),
    );

    act(() => void vi.advanceTimersByTime(SECONDS * 1000));
    act(() => void vi.advanceTimersByTime(10_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  // "A visible cancel" is the promise the countdown is allowed to exist on. If
  // holding open did not actually hold, the automation would be a thing done TO
  // the person rather than for them.
  it('stops for good once the round is held open', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useSelfEndingRound({ armed: true, seconds: SECONDS, onExpire }),
    );

    act(() => void vi.advanceTimersByTime(2_000));
    act(() => void result.current.holdOpen());
    expect(result.current.remaining).toBeNull();

    act(() => void vi.advanceTimersByTime(60_000));
    expect(onExpire).not.toHaveBeenCalled();
  });

  // The race the tick's ref re-read exists for: a hold landing between two
  // scheduled ticks must make the already-queued tick a no-op, not end a round
  // the person just cancelled.
  it('ignores a tick already scheduled when the hold landed', () => {
    const onExpire = vi.fn();
    const { result } = renderHook(() =>
      useSelfEndingRound({ armed: true, seconds: SECONDS, onExpire }),
    );

    act(() => void vi.advanceTimersByTime(SECONDS * 1000 - 100));
    act(() => void result.current.holdOpen());
    act(() => void vi.advanceTimersByTime(1_000));

    expect(onExpire).not.toHaveBeenCalled();
  });

  // THE PRODUCTION FAILURE THIS HOOK IS SHAPED AROUND. The board calls
  // router.refresh() on every revision bump, so an agent writing anything at
  // all re-renders it with a fresh onExpire identity and restarts the effect.
  // Held in state instead of a ref, the deadline would reset on each of those
  // and the round would never end while a partner was working.
  it('keeps counting across re-renders that change the callback identity', () => {
    const onExpire = vi.fn();
    const { result, rerender } = renderHook(
      (props: { onExpire: () => void }) =>
        useSelfEndingRound({ armed: true, seconds: SECONDS, ...props }),
      { initialProps: { onExpire } },
    );

    act(() => void vi.advanceTimersByTime(6_000));
    expect(result.current.remaining).toBe(4);

    // A new function each time, exactly as a useCallback over a changed bridge
    // produces.
    for (let i = 0; i < 5; i += 1) {
      rerender({ onExpire });
      act(() => void vi.advanceTimersByTime(500));
    }

    expect(result.current.remaining).toBeLessThan(4);
    act(() => void vi.advanceTimersByTime(2_000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });

  // Cancelling ends THIS round's countdown, not the feature. The next round has
  // to arrive with a fresh one or the board silently stops ending itself for
  // the rest of the session.
  it('arms again for the next round after a hold', () => {
    const onExpire = vi.fn();
    const { result, rerender } = renderHook(
      (props: { armed: boolean }) =>
        useSelfEndingRound({ seconds: SECONDS, onExpire, ...props }),
      { initialProps: { armed: true } },
    );

    act(() => void result.current.holdOpen());
    act(() => void vi.advanceTimersByTime(30_000));
    expect(onExpire).not.toHaveBeenCalled();

    // The partner replies and a new round begins: disarm, then arm again.
    rerender({ armed: false });
    act(() => void vi.advanceTimersByTime(100));
    rerender({ armed: true });

    expect(result.current.remaining).toBe(SECONDS);
    act(() => void vi.advanceTimersByTime(SECONDS * 1000));
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
