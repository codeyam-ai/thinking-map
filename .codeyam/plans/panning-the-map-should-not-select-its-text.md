---
title: "Panning the Map Should Not Select Its Text"
mode: ui
createdAt: "2026-09-03T00:09:02Z"
source: manual
---

## Summary

Dragging the board paints a text highlight that trails the cursor: press on a
question card, drag to pan, and the browser reads the gesture as "select this
text" instead of "move the map". The helper that fixes this already exists and
is already tested — `suppressTextSelection` in `app/lib/textSelection.ts` — but
nothing calls it. It is dead code: `useBoardCamera` never imports it. Wire it
into the camera's pointer gesture, and then close the hole that creates: because
a drag on a card pans the board, selecting a card's text by dragging was never
possible in the first place, so the map's words have no copy path at all. Add a
small copy button to each text surface on the board — every question card, the
core idea circle, the "What that tells us" insight, and the conclusion — so
anywhere you would have wanted to select, there is a button instead.

## Key Decisions

- **Suppress on `pointerdown`, not at the pan threshold.** The helper's own
  doc-comment imagines suppression starting when the drag becomes a pan, but the
  threshold is `PAN_THRESHOLD = 3` pixels, and by then Chrome has an in-flight
  selection drag that setting `user-select: none` mid-gesture does not reliably
  abort — `removeAllRanges()` clears what exists, and the browser keeps
  extending from the same anchor. Suppressing at `pointerdown` is the seam where
  the highlight never starts. The cost is that double-click-to-select-a-word on
  card text stops working; the copy buttons are what pays for it, which is why
  the two halves are one plan and not two.
- **Skip suppression for `[data-no-pan]` subtrees.** `onPointerDown` already
  returns early when the target is inside `[data-no-pan]` — the answer composer,
  the choice pills, the chat panel, the zoom controls. Selection inside a
  textarea must keep working, so the suppression call goes *after* that guard,
  not before it.
- **Restore in the existing `onPointerUp`/`onPointerCancel` path.** The camera
  already routes both to one handler, and `suppressTextSelection` returns an
  idempotent restore, so the ref holding it can be cleared unconditionally. No
  new lifecycle.
- **The copied string is a rule, not a template in JSX.** What a card copies
  differs by face — an open question copies the question, an answered one copies
  the question and your answer, an insight copies its label and detail — and
  that is the same kind of decision `cardPresentation` and `cardEyebrow` already
  own. It goes in a new pure module with tests rather than three inline template
  literals that can drift.
- **Reveal on hover, on keyboard focus, and on the focused card.** Hover-only
  would make the control invisible in every scenario screenshot, which on this
  project means the affordance is undocumented. Tying visibility to the board's
  own `focused` state as well means a scenario that focuses a card demonstrates
  the button without needing a synthetic hover.
- **A new `CopyTextButton`, not a reuse of `CopyablePrompt`.** `CopyablePrompt`
  renders the text *and* a button — it is the block whose whole purpose is to be
  copied. Here the text is already on the card and the button is an icon beside
  it. The clipboard call, the `catch` that refuses to claim success, and the
  `aria-live` label flip are copied from `CopyablePrompt` deliberately; the
  layout is not.

## Implementation

### 1. Hold selection off for the duration of a board gesture

**File**: `app/hooks/useBoardCamera.ts`

Import `suppressTextSelection` from `@/app/lib/textSelection`. Add a ref beside
`drag` holding the restore function (`useRef<(() => void) | null>(null)`).

In `onPointerDown`, after the `e.button !== 0` and `el.closest('[data-no-pan]')`
guards return early, call `restore.current = suppressTextSelection()` alongside
setting `drag.current`.

In `onPointerUp` (which also serves `onPointerCancel`), call
`restore.current?.()` and null the ref, next to clearing `drag.current` and
releasing the pointer capture. Restoring is idempotent, so a doubled
`pointerup` is safe.

