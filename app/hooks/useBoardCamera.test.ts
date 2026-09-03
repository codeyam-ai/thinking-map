// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBoardCamera, type Camera } from './useBoardCamera';

// The camera over the board.
//
// The most expensive bug of the board's first build lived here, and it was not
// a pan bug — it was that NO CARD ON THE BOARD COULD BE CLICKED. Capturing the
// pointer on pointerdown retargets the eventual click to the capturing element,
// so every click died on the canvas before it reached the card underneath. The
// fix was to wait for a few pixels of movement before capturing, which means
// the thing worth testing is the threshold's BEHAVIOUR: a still pointer must
// never capture.

/** The parts of a PointerEvent these handlers actually read, plus spies for the
 *  capture calls whose absence is the point of the threshold. */
function pointer(
  x: number,
  y: number,
  target: { closest: (s: string) => unknown } | null = null,
) {
  const currentTarget = {
    setPointerCapture: vi.fn(),
    releasePointerCapture: vi.fn(),
    hasPointerCapture: vi.fn(() => false),
  };
  return {
    button: 0,
    pointerId: 1,
    clientX: x,
    clientY: y,
    target: target ?? { closest: () => null },
    currentTarget,
    ctrlKey: false,
    metaKey: false,
    deltaX: 0,
    deltaY: 0,
  } as unknown as React.PointerEvent & {
    currentTarget: typeof currentTarget;
  };
}

const START: Camera = { scale: 1, x: 0, y: 0 };

// The selection lock lives on `document.body`, which every test in this file
// shares. Most of the pan cases above simulate a HALF gesture — a pointerdown
// with no release, which is a thing no browser produces — and each one leaves
// the lock on behind it. Without this reset a later test reads whatever the
// previous one left, and the restore, which puts back the value it found,
// faithfully puts back 'none'.
beforeEach(() => {
  document.body.style.userSelect = '';
});

describe('useBoardCamera panning', () => {
  // The bug, stated as the behaviour that must hold. A press and release with
  // no movement in between must leave the camera untouched AND must never call
  // setPointerCapture — the capture is what swallowed the click, so its absence
  // is the actual assertion, not the unchanged camera.
  it('never captures the pointer on a click that does not move', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    const down = pointer(100, 100);
    act(() => result.current.handlers.onPointerDown(down));
    const up = pointer(100, 100);
    act(() => result.current.handlers.onPointerUp(up));

    expect(down.currentTarget.setPointerCapture).not.toHaveBeenCalled();
    expect(result.current.camera).toEqual(START);
  });

  // A hand tremor during a click is a click, not a pan. Below the threshold the
  // board must not creep — a board that nudges every time you answer a card
  // feels broken in a way that is hard to name.
  it('does not pan for movement below the threshold', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    const move = pointer(101, 101);
    act(() => result.current.handlers.onPointerMove(move));

    expect(move.currentTarget.setPointerCapture).not.toHaveBeenCalled();
    expect(result.current.camera).toEqual(START);
  });

  // Past the threshold it is a drag, and only THEN is the pointer captured —
  // so the gesture survives the cursor leaving the element, without having cost
  // anyone a click.
  it('pans and captures once the pointer has travelled far enough', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    const move = pointer(140, 120);
    act(() => result.current.handlers.onPointerMove(move));

    expect(move.currentTarget.setPointerCapture).toHaveBeenCalled();
    expect(result.current.camera.x).toBe(-40);
    expect(result.current.camera.y).toBe(-20);
  });

  // The delta is divided by the current scale so the board tracks the cursor by
  // the same SCREEN distance however far out you are zoomed. Without it a drag
  // zoomed out crawls and a drag zoomed in throws the board off-screen.
  it('tracks the cursor identically at every zoom level', () => {
    const { result } = renderHook(() =>
      useBoardCamera({ scale: 0.5, x: 0, y: 0 }),
    );

    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    act(() => result.current.handlers.onPointerMove(pointer(150, 100)));

    // 50 screen pixels at half scale is 100 board units.
    expect(result.current.camera.x).toBe(-100);
  });

  // A drag beginning inside a card's own controls belongs to the control. A
  // textarea you cannot select text in because the board panned away underneath
  // is the same class of bug as the unclickable card.
  it('refuses to start a drag from inside a control', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    const inControl = { closest: (s: string) => (s === '[data-no-pan]' ? {} : null) };
    act(() => result.current.handlers.onPointerDown(pointer(100, 100, inControl)));
    act(() => result.current.handlers.onPointerMove(pointer(200, 200)));

    expect(result.current.camera).toEqual(START);
  });

  // Only the primary button drags; a right-click is a context menu.
  it('ignores a non-primary button', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    const down = { ...pointer(100, 100), button: 2 } as React.PointerEvent;
    act(() => result.current.handlers.onPointerDown(down));
    act(() => result.current.handlers.onPointerMove(pointer(200, 200)));

    expect(result.current.camera).toEqual(START);
  });
});

