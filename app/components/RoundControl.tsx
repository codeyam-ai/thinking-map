'use client';

// The round: how a person says "I'm done, come back to me".
//
// WebMCP is pull-only — the page cannot wake an agent — so this button does not
// send anything. It writes one more contribution to the shared log, and the
// agent, which is sitting in `await_user_activity`, wakes because the log
// moved. The waiting state below is therefore honest rather than decorative:
// the page genuinely does not know when the partner will answer, only that the
// map's revision will rise when it has.
//
// That is also why the button is not disabled while questions are unanswered.
// Deciding a round is over is the person's call, not a completeness check —
// "I don't know yet" is a real answer to give by moving on.
//
// `countdown` is the one state where the round ends WITHOUT a press: the board
// is fully answered, so the thing this control existed to ask for has already
// happened. It still counts down in the open rather than firing on the last
// answer, because the seconds after finishing are exactly when someone thinks
// of the general remark that fits nowhere on the board — and automation that
// takes that moment away is a thing done TO them. Hence a visible number and a
// visible way to stop it.

import { useEffect, useRef, useState } from 'react';

export type RoundPhase = 'idle' | 'waiting';

export default function RoundControl({
  open,
  answered,
  phase,
  onNext,
  countdown = null,
  onCancel,
}: {
  /** Unanswered questions currently on the board. */
  open: number;
  /** Questions answered so far this round. */
  answered: number;
  phase: RoundPhase;
  onNext: () => void;
  /** Seconds until the round ends on its own, or null when nothing is armed. */
  countdown?: number | null;
  /** Stop the countdown and leave the round open. */
  onCancel?: () => void;
}) {
  const waiting = phase === 'waiting';
  // A wait that has already begun outranks a countdown to starting one.
  const counting = !waiting && countdown !== null;

  // Elapsed seconds, shown once the wait stops feeling instant. A spinner with
  // no number reads the same at two seconds and at forty; the count is what
  // tells someone whether their partner is thinking or has gone away.
  const [seconds, setSeconds] = useState(0);
  const started = useRef<number | null>(null);
  useEffect(() => {
    if (!waiting) {
      started.current = null;
      setSeconds(0);
      return;
    }
    started.current = Date.now();
    const t = setInterval(
      () => setSeconds(Math.round((Date.now() - (started.current ?? 0)) / 1000)),
      1000,
    );
    return () => clearInterval(t);
  }, [waiting]);

  // Renders INLINE, inside the composer's bar. It used to position itself at
  // the bottom of the board, which is also where the composer lives — two
  // floating controls stacking on the same spot. One bar carrying both is also
  // the truer arrangement: saying something and ending a round are the two
  // things you can do that are not about one particular card.
  return (
    <>
      <span className="hidden shrink-0 whitespace-nowrap pl-1 text-[12px] text-white/45 sm:block">
          {waiting ? (
            <>
              Your partner is thinking
              {seconds > 2 ? ` · ${seconds}s` : ''}
            </>
          ) : counting ? (
            // Deliberately terser than the resting line below it. This is the
            // one state where the row carries THREE things — the message, the
            // way out, and the way on — and the panel is not wide enough for
            // the full sentence plus both. The number is the part that has to
            // survive; "everything is answered" is already why the countdown
            // is on screen at all.
            <>
              Back to your partner ·{' '}
              <span className="tabular-nums text-white/80">{countdown}s</span>
            </>
          ) : open > 0 ? (
            <>
              {answered} answered · {open} still open
            </>
          ) : (
            'Everything on the board is answered'
          )}
      </span>

      {/* The cancel sits BEFORE the primary and is deliberately quiet. It is
          the rarer choice — most rounds should just end — but it has to be
          reachable without aiming, because the person reaching for it is
          racing a number. */}
      {counting && onCancel ? (
        <button
          type="button"
          onClick={onCancel}
          className="shrink-0 whitespace-nowrap rounded-full px-2 py-2.5 text-[12px] text-white/55 underline-offset-2 transition hover:text-white/85 hover:underline"
        >
          Not yet
        </button>
      ) : null}

      <button
        type="button"
        onClick={onNext}
        disabled={waiting}
        className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-[#d9f27e] px-5 py-2.5 text-[13px] font-semibold text-black transition-opacity disabled:opacity-45"
      >
          {waiting ? (
            <>
              {/* The one moving thing on a still board, so "something is
                  happening" needs no reading. */}
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/25 border-t-black" />
              Waiting
            </>
          ) : counting ? (
            <>Go now →</>
          ) : (
          <>Next round →</>
        )}
      </button>
    </>
  );
}
