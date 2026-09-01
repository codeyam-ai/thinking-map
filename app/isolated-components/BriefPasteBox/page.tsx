'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BriefPasteBox';

const SPEC = `# Northgate Library — Digital Membership Renewal

## Background

Northgate Library District serves 41,000 cardholders across six branches and a
bookmobile. Membership is free but must be renewed every two years, which is a
state requirement tied to proof of residence rather than a policy we chose.
Renewal is currently done in person at a service desk. In FY24 we processed
9,180 renewals and lost an estimated 3,400 cardholders who simply let their
membership lapse rather than make the trip.

## Residency verification

This is the part we are least sure about.`;

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, string> = {
    // Where everyone starts, and where "Attach it" is correctly dead — there
    // is nothing to attach yet.
    Default: '',
    // A real document in the box: the button comes alive, and the panel grows
    // to hold a brief that would never have fitted in the one-line input.
    Filled: SPEC,
  };
  const defaultText = preset[s];
  if (defaultText === undefined) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component
          defaultText={defaultText}
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
