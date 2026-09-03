'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardNavComposer';

// A client harness rather than a server page: the composer takes callbacks, and
// a function cannot cross the server/client boundary as a prop.
//
// The composer owns its own open/closed state, and that state is deliberately
// NOT liftable to a prop: the draft belongs with the thing that holds it. So
// this fixture offers the resting state only, and the opened one is captured as
// an INTERACTION scenario that presses the button — which is the honest
// capture anyway, because the field only exists after a press.

const scenarios: Record<string, Record<string, never>> = {
  // Collapsed, which is how it sits for almost all of a session. One word,
  // because the board is what you are meant to be looking at.
  Default: {},
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  const [sent, setSent] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div className="flex justify-end">
        <Component onSend={setSent} />
      </div>
      {sent ? (
        <div className="mt-2 text-[12px] text-white/50">said: {sent}</div>
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
