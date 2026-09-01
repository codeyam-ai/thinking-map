'use client';

import { useEffect, useRef } from 'react';
import { PHASES, PHASE_LABELS, type Phase } from '../lib/mapKinds';

/**
 * The six-phase track. The active phase wears the lime; the rest are muted.
 * Completed phases are deliberately not distinguished from upcoming ones —
 * this is a map of the process, not a progress bar.
 *
 * Below `lg` the six pills are wider than a half screen, so the track scrolls
 * horizontally rather than collapsing to a "3 of 6" summary — keeping the whole
 * process visible and reachable is the point of the track. The active pill is
 * scrolled into view whenever it changes, and a trailing fade is what says
 * there is more to the right.
 */
export default function PhaseNav({ active }: { active: Phase }) {
  const activeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    // jsdom has no layout engine and no scrollIntoView, so guard rather than
    // making the render tests carry a polyfill.
    activeRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [active]);

  return (
    <nav className="no-scrollbar flex flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain rounded-full bg-surface p-1.5 [mask-image:linear-gradient(to_right,black_85%,transparent)] lg:[mask-image:none]">
      {PHASES.map((phase) => {
        const isActive = phase === active;
        return (
          <span
            key={phase}
            ref={isActive ? activeRef : undefined}
            aria-current={isActive ? 'step' : undefined}
            className={`rounded-full px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] whitespace-nowrap lg:px-3.5 lg:tracking-[0.08em] ${
              isActive ? 'bg-lime text-ink' : 'text-muted'
            }`}
          >
            {PHASE_LABELS[phase]}
          </span>
        );
      })}
    </nav>
  );
}
