// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import { createRef } from 'react';
import { useDismissOnOutside } from './useDismissOnOutside';

// Three surfaces open something over content the person is trying to read, and
// all three used to carry their own copy of this effect. What these pin is the
// part that must not drift between them: what counts as outside, what counts as
// a dismissal, and that nothing is left listening once the overlay is closed.

/** A detached element standing in for the overlay's own box. */
function box(): { ref: React.RefObject<HTMLElement | null>; inside: HTMLElement } {
  const el = document.createElement('div');
  const inside = document.createElement('button');
  el.appendChild(inside);
  document.body.appendChild(el);
  const ref = createRef<HTMLElement>();
  ref.current = el;
  return { ref, inside };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('useDismissOnOutside', () => {
  // The ordinary dismissal: a pointer lands somewhere that is not the overlay.
  it('dismisses on a pointer down outside the element', () => {
    const { ref } = box();
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnOutside(ref, true, onDismiss));

    fireEvent.mouseDown(document.body);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // The half that makes it usable rather than a trap: clicking the overlay's own
  // contents must not close the thing being clicked.
  it('leaves the overlay open for a pointer down inside it', () => {
    const { ref, inside } = box();
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnOutside(ref, true, onDismiss));

    fireEvent.mouseDown(inside);

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // The keyboard route out, which is the only one a person navigating without a
  // pointer has.
  it('dismisses on Escape', () => {
    const { ref } = box();
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnOutside(ref, true, onDismiss));

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // Escape is the exit, not every key. A person typing into a field inside the
  // overlay must not close it on the first letter.
  it('ignores keys other than Escape', () => {
    const { ref } = box();
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnOutside(ref, true, onDismiss));

    fireEvent.keyDown(document, { key: 'a' });
    fireEvent.keyDown(document, { key: 'Enter' });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // Nothing is open, so nothing is listening — every one of these surfaces
  // spends most of its life closed, and a closed menu firing a dismissal would
  // be a callback nobody asked for.
  it('does not listen while closed', () => {
    const { ref } = box();
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnOutside(ref, false, onDismiss));

    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // A ref that has not attached yet cannot contain anything, so the pointer is
  // outside by definition rather than a crash on `.contains` of null.
  it('treats a null ref as outside rather than throwing', () => {
    const ref = createRef<HTMLElement>();
    const onDismiss = vi.fn();
    renderHook(() => useDismissOnOutside(ref, true, onDismiss));

    expect(() => fireEvent.mouseDown(document.body)).not.toThrow();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  // The teardown. Without it every open/close cycle would leave another
  // listener on the document, and the callback would fire once per cycle the
  // surface had ever been through.
  it('stops listening once it closes', () => {
    const { ref } = box();
    const onDismiss = vi.fn();
    const { rerender } = renderHook(
      ({ open }) => useDismissOnOutside(ref, open, onDismiss),
      { initialProps: { open: true } },
    );

    rerender({ open: false });
    fireEvent.mouseDown(document.body);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onDismiss).not.toHaveBeenCalled();
  });

  // Unmounting is the other way an overlay goes away — navigating off the map
  // while the panel is open — and it must clean up the same way closing does.
  it('stops listening on unmount', () => {
    const { ref } = box();
    const onDismiss = vi.fn();
    const { unmount } = renderHook(() =>
      useDismissOnOutside(ref, true, onDismiss),
    );

    unmount();
    fireEvent.mouseDown(document.body);

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
