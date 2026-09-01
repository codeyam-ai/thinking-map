'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';

/** Below this, node labels stop being readable and the map stops being a map. */
export const MIN_SCALE = 0.62;

/**
 * Scale a fixed-size plane to fit its frame, down to a legibility floor.
 *
 * Seeing the shape of your thinking all at once is the point of the map, so
 * fitting beats scrolling — but only to MIN_SCALE. A map that would need more
 * shrinking than that has outgrown the panel, and scrolling a readable map
 * beats staring at an illegible one that fits.
 *
 * This is the map's INITIAL answer, not a standing invariant. Pass
 * `userControlled` once the person has taken the viewport (see useMapViewport)
 * and the fit stops recomputing: a ResizeObserver tick would otherwise stamp on
 * someone's zoom the moment the window moved, and the centre-the-scroll effect
 * would throw away wherever they had panned to.
 */
export function useFitToFrame(
  contentWidth: number,
  contentHeight: number,
  userControlled = false,
) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [frameWidth, setFrameWidth] = useState(0);

  // Read inside the observer rather than through the effect's deps: making it a
  // dependency would re-run the effect at the moment control is taken, and that
  // run's `fit()` is exactly the re-fit this flag exists to prevent.
  const controlled = useRef(userControlled);
  controlled.current = userControlled;

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || contentWidth === 0 || contentHeight === 0) return;

    const fit = () => {
      const { width, height } = frame.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      // The frame's width is still tracked while the viewport is the person's:
      // the centring rule needs it whatever the scale came from.
      setFrameWidth(width);
      if (controlled.current) return;
      const toFit = Math.min(1, width / contentWidth, height / contentHeight);
      setScale(Math.max(toFit, MIN_SCALE));
    };
    fit();

    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [contentWidth, contentHeight]);

  // Open an oversized map on its middle: the root idea sits at the horizontal
  // centre of the layout, so centring the scroll puts the thing the map is
  // *about* on screen first. This must be a layout effect — a passive one runs
  // after paint, and the capture browser reads scrollLeft before it lands.
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame || userControlled) return;
    const overflow = frame.scrollWidth - frame.clientWidth;
    if (overflow > 0) frame.scrollLeft = overflow / 2;
  }, [scale, contentWidth, userControlled]);

  return { frameRef, scale, frameWidth };
}
