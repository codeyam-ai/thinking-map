---
title: "The Phase Track Fades Its Own Active Step"
mode: ui
createdAt: "2026-09-01T20:47:28Z"
source: manual
---

## Summary

The phase track's trailing fade is applied unconditionally below `lg`, so it
fades whatever sits at the right edge — including the active step, which is the
one element on the track that must read clearly. On the summary phase the lime
`06 NEXT STEPS` pill is washed out to near-illegibility, and on a track narrow
enough to need no scrolling at all the fade still appears, promising content to
the right that does not exist. Make the fade conditional on there actually being
more track in that direction.

## Key Decisions

- **The fade is the bug, not the scrolling track.** `PhaseNav` deliberately
  scrolls horizontally below `lg` rather than collapsing to a "3 of 6" summary,
  and it scrolls the active pill into view on mount and on change. Both of those
  are right and stay. The defect is one always-on `mask-image`: it says "there is
  more to the right" as a static decoration rather than as a fact about the
  current scroll position.
- **Fade only when there is something to fade toward.** Derive the mask from
  scroll state — no trailing fade once `scrollLeft` has reached the end, no
  leading fade at the start. The mask exists to signal reachable-but-unseen
  content, so it should be absent exactly when there is none.
- **Add the leading fade too.** Today only the right edge fades. Once the track
  is scrolled away from the start, content is cut off on the LEFT with nothing
  saying so, which is the same omission mirrored. The symmetric treatment is what
  makes the affordance mean "more this way" rather than "right edge".
- **This is why it hid for so long.** `lg` is 1024px, and the project captured
  scenarios at Desktop (1440) until the default moved to Tablet (768). The mask
  was off in every captured frame and on for every real half-screen user — the
  gap between the two is what the size switch closed.
- **No unit-level reproduction is writable, and the existing test file already
  says why.** `PhaseNav.render.test.tsx` states that jsdom has no layout engine,
  so `getBoundingClientRect`, `scrollWidth` and `clientWidth` all read zero and a
  mask/overflow assertion would pass whether or not the bug were present. Its
  three existing tests cover the one genuinely testable behavior — that
  `scrollIntoView` is called on mount and on phase change — and those must keep
  passing. This one is demonstrated by scenario capture.

## Implementation

### 1. Make the fade reflect scroll position

**File**: `app/components/PhaseNav.tsx`

Hold the track element in a ref and track two booleans — whether it is scrolled
away from the start, and whether it has more to reveal at the end — updated on
`scroll`, on mount, and on resize. Derive the `mask-image` from them:

- neither end reachable (the track fits) → no mask at all
- more to the right only → fade the right edge (today's behaviour, now earned)
- more to the left only → fade the left edge
- both → fade both edges

Keep `lg:[mask-image:none]`, since above `lg` the track never overflows. Keep the
existing `scrollIntoView` effect and the `no-scrollbar` / `overscroll-x-contain`
treatment exactly as they are.

The resize listener matters as much as the scroll listener: the window can cross
the fits/does-not-fit boundary without any scrolling, and a stale "more to the
right" would leave the fade stuck on over a track that now fits.

### 2. Show the corrected states

**File**: `app/isolated-components/PhaseNav/page.tsx`

The three existing scenarios (`Default`, `Research`, `NextSteps`) already sit at
Tablet and will re-capture with the fix. Add a narrow scenario that is genuinely
scrolled mid-track, so the both-edges-fading state is demonstrated rather than
inferred — the current three cannot show it, because at 768px the track fits and
after the fix none of them will fade at all.

## Reused existing code

- `PhaseNav` in `app/components/PhaseNav.tsx` (glossary entry: `PhaseNav`) — the
  component being fixed; its scrolling track, `scrollIntoView` effect and
  `no-scrollbar` treatment all stay.
- `PHASES` and `PHASE_LABELS` from `app/lib/mapKinds.ts` (glossary entries:
  `PHASES`, `PHASE_LABELS`) — unchanged; the fix touches only the mask.
- `app/components/PhaseNav.render.test.tsx` (registered against the `PhaseNav`
  glossary entry) — its three `scrollIntoView` tests must keep passing, and its
  header comment already documents why layout assertions are not testable here.
- **Existing-implementation survey.** Grepped `app/` for any other scroll-state
  or fade-mask handling: there is none. `MapRow` and the map column wrap or
  scroll vertically without a mask, and no shared "scrolled-away-from-edge" hook
  exists. The scroll-state derivation in change 1 is genuinely new, and small
  enough to stay local to `PhaseNav` rather than becoming a shared hook on first
  use.

## Reproduction Test

The active phase pill is faded by the track's trailing mask when it sits at the
right edge, including when the track fits entirely and nothing is hidden.

No unit-level reproduction is writable. The behaviour is pure layout — a
`mask-image` applied over an element whose overflow state depends on measured
widths — and jsdom reports every width as zero, so an assertion about the mask
would pass with or without the bug. `PhaseNav.render.test.tsx` already records
this reasoning for the same component.

Demonstrate with scenario capture instead: `phasenav-nextsteps` at Tablet is the
reproduction. Before the fix its lime `06 NEXT STEPS` pill fades to near-white at
the right edge despite the whole six-pill track fitting inside the frame; after
the fix the pill is solid lime and no mask is applied.

## Scenarios to Demonstrate

- **The last phase active, narrow** — `06 NEXT STEPS` solid lime with no fade
  over it, on a track that fits. The reported case.
- **The first phase active, narrow** — no leading fade at the start of the track.
- **Mid-track, scrolled** — both edges fading, because content is genuinely cut
  off on both sides. The state that proves the mask still does its job.
- **Scrolled fully to the end** — trailing fade gone, leading fade present.
- **Desktop width** — no mask in any position, unchanged from today.
- **The summary screen at narrow width** — the whole header in context, since
  that is where the washed-out pill was found.