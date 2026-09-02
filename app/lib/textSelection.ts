'use client';

/**
 * Hold text selection off for the duration of a drag.
 *
 * A pointer dragged across a pill or the canvas is a gesture about the map, but
 * the browser reads it as "select this text" and paints a highlight trailing
 * the cursor. Selecting a node's text is worth keeping — it is how you copy a
 * label out — so this suppresses selection only while a drag is actually
 * running, rather than making the map permanently unselectable.
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