Note in a comment why the call sits at `pointerdown` rather than at the pan
threshold — the in-flight-selection reason from Key Decisions. The helper's own
doc-comment currently describes the threshold-based placement; update that
paragraph so the two files agree.

### 2. What each board surface copies

**New file**: `app/lib/boardCopyText.ts`

Pure functions, no React, matching the shape of `cardPresentation` and
`handoffCopy`:

- `cardCopyText(card)` — takes the fields `PlacedCard` already carries (`label`,
  `detail`, `kind`, `status`). Returns the question alone for an open card; the
  question and the answer, separated by a blank line, for an answered one; the
  label and detail for an insight. Never returns a trailing blank line and never
  returns an empty string for a card that has a label.
- `coreCopyText({ seedIdea, insight })` — the idea on its own, or the idea
  followed by the current reading when one exists.
- `conclusionCopyText({ label, detail, choices })` — the conclusion, its detail,
  and the "Where next" options as a list when there are any.

**New file**: `app/lib/boardCopyText.test.ts` — one test per branch above,
including the empty-detail and no-choices cases.

### 3. The button itself

**New file**: `app/components/CopyTextButton.tsx`

A small icon button. Props: `text` (what lands on the clipboard), `label` (its
accessible name, e.g. "Copy this question"), `accent` (the theme colour, so it
reads as part of the card it sits on), and `className` for placement.

Behaviour, taken from `CopyablePrompt`:

- `navigator.clipboard?.writeText(text)`, `.then` sets copied, `.catch` leaves
  it false — a refused clipboard must not claim success.
- The confirmation is an `aria-live="polite"` span holding a visually-hidden
  "Copied" so the flip is audible as well as visual; the icon swaps to a check
  for a couple of seconds and then back.
- `data-no-pan` on the button, plus `onClick={(e) => e.stopPropagation()}`
  before the copy, so pressing it neither pans the board nor focuses the card
  underneath.
- Visibility: `opacity-0` at rest, `group-hover:opacity-100`,
  `focus-visible:opacity-100`, and an explicit `visible` prop the caller sets
  when its card is the focused one.

**New file**: `app/components/CopyTextButton.render.test.tsx` — that it copies
the exact string it was given, that a rejected clipboard does not flip the
label, that the click does not bubble, and that it carries `data-no-pan`.

### 4. Cards

**File**: `app/components/QuestionCard.tsx`

Add `group` to the root div's className. Render `CopyTextButton` positioned
top-right (`absolute right-6 top-6`) — the bottom-right corner is already the
pencil on an answered card. Text comes from `cardCopyText(card)`; `accent` is
the existing `accent`; `visible` is the existing `focused`. Suppress it while
the composer is open (`writing && composing`), where the card is a form rather
than something to copy.

### 5. The core idea and its reading

**File**: `app/components/CoreIdeaCard.tsx`

Two buttons, because they are two pieces of text a person would want
separately:

- One on the disc, inside the circle's padding at the bottom-right, copying
  `coreCopyText({ seedIdea, insight: null })` — the idea in the person's own
  words.
- One on the "What that tells us" panel, top-right, copying
  `coreCopyText({ seedIdea, insight })` so the reading arrives with the idea it
  is about.

The disc currently has no `group` wrapper and no hover state; add `group` to the
circle div and to the insight panel div respectively. Accent for the disc is the
card's black-on-white palette rather than a theme hue, so pass the ink colour
explicitly.

### 6. The conclusion

**File**: `app/components/ConvergenceNode.tsx`

Add `group` to the ready-state panel's root div and a `CopyTextButton` at its
top-right, copying `conclusionCopyText(state)`. The panel already keeps its
choice buttons in a `data-no-pan` block; the copy button carries its own, so it
sits outside that block without changing it.

## Reused existing code

- `suppressTextSelection` from `app/lib/textSelection.ts` (glossary entry:
  `suppressTextSelection`) — already written and already covered by
  `app/lib/textSelection.test.ts`; this plan is largely about calling it.
