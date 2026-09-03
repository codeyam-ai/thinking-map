'use client';

// The round trip between the map and what it has produced.
//
// One control, not two. The far end of the board is a long way from the cards
// you answer — far enough that reaching it meant panning, and getting back
// meant panning again or giving up and pressing All — so the button that takes
// you there is the button that brings you back. A separate "return" control
// would be a second thing to find at the moment someone is already lost.
//
// The count is the other half. Crossing the board is only worth doing when
// something is over there, and the map moves while you are answering: the
// partner reads what you said and writes at the far end, with nothing on
// screen to say so. So the button carries how much arrived while you were
// elsewhere, and stops carrying it the moment you have been to look.

export default function BoardNavFarEnd({
  atFarEnd,
  changedCount,
  onGoToFarEnd,
  onBackToMap,
}: {
  /** Where the button last took you — not where the camera is. Deriving this
   *  from the camera would flip the label under someone who nudged the board a
   *  little, which is the moment they most need it to say what it said a
   *  second ago. */
  atFarEnd: boolean;
  changedCount: number;
  onGoToFarEnd: () => void;
  onBackToMap: () => void;
}) {
  if (atFarEnd) {
    return (
      <button
        type="button"
        onClick={onBackToMap}
        className="shrink-0 whitespace-nowrap rounded-full border border-white/20 px-4 py-1.5 text-[12.5px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
      >
        ← Back to the map
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onGoToFarEnd}
      className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-white/20 px-4 py-1.5 text-[12.5px] text-white/70 transition-colors hover:border-white/40 hover:text-white"
    >
      Insights
      {changedCount > 0 ? (
        // A dot and a number rather than the word "new". It sits inside a
        // button that already says where it goes, and the only question left
        // is how much is waiting there — lime as a FILL, which is the one use
        // the palette allows and the one thing on this bar that just changed.
        <span className="rounded-full bg-[#D5F560] px-1.5 py-0.5 text-[11px] font-semibold leading-none text-black">
          {changedCount}
        </span>
      ) : null}
      <span aria-hidden="true">→</span>
    </button>
  );
}
