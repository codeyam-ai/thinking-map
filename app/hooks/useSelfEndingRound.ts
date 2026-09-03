'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * The countdown that ends a round without anyone pressing anything.
 *
 * `armed` is the STATE the board is in — see `roundIsFinished`. This hook adds
 * only the delay and the ways out of it, and the split is deliberate: the round
 * ends because the board ran out of questions, and the seconds are just how
 * long the person gets to change their mind about that.
 *
 * WHY A GRACE WINDOW RATHER THAN FIRING AT ONCE. The seconds after answering
 * the last card are exactly when the general remark that fits on no card
 * arrives — the one about the round as a whole. Handing the board straight to
 * the partner would take that moment away, which is the difference between
 * automation done FOR someone and done TO them. Hence a visible number and two
 * ways to stop it: `holdOpen`, which the cancel button and any keystroke in the
 * chat both call.
 *
 * WHY THE DEADLINE IS A REF. This is the part that breaks if it is rewritten
 * as state. The board calls `router.refresh()` on every revision bump, so an
 * agent writing ANYTHING re-renders this component — and each re-render changes
 * the identity of the `onExpire` callback, which restarts the effect. A
 * deadline recomputed on that path would reset once per agent write and could
 * never reach zero while a partner was busy. The ref survives; only the
 * displayed number is state.
 *
 * NOT `useBoundedWait`. That one reports a STEP — 0 until the limit, then the
 * limit — and deliberately resets whenever `active` or its reset key change
 * identity, because the pending row it serves flips exactly once and a
 * per-frame value would re-render the map column continuously. This needs the
 * opposite on both counts: a number that ticks so it can be read as a
 * countdown, and a deadline that OUTLIVES exactly those identity changes.
 */
export function useSelfEndingRound({
  armed,
  seconds,
  onExpire,
}: {
  /** Whether the round is finished and the countdown should be running. */
  armed: boolean;
  /** How long the person gets before it fires. */
  seconds: number;
  /** Called once, when the countdown runs out. */
  onExpire: () => void;
}): {
  /** Whole seconds left, or null when nothing is counting. */
  remaining: number | null;
  /** Stop the countdown and leave the round open. */
  holdOpen: () => void;
} {
  const deadline = useRef<number | null>(null);
  const heldOpen = useRef(false);
  const [remaining, setRemaining] = useState<number | null>(null);

  const holdOpen = useCallback(() => {
    heldOpen.current = true;
    deadline.current = null;
    setRemaining(null);
  }, []);

  // Cancelling was about the round just finished, not a standing preference
  // never to do this again — so disarming clears the hold and the next round
  // gets a fresh countdown.
  useEffect(() => {
    if (!armed) heldOpen.current = false;
  }, [armed]);

  useEffect(() => {
    if (!armed || heldOpen.current) {
      deadline.current = null;
      setRemaining(null);
      return;
    }
    if (deadline.current === null) {
      deadline.current = Date.now() + seconds * 1000;
    }

    const tick = () => {
      // Re-read the ref every tick rather than closing over the deadline. A
      // hold that lands between two ticks clears it, and this read is what
      // makes the already-scheduled tick a no-op instead of a round that ends
      // after it was cancelled.
      const due = deadline.current;
      if (due === null) return;

      const left = Math.ceil((due - Date.now()) / 1000);
      if (left > 0) {
        setRemaining(left);
        return;
      }

      // Cleared BEFORE firing, so a tick that slips in before React re-renders
      // finds nothing to do rather than ending the round a second time.
      deadline.current = null;
      setRemaining(null);
      onExpire();
    };

    tick();
    // Four times a second: fast enough that the number never visibly sticks on
    // a value, cheap enough to be irrelevant beside the board's own rendering.
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [armed, seconds, onExpire]);

  return { remaining, holdOpen };
}
