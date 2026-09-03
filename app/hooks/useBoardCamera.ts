'use client';

// The camera over the board.
//
// Pan and zoom are one piece of state — a scale and a translation — because
// they are read together on every frame and a split would let them tear: the
// board would visibly shear for a frame when a zoom and a pan land in
// different renders.
//
// Written by hand rather than with a canvas library. The whole board is a
// handful of absolutely-positioned divs under one CSS transform, which the
// compositor handles for free, and a library would bring a renderer, a node
// type registry and an edge system to replace about sixty lines.

import { useCallback, useRef, useState } from 'react';
import { suppressTextSelection } from '@/app/lib/textSelection';

export interface Camera {
  /** Board units per screen pixel. 1 is "actual size". */
  scale: number;
  /** Board-space point that sits at the centre of the viewport. */
  x: number;
  y: number;
}

const MIN_SCALE = 0.12;
const MAX_SCALE = 1.6;

const clampScale = (s: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, s));

export function useBoardCamera(initial: Camera) {
  const [camera, setCamera] = useState<Camera>(initial);
  // The drag origin lives in a ref, not state: it changes on every pointermove
  // and nothing renders from it, so putting it in state would re-render the
  // whole board on each mouse event to no visible effect.
  const drag = useRef<{
    px: number;
    py: number;
    cx: number;
    cy: number;
    /** Whether this gesture has moved far enough to count as a pan. Until it
     *  has, the pointer is deliberately NOT captured: capturing on pointerdown
     *  retargets the eventual click to the capturing element, which silently
     *  swallows every click on a card. A board you cannot click is a worse bug
     *  than a pan that starts three pixels late. */
    panning: boolean;
  } | null>(null);
  // The undo for the selection lock the gesture takes out, held for as long as
  // the gesture lasts. A ref rather than state for the same reason as `drag`:
  // nothing renders from it.
  const restoreSelection = useRef<(() => void) | null>(null);

/** How far the pointer must travel before the gesture is a pan rather than a
 *  click. Three pixels is below the noise floor of a normal click but well
 *  under anything a person would read as a drag. */
const PAN_THRESHOLD = 3;

  const zoomBy = useCallback((factor: number) => {
    setCamera((c) => ({ ...c, scale: clampScale(c.scale * factor) }));
  }, []);

  /** Move the camera so a board-space point sits in the middle of the viewport,
   *  optionally changing zoom in the same commit. This is the "fly to the card"
   *  motion; the transition is CSS on the transformed layer. */
  const focusOn = useCallback((x: number, y: number, scale?: number) => {
    setCamera((c) => ({ x, y, scale: scale === undefined ? c.scale : clampScale(scale) }));
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Only the primary button drags, and never from inside a control: a
      // textarea inside a card must keep its own selection behaviour.
      if (e.button !== 0) return;
      const el = e.target as HTMLElement;
      if (el.closest('[data-no-pan]')) return;
      // Here, and not at PAN_THRESHOLD, even though only a pan needs it. By the
      // time three pixels have passed the browser has a selection drag in
      // flight, and `user-select: none` set mid-gesture does not reliably abort
      // one: clearing the ranges leaves the anchor, and the browser keeps
      // extending from it. Pointerdown is the seam where the highlight never
      // starts. It costs double-click-to-select on card text, which is what the
      // copy buttons on each surface exist to pay for.
      restoreSelection.current = suppressTextSelection();
      drag.current = {
        px: e.clientX,
        py: e.clientY,
        cx: camera.x,
        cy: camera.y,
        panning: false,
      };
    },
    [camera.x, camera.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;

    const dx = e.clientX - d.px;
    const dy = e.clientY - d.py;
    if (!d.panning) {
      if (Math.hypot(dx, dy) < PAN_THRESHOLD) return;
      // Only now is this a pan. Capture from here so the gesture survives the
      // pointer leaving the element, without having cost us the click.
      d.panning = true;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }

    // Divide by scale so a drag moves the board under the cursor by the same
    // screen distance however far out you are zoomed.
    setCamera((c) => ({ ...c, x: d.cx - dx / c.scale, y: d.cy - dy / c.scale }));
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    drag.current = null;
    // Restoring is idempotent, so a doubled pointerup — or a cancel arriving
    // after an up — costs nothing.
    restoreSelection.current?.();
    restoreSelection.current = null;
    const el = e.currentTarget as HTMLElement;
    if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    // Trackpad pinch arrives as a wheel event with ctrlKey set; a plain wheel
    // is a two-finger scroll, which should pan rather than zoom.
    if (e.ctrlKey || e.metaKey) {
      setCamera((c) => ({ ...c, scale: clampScale(c.scale * (1 - e.deltaY * 0.01)) }));
      return;
    }
    setCamera((c) => ({ ...c, x: c.x + e.deltaX / c.scale, y: c.y + e.deltaY / c.scale }));
  }, []);

  return {
    camera,
    zoomBy,
    focusOn,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onWheel },
  };
}