- `useBoardCamera` from `app/hooks/useBoardCamera.ts` (glossary entry:
  `useBoardCamera`) — the gesture the suppression is scoped to.
- `CopyablePrompt` from `app/components/CopyablePrompt.tsx` (glossary entry:
  `CopyablePrompt`) — the clipboard call, the `catch`-means-no-success rule and
  the `aria-live` confirmation are lifted from it. Not reused as a component:
  it renders the text as well as the button, which is the opposite of what the
  board needs.
- `PlacedCard` from `app/lib/galaxyLayout.ts` — the new copy-text builder reads
  only fields it already carries.
- `isAnsweredCard` / `isInsightCard` / `isOpenCard` from
  `app/lib/cardPresentation.ts` — the copy-text builder branches on the same
  three faces the card renders, and must use these predicates rather than
  re-deriving them, or the copied text and the drawn card can disagree.
- The `group` / `group-hover` hover-reveal idiom already used in
  `app/components/SavedMapRow.tsx`.

**Existing-implementation survey.** Grepped `app/` for the CSS user-select
property in all three spellings: the only hits are `app/lib/textSelection.ts`
and `app/lib/textSelection.test.ts`. There is no second, competing suppression
anywhere in the app, and no global select-none on the board shell. Grepped for
the clipboard API: exactly one call site, in
`app/components/CopyablePrompt.tsx`. There is no existing generic copy-icon
button component and no existing copy-text builder, so both new files in the
Implementation section are genuinely new rather than duplicates.

## Reproduction Test

Dragging the board leaves text selection on, so the browser paints a highlight
trailing the cursor while the map pans.

**Target**: `app/hooks/useBoardCamera.test.ts` — run with
`codeyam-editor editor refresh-tests --test board_pan_suppresses_text_selection`.

The file is already `// @vitest-environment jsdom` and already has the `pointer()`
fake-event helper this test reuses. Add a new describe block:

```ts
describe('useBoardCamera and text selection', () => {
  // The reported complaint: a drag across a card paints a selection highlight
  // that trails the cursor, because the browser reads the pan as a select.
  it('turns text selection off while a board gesture is running', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    act(() => result.current.handlers.onPointerDown(pointer(100, 100)));
    expect(document.body.style.userSelect).toBe('none');

    act(() => result.current.handlers.onPointerUp(pointer(140, 120)));
    expect(document.body.style.userSelect).toBe('');
  });

  // Selection inside a card's own controls is not the board's to suppress.
  it('leaves selection alone for a press inside a no-pan subtree', () => {
    const { result } = renderHook(() => useBoardCamera(START));

    const inControl = pointer(100, 100, { closest: (s: string) => (s === '[data-no-pan]' ? {} : null) });
    act(() => result.current.handlers.onPointerDown(inControl));
    expect(document.body.style.userSelect).toBe('');
  });
});
```

Status: PROPOSED — confirm red at execution. Expected failure: the first test
fails on its first assertion — `useBoardCamera` never calls
`suppressTextSelection`, so `document.body.style.userSelect` is still `''` after
`onPointerDown`, and `expect('').toBe('none')` fails. The second test passes
before the fix and is there to pin the `[data-no-pan]` carve-out afterwards.

## Scenarios to Demonstrate

- A board mid-pan with a card under the cursor — nothing highlighted, the map
  moving.
- An open question card with the copy button revealed (the focused card).
- An answered card, where the copy button and the pencil share the card without
  colliding.
- An insight card carrying a detail paragraph.
- A card with its composer open — the copy button is deliberately absent.
- The core idea circle with a long idea (the 26px type size) and its button.
- The core with a "What that tells us" panel, so both copy buttons are on
  screen at once.
- A finished board showing the conclusion with its "Where next" options and the
  panel's copy button.
- The board zoomed out below `LABEL_ONLY_BELOW`, where the cards are gone and
  there is nothing to copy — the labels-only state must stay unchanged.