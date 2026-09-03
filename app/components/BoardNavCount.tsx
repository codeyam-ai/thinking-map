'use client';

// How much is still waiting, as the thing that takes you there.
//
// A BUTTON, not a readout. A board wide enough to need a count is already too
// wide to scan by eye, so a number that only reports is a scoreboard for a
// problem it just described and did nothing about. Pressing it flies the camera
// to the next unanswered card and opens its field — the same motion clicking
// the card performs, which is why the two land identically.
//
// It wears the lime, and it is the only lime on the bar. The palette allows the
// accent on exactly one thing per screen: the thing asking for the person. When
// nothing is open this button is gone and the way ON to the next phase takes
// its place and its colour, because only one of the two can ever be the next
// thing to do.

export default function BoardNavCount({
  waiting,
  onGoToNext,
}: {
  /** How many cards are still asking something. Never rendered at zero — the
   *  caller swaps this component out entirely rather than letting it print a
   *  greyed "0 questions waiting", which reads as a control that broke. */
  waiting: number;
  onGoToNext: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onGoToNext}
      // Lime as a FILL with ink type. Never lime type: the token is a fill and
      // a border only, and lime text on this ground fails to read at all.
      className="shrink-0 rounded-full bg-[#D5F560] px-4 py-1.5 text-[12.5px] font-semibold text-black transition-transform hover:scale-[1.02]"
    >
      {waiting} question{waiting === 1 ? '' : 's'} waiting for you
    </button>
  );
}
