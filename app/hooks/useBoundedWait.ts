'use client';

import { useEffect, useState } from 'react';

/**
 * How long something has been true, reported once it has been true long enough.
 *
 * The pending row needs to know when to stop shimmering, and "how long have we
 * been waiting" is the only input it has that a pure function cannot compute.
 * This is that input, and nothing else: it does not know what a round is, and
 * `pendingRow` — which does — decides what the elapsed time means.
 *
 * It reports a STEP, not a ticking clock: 0 until the limit, then the limit. A
 * value that changed every frame would re-render the whole map column once a
 * frame to move a decision that flips exactly once.
 */
export function useBoundedWait(
  active: boolean,
  limitMs: number,
  /** Restart the wait when this changes — a new round means the page is
   *  reaching for something new, not still waiting on the old thing. */
  resetKey?: unknown,
): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    setElapsed(0);
    if (!active) return;
    const timer = setTimeout(() => setElapsed(limitMs), limitMs);
    return () => clearTimeout(timer);
  }, [active, limitMs, resetKey]);

  return elapsed;
}
