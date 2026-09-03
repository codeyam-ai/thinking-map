'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardNavQuestions';
import type { NavQuestion } from '../../lib/boardNav';

// A client harness rather than a server page: this takes callbacks, and a
// function cannot cross the server/client boundary as a prop.
//
// What is under test here is the ARRANGEMENT — which of three things the left
// of the bar is showing. That is the decision this component owns, and each
// scenario below is one branch of it. The count's own appearance and the
// list's own appearance have their own scenarios.

const HUES = { pink: 318, green: 96, blue: 233 };

const QUESTIONS: NavQuestion[] = [
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
];

const scenarios: Record<
  string,
  { questions: NavQuestion[]; insightCount: number; forward?: 'phase' | null }
> = {
  // Mid-round: questions waiting, and the partner has worked some things out.
  Default: { questions: QUESTIONS, insightCount: 3 },

  // Nothing worked out yet. The insight count is absent rather than zero — a
  // "0 insights" would be a fact nobody needs and a second thing to read.
  NothingLearnedYet: { questions: QUESTIONS, insightCount: 0 },

  // Everything answered, and a phase left to reach. The way ON takes the
  // count's PLACE rather than sitting beside it: only one of the two can be
  // the next thing to do, and showing both is what made this bar say three
  // different things at once.
  Answered: { questions: [], insightCount: 3, forward: 'phase' },

  // The last stop on the arc: nothing open and no phase left. Even here it
  // points somewhere rather than reporting emptiness.
  EndOfTheArc: { questions: [], insightCount: 4, forward: null },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <Component
        questions={scenario.questions}
        insightCount={scenario.insightCount}
        onGoTo={() => {}}
        onGoToNext={() => {}}
        // Stands in for `PhaseAdvance` in its `bar` tone. The real one needs a
        // map id and the bridge; what this scenario is about is that SOMETHING
        // occupies the count's slot, wearing the count's lime.
        forward={
          scenario.forward === 'phase' ? (
            <button
              type="button"
              className="shrink-0 whitespace-nowrap rounded-full bg-[#D5F560] px-4 py-1.5 text-[12.5px] font-semibold text-black"
            >
              Ready to research →
            </button>
          ) : undefined
        }
      />
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