describe('useBoardCamera and text selection', () => {
  // The reported complaint: a drag across a card paints a selection highlight
  // that trails the cursor, because the browser reads the pan as a select.
  //
  // The lock goes on at pointerdown rather than at the pan threshold. Three
  // pixels in, the browser already has a selection drag in flight and clearing
  // its ranges leaves the anchor for it to keep extending from — so a test that
  // only checked the state after a threshold-crossing move would pass over the
  // very placement that does not work.
  it('turns text selection off while a board gesture is running', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    expect(document.body.style.userSelect).toBe('none');

    act(() => result.current.handlers.onPointerUp(pointer(140, 120)));
    expect(document.body.style.userSelect).toBe('');
  });

  // Selection inside a card's own controls is not the board's to suppress —
  // the composer is a textarea, and text you cannot select in one is a
  // regression traded for the fix rather than a fix.
  it('leaves selection alone for a press inside a no-pan subtree', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    const inControl = { closest: (s: string) => (s === '[data-no-pan]' ? {} : null) };
    act(() => result.current.handlers.onPointerDown(pointer(100, 100, inControl)));

    expect(document.body.style.userSelect).toBe('');
  });

  // A cancelled gesture — the pointer leaving the window, a touch interrupted
  // by a system gesture — must not leave the page permanently unselectable.
  // `onPointerCancel` is the same handler, so this pins the wiring rather than
  // the restore itself.
  it('restores selection when the gesture is cancelled rather than released', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    act(() => result.current.handlers.onPointerCancel(pointer(100, 100)));

    expect(document.body.style.userSelect).toBe('');
  });
});

