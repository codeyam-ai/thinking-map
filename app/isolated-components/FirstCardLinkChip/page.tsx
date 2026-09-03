'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/FirstCardLinkChip';
import type { FetchedBrief } from '../../lib/briefFetch';

// A client component, not a server one: the remove handler is a function, and a
// server component cannot pass one across the boundary.
//
// The harness stands up two things the chip cannot be judged without. The
// CARD'S YELLOW, because the whole visual claim is that this chip inverts
// against it — black on yellow, where a browsed file's chip is a wash of the
// same yellow — and on a default background that distinction is invisible. And
// the 440px width, because the chip is an <li> in a fixed-width card and
// truncation is the behaviour worth looking at.

const PAGE: FetchedBrief = {
  text: '# Digital Membership Renewal\n\nNorthgate Library District serves 41,000 cardholders.',
  sourceName: 'Digital Membership Renewal — northgate.example.gov/board/renewal-brief',
  mediaType: 'text/html',
  warning: null,
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, FetchedBrief> = {
    // The ordinary result of the link door: a page with a real title, which is
    // longer than the chip and truncates rather than widening.
    Default: PAGE,
    // A bare domain, which is what an untitled page gives you. Shown as it is —
    // truncation is for names that need it, not a house style applied to every
    // chip.
    ShortName: { ...PAGE, sourceName: 'northgate.example.gov/spec' },
    // A title that runs to a sentence, which is most of them. This is the case
    // that decides whether a page can be shown in a 440px card at all: the
    // card's controls sit on the row below, and a chip that grows pushes them
    // out of line.
    LongName: {
      ...PAGE,
      sourceName:
        'Northgate Library District — Digital Membership Renewal, Board Brief v4 (final)',
    },
  };
  const brief = preset[s];
  if (!brief) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{ background: '#e4ec4b' }}
      >
        {/* A <ul>, because the chip is an <li> and lives in the strip. */}
        <ul className="flex flex-wrap gap-2">
          <Component brief={brief} onRemove={() => {}} />
        </ul>
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
