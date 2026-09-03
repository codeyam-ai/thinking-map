'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardNav';
import type { NavQuestion } from '../../lib/boardNav';

// A client harness rather than a server page: the bar takes callbacks, and a
// function cannot cross the server/client boundary as a prop.
//
// The whole bar, which is where its one rule is visible: the left side ALWAYS
// POINTS SOMEWHERE. Set these scenarios beside each other and the rule reads —
// questions waiting, or the way on to the next phase, never a report that
// nothing is happening.

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
  {
    questions: NavQuestion[];
    insightCount: number;
    atFarEnd?: boolean;
    changedCount?: number;
    forward?: boolean;
  }
> = {
  // The surface a person actually works on: what is waiting, a way to the far
  // end, and somewhere to say the thing that fits on no card.
  Default: { questions: QUESTIONS, insightCount: 3 },

  // A fresh board. No insights yet, so the far-end button is ABSENT — a door
  // onto an empty room competes with the one thing genuinely waiting.
  NothingAtTheFarEnd: { questions: QUESTIONS, insightCount: 0 },

  // The map moved while the person was answering. The partner read what they
  // said and wrote at the far end, and the badge is the only thing on screen
  // that says so.
  SomethingChanged: { questions: QUESTIONS, insightCount: 4, changedCount: 2 },

  // Everything answered. The way ON stands where the count stood, in the same
  // lime, because it is now the one thing asking for the person.
  Answered: { questions: [], insightCount: 3, forward: true },

  // Standing at the far end, where the same button is the way back.
  AtTheFarEnd: { questions: QUESTIONS, insightCount: 3, atFarEnd: true },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The bar is pinned across the top of the board and stretches to its width,
  // so the harness supplies a board-sized dark ground rather than letting it
  // render at its content width — which is a shape it never has in the app.
  return (
    <div
      id="codeyam-capture"
      style={{ background: '#050505', padding: 20, width: 980 }}
    >
      <Component
        questions={scenario.questions}
        insightCount={scenario.insightCount}
        onGoTo={() => {}}
        onGoToNext={() => {}}
        onSay={() => {}}
        atFarEnd={scenario.atFarEnd}
        changedCount={scenario.changedCount}
        onGoToFarEnd={() => {}}
        onBackToMap={() => {}}
        // Stands in for `PhaseAdvance` in its `bar` tone: the real one needs a
        // map id and the bridge, and what this is about is that something
        // occupies the count's slot wearing the count's lime.
        forward={
          scenario.forward ? (
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
