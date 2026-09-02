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

import { useEffect, useRef, useState } from 'react';

export type RoundPhase = 'idle' | 'waiting';

export default function RoundControl({
  open,
  answered,
  phase,
  onNext,
}: {
  /** Unanswered questions currently on the board. */
  open: number;
  /** Questions answered so far this round. */
  answered: number;
  phase: RoundPhase;
  onNext: () => void;
}) {
  const waiting = phase === 'waiting';

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

  return (
    <div
      className="pointer-events-auto absolute bottom-6 left-1/2 z-20 -translate-x-1/2"
      data-no-pan
    >
      <div className="flex items-center gap-4 rounded-full border border-white/12 bg-black/80 px-3 py-2 pl-6 backdrop-blur">
        <span className="text-[13px] text-white/60">
          {waiting ? (
            <>
              Your partner is thinking
              {seconds > 2 ? ` · ${seconds}s` : ''}
            </>
          ) : open > 0 ? (
            <>
              {answered} answered · {open} still open
            </>
          ) : (
            'Everything on the board is answered'
          )}
        </span>

        <button
          type="button"
          onClick={onNext}
          disabled={waiting}
          className="flex items-center gap-2 rounded-full bg-[#d9f27e] px-5 py-2.5 text-[13px] font-semibold text-black transition-opacity disabled:opacity-45"
        >
          {waiting ? (
            <>
              {/* The one moving thing on a still board, so "something is
                  happening" needs no reading. */}
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-black/25 border-t-black" />
              Waiting
            </>
          ) : (
            <>Next round →</>
          )}
        </button>
      </div>
    </div>
  );
}
