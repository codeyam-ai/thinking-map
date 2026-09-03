'use client';

// Move on, but not instantly.
//
// Answering a card and being taken somewhere else in the same frame reads as
// the board having eaten the answer: the thing you were looking at is gone
// before your own words appeared on it. So the card turns over first, holds
// long enough to be read, and only then does the camera move.
//
// The pause is the whole feature, which is why it is a timer with a test
// rather than a CSS transition someone has to watch to check.
//
// The callback is held in a ref and read at FIRING time, never captured when
// the timer was armed. The component that owns it re-creates it on every
// render — it closes over which card is focused and which are still open — so
// a captured copy would move to a question chosen from a board several answers
// out of date.

import { useCallback, useEffect, useRef } from 'react';

export function useDelayedAdvance(
  onAdvance: () => void,
  delayMs: number,
): { arm: () => void; cancel: () => void } {
  const latest = useRef(onAdvance);
  latest.current = onAdvance;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancel = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const arm = useCallback(() => {
    // Answering two cards quickly must not queue two jumps: the newer answer
    // replaces the older one's pending move rather than adding to it.
    cancel();
    timer.current = setTimeout(() => {
      timer.current = null;
      latest.current();
    }, delayMs);
  }, [cancel, delayMs]);

  // A pending jump that fired after the board had gone would move a camera
  // that no longer exists.
  useEffect(() => cancel, [cancel]);

  return { arm, cancel };
}
