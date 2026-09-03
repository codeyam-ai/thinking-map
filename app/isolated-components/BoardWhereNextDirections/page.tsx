'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardWhereNextDirections';
import type { SummaryNode } from '../../lib/summaryGroups';

// A client harness rather than a server page: taking a direction is a callback,
// and a function cannot cross the server/client boundary as a prop.
//
// The thing every scenario has to show is that these are BUTTONS. On paper they
// were lettered list items — A, B, C, inert — which made the end of the map a
// thing to read. Pressing one is the same contribution the insight stack's
// "where next" already makes: a note saying which way to go, not an answer,
// because no question on the map is closed by choosing a direction.

const node = (id: string, label: string, order: number): SummaryNode => ({
  id,
  kind: 'direction',
  label,
  detail: null,
  order,
});

const scenarios: Record<string, { items: SummaryNode[] }> = {
  // Three, which is what the partner is asked for and what the lettering fits.
  Default: {
    items: [
      node('a', 'Classroom vocabulary game', 0),
      node('b', 'Teacher assessment tool', 1),
      node('c', 'Shared parent-teacher app', 2),
    ],
  },

  // Two is a real shortlist. A pair must not read as an either/or toggle.
  Two: {
    items: [
      node('a', 'Classroom vocabulary game', 0),
      node('b', 'Teacher assessment tool', 1),
    ],
  },

  // A direction long enough to wrap. It wraps rather than truncating, because
  // half a direction cannot be chosen between — which is the only thing these
  // buttons are for.
  LongDirection: {
    items: [
      node(
        'a',
        'A shared board the evening shift and the morning shift both write to, replacing the whiteboard rather than sitting beside it',
        0,
      ),
      node('b', 'Teacher assessment tool', 1),
    ],
  },

  // The partner has not picked directions yet, which is most of a session. The
  // region names the next action rather than the absence of data.
  Empty: { items: [] },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  const [taken, setTaken] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ width: 420 }}>
        <Component items={scenario.items} onChoose={setTaken} />
      </div>
      {taken ? (
        <div className="mt-2 text-[12px] text-white/50">took: {taken}</div>
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
