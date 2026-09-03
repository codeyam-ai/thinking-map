'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { isTextClipped } from '@/app/lib/clippedText';

/**
 * Watches a scrolling element and reports whether it is currently hiding text
 * below its bottom edge — the signal the core card turns into a fade.
 *
 * All the reasoning lives in `isTextClipped`; this is the wiring. It re-measures
 * on scroll and on resize, because the same idea clips at one card width and
 * not at another and the board it sits on is zoomable. `deps` re-measures when
 * the CONTENT changes, which no resize would report.
 */
export function useClippedText<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null);
  const [clipped, setClipped] = useState(false);

  const measure = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setClipped(
      isTextClipped({
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        scrollTop: el.scrollTop,
      }),
    );
  }, []);

  useEffect(() => {
    measure();
    const el = ref.current;
    // Guarded because the observer is absent in some test and SSR
    // environments; the measure above still runs, so the value is never stale
    // in a way that matters on a first paint.
    if (!el || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, ...deps]);

  return { ref, clipped, onScroll: measure };
}
