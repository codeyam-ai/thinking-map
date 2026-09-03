'use client';

// The bar over the map.
//
// It replaced the chat panel in the corner, and the change is about what a
// person needs from a surface they can get lost on. A transcript answers "what
// was said"; a board answers "what is here"; neither of them answers the
// question someone actually arrives with, which is *does anything still need
// me, and how do I get to it*. That question has one honest answer — a count of
// what is open and a way to reach it — and it belongs at the top, where you
// look first, rather than in a corner you have to remember to check.
//
// THE LEFT SIDE ALWAYS POINTS SOMEWHERE. That is the rule, and it is worth
// stating because the bar briefly broke it: with everything answered it read
// "Nothing waiting on you" on the left, "Everything on the board is answered ·
// Next round" on the right, and "The directions are laid out… Draw up the plan"
// on a second row — three claims about what to do next, one of them a dead end,
// in the one place a person looks to find out where to go. So there is exactly
// one forward move on screen at a time and it always occupies the same spot:
// the questions still waiting, or, when there are none, the way on to the next
// phase.
//
// The round button went with that. It offered a THIRD next move beside those
// two, for something the board already does on its own — the round ends itself
// once everything is answered, and typing in this bar still holds it open. What
// is lost is the visible countdown-cancel; what is gained is a bar that names
// one next thing instead of three.
//
// It is pinned to the viewport, not to the board plane — everything inside the
// transform shrinks as you zoom out, and a navigation aid that got smaller the
// more lost you were would be exactly backwards. `data-no-pan` for the same
// reason `BoardZoomControls` carries it: without it, a press that starts on a
// button and drifts three pixels pans the map instead of clicking.

import BoardNavComposer from './BoardNavComposer';
import BoardNavFarEnd from './BoardNavFarEnd';
import type { NavQuestion } from '@/app/lib/boardNav';
import BoardNavQuestions from './BoardNavQuestions';

export default function BoardNav({
  questions,
  insightCount,
  onGoTo,
  onGoToNext,
  onSay,
  onTyping,
  forward,
  atFarEnd,
  changedCount,
  onGoToFarEnd,
  onBackToMap,
}: {
  questions: NavQuestion[];
  insightCount: number;
  onGoTo: (id: string) => void;
  onGoToNext: () => void;
  onSay: (text: string) => void;
  onTyping?: () => void;
  /** The way on when nothing is left open. It takes the count's PLACE rather
   *  than sitting beside it — only one of the two can be the next thing to do. */
  forward?: React.ReactNode;
  /** The round trip to the far end of the board, and how much has arrived
   *  there while the person was answering. */
  atFarEnd?: boolean;
  changedCount?: number;
  onGoToFarEnd?: () => void;
  onBackToMap?: () => void;
}) {
  return (
    <div
      // `relative`, not `absolute`: the board's top-left column places this and
      // whatever sits under it. And explicitly NOT `overflow-hidden`, however
      // much the rounded corners want it — the question list hangs BELOW this
      // bar, and clipping to the bar left the chevron flipping open onto
      // nothing.
      className="pointer-events-auto relative rounded-[20px] border border-white/12 bg-black/85 backdrop-blur-md"
      data-no-pan
    >
      <div className="flex items-center gap-3 px-4 py-2.5">
        <BoardNavQuestions
          questions={questions}
          insightCount={insightCount}
          onGoTo={onGoTo}
          onGoToNext={onGoToNext}
          forward={forward}
        />

        {/* The spacer, so the two groups sit at the two ends however wide the
            left one gets. It is also what the composer expands INTO. */}
        <div className="min-w-0 flex-1" />

        {/* Only when there IS something at the far end to go to. A board with
            no insights yet offers the questions and nothing else — a button
            promising insights on a map that has none is a door onto an empty
            room, and it competes for attention with the one thing that is
            genuinely waiting.

            `|| atFarEnd` is not a loophole: someone standing at the far end
            needs the way back even if what they went to read has since been
            removed, and a control that vanished under them would strand them
            at the end of the board. */}
        {onGoToFarEnd && onBackToMap && ((insightCount ?? 0) > 0 || atFarEnd) ? (
          <BoardNavFarEnd
            atFarEnd={Boolean(atFarEnd)}
            changedCount={changedCount ?? 0}
            onGoToFarEnd={onGoToFarEnd}
            onBackToMap={onBackToMap}
          />
        ) : null}

        <BoardNavComposer onSend={onSay} onTyping={onTyping} />
      </div>
    </div>
  );
}
