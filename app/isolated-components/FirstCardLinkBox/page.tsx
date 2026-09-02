'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/FirstCardLinkBox';

// A client component, not a server one: the props below are event handlers, and
// a server component cannot pass a function across the boundary.
//
// The harness stands up the card this box lives inside — the same yellow, the
// same 440px column. Without it the panel would render on the default page
// background and the capture would say nothing about the only question worth
// asking here, which is whether a black-on-yellow field is legible at all.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, { url: string; reading: boolean }> = {
    // Where everyone starts: an empty field, and "Attach it" correctly dead
    // because there is no address to fetch yet.
    Default: { url: '', reading: false },
    // A real address in the field, so the button comes alive. A deep link
    // rather than a bare domain, because a link worth attaching usually is one.
    Filled: {
      url: 'https://northgate.example.gov/board/2026/digital-membership-renewal-brief',
      reading: false,
    },
    // Mid-fetch: the field locks and the button says what is happening rather
    // than inviting a second attempt at the same page.
    Reading: { url: 'https://northgate.example.gov/board/renewal-brief', reading: true },
  };
  const [url, setUrl] = useState(preset[s]?.url ?? '');
  const config = preset[s];
  if (!config) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture">
      <div
        className="flex w-[440px] max-w-[88vw] flex-col rounded-[26px] p-9"
        style={{ background: '#e4ec4b' }}
      >
        <Component
          url={url}
          reading={config.reading}
          onChange={setUrl}
          onAttach={() => {}}
          onCancel={() => {}}
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
