'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useFitToFrame } from './useFitToFrame';
import { suppressTextSelection } from '../lib/textSelection';

/** Far enough out to see a sprawling map whole; far enough in to read detail. */
export const MIN_ZOOM = 0.25;
export const MAX_ZOOM = 2.5;

/** One press of a zoom button. A ratio rather than a step, so zooming out and
 *  back in returns you exactly where you were. */
const ZOOM_STEP = 1.3;

/** Turns a wheel delta into a zoom factor. Exponential, so a fast scroll and
 *  several slow ones cover the same ground. Tuned up from a first pass that
 *  read as sluggish: crossing the map's useful range should take a flick, not
 *  a grind. */
const WHEEL_SENSITIVITY = 0.005;

/** Pointer travel below this is a click that wobbled, not a pan. */
const PAN_THRESHOLD = 3;

function clamp(scale: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, scale));
}

/**
 * The person's control of the map plane: how far in it is zoomed, and where it
 * is panned to.
 *
 * Auto-fit is the *initial* answer here, not a standing invariant — so this
 * hook wraps useFitToFrame rather than sitting beside it, and reports the fit
 * scale until someone touches the viewport. From that moment the scale is
 * theirs and stays where they put it, including across the window resizes that
 * would otherwise re-fit underneath them. `fitToMap` hands control back rather
 * than computing a scale of its own, which is what makes the reset exact
 * instead of approximate.
 *
 * Pan is the frame's scroll position rather than a second transform. The plane
 * already lives in a scroll container, and both the centring rule and the
 * scrollable extent are expressed in those terms — a parallel pan offset would
 * have to be reconciled with them on every change, and would quietly disagree.
 */
export function useMapViewport(contentWidth: number, contentHeight: number) {
  const [userScale, setUserScale] = useState<number | null>(null);
  const [panning, setPanning] = useState(false);
  const planeRef = useRef<HTMLDivElement>(null);

  const isCustom = userScale !== null;
  const { frameRef, scale: fitScale, frameWidth } = useFitToFrame(
    contentWidth,
    contentHeight,
    isCustom,
  );
  const scale = userScale ?? fitScale;

  // Where the pointer was when a zoom started, so the map point under it can be
  // put back under it once the new scale has been laid out.
  const anchor = useRef<{
    mapX: number;
    mapY: number;
    clientX: number;
    clientY: number;
  } | null>(null);

  const zoomAbout = useCallback(
    (next: number, clientX: number, clientY: number) => {
      const plane = planeRef.current;
      if (plane) {
        const rect = plane.getBoundingClientRect();
        anchor.current = {
          mapX: (clientX - rect.left) / scale,
          mapY: (clientY - rect.top) / scale,
          clientX,
          clientY,
        };
      }
      setUserScale(clamp(next));
    },
    [scale],
  );

  // Zooming about the pointer is a two-part move: the scale changes, and then
  // the scroll absorbs the difference so whatever was under the cursor has not
  // moved. The second part can only happen once the new scale is laid out, and
  // has to land before paint or the map visibly jumps.
  useLayoutEffect(() => {
    const held = anchor.current;
    anchor.current = null;
    const frame = frameRef.current;
    const plane = planeRef.current;
    if (!held || !frame || !plane) return;

    const rect = plane.getBoundingClientRect();
    frame.scrollLeft += rect.left - (held.clientX - held.mapX * scale);
    frame.scrollTop += rect.top - (held.clientY - held.mapY * scale);
  }, [scale, frameRef]);

  /** Zoom a step about the middle of the frame — a button press has no pointer
   *  position of its own, and the centre is what the person is looking at. */
  const zoomBy = useCallback(
    (factor: number) => {
      const frame = frameRef.current;
      if (!frame) {
        setUserScale(clamp(scale * factor));
        return;
      }
      const rect = frame.getBoundingClientRect();
      zoomAbout(
        scale * factor,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
    },
    [frameRef, scale, zoomAbout],
  );

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy]);
  const zoomOut = useCallback(() => zoomBy(1 / ZOOM_STEP), [zoomBy]);

  /** Hand the viewport back to auto-fit. */
  const fitToMap = useCallback(() => setUserScale(null), []);

  // Wheel and trackpad pinch both arrive here. The listener is attached by hand
  // because React's is passive, and a passive listener cannot preventDefault —
  // without which a pinch zooms the whole page instead of the map.
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      zoomAbout(
        scale * Math.exp(-event.deltaY * WHEEL_SENSITIVITY),
        event.clientX,
        event.clientY,
      );
    };

    frame.addEventListener('wheel', onWheel, { passive: false });
    return () => frame.removeEventListener('wheel', onWheel);
  }, [frameRef, scale, zoomAbout]);

  /**
   * Drag the canvas to pan. The handler goes on the frame; a pill stops its own
   * pointerdown from reaching it, so dragging a node moves the node and
   * dragging the space around it moves the map.
   */
  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const frame = frameRef.current;
      if (!frame || event.button !== 0) return;

      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = frame.scrollLeft;
      const startTop = frame.scrollTop;
      let moved = false;
      let restoreSelection: (() => void) | null = null;

      const onMove = (move: PointerEvent) => {
        const dx = move.clientX - startX;
        const dy = move.clientY - startY;
        if (!moved && Math.hypot(dx, dy) < PAN_THRESHOLD) return;
        // Same reasoning as the node drag: a pan is a gesture about the map, so
        // it must not trail a text highlight behind the cursor.
        restoreSelection ??= suppressTextSelection();
        moved = true;
        setPanning(true);
        frame.scrollLeft = startLeft - dx;
        frame.scrollTop = startTop - dy;
      };
      const onUp = () => {
        setPanning(false);
        restoreSelection?.();
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      // On the window rather than the element: a pan that leaves the frame
      // should keep panning, and must still end when the button comes up
      // somewhere else entirely.
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    },
    [frameRef],
  );

  return {
    frameRef,
    planeRef,
    scale,
    frameWidth,
    isCustom,
    panning,
    zoomIn,
    zoomOut,
    fitToMap,
    onPointerDown,
  };
}
