---
title: "A Pinch on the Map Zooms the Map, Not the Page"
mode: ui
createdAt: "2026-09-03T10:41:51Z"
source: manual
---

## Summary

Pinching on the board zooms the whole browser page before (and as well as) the
board. The board's zoom handler is a React `onWheel` prop, and React attaches
`wheel` at the root container as a **passive** listener — so nothing in that
handler can ever call `preventDefault()`, and the browser is free to apply its
own page zoom to the same gesture. The `touch-none` class on the board shell
already covers touchscreen pinch; what is unhandled is the trackpad pinch, which
arrives as `ctrl`+`wheel` on desktop and as Safari's non-standard `gesture*`
events. Fix: register the wheel and gesture listeners natively on the board
element with `{ passive: false }` and call `preventDefault()`, so the gesture
belongs to the board and the page never scales.

## Key Decisions

- **Native listeners, not the React prop.** React 19 registers `wheel` (like
  `touchstart`/`touchmove`) as passive on the root container, so
  `e.preventDefault()` inside `onWheel` is a no-op and logs a console warning.
  There is no React-level flag to opt out; the only working seam is
  `addEventListener('wheel', h, { passive: false })` on the element itself. This
  is why the earlier plan's zoom "worked" while the page kept zooming — the
  board's zoom ran, but the browser's did too.
- **Prevent the plain-wheel pan too, not just the pinch.** The board is a
  canvas: a two-finger scroll over it should move the board and nothing else.
  `overscroll-contain` stops the scroll chaining to an ancestor but does not stop
  the page from scrolling in the first place if it ever becomes scrollable.
  Preventing every wheel event the board consumes is the honest rule.
- **Handle Safari's `gesturestart` / `gesturechange` / `gestureend`.** Safari
  emits these for trackpad pinch alongside `ctrl`+`wheel`, and an unprevented
  `gesturestart` still triggers Safari's page zoom. They are not in `lib.dom`,
  so they are attached by string name with a locally-declared event shape rather
  than a global type augmentation.
- **The hook owns the listeners, keyed off a surface ref passed in.**
  `useBoardCamera` already owns pan, zoom and the selection lock for this
  surface; splitting "the gesture" across the hook and the component is what let
  the preventDefault gap open. `GalaxyBoard` already holds a `shell` ref for
  measuring — pass that same ref to the hook rather than introducing a second.
- **Zoom stays about the viewport centre.** Zoom-about-pointer is a real
  improvement and is now cheap (the native event carries `clientX`/`clientY`),
  but it is a behaviour change, not this bug. Out of scope.

## Implementation

### 1. Attach the wheel and gesture listeners natively

**File**: `app/hooks/useBoardCamera.ts`

Give the hook a second parameter — the board surface, as a
`RefObject<HTMLElement | null>` — and add a `useEffect` that attaches the
listeners to `surface.current` with `{ passive: false }`, returning a cleanup
that removes them.

- `wheel`: call `e.preventDefault()` unconditionally (the board consumes every
  wheel event over it), then apply the existing split — `ctrlKey || metaKey`
  scales by `clampScale(c.scale * (1 - deltaY * 0.01))`, otherwise pan by
  `deltaX`/`deltaY` divided by scale. The body of the current `onWheel` moves
  here verbatim; only the event type changes from `React.WheelEvent` to the
  native `WheelEvent`.
- `gesturestart`, `gesturechange`, `gestureend`: `preventDefault()` on each.
  `gesturechange` additionally scales — Safari's `scale` on the event is
  cumulative for the gesture, so track the previous value in a ref and apply the
  ratio, which keeps the clamp and the units consistent with the wheel path.
- Remove `onWheel` from the returned `handlers` object, since the React prop is
  exactly the thing that cannot work. The pointer handlers stay as they are.

Keep the effect's dependency list empty apart from the ref: all camera writes go
through the `setCamera` updater form, so the listeners never close over a stale
camera and never need reattaching.

