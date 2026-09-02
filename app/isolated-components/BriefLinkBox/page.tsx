'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BriefLinkBox';

// A client component, not a server one: the props below are event handlers, and
// a server component cannot pass a function across the boundary.
//
// The same harness shape as `BriefPasteBox`, deliberately — the two boxes are
// the same door in two materials, and captures that sit side by side are how
// anyone checks they still read as siblings.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, string> = {
    // Where everyone starts, and where "Attach it" is correctly dead — there
    // is no address to fetch yet.
    Default: '',
    // A real address in the field: the button comes alive. A long one, because
    // a link worth attaching is usually a deep link into somebody's docs
    // rather than a bare domain.
    Filled:
      'https://northgate.example.gov/board/2026/digital-membership-renewal-brief',
  };
  const defaultUrl = preset[s];
  if (defaultUrl === undefined) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component
          defaultUrl={defaultUrl}
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
