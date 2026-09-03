---
title: "Cards Disappear When Zoomed Out"
mode: ui
createdAt: "2026-09-03T15:33:45Z"
source: manual
---

## Summary

Zooming the board out far enough makes every question card vanish while the
connector lines, hubs and backdrop stay drawn — the board empties out at exactly
the zoom where someone is trying to take in its shape. The cause is a hard
visibility cutoff in `GalaxyBoard`: `LABEL_ONLY_BELOW = 0.16` sets a `far` flag,
and the card list is rendered behind `!far &&`, so the whole bottom quarter of
the zoom range (the camera floor is `MIN_SCALE = 0.12`) renders no cards at all.
The cutoff's stated premise — that cards "degrade to single pixels" out there —
is simply not true at these sizes: a card is 300x360 board units, so even at the
0.12 floor it is roughly 36x43 screen pixels, a legible block of texture rather
than a pixel. Fix: delete the visibility cutoff so cards render at every
reachable zoom, keeping the threshold only for the one thing it legitimately
drives (bumping the hub label's font size when you are far out).

This also fixes a second face of the same bug that does not require the user to
touch the zoom controls at all: `frameAll` computes its fit scale from the
layout bounds and the measured viewport, and on a board with many themes that
fit lands below 0.16 — so "Frame the whole board", and the on-mount framing
effect that calls the same function, can open the board with no cards on it.

## Key Decisions

- **Cards render at every reachable zoom; the cutoff goes away.** Chosen over
  keeping a far-zoom mode that draws simplified card blocks: at the 0.12 floor a
  full card is already only ~36x43px, so the simplified renderer would be a
  second card presentation to maintain for no visible gain. Chosen over raising
  `MIN_SCALE` to 0.16, which would leave the label-only path as unreachable dead
  code and would still make large boards impossible to frame whole.
- **The `far` flag survives, narrowed to what it actually earns.** It still
  drives the hub label's font bump (`fontSize: far ? 21 : 15`), which is a real
  readability affordance when the card text has become texture. Renaming the
  constant to match that single remaining job keeps the next reader from
  re-introducing the cull.
- **Repro is a component render test, not a camera-hook test.** `useBoardCamera`
  is behaving correctly here — it clamps to `MIN_SCALE` as designed and its
  existing tests pass. The defect is in what `GalaxyBoard` chooses to render at
  a given scale, so the test has to mount the board and drive the zoom-out
  control.

## Implementation

### 1. Stop culling the cards at low zoom

**File**: `app/components/GalaxyBoard.tsx`

- Remove the `!far &&` guard in front of `cluster.cards.map(...)` so the card
  list renders at every scale.
- Keep the scale threshold and the derived flag, but rename both to say what
  they now do — the constant to something like `HUB_LABEL_EMPHASIS_BELOW` and
  the local `far` to `farOut` (or keep `far` if it reads better once the cull is
  gone). Its only remaining consumer is the hub label's `fontSize`.
- Rewrite the constant's doc comment. The current one explains a hiding rule
  that will no longer exist and states a premise (cards "degrade to single
  pixels") that is false at these dimensions; replace it with the real reason
  the threshold is still there — the hub label grows once the card text has
  become texture — and record why the cards are never hidden: the shape of the
  thinking *is* the cards, and an empty board at the framing zoom is the bug
  this replaced.
- Sanity-check the entry animation while you are here: each card carries
  `animation: cy-emerge ... ${i * 90}ms both`. Cards that were previously
  unmounted below the threshold will now mount on first frame instead, so
  confirm the stagger still reads as intended on a board that opens already
  zoomed out (the `frameAll`-on-mount path), and note in the build if it needs
  gating.

### 2. Pin the behaviour with a board render test

**New file**: `app/components/GalaxyBoard.render.test.tsx`

The reproduction test described in `## Reproduction Test` below. Follow the
stubbing convention already used by `app/components/BoardWorkspace.render.test.tsx`
— stub the decorative/expensive children (`GalaxyBackdrop`, `ThemeParticles`,
and `InsightStack` if it drags in anything jsdom dislikes) so the test is about
the card-visibility rule and nothing else. Register it with
`codeyam-editor editor refresh-tests`.

### 3. Verify the framing path no longer opens an empty board

**File**: `app/components/GalaxyBoard.tsx`

No code change expected here beyond change 1 — `frameAll` is correct as written
— but confirm as part of the build that a board with enough themes to force a
fit below 0.16 now frames with its cards visible. If the scenario set has no
such board, add one under `## Scenarios to Demonstrate` rather than tuning the
fit factor.

## Reused existing code

- `useBoardCamera` from `app/hooks/useBoardCamera.ts` (glossary entry:
  `useBoardCamera`) — the camera and its `MIN_SCALE = 0.12` floor are unchanged;
  the plan only changes what the board draws at a given scale.
- `clampScale` from `app/hooks/useBoardCamera.ts` (glossary entry: `clampScale`)
  — already covered by `app/hooks/useBoardCamera.test.ts`; the zoom-limit tests
  there stay green and are not this plan's concern.
- `layOutGalaxy`, `CARD_SIZE` from `app/lib/galaxyLayout.ts` — the card
  footprint (300x360) is the evidence that the "single pixels" premise is wrong;
  no layout change is needed.
- `BoardZoomControls` from `app/components/BoardZoomControls.tsx` — the repro
  drives the real control by its existing `aria-label="Zoom out"`, so no test
  hook has to be added to production code.
- `app/components/BoardWorkspace.render.test.tsx` — the existing pattern for
  mounting a board-side component under jsdom with its heavy children stubbed.

**Existing-implementation survey:** no other scale-based visibility gate exists
on the board. `LABEL_ONLY_BELOW` in `app/components/GalaxyBoard.tsx` is the only
threshold constant of its kind; a search for the camera scale finds it used
elsewhere only to divide connector stroke widths (keeping lines hairline) and to
scale pan deltas in `useBoardCamera`. Nothing else hides content by zoom, so
this change adds no duplicate rule.

## Reproduction Test

Pins that the question cards stay on the board at the minimum zoom, instead of
disappearing and leaving only the connector lines and hubs.

**Target**: `app/components/GalaxyBoard.render.test.tsx` (new file) — run with
`codeyam-editor editor refresh-tests --test GalaxyBoard`.

```tsx
// Zooming all the way out must never empty the board: the cards ARE the shape
// of the thinking, and the bug was that below 0.16 only lines and hubs drew.
it('keeps the cards on the board at the minimum zoom', async () => {
  render(
    <GalaxyBoard
      seedIdea="a seed"
      themes={[{ id: 't1', label: 'Positioning', hue: 210, order: 0 }]}
      nodes={[
        {
          id: 'n1',
          themeId: 't1',
          kind: 'question',
          label: 'Who is this for?',
          detail: null,
          status: 'open',
        },
      ]}
    />,
  );

  const zoomOut = screen.getByLabelText('Zoom out');
  for (let i = 0; i < 20; i++) fireEvent.click(zoomOut);

  expect(screen.getByText('Who is this for?')).toBeTruthy();
});
```

Status: PROPOSED — confirm red at execution. Expected failure: with the `!far &&`
guard in place, twenty zoom-out clicks drive the camera to `MIN_SCALE` (0.12),
which is below `LABEL_ONLY_BELOW` (0.16), so no `QuestionCard` is mounted and
`getByText('Who is this for?')` throws "Unable to find an element with the text".

Two things to confirm empirically rather than assume, both at execution:

- **The zoom-out count and the starting scale.** jsdom reports `clientWidth`/
  `clientHeight` as 0, so the on-mount `frameAll` computes a fit of 0 and clamps
  to `MIN_SCALE` — the board may already be below the cutoff before a single
  click. That makes the test red for a slightly different reason than a real
  user's gesture. Confirm the red, then decide whether to stub the shell's
  measurement so the test starts at a realistic scale and the clicks are what
  crosses the threshold. Do not trust the count of 20 without observing it.
- **The theme/node fixture shape.** The exact fields on `GalaxyTheme` and
  `GalaxyNodeInput` (and which props `GalaxyBoard` requires) come from
  `app/lib/galaxyLayout.ts`; fill the fixture from the real types rather than
  from the sketch above.

## Scenarios to Demonstrate

- A rich multi-theme board framed whole ("All" / on-mount framing) where the fit
  scale lands below 0.16 — every card visible, hub labels enlarged.
- The same board zoomed all the way out with the zoom-out control — cards still
  present as themed blocks, connectors and hubs unchanged.
- A single-theme board zoomed all the way out — the small case, confirming the
  fix is not specific to crowded layouts.
- A board zoomed all the way in to `MAX_SCALE` — unchanged behaviour, guarding
  against a regression at the other end.
- An empty board (no themes) at minimum zoom — still shows the core idea and the
  thinking indicator, with no cards to draw.