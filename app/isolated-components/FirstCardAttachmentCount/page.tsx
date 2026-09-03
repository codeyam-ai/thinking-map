'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/FirstCardAttachmentCount';

// The harness stands up the card's yellow, because this line is deliberately
// quiet against it — black at 55% — and its whole job is to be readable
// without competing with the chips underneath it. On a default background
// that judgement cannot be made.
//
// The state where it renders NOTHING is not a scenario here: an empty capture
// proves nothing a reader can look at, and the threshold is already pinned by
// FirstCardAttachments' own test.

function Harness() {
  const s = useSearchParams().get('s') ?? 'JustOver';
  const preset: Record<string, number> = {
    // One past the threshold — the first moment the line appears at all, and
    // the case that decides whether it reads as information or as clutter.
    JustOver: 5,
    // A card carrying far more than it can show. This is what the line exists
    // for: the strip below it is scrolling, and this is the only thing saying
    // that what went out of sight is still attached rather than dropped.
    Many: 16,
  };
  const total = preset[s];
  if (total === undefined) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{ background: '#e4ec4b' }}
      >
        <Component total={total} />
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
