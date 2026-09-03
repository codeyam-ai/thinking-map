'use client';

// How the board is meant to be used, said once.
//
// The map arrives with questions already on it, which looks like something to
// read rather than something to do — and the difference between a person who
// gets a good plan out of this and one who does not is entirely whether they
// answered anything. So the one instruction worth giving is the loop itself:
// go round the map, answer things, and the partner gets better at guiding you
// in proportion to what you gave it.
//
// It is DISMISSED BY HAND rather than on a timer or on first answer. An
// instruction that vanishes while you are still reading it has to be
// remembered instead of read, and this one is three lines long — the cost of
// leaving it up until someone closes it is a corner of the board, and the cost
// of taking it away early is the whole point of the panel.
//
// The dismissal is remembered per browser, not per map: this is onboarding for
// the product, not for one board, and meeting it again on every new map would
// make it furniture. `useDismissedOnce` owns that memory and the three ways
// reading it can go wrong — all of which fail towards SHOWING, because meeting
// a note twice is a much smaller failure than never meeting it at all.

import { useDismissedOnce } from '@/app/hooks/useDismissedOnce';

const KEY = 'thinkingmap.board-toolkit.dismissed';

export default function BoardToolkitPanel({
  /** Someone is on a card. The note stands down — it is an instruction to go
   *  and work on the map, and a tablet-width board has no room for both a
   *  300px note and the 276px card the person just flew to, so leaving it up
   *  would have the instruction cover the very thing it asked them to do. Not
   *  the same as being dismissed: this is temporary and unrecorded, and the
   *  note comes back when they step off the card. */
  suppressed = false,
}: {
  suppressed?: boolean;
} = {}) {
  const { show, dismiss } = useDismissedOnce(KEY);

  if (!show || suppressed) return null;

  return (
    <div
      // Directly under the bar and no wider than a column, because the two are
      // one thought: the bar says what is waiting, and this says what to do
      // about it. It also has to be OFF THE CENTRE — a card flown to from the
      // bar lands in the middle of the viewport, and the corner this first sat
      // in put the instruction squarely over that card's Save button.
      className="pointer-events-auto w-[300px] rounded-[20px] border border-white/12 bg-black/85 p-5 backdrop-blur-md"
      data-no-pan
    >
      <div className="mb-3 flex items-start gap-2">
        <h2 className="flex-1 text-[11px] uppercase tracking-[0.14em] text-white/40">
          How this works
        </h2>
        <button
          type="button"
          onClick={dismiss}
          aria-label="Close"
          className="-mt-0.5 shrink-0 text-white/35 transition-colors hover:text-white/80"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M6 6l12 12M18 6L6 18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <p className="text-[13px] leading-relaxed text-white/70">
        Move around the map and answer what it asks you. The more you give it,
        the better it can guide you — and the bar up top will always say what is
        still waiting.
      </p>
    </div>
  );
}
