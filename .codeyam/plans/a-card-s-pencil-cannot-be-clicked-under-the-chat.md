---
title: "A Card's Pencil Cannot Be Clicked Under The Chat"
mode: ui
createdAt: "2026-09-03T16:08:42Z"
source: manual
---

## Summary

An answered card sitting in the board's bottom-right corner cannot be edited:
its **Edit this answer** pencil is underneath the chat panel, which swallows the
click. Both are anchored to the same place. `QuestionCard` puts the pencil at
`absolute bottom-6 right-6` of the card; `BoardChat` puts itself at
`absolute bottom-6 right-6 z-30` of the board viewport with
`pointer-events-auto`, up to 360px wide. Whichever card lands under that
footprint loses its pencil, silently — the cursor does nothing and nothing
explains why.

There is no chat state that frees the corner. All three of `BoardChat`'s views
occupy it: open and collapsed both render the panel at that anchor, and
`closed` still renders `BoardChatPill` at `absolute bottom-6 right-6`. So
"get the chat out of the way first" is not available to a user or to a
scenario — which is exactly what the registered scenario
`the-round-ends-itself-on-a-real-board` discovered. Its `interactions[0]` clicks
**Hide the conversation** precisely to clear the board, then `interactions[1]`
clicks the pencil and fails: Playwright reports the header's own `Chat` label
intercepting pointer events for the full 5s retry window. Interactions 2–4
(fill the textarea, Save, type into the chat) never run, so the scenario's
screenshot is fresh but demonstrates one of its five steps. It reproduced
identically on three consecutive recapture runs, so it is deterministic, not
flaky.

The fix is to move the pencil off the contested corner. That is the whole
change; the chat keeps its position and its three states.

## Key Decisions

- **Move the pencil, not the chat.** The collision is one control against a
  viewport-anchored overlay, and the control is the cheaper thing to move: one
  file, no new props, no shared state. Relocating it also fixes the bug for a
  real person, who currently has to pan the board to reach their own answer.
- **Bottom-left of the card is the candidate position, to be confirmed at
  execution.** The card's top-right is already taken by `CopyTextButton`
  (`absolute right-6 top-6`, shown when the card is focused), so the pencil
  cannot simply move up there without crowding it. Bottom-left looks free —
  the answered face is a flex column of label and answer text with a
  `flex-1` spacer, and nothing else is absolutely positioned there — but
  confirm visually before settling, and prefer a position that reads as
  belonging to the card rather than merely as "not where the chat is".
- **Declined: make the chat yield when a card is focused.** Auto-collapsing to
  the pill on focus would keep every control where it is, but needs the board's
  focus state wired into `BoardChat`'s `view` (today private `useState`), and
  the pill still sits in the same corner — so it would move the collision
  rather than remove it.
- **Declined: give the board a chat-free safe area.** The general fix, and the
  right one if this recurs, but it touches board layout and camera framing —
  disproportionate to one misplaced control, and it would collide with the
  queued `cards-disappear-when-zoomed-out` work in the same area.
- **Declined: fix only the scenario.** Clicking **Close the conversation**
  instead of **Hide** leaves the pill in that corner, so it may not even clear
  the pencil, and it would paper over a defect a user meets too. A scenario
  that has to avoid a control is evidence about the product, not about the
  scenario.
- **No unit test can catch this class of bug.** The existing
  `QuestionCard — an answered question › returns to an editable box through the
  pencil` passes today and will keep passing: jsdom has no overlay, no z-index
  and no geometry, so it cannot see an intercepted click. The scenario capture
  is the only gate that observes it, which is why the demonstration below
  matters more than a new assertion.

## Implementation

### 1. Move the Edit affordance out of the chat's footprint

**File**: `app/components/QuestionCard.tsx`

The `Edit this answer` control at line 236 carries
`className="absolute bottom-6 right-6 opacity-70 transition-opacity hover:opacity-100"`.
Move it clear of the board's bottom-right corner — bottom-left is the candidate
(see Key Decisions) — keeping the `aria-label`, `role="button"`, `tabIndex`,
`data-no-pan` and the `stopPropagation` in its `onClick`/`onKeyDown` exactly as
they are. Those are load-bearing: `data-no-pan` and the propagation stop are
what keep a click on the pencil from being read as a board pan or as a
card-focus request.

