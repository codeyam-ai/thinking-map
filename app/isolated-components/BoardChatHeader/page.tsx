'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../../app/components/BoardChatHeader';

// A client harness rather than a server page: the header takes `onToggle` and
// `onClose` callbacks, and an event handler cannot be passed from a server
// component to a client one — that boundary is what made the first version of
// this file return HTTP 500 rather than a picture.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  // Held rather than no-op'd so the chevron is genuinely wired: a capture of a
  // dead control looks identical to a capture of a live one, and only one of
  // them is worth registering.
  const [open, setOpen] = useState(s !== 'Collapsed');
  const [closed, setClosed] = useState(false);

  if (s !== 'Default' && s !== 'Collapsed') {
    return <div>Unknown scenario: {s}</div>;
  }

  // The panel's ground, width and rounded top, because this row is the top of a
  // floating panel and reads as a plain toolbar without them.
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
      <Component
        open={open}
        onToggle={() => setOpen((v) => !v)}
        onClose={() => setClosed(true)}
      />
      {closed ? (
        <div className="px-4 pb-2 text-[12px] text-white/40">closed</div>
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
