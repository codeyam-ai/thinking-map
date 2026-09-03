'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardNavFarEnd';

// A client harness rather than a server page: the round trip takes callbacks,
// and a function cannot cross the server/client boundary as a prop.
//
// The scenarios are the two ends of ONE control. It takes you to the far end
// of the board and then it brings you back — a separate return control would
// be a second thing to find at the moment someone is already lost.

const scenarios: Record<string, { atFarEnd: boolean; changedCount: number }> = {
  // On the map, with nothing new since the last look. The plain invitation.
  Default: { atFarEnd: false, changedCount: 0 },

  // The state the count exists for: the map moved while you were answering.
  // The partner read what you said and wrote at the far end, and nothing else
  // on screen says so.
  Changed: { atFarEnd: false, changedCount: 3 },

  // One. The badge is a number rather than the word "new", so the singular
  // costs nothing.
  OneChanged: { atFarEnd: false, changedCount: 1 },

  // Standing at the far end. Same control, opposite direction — and it says
  // where it goes rather than just "back", because "back" on a board that
  // pans in every direction is not an address.
  AtFarEnd: { atFarEnd: true, changedCount: 0 },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <Component
        atFarEnd={scenario.atFarEnd}
        changedCount={scenario.changedCount}
        onGoToFarEnd={() => {}}
        onBackToMap={() => {}}
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