describe('useBoardCamera zooming', () => {
  // The reported bug: a trackpad pinch over the board zoomed the whole PAGE.
  // The board's wheel handler was a React `onWheel` prop, and React attaches
  // `wheel` passively at the root — so preventDefault could never fire and the
  // browser applied its own zoom on top. The assertion is `defaultPrevented`,
  // not the camera: the camera already moved before the fix, and the page
  // zoomed anyway.
  it('consumes a trackpad pinch instead of letting the page zoom', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const ref = { current: surface };

    renderHook(() => useBoardCamera(START, ref));

    const pinch = new WheelEvent('wheel', {
      deltaY: -10,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    surface.dispatchEvent(pinch);

    expect(pinch.defaultPrevented).toBe(true);

    surface.remove();
  });

  // Swallowing the gesture is only half the fix. A handler that prevents the
  // default and then does nothing would pass the test above while leaving the
  // board frozen under a pinch, which is a worse bug than the one being fixed.
  it('scales the board when a pinch is consumed', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const ref = { current: surface };

    const { result } = renderHook(() => useBoardCamera(START, ref));

    act(() => {
      surface.dispatchEvent(
        new WheelEvent('wheel', {
          deltaY: -10,
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    expect(result.current.camera.scale).toBeGreaterThan(START.scale);

    surface.remove();
  });

  // A plain wheel is a two-finger scroll, which the board reads as a pan — and
  // it too must be consumed, because the board is a canvas and every wheel
  // event over it belongs to the board rather than to the page behind it.
  it('pans rather than zooms on a plain wheel, and consumes that too', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const ref = { current: surface };

    const { result } = renderHook(() => useBoardCamera(START, ref));

    const scroll = new WheelEvent('wheel', {
      deltaX: 30,
      deltaY: 20,
      bubbles: true,
      cancelable: true,
    });
    act(() => {
      surface.dispatchEvent(scroll);
    });

    expect(scroll.defaultPrevented).toBe(true);
    expect(result.current.camera.scale).toBe(START.scale);
    expect(result.current.camera.x).toBe(START.x + 30);
    expect(result.current.camera.y).toBe(START.y + 20);

    surface.remove();
  });

  // Safari does not only send ctrl+wheel for a trackpad pinch; it also emits
  // its own gesture events, and an unprevented gesturestart still hands Safari
  // its page zoom. Preventing the wheel alone leaves the bug half-fixed there.
  it('consumes Safari gesture events so the page does not scale', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const ref = { current: surface };

    const { result } = renderHook(() => useBoardCamera(START, ref));

    const start = new Event('gesturestart', { bubbles: true, cancelable: true });
    Object.defineProperty(start, 'scale', { value: 1 });
    const change = new Event('gesturechange', { bubbles: true, cancelable: true });
    Object.defineProperty(change, 'scale', { value: 1.5 });

    act(() => {
      surface.dispatchEvent(start);
      surface.dispatchEvent(change);
    });

    expect(start.defaultPrevented).toBe(true);
    expect(change.defaultPrevented).toBe(true);
    expect(result.current.camera.scale).toBeGreaterThan(START.scale);

    surface.remove();
  });

  // The listeners belong to the surface, so unmounting must take them with it.
  // A board that keeps swallowing wheel events after it is gone would freeze
  // scrolling on whatever replaced it.
  it('stops consuming wheel events once the board unmounts', () => {
    const surface = document.createElement('div');
    document.body.appendChild(surface);
    const ref = { current: surface };

    const { unmount } = renderHook(() => useBoardCamera(START, ref));
    unmount();

    const afterUnmount = new WheelEvent('wheel', {
      deltaY: -10,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    surface.dispatchEvent(afterUnmount);

    expect(afterUnmount.defaultPrevented).toBe(false);

    surface.remove();
  });

  // The clamp at both ends. Past the floor the board is a few pixels of noise
  // with no way back; past the ceiling one card fills the screen and the shape
  // of the thinking — the entire point of the board — is gone.
  it('holds the zoom inside its limits at both ends', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => {
      for (let i = 0; i < 40; i++) result.current.zoomBy(0.5);
    });
    expect(result.current.camera.scale).toBeGreaterThan(0);
    const floor = result.current.camera.scale;

    act(() => {
      for (let i = 0; i < 80; i++) result.current.zoomBy(2);
    });
    const ceiling = result.current.camera.scale;

    expect(ceiling).toBeGreaterThan(floor);
    expect(Number.isFinite(ceiling)).toBe(true);
  });

  // Zoom must never invert. A negative or zero scale flips or collapses the
  // whole transformed layer, and every coordinate that divides by it explodes.
  it('never lets the scale reach zero or go negative', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => {
      for (let i = 0; i < 60; i++) result.current.zoomBy(0.1);
    });

    expect(result.current.camera.scale).toBeGreaterThan(0);
  });

  // Flying to a card moves the camera and may change the zoom in the same
  // commit — the two are one piece of state precisely so they cannot tear.
  it('focuses on a point, optionally changing zoom with it', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => result.current.focusOn(500, -300));
    expect(result.current.camera).toEqual({ scale: 1, x: 500, y: -300 });

    act(() => result.current.focusOn(10, 20, 0.4));
    expect(result.current.camera).toEqual({ scale: 0.4, x: 10, y: 20 });
  });

  // A focus that asks for an out-of-range zoom is clamped like any other, so
  // "frame everything" on a huge board cannot push the camera past the floor.
  it('clamps a zoom asked for through focusOn', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => result.current.focusOn(0, 0, 0.0001));

    expect(result.current.camera.scale).toBeGreaterThan(0.0001);
  });
});
