'use client';

import { useEffect, useRef } from 'react';

/** How close to the bottom still counts as following along. Someone who has
 *  scrolled up to re-read round one is READING, and moving the page under a
 *  reader is worse than not moving it at all. */
const FOLLOWING_SLACK_PX = 120;

export interface FollowColumn {
  /** Put on the scrolling container. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Put on an empty element at the very bottom of that container. */
  endRef: React.RefObject<HTMLDivElement | null>;
  /** Wire to the container's `onScroll`. */
  onScroll(): void;
}

/**
 * Keeping the bottom of a growing column in view — for a reader who is at the
 * bottom, and nobody else.
 *
 * Two things make this less trivial than it looks.
 *
 * First, it must not fire on first paint. The scroll is the page REACTING — a
 * round arriving, or the last answer of a round going in — and a page that
 * jumps to its own bottom before the person has read the top is not reacting to
 * anything.
 *
 * Second, "have I run before?" is the WRONG way to express that, because React
 * StrictMode invokes effects twice on mount and the second invocation would
 * find the flag already consumed and scroll. (That is not hypothetical: it is
 * exactly what this did before it was written this way.) So the refs are seeded
 * with the MOUNT-TIME values during render, and the effect compares against a
 * transition. A double invocation sees no change, because there was none.
 */
export function useFollowColumn(
  rounds: number,
  /** The round is fully answered, so the page is reaching for the next one. */
  reaching: boolean,
): FollowColumn {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const following = useRef(true);
  const previousRounds = useRef(rounds);
  const previousReaching = useRef(reaching);

  useEffect(() => {
    const grew = rounds > previousRounds.current;
    const startedReaching = reaching && !previousReaching.current;
    previousRounds.current = rounds;
    previousReaching.current = reaching;

    if (!grew && !startedReaching) return;
    if (!following.current) return;
    // Guarded rather than called: jsdom has no layout, so it does not define
    // this at all, and a render test should not have to stub it.
    endRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'end' });
  }, [rounds, reaching]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    following.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < FOLLOWING_SLACK_PX;
  }

  return { scrollRef, endRef, onScroll };
}
