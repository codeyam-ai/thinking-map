'use client';

// What is still waiting for you, and the way to get to it.
//
// The count is a BUTTON, not a readout. A board wide enough to need a count is
// already too wide to scan by eye, so a number that only reports is a scoreboard
// for a problem it just described and did nothing about — pressing it flies the
// camera to the next unanswered card and focuses its field, which is the same
// motion clicking the card performs.
//
// The chevron beside it is the other half of that promise. In order is the
// common case, so it is the plain press; picking a specific one is the case
// where you already know which question you want to think about, and a list of
// their actual TEXT is the only thing that makes that choice possible. Two
// affordances rather than one control that guesses which you meant.
//
// What is left in this file is the ARRANGEMENT: which of the three things the
// left of the bar is showing — the count and its list, the way on to the next
// phase, or the note that the plan is where the map ends — and whether the list
// is open. The count and the list each own their own appearance.

import { useRef, useState } from 'react';
import { useDismissOnOutside } from '@/app/hooks/useDismissOnOutside';
// The shape comes from `boardNav`, beside the function that builds it. A copy
// declared here would be a second definition of the same thing, free to drift
// from the one the board actually produces.
import type { NavQuestion } from '@/app/lib/boardNav';
import BoardNavCount from './BoardNavCount';
import BoardNavQuestionList from './BoardNavQuestionList';

export default function BoardNavQuestions({
  questions,
  insightCount,
  onGoTo,
  onGoToNext,
  forward,
}: {
  /** The open cards, in board order — the order the plain press walks. */
  questions: NavQuestion[];
  /** How much the partner has worked out so far. Counted, never listed: an
   *  insight is not waiting for you, so it has nothing to navigate TO. */
  insightCount: number;
  onGoTo: (id: string) => void;
  onGoToNext: () => void;
  /** The way on, for a board with nothing left open. It takes the count's
   *  place rather than sitting beside it: only one of the two can ever be the
   *  next thing to do, and showing both is what made this bar say three
   *  different things at once. */
  forward?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const shell = useRef<HTMLDivElement>(null);
  useDismissOnOutside(shell, open, () => setOpen(false));

  const waiting = questions.length;

  return (
    <div ref={shell} className="relative flex min-w-0 items-center gap-1.5">
      {waiting > 0 ? (
        <>
          <BoardNavCount
            waiting={waiting}
            onGoToNext={() => {
              setOpen(false);
              onGoToNext();
            }}
          />

          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={
              open ? 'Hide the open questions' : 'List the open questions'
            }
            aria-expanded={open}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/40 transition-colors hover:text-white"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              aria-hidden="true"
              style={{ transform: open ? 'rotate(180deg)' : 'none' }}
            >
              <path
                d="M6 9l6 6 6-6"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      ) : forward ? (
        // Nothing open, but there IS a way on — so the bar carries the way on
        // rather than a report that nothing is waiting. "Nothing waiting on
        // you" was a dead end printed in the one place a person looks to find
        // out where to go, and it sat next to two other controls each claiming
        // to be the next move. One lime thing, and it is the next move.
        forward
      ) : (
        // The last stop on the arc: nothing open and no phase left to reach.
        // Even here it points somewhere — at the plan standing at the far end
        // of the board, which is what the person came back for.
        <span className="shrink-0 whitespace-nowrap px-2 text-[12.5px] text-white/45">
          Your plan is at the end of the map
        </span>
      )}

      {insightCount > 0 ? (
        <span className="shrink-0 whitespace-nowrap pl-2 text-[12.5px] text-white/45">
          {insightCount} insight{insightCount === 1 ? '' : 's'}
        </span>
      ) : null}

      {open && waiting > 0 ? (
        <BoardNavQuestionList
          questions={questions}
          onGoTo={(id) => {
            setOpen(false);
            onGoTo(id);
          }}
        />
      ) : null}
    </div>
  );
}
