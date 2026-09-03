'use client';

// Every open question, by its own words.
//
// The other half of the count's promise. Taking them in order is the common
// case and the count already does that, so this is for the case where you
// already know WHICH question you want to think about — and the only thing that
// makes that choice possible is seeing what each one actually says. A list of
// "Question 1, Question 2" would be a menu of positions, not of questions.
//
// Each row carries its card's own colour, so a question in this list and the
// card it flies to are visibly the same object rather than two things that
// happen to share a sentence.
//
// It scrolls DOWN and never sideways. A long question wraps; the panel has a
// ceiling because a board with twenty open cards would otherwise drop a list
// past the bottom of the screen.

import { themeColor } from '@/app/lib/themeHue';
import type { NavQuestion } from '@/app/lib/boardNav';

export default function BoardNavQuestionList({
  questions,
  onGoTo,
}: {
  questions: NavQuestion[];
  onGoTo: (id: string) => void;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+10px)] z-10 max-h-[320px] w-[320px] overflow-y-auto overflow-x-hidden rounded-[20px] border border-white/12 bg-black/95 py-2 backdrop-blur-md">
      {questions.map((question) => (
        <button
          key={question.id}
          type="button"
          onClick={() => onGoTo(question.id)}
          className="flex w-full items-start gap-2.5 break-words px-4 py-2.5 text-left text-[13px] leading-snug text-white/75 transition-colors hover:bg-white/8 hover:text-white"
        >
          <span
            aria-hidden="true"
            className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
            style={{ background: themeColor(question.hue) }}
          />
          <span>{question.label}</span>
        </button>
      ))}
    </div>
  );
}
