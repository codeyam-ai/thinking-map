'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/FirstCardControls';

// A client component, not a server one: the props below are event handlers, and
// a server component cannot pass a function across the boundary.
//
// The harness stands up the yellow card this row sits along the bottom of. The
// send button is black-on-yellow and the attach pills are washes of the same
// yellow, so every state below is a contrast question that only reads against
// the real card colour.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, { busy: boolean; canStart: boolean }> = {
    // What almost every arrival sees: nothing typed, nothing attached, so the
    // send is dimmed and both ways in are open.
    Default: { busy: false, canStart: false },
    // Something typed. The send goes solid, which is the only signal that the
    // card is ready to go.
    Ready: { busy: false, canStart: true },
    // Startable from a page alone: pages attached and NOTHING typed. Identical
    // in props to Ready now, and kept anyway — it is the state that says the
    // sentence is OPTIONAL, and it is the one where "Add a link" staying live
    // matters most, because a person who arrived with one page usually has a
    // second. It used to dim here.
    BriefOnly: { busy: false, canStart: true },
    // Mid-submit: the send spins and goes dead, so a second click cannot start
    // a second board.
    Busy: { busy: true, canStart: true },
  };
  const config = preset[s];
  if (!config) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{ background: '#e4ec4b' }}
      >
        <Component
          busy={config.busy}
          canStart={config.canStart}
          onBrowse={() => {}}
          onLink={() => {}}
          onStart={() => {}}
        />
      </div>
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