Add a comment saying *why* the position is what it is, naming `BoardChat`'s
`bottom-6 right-6 z-30` footprint. Without it the next person tidying the
layout moves it straight back.

### 2. Confirm the scenario's whole interaction chain now runs

**File**: `.codeyam/scenarios/the-round-ends-itself-on-a-real-board.json`

No edit is expected here — leave `interactions[0]` (**Hide the conversation**)
in place, since collapsing the chat is a state worth showing. The point is to
re-run the capture and verify all five interactions execute: hide the chat,
click the pencil, fill the textarea, Save, then type into the chat input. Until
this scenario captures with its chain complete, the fix is not demonstrated.

If the pencil is reachable but a *later* interaction now fails, treat that as a
separate finding and report it rather than folding it into this plan.

### 3. Re-register and recapture the affected component scenarios

`QuestionCard`'s own scenarios — `questioncard-answered` and
`questioncard-focused` in particular — render the moved control, so they need
recapturing alongside the board scenario.

## Reused existing code

- `QuestionCard` from `app/components/QuestionCard.tsx` (glossary entry:
  `QuestionCard`) — the component that owns the misplaced control. Its glossary
  description already records why the root is a plain `div` with no button role,
  which is the constraint the `stopPropagation` calls exist to satisfy.
- `BoardChat` from `app/components/BoardChat.tsx` (glossary entry: `BoardChat`)
  — the overlay whose footprint defines what "clear of the corner" means. Read
  only; not modified.
- `BoardChatHeader` from `app/components/BoardChatHeader.tsx` — the source of
  the three `aria-label`s (`Hide the conversation`, `Show the conversation`,
  `Close the conversation`) and of the `Chat` label that intercepts the click.
- `CopyTextButton` from `app/components/CopyTextButton.tsx` (glossary entry:
  `CopyTextButton`) — already occupies the card's top-right, which is why the
  pencil cannot move there.
- `QuestionCard — an answered question › returns to an editable box through the
  pencil` in `app/components/QuestionCard.render.test.tsx` — the existing
  registered test for this control. It must keep passing after the move; it
  finds the control by `aria-label`, so a pure position change should not
  disturb it.

**Existing-implementation survey:** this plan adds no config field, threshold or
gate dimension. Nothing in the tree currently reserves board space for the chat
or otherwise encodes its footprint — the `bottom-6 right-6` anchor is repeated
literally in `app/components/BoardChat.tsx` (twice, for the panel and the pill)
and in `app/components/QuestionCard.tsx`, with no shared constant. Introducing
one is deliberately out
of scope here; it belongs with the safe-area approach if that is ever taken.

## Reproduction Test

The buggy behaviour is a click on **Edit this answer** being intercepted by the
chat panel when the card sits in the board's bottom-right corner.

**No unit-level reproduction is writable, and none should be faked.** This is a
real-browser stacking and geometry failure: jsdom has no layout, no z-index and
no pointer-event hit-testing, so the existing pencil test passes with the bug
fully present. A new unit test would either duplicate that passing test or
assert on a Tailwind class string, which pins the implementation rather than the
behaviour.

Demonstrate it instead through the registered scenario
`the-round-ends-itself-on-a-real-board`, whose capture fails today with:

```
interactions[1]: preview-interact: action "click" failed against selector
"[aria-label=\"Edit this answer\"]": locator.click: Timeout 5000ms exceeded.
  <span class="flex-1 ...">Chat</span> from
  <div data-no-pan="true" class="pointer-events-auto absolute bottom-6 right-6 z-30 ...">
  subtree intercepts pointer events
```

Status: PROPOSED — the red is already confirmed, reproduced identically on three
consecutive `recapture-stale` runs on 2026-09-03. The fix is proved when that
capture completes all five interactions instead of stopping at the second.

## Scenarios to Demonstrate

- `the-round-ends-itself-on-a-real-board` — the existing board scenario, now
  running its full chain: chat collapsed, answer edited through the pencil,
  edit saved, and a further message typed into the chat.
- `questioncard-answered` — the answered face at rest, with the pencil in its
  new position.
- `questioncard-focused` — the focused card, proving the pencil and
  `CopyTextButton` coexist without crowding each other.
- A card deliberately positioned in the board's bottom-right corner with the
  chat **open**, which is the exact state that used to be unclickable.
- The same card with the chat **closed to its pill**, confirming the pencil is
  reachable in every chat state rather than only the ones that happen to be
  narrow.