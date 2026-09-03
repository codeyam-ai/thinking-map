'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardToolkitPanel';

// A client harness rather than a server page: the panel remembers its own
// dismissal in the browser, so what it shows depends on state only the client
// has.
//
// The scenarios are the two reasons it stands DOWN, which is the part worth
// pinning. It is dismissed by hand — an instruction that vanished while you
// were still reading it would have to be remembered instead of read — but it
// also gets out of the way while a card is focused, because a tablet-width
// board has no room for both a 300px note and the 276px card someone just flew
// to, and leaving it up would have the instruction cover the very thing it
// asked them to go and do.

const scenarios: Record<string, { suppressed: boolean }> = {
  // Arriving at a map. The one instruction worth giving is the loop itself.
  Default: { suppressed: false },

  // On a card, or on a finished map. Not the same as dismissed: this is
  // temporary and unrecorded, and the note comes back when they step off.
  StoodDown: { suppressed: true },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];

  // A capture browser starts from a cold profile, so the panel is undismissed
  // by default — but a rerun in a warm one would silently photograph nothing.
  // Clearing is what makes the capture the same every time.
  useEffect(() => {
    try {
      window.localStorage.removeItem('thinkingmap.board-toolkit.dismissed');
    } catch {
      // Nothing to clear is the state we wanted anyway.
    }
  }, []);

  if (!scenario) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ minHeight: 220 }}>
        <Component suppressed={scenario.suppressed} />
        {scenario.suppressed ? (
          <div className="text-[12px] text-white/40">
            stood down — the card underneath is what matters right now
          </div>
        ) : null}
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
