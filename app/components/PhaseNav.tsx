'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PHASES, PHASE_LABELS, type Phase } from '../lib/mapKinds';

/**
 * The phase track. The active phase wears the lime; the rest are muted.
 * Completed phases are deliberately not distinguished from upcoming ones —
 * this is a map of the process, not a progress bar.
 *
 * Below `lg` the pills can be wider than a half screen, so the track scrolls
 * horizontally rather than collapsing to a "3 of 5" summary — keeping the whole
 * process visible and reachable is the point of the track. The active pill is
 * scrolled into view whenever it changes, and an edge fade is what says there is
 * more in that direction.
 *
 * The fade is derived from scroll position, never applied unconditionally: a
 * mask over an edge with nothing beyond it promises content that does not exist
 * and washes out whatever really sits there — which, when the last phase is
 * active, is the one pill that must read clearly.
 */

/** Full literal class strings so Tailwind's source scanner finds each one. */
const EDGE_MASKS = {
  none: '',
  start: '[mask-image:linear-gradient(to_right,transparent,black_15%)]',
  end: '[mask-image:linear-gradient(to_right,black_85%,transparent)]',
  both: '[mask-image:linear-gradient(to_right,transparent,black_15%,black_85%,transparent)]',
} as const;

export default function PhaseNav({ active }: { active: Phase }) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const trackRef = useRef<HTMLElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    // Sub-pixel widths mean scrollLeft rarely lands exactly on 0 or on max, so
    // a strict comparison would leave a fade stuck on at a fully-scrolled end.
    const start = el.scrollLeft > 1;
    const end = el.scrollLeft < max - 1;
    setEdges((prev) =>
      prev.start === start && prev.end === end ? prev : { start, end },
    );
  }, []);

  useEffect(() => {
    // jsdom has no layout engine and no scrollIntoView, so guard rather than
    // making the render tests carry a polyfill.
    activeRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
    measure();
  }, [active, measure]);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    measure();
    el.addEventListener('scroll', measure, { passive: true });
    // The window can cross the fits / does-not-fit boundary without any
    // scrolling at all, and a stale "more to the right" would leave the fade on
    // over a track that now fits.
    window.addEventListener('resize', measure);
    return () => {
      el.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [measure]);

  const mask =
    edges.start && edges.end
      ? EDGE_MASKS.both
      : edges.start
        ? EDGE_MASKS.start
        : edges.end
          ? EDGE_MASKS.end
          : EDGE_MASKS.none;

  return (
    <nav
      ref={trackRef}
      className={`no-scrollbar flex flex-nowrap items-center gap-1 overflow-x-auto overscroll-x-contain rounded-full bg-surface p-1.5 ${mask} lg:[mask-image:none]`}
    >
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
