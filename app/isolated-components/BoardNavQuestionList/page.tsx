'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardNavQuestionList';
import type { NavQuestion } from '../../lib/boardNav';

// A client harness rather than a server page: each row takes a callback, and a
// function cannot cross the server/client boundary as a prop.
//
// The thing every scenario has to show is that the rows carry the questions'
// OWN WORDS and their card's own colour. A list of "Question 1, Question 2"
// would be a menu of positions, and the whole reason this exists is the case
// where you already know which question you want to think about.

const HUES = { pink: 318, green: 96, blue: 233, orange: 22 };

const scenarios: Record<string, { questions: NavQuestion[] }> = {
  // Three open cards across three lines of thinking, which is what makes the
  // dots worth drawing at all.
  Default: {
    questions: [
      {
        id: 'a',
        label: 'At what moment does it actually get dropped?',
        hue: HUES.pink,
      },
      {
        id: 'b',
        label: 'Who is supposed to own a call-back once the shift ends?',
        hue: HUES.green,
      },
      {
        id: 'c',
        label: 'Does this replace the whiteboard or sit beside it?',
        hue: HUES.blue,
      },
    ],
  },

  // One question is a legitimate list. It must not read as a heading.
  Single: {
    questions: [
      {
        id: 'a',
        label: 'At what moment does it actually get dropped?',
        hue: HUES.pink,
      },
    ],
  },

  // More than the panel is tall. It scrolls DOWN — the one direction anything
  // here may move — and the ceiling exists because a board with a dozen open
  // cards would otherwise drop a list past the bottom of the screen.
  Overflowing: {
    questions: [
      {
        id: 'a',
        label: 'At what moment does it actually get dropped?',
        hue: HUES.pink,
      },
      {
        id: 'b',
        label: 'Who is supposed to own a call-back once the shift ends?',
        hue: HUES.green,
      },
      {
        id: 'c',
        label: 'Does this replace the whiteboard or sit beside it?',
        hue: HUES.blue,
      },
      {
        id: 'd',
        label: 'Which item goes missing most often?',
        hue: HUES.orange,
      },
      { id: 'e', label: 'Do patients ever touch it directly?', hue: HUES.pink },
      {
        id: 'f',
        label: 'Is it coordination or is it staffing?',
        hue: HUES.green,
      },
      {
        id: 'g',
        label: 'What already exists that people have tried?',
        hue: HUES.blue,
      },
    ],
  },

  // A question long enough to wrap, which is the shape a real one produces.
  // It wraps rather than truncating: a half-shown question cannot be chosen
  // between, which is the only thing this list is for.
  LongQuestion: {
    questions: [
      {
        id: 'a',
        label:
          'When a re-check is promised at the end of a shift, who is holding it between that moment and the next morning — and does anyone write it down?',
        hue: HUES.pink,
      },
      {
        id: 'b',
        label: 'Is it coordination or is it staffing?',
        hue: HUES.green,
      },
    ],
  },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  const [went, setWent] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The list hangs off the bar, so the harness supplies the bar's ground and
  // the relative box it is positioned against — its `absolute` placement is
  // only meaningful inside one.
  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ position: 'relative', height: 360, width: 360 }}>
        <Component questions={scenario.questions} onGoTo={setWent} />
      </div>
      {went ? (
        <div className="text-[12px] text-white/50">flew to: {went}</div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <Harness />
    </Suspense>
  );
}
