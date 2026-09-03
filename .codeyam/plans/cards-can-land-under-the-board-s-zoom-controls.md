---
title: "Cards Can Land Under The Board's Zoom Controls"
mode: ui
createdAt: "2026-09-03T18:49:44Z"
---

## Summary

`BoardZoomControls` is pinned to the board viewport at `absolute bottom-6 left-6`
with `data-no-pan`, over the board plane. A card that the camera frames into that
corner sits underneath it, and every control on that card — the **Edit this
answer** pencil at `absolute bottom-6 right-6`, and `CopyTextButton` at
`absolute right-6 top-6` — becomes unclickable, silently. The cursor does
nothing and nothing explains why.

This is the THIRD time this class of collision has been recorded on this board,
which is what makes it worth fixing generally rather than by moving one more
control:

- **The agent panel.** Registered as the scenario
  `the-board-s-bottom-right-corner-uncovered`, whose description records that the
  panel "used to sit bottom-right at a higher stacking order than the chat,
  leaving about 12px between them and covering this transcript outright once
  opened".
- **`BoardChat`.** The plan `a-card-s-pencil-cannot-be-clicked-under-the-chat`
  (2026-09-03) — the chat panel at `bottom-6 right-6 z-30`, up to 360px wide,
  swallowing the pencil of any card framed beneath it.
- **`BoardZoomControls`,** now, at the opposite bottom corner.

The first two were each resolved by moving the *other* thing. That is why this
keeps recurring: nothing in the board's framing knows that a viewport-pinned
panel is there at all.

## Status of the previous attempt — read this before starting

The `a-card-s-pencil-cannot-be-clicked-under-the-chat` cycle was built and then
**deliberately abandoned unshipped**, and the reasoning is worth having:

- Its bug was fixed incidentally by `c3e01ac` *feat: One Bar Over the Map*, which
  UNMOUNTED `BoardChat` from `BoardWorkspace` ("the panel is HIDDEN, not deleted…
  What it used to carry moved into `BoardNav`"). Nothing occupies the board's
  bottom-right corner any more, so the pencil there is already unobstructed.
- That cycle's fix moved the pencil to the card's bottom-**left** — which is now
  the occupied corner. Shipping it would have reproduced the same bug mirrored.
  **Do not move the pencil.** It is correctly placed where it is.

The abandoned work is recoverable from the reflog at commit `42ac37b`
("codeyam: transient pre-commit-sync recovery commit"), including a working
`app/lib/boardSafeArea.ts` with 9 passing tests. Treat it as a reference
implementation to adapt, not as code to restore — see below.

## Key Decisions

- **Fix the FRAMING, not the controls.** Moving a control within a card buys
  exactly one card-width of clearance. Once a card sits WHOLLY inside a panel's
  footprint — which happens whenever the board is zoomed out enough that a card
  is smaller than the panel — no position inside the card is reachable. The
  previous cycle proved this empirically: after moving the pencil, the scenario
  registered to demonstrate the fix still failed its capture, with Playwright
  reporting the panel's subtree intercepting pointer events. This is the single
  most important finding to carry forward.
- **Reserve one region, not two.** Reserving both the panel's full column and its
  full band costs most of a narrow viewport for a panel occupying one corner. The
  approach that worked: compute BOTH candidate rectangles — the column beside the
  panel and the band above it — and pick whichever fits the board being framed at
  the larger scale. Which one wins depends on the board's own aspect, so the
  content's size has to be an input; no tuned constant can stand in for it.
- **Generalize the corner.** The prior `boardSafeArea` hardcoded a BOTTOM-RIGHT
  anchor because that is where the chat sat. `BoardZoomControls` is bottom-LEFT,
  so the function needs the anchor as a parameter. Keep the fallback: when
  reserving would leave nothing to draw in, return the whole viewport — a board
  squeezed to zero is worse than a control that needs a collapsed panel to reach.
- **Measure, do not assume.** Have the panel report its own rendered footprint
  rather than hardcoding a size, and include the `bottom-6 left-6` gutter in the
  reservation — a card centred in that gutter still has its controls half-covered.
- **Do not yank a view the person owns.** Re-frame when the footprint changes, but
  only while the camera is still exactly where `frameAll` left it. Once someone
  has panned or zoomed, that view is theirs; the ALL button is the way back.
  (`frameAll` runs on mount and from that button, so respecting the reservation
  there is what makes the initial frame safe.)

## Implementation

### 1. A pure safe-area function, anchored to either bottom corner

**File**: `app/lib/boardSafeArea.ts` (new) + `app/lib/boardSafeArea.test.ts`

`frameRectAvoiding(viewport, obstacle, content, anchor)` returning the largest
`Rect` the content can be framed into. The `42ac37b` version is a working
starting point; the change needed is the `anchor` parameter (`'bottom-left'` |
`'bottom-right'`) deciding whether the column candidate is to the panel's left or
its right. Its test asserting the returned region never overlaps the panel FOR
ANY BOARD SHAPE is the one worth keeping verbatim, re-pointed at the new anchor.

### 2. `BoardZoomControls` reports its footprint

**File**: `app/components/BoardZoomControls.tsx`

Measure the rendered element (ref callback + `ResizeObserver`) and report
`{width, height}` including the 24px gutter. The control stack is fixed-height
today, so a constant would work — measuring is still preferable, because the
next thing added to that stack should not silently reintroduce this bug.

### 3. `GalaxyBoard` frames into the safe region

**File**: `app/components/GalaxyBoard.tsx`

`frameAll` fits to the safe rect instead of the full viewport, and centres the
board on that rect's centre. Note `focusOn` places a board point at the
VIEWPORT's centre, so the board point must be shifted by the gap between the two
centres, converted from screen pixels back into board units by dividing by the
fit scale.

**Caution**: `c3e01ac` substantially rewrote this file — `BoardNav`,
`BoardWhereNext`, `BoardToolkitPanel`, `onSay`/`onTyping`/`onAskMore`/
`navForward`, and a reworked `HUB_LABEL_EMPHASIS_BELOW` replacing the old
card-culling threshold. Read it fresh; do not port a diff written against the
pre-`c3e01ac` shape.

Also check `BoardNav` at `inset-x-5 top-5 z-20`: it spans the full width at the
TOP of the board and may deserve the same treatment as a top band, which would
make the reservation two-sided. Decide this against the real layout rather than
in the plan.

## Reproduction Test

No unit-level reproduction is writable, and none should be faked. This is a
real-browser stacking and geometry failure: jsdom has no layout, no z-index and
no pointer-event hit-testing, so a test asserting on the pencil renders and is
clickable passes with the bug fully present. A test asserting a Tailwind class
string would pin the implementation rather than the behaviour.

The honest unit-level target is the geometry itself — `frameRectAvoiding` must
never return a region overlapping the panel — which IS red-provable, and which
the previous cycle's test suite already demonstrates.

Demonstrate the BUG through a driven application scenario: seed a board whose
layout puts a card in the bottom-left, and drive a click on that card's pencil.
Before the fix that capture fails with the zoom-control subtree intercepting
pointer events; after it, the click lands and the card enters its editing state.
Note the previous cycle's proof was recorded as an AGENT ATTESTATION rather than
a tool measurement, because a new module cannot be revert-proved — expect the
same here and record it the same honest way.

## Scenarios to Demonstrate

- A card framed into the board's bottom-left corner with the zoom controls
  present — the exact state that is unclickable — driven through the pencil.
- The whole board after the fix, showing every card clear of the control stack.
- `boardchat-collapsed` and `boardchat-closedtopill` already exist and are
  unaffected; they cover the unmounted panel's own states and are not part of
  this work.