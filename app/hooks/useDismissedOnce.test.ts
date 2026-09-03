// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDismissedOnce } from './useDismissedOnce';

const KEY = 'test.note.dismissed';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('useDismissedOnce', () => {
  // The ordinary first visit. It is shown only after the effect runs, never on
  // the first render — server and client must agree, and only the client can
  // know what the browser remembers.
  it('shows the thing to someone who has never dismissed it', () => {
    const { result } = renderHook(() => useDismissedOnce(KEY));
    expect(result.current.show).toBe(true);
  });

  // Closing it now, and recording that it was closed. Both halves matter: the
  // second is what stops it coming back on the next map.
  it('hides it once, and remembers', () => {
    const { result } = renderHook(() => useDismissedOnce(KEY));
    act(() => result.current.dismiss());

    expect(result.current.show).toBe(false);
    expect(window.localStorage.getItem(KEY)).toBe('1');
  });

  // The second visit, which is the whole reason this is remembered at all.
  it('stays hidden on a later visit', () => {
    const first = renderHook(() => useDismissedOnce(KEY));
    act(() => first.result.current.dismiss());

    const second = renderHook(() => useDismissedOnce(KEY));
    expect(second.result.current.show).toBe(false);
  });

  // Two notes must not dismiss each other.
  it('remembers each key separately', () => {
    const one = renderHook(() => useDismissedOnce('note.one'));
    act(() => one.result.current.dismiss());

    const two = renderHook(() => useDismissedOnce('note.two'));
    expect(two.result.current.show).toBe(true);
  });

  // The failure that decides the direction of the whole hook. A private
  // window, cleared site data, or a browser set to block site data can make
  // the read THROW — and showing an instruction twice is a far smaller failure
  // than never showing it at all, so a throw has to leave it visible.
  it('shows it anyway when the browser refuses to be read', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('access denied');
    });

    const { result } = renderHook(() => useDismissedOnce(KEY));
    expect(result.current.show).toBe(true);
  });

  // Closing has to work even when the closing cannot be recorded. Someone
  // meeting the note once more on another visit is not worth a broken button.
  it('still closes when the browser refuses to be written to', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    const { result } = renderHook(() => useDismissedOnce(KEY));
    act(() => result.current.dismiss());
    expect(result.current.show).toBe(false);
  });
});
