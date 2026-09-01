'use client';

import { useRef, useState } from 'react';
import { suppressTextSelection } from '../lib/textSelection';

/** Pointer travel under this is a click; beyond it, a drag. The pill has to
 *  carry both — clicking one to ask about it is the next thing that element
 *  learns to do — so the two are separated here once rather than twice. */
export const DRAG_THRESHOLD = 4;

/**
 * The click-or-drag gesture on a map node.
 *
 * It reports movement as a delta in MAP pixels rather than screen pixels: the
 * plane is scaled, so without dividing by the scale a node would drift further
 * from the pointer the further you zoomed in.
 *
 * The deltas go to the caller on every move rather than being held here,
 * because the node's position feeds the layout — and only the layout can move
 * the node's dotted connector along with it. A version of this that kept the
 * offset locally moved the pill and left its edge behind.
 */
export function useNodeDrag({
  id,
  scale,
  onDragMove,
  onNudge,
  onTap,
}: {
  id: string;
  scale: number;
  onDragMove?: (id: string, dx: number, dy: number) => void;
  onNudge?: (id: string, dx: number, dy: number) => void;
  /** The gesture ended without passing the threshold — a click, not a drag.
   *  Kept on this side of the split because the threshold is the only thing
   *  that can tell the two apart, and duplicating it would let a nudge and a
   *  tap disagree about which one just happened. */
  onTap?: (id: string) => void;
}) {
  const [dragging, setDragging] = useState(false);
  const past = useRef(false);

  const onPointerDown = (event: React.PointerEvent<HTMLElement>) => {
    // A pill that can only be asked about still has to claim the gesture, so
    // the test is "does this node do anything at all", not "can it be nudged".
    if ((!onNudge && !onTap) || event.button !== 0) return;
    // The frame beneath pans on pointerdown. A pointer that lands on a node is
    // moving the node, so it must not also move the map.
    event.stopPropagation();

    const startX = event.clientX;
    const startY = event.clientY;
    past.current = false;
    let restoreSelection: (() => void) | null = null;

    const onMove = (move: PointerEvent) => {
      const travel = Math.hypot(move.clientX - startX, move.clientY - startY);
      if (!past.current && travel < DRAG_THRESHOLD) return;
      // Only once the gesture is a real drag: below the threshold it is still a
      // click, and a click must leave the label selectable so it can be copied.
      restoreSelection ??= suppressTextSelection();
      past.current = true;
      setDragging(true);
      onDragMove?.(id, (move.clientX - startX) / scale, (move.clientY - startY) / scale);
    };

    const onUp = (up: PointerEvent) => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      restoreSelection?.();
      const wasDragging = past.current;
      past.current = false;
      setDragging(false);
      if (wasDragging) {
        onNudge?.(id, (up.clientX - startX) / scale, (up.clientY - startY) / scale);
      } else {
        // Exactly one of the two fires. A gesture that nudged a node was not
        // also a request to ask about it, and a person who moved a pill by
        // accident should not have a composer open on top of it.
        onTap?.(id);
      }
    };

    // On the window rather than the element: a drag that leaves the pill should
    // keep dragging, and must still end when the button comes up elsewhere.
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return { dragging, onPointerDown };
}
