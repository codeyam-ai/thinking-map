'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../../app/components/BoardChatComposer';

// A client harness rather than a server page: the composer takes an `onSend`
// callback, and a function cannot cross the server/client boundary as a prop.
// Holding what was sent also means the capture shows sending genuinely wired
// up rather than dropped on the floor.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const [sent, setSent] = useState<string | null>(null);

  if (s !== 'Default') return <div>Unknown scenario: {s}</div>;

  // The panel's ground and width, with the top border the composer sits under
  // in the real panel — on white and at full width it is a different object.
  return (
    <div
      id="codeyam-capture"
      style={{
        background: 'rgba(0,0,0,0.85)',
        width: 360,
        borderRadius: 22,
        border: '1px solid rgba(255,255,255,0.12)',
      }}
    >
      <Component onSend={setSent} />
      {sent ? (
        <div className="px-4 pb-2 text-[12px] text-white/40">sent: {sent}</div>
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
