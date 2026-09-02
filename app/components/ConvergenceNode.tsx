'use client';

// Where the lines come back together.
//
// The board's whole shape is a promise: one idea opens into several lines of
// thinking, and they are worth something again when they close. This is the
// closing. Until it holds something, the curves converge on nothing — which
// reads as a drawing that ran out rather than as a place still being filled.
//
// So it is never empty. Before the rows are done it is a dim marker: "this is
// where you are heading". Once they are done and the partner is composing, it
// is a cycling word — deliberately a little absurd, because the honest thing to
// say during a wait of unknown length is not a fake percentage, and a machine
// that is visibly amusing itself is better company than one pretending to
// measure something. When the conclusion lands, it is the conclusion.

import { useEffect, useState } from 'react';

/** The words. Half real, half nonsense, because a wait that takes itself too
 *  seriously invites you to time it. */
const WORDS = [
  'Gathering',
  'Decombobulating',
  'Cross-referencing',
  'Untangling',
  'Reticulating',
  'Weighing',
  'Second-guessing',
  'Recombobulating',
  'Sharpening',
];

export type ConvergenceState =
  | { kind: 'waiting' }
  | { kind: 'composing' }
  | { kind: 'ready'; label: string; detail: string | null };

export default function ConvergenceNode({
  state,
  hue = 62,
}: {
  state: ConvergenceState;
  hue?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (state.kind !== 'composing') return;
    // Slow enough to read, fast enough that it never looks stuck.
    const t = setInterval(() => setI((n) => n + 1), 1400);
    return () => clearInterval(t);
  }, [state.kind]);

  if (state.kind === 'waiting') {
    return (
      <div className="absolute -translate-x-1/2 -translate-y-1/2">
        <div
          className="rounded-full border border-dashed"
          style={{
            width: 132,
            height: 132,
            borderColor: 'rgba(255,255,255,0.16)',
          }}
        />
      </div>
    );
  }

  if (state.kind === 'composing') {
    return (
      <div className="absolute -translate-y-1/2" style={{ left: -60 }}>
        <div className="flex items-center gap-5">
          <span
            className="block h-[26px] w-[26px] shrink-0 rounded-full"
            style={{
              background: '#e4ec4b',
              animation: 'cy-think 1.4s ease-in-out infinite',
            }}
          />
          {/* Keyed on the index so each word remounts and replays the fade —
              without the key it would swap in place with no transition. */}
          <span
            key={i}
            className="whitespace-nowrap text-[26px] font-medium"
            style={{
              color: 'rgba(255,255,255,0.5)',
              animation: 'cy-emerge 420ms ease-out both',
            }}
          >
            {WORDS[i % WORDS.length]}…
          </span>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute -translate-y-1/2 rounded-[24px] border p-8"
      style={{
        left: -40,
        width: 480,
        background: '#0b0b0c',
        borderColor: `hsl(${hue} 80% 60% / 0.5)`,
        boxShadow: '0 26px 80px rgba(0,0,0,0.65)',
      }}
    >
      <span
        className="text-[11px] font-semibold uppercase tracking-[0.14em]"
        style={{ color: `hsl(${hue} 85% 65%)` }}
      >
        Where to start
      </span>
      <p className="mt-3 text-[22px] font-semibold leading-snug text-white">
        {state.label}
      </p>
      {state.detail ? (
        <p className="mt-3 text-[14px] leading-relaxed text-white/60">
          {state.detail}
        </p>
      ) : null}
    </div>
  );
}
