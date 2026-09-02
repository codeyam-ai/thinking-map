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
  const preset: Record<
    string,
    { busy: boolean; canStart: boolean; linkDisabled: boolean }
  > = {
    // What almost every arrival sees: nothing typed, nothing attached, so the
    // send is dimmed and both ways in are open.
    Default: { busy: false, canStart: false, linkDisabled: false },
    // Something typed. The send goes solid, which is the only signal that the
    // card is ready to go.
    Ready: { busy: false, canStart: true, linkDisabled: false },
    // A brief in hand and NOTHING typed. The send is live anyway, which is the
    // opposite of every other state here — a page says what you want thought
    // through, so the sentence is optional. "Add a link" dims because there is
    // one brief per board.
    BriefOnly: { busy: false, canStart: true, linkDisabled: true },
    // Mid-submit: the whole row locks and the send spins, so a second click
    // cannot start a second board.
    Busy: { busy: true, canStart: true, linkDisabled: true },
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
          linkDisabled={config.linkDisabled}
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
