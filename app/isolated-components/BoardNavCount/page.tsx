'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardNavCount';

// A client harness rather than a server page: the count takes a callback, and a
// function cannot cross the server/client boundary as a prop.
//
// What every scenario below must show is that this is a BUTTON. It reads as a
// count, and a count that only reported would be a scoreboard for a problem it
// had just described and done nothing about — pressing it is what takes you to
// the next unanswered card.

const scenarios: Record<string, { waiting: number }> = {
  // The ordinary board mid-round.
  Default: { waiting: 3 },

  // The singular. "1 questions waiting for you" is the kind of thing nobody
  // notices until it is on screen in front of a client.
  One: { waiting: 1 },

  // A board somebody has left for a while. The pill grows with the number and
  // has to stay a pill rather than wrapping into a paragraph.
  Many: { waiting: 12 },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  const [pressed, setPressed] = useState(false);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The board's ground, because the lime pill is designed against near-black
  // and reads as a completely different weight on white.
  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <Component
        waiting={scenario.waiting}
        onGoToNext={() => setPressed(true)}
      />
      {pressed ? (
        <div className="mt-2 text-[12px] text-white/50">
          flew to the next question
        </div>
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
