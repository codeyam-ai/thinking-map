'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/AttachmentAddButton';

// The way to bring something else along.
//
// A client component, because the button takes an `onClick` and a function
// cannot cross the server boundary.
//
// Only two frames, because the interesting third state is its ABSENCE: at the
// cap this control is not rendered at all rather than rendered and refusing.
// That decision belongs to CoreAttachments, which is where it can be seen —
// the `Full` frame there is the one that shows this button gone, and there is
// nothing to capture for it here.
//
// Dashed rather than solid on purpose: it is an invitation to add something,
// not an action on something that already exists.

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';

  const presets: Record<string, { busy: boolean }> = {
    // At rest, which is how it spends almost all of its time.
    Default: { busy: false },
    // While a save is in flight. Disabled so a second file cannot be chosen
    // into a list that is mid-write.
    Busy: { busy: true },
  };

  const preset = presets[s];
  if (!preset) return <div>Unknown scenario: {s}</div>;

  // An <li> on the board's dark canvas — its white-on-transparent dashes are
  // invisible on a default background.
  return (
    <div id="codeyam-capture" style={{ background: '#000', padding: 28 }}>
      <ul style={{ display: 'flex', gap: 8, margin: 0, padding: 0 }}>
        <Component busy={preset.busy} onClick={() => {}} />
      </ul>
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
