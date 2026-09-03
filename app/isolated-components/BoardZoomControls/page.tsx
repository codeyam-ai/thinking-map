'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../../app/components/BoardZoomControls';

// A client harness rather than a server page: the stack takes three callbacks,
// and an event handler cannot be passed from a server component to a client
// one.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  // A zoom factor the harness applies to nothing — it exists so the controls
  // are genuinely wired, since a capture of three dead buttons looks exactly
  // like a capture of three live ones.
  const [zoom, setZoom] = useState(1);

  if (s !== 'Default') return <div>Unknown scenario: {s}</div>;

  // The component positions itself absolutely against the board's bottom-left,
  // so it contributes nothing to its parent's intrinsic size — a shrink-to-fit
  // capture element would collapse to a hairline around it. A relative box the
  // shape of a corner of the board is what makes the PLACEMENT visible, which
  // is the thing worth looking at here.
  return (
    <div
      id="codeyam-capture"
      style={{
        background: '#0a0a0b',
        width: 320,
        height: 260,
        position: 'relative',
      }}
    >
      <Component
        onZoomIn={() => setZoom((z) => z * 1.35)}
        onZoomOut={() => setZoom((z) => z / 1.35)}
        onFrameAll={() => setZoom(1)}
      />
      {zoom !== 1 ? (
        <div className="absolute right-3 top-3 text-[12px] text-white/40">
          zoom: {zoom.toFixed(2)}
        </div>
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