### 2. Pass the board shell to the camera

**File**: `app/components/GalaxyBoard.tsx`

Move the `const shell = useRef<HTMLDivElement>(null)` declaration above the
`useBoardCamera(...)` call and pass it as the second argument. The
`{...handlers}` spread on the shell `div` stays — it now carries only the
pointer handlers. Nothing else about the element changes; `touch-none`,
`overscroll-contain` and `isolate` are all still doing their jobs for the
touchscreen and scroll-chaining cases.

Add a short comment at the spread noting that wheel/pinch is deliberately NOT in
this spread, and why — otherwise the next person "tidies up" by re-adding
`onWheel` and quietly restores the bug.

### 3. Pin the fix with the reproduction test

**File**: `app/hooks/useBoardCamera.test.ts`

Add the test in `## Reproduction Test` to the existing `useBoardCamera zooming`
describe block, plus a companion asserting the pinch actually changes
`camera.scale` (so a fix that prevents the default but stops zooming would still
be caught) and one asserting a plain wheel pans rather than zooms.

## Reused existing code

- `clampScale` from `app/hooks/useBoardCamera.ts` (glossary entry: `clampScale`)
  — the zoom clamp is unchanged; both the wheel and gesture paths go through it.
- `useBoardCamera` from `app/hooks/useBoardCamera.ts` (glossary entry:
  `useBoardCamera`) — the hook being modified; its pan, threshold and selection
  behaviour are untouched.
- `GalaxyBoard` from `app/components/GalaxyBoard.tsx` (glossary entry:
  `GalaxyBoard`) — the only caller; already holds the `shell` ref this needs.
- `suppressTextSelection` from `app/lib/textSelection.ts` (glossary entry:
  `suppressTextSelection`) — untouched, listed because it shares the gesture
  lifecycle and must keep working across this change.

**Existing-implementation survey**: there is no other wheel, `gesture*`, or
`touch-action` handling anywhere in `app/` — a grep for
`touchAction|touch-action|gesturestart|ctrlKey|onWheel|user-scalable|maximum-scale`
returns only `app/hooks/useBoardCamera.ts` and its test, plus the `touch-none` class on the
board shell. No viewport `<meta>` with `user-scalable=no` exists in
`app/layout.tsx`, and none should be added: disabling page zoom document-wide
would break legitimate accessibility zoom everywhere else in the app. The fix
belongs on the board element alone.

## Reproduction Test

Pins that a trackpad pinch over the board is consumed by the board rather than
handed to the browser as a page zoom.

**Target**: `app/hooks/useBoardCamera.test.ts` — run with
`codeyam-editor editor refresh-tests --test useBoardCamera`.

```ts
// The reported bug: a trackpad pinch over the board zooms the whole PAGE. The
// board's wheel handler was a React `onWheel` prop, and React attaches `wheel`
// passively at the root — so preventDefault could never fire and the browser
// applied its own zoom on top. The assertion is `defaultPrevented`, not the
// camera: the camera already moved before the fix, and the page zoomed anyway.
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
```

Status: PROPOSED — confirm red at execution. Expected failure: `useBoardCamera`
takes one argument today and registers no native listener, so nothing calls
`preventDefault` and `pinch.defaultPrevented` is `false`. Under TypeScript the
second argument is also a compile error before the hook signature changes, which
is the same red one step earlier.

## Scenarios to Demonstrate

- A full board at the default framing, pinched in on a trackpad — the board
  scales and the page chrome stays exactly where it was.
- The same board pinched back out past the zoom floor — the clamp holds and the
  page still does not scale.
- A two-finger scroll (plain wheel) over the board — the board pans, the page
  behind it does not move.
- A pinch that starts over a card's composer (`[data-no-pan]`) — the board still
  zooms, because zoom is not a drag, and the textarea keeps its own selection.
- An empty board — nothing to zoom, and the gesture is still swallowed rather
  than reaching the browser.