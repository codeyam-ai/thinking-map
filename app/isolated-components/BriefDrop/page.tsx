'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component, { type AttachedBrief } from '../../components/BriefDrop';

const SPEC = `# Northgate Library — Digital Membership Renewal

## Background

Northgate Library District serves 41,000 cardholders across six branches and a
bookmobile. Membership is free but must be renewed every two years, which is a
state requirement tied to proof of residence rather than a policy we chose.

## Who this is for

Roughly 30% of active cardholders are over 65. About 5,600 households in the
district have no fixed broadband connection.

## Residency verification

This is the part we are least sure about. State rules require proof that the
cardholder still lives in the district.`;

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, AttachedBrief | null> = {
    // Nothing attached and not pasting. This state now renders NOTHING — the
    // dashed panel that used to live here moved into the `+` menu inside the
    // input frame, which is the whole point of the landing-focus change.
    Default: null,
    // A document in hand. The intake switches wholesale: the drop target is
    // gone and the readout takes its place, because there is one brief per map
    // and attaching a second is not a thing you can do.
    Attached: {
      text: SPEC.repeat(3),
      sourceName: 'northgate-renewal-brief.pdf',
      mediaType: 'application/pdf',
      warning: null,
    },
    // Mid-paste: the person chose "Paste a brief" from the attach menu and the
    // box is open. This is the state the menu's second item leads to.
    Pasting: null,
    // The third door, open: an address field instead of a textarea, because a
    // page is neither a file you can pick nor text you would paste.
    Linking: null,
  };
  // The hook runs unconditionally — an early return above it would break the
  // rules of hooks — so an unknown scenario is caught after state is set up.
  const [brief, setBrief] = useState<AttachedBrief | null>(preset[s] ?? null);
  if (!(s in preset)) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component
          brief={brief}
          pasting={s === 'Pasting'}
          linking={s === 'Linking'}
          onAttach={setBrief}
          onAttachLink={() => {}}
          onClear={() => setBrief(null)}
          onCancelPaste={() => {}}
          onCancelLink={() => {}}
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
