'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Close an open overlay on the two gestures that both mean "not this".
 *
 * A popover that cannot be dismissed the two ways every popover is dismissed is
 * a trap, and on this app every one of them opens over something the person is
 * trying to read — a board they are panning, a map they came back for. The
 * gestures are not negotiable, which is exactly why they should not be
 * re-typed: three surfaces had grown their own copy of this effect
 * (`AgentStatus`, `BoardMenu`, `BriefMenu`), each with its own listener names
 * and its own chance of forgetting a teardown.
 *
 * `mousedown` rather than `click`, deliberately: a click that starts inside the
 * panel and ends outside it — a drag to select the prompt text — is not a
 * dismissal, and `click` would read it as one.
 *
 * Does nothing while closed, so the listeners exist only for as long as there
 * is something to dismiss.
 */
export function useDismissOnOutside(
  /** The element the overlay lives in. A pointer inside it is not "outside". */
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, open, onDismiss]);
}
