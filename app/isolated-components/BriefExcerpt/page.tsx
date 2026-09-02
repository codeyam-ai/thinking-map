'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BriefExcerpt';

const BRIEF = `# Northgate Library — Digital Membership Renewal

## Background

Northgate Library District serves 41,000 cardholders across six branches and a
bookmobile. Membership is free but must be renewed every two years.

## Who this is for

Roughly 30% of active cardholders are over 65.`;

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const preset: Record<string, string> = {
    // Verbatim, markdown marks and all — the claim is "this is what came out
    // of your file", and tidying it up would undermine the only thing it
    // is here to prove.
    Default: BRIEF,
    // A scan. The empty preview IS the finding, and it is why this block is
    // shown before a map exists rather than after.
    NothingExtracted: '',
  };
  const text = preset[s];
  if (text === undefined) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: '100%', maxWidth: 930 }}>
        <Component text={text} />
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
