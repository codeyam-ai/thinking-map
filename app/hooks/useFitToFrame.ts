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
 */
export function useFitToFrame(contentWidth: number, contentHeight: number) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [frameWidth, setFrameWidth] = useState(0);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame || contentWidth === 0 || contentHeight === 0) return;

    const fit = () => {
      const { width, height } = frame.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      setFrameWidth(width);
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
    if (!frame) return;
    const overflow = frame.scrollWidth - frame.clientWidth;
    if (overflow > 0) frame.scrollLeft = overflow / 2;
  }, [scale, contentWidth]);

  return { frameRef, scale, frameWidth };
}
