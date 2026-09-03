'use client';

/**
 * Hold text selection off for the duration of a drag.
 *
 * A pointer dragged across a pill or the canvas is a gesture about the map, but
 * the browser reads it as "select this text" and paints a highlight trailing
 * the cursor. This suppresses selection for the duration of that gesture rather
 * than making the map permanently unselectable.
 *
 * Its one caller, `useBoardCamera`, takes the lock out on POINTERDOWN — not
 * when the drag passes the pan threshold, which is what an earlier version of
 * this comment described. Three pixels in, the browser already has a selection
 * drag in flight, and clearing the ranges below leaves its anchor behind for it
 * to keep extending from. Pointerdown is the only seam where the highlight
 * never starts at all. Selecting a card's text by dragging is therefore gone;
 * the copy button on each board surface is what replaces it.
 *
 * Returns the restore function. Call it when the gesture ends; calling it twice
 * is harmless.
 */
export function suppressTextSelection(): () => void {
  if (typeof document === 'undefined') return () => {};

  // The threshold that starts a drag is a few pixels in, so the browser may
  // already have selected a character or two. Clear what it has before locking
  // further selection out.
  document.getSelection()?.removeAllRanges();

  const body = document.body;
  const previous = body.style.userSelect;
  body.style.userSelect = 'none';

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    body.style.userSelect = previous;
  };
}
