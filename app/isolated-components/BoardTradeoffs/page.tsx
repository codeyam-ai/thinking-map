'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Component from '../../components/BoardTradeoffs';
import type { Tradeoffs } from '../../lib/tradeoffs';

// A client harness because the component holds its own open/closed state for
// "dig in" — and that state is the point of half these scenarios.
//
// The two halves worth capturing are the FEW bullets and the control. A card is
// scanned while being held against the option below it, so printing everything
// known would turn a shortlist into a wall — and hiding the rest behind a
// control rather than dropping it means someone who has narrowed it to two can
// still get the whole picture on both.

const scenarios: Record<string, { tradeoffs: Tradeoffs | null }> = {
  // Everything the partner could say. Two bullets stand; the other four wait.
  Default: {
    tradeoffs: {
      effort: 'About two days',
      cost: 'Printing, a few pounds',
      requires: ['One teacher who will run it', 'Ten words chosen in advance'],
      betterWhen: 'You already have a classroom to try it in',
      worseWhen: 'The question is really about parents, not pupils',
    },
  },

  // The partner knew the effort and nothing else. A partial answer is kept
  // rather than padded — inventing a cost to fill the shape is exactly the
  // plausible-sounding nothing this field exists to avoid.
  EffortOnly: { tradeoffs: { effort: 'An afternoon' } },

  // Two facts, so everything fits and the control knows not to offer itself.
  // Nothing to dig into is not a broken expander.
  NothingHidden: { tradeoffs: { effort: 'An afternoon', cost: 'Free' } },

  // The comparison the whole field exists for, on its own.
  TheComparison: {
    tradeoffs: {
      betterWhen: 'You want an answer this week',
      worseWhen: 'You need it to survive a second classroom',
    },
  },

  // A finding or a gap has no effort and no alternative to be better than, so
  // it carries none of this — and the component renders NOTHING rather than a
  // heading over no bullets, which would announce thinking that never happened.
  None: { tradeoffs: null },
};

function Harness() {
  const s = useSearchParams().get('s') ?? 'Default';
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // Inside the bordered card it really sits in, at the far-end column's width,
  // because the label column only reads as a column against a real bound.
  return (
    <div id="codeyam-capture" style={{ background: '#050505', padding: 28 }}>
      <div style={{ width: 420 }}>
        <div className="flex flex-col gap-1.5 rounded-[16px] border border-white/20 px-4 py-3.5">
          <span className="text-[11px] uppercase tracking-[0.14em] text-white/40">
            Try this
          </span>
          <span className="text-[13.5px] font-semibold leading-snug text-white">
            Ten words on paper cards, one classroom
          </span>
          <Component tradeoffs={scenario.tradeoffs} />
        </div>
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
