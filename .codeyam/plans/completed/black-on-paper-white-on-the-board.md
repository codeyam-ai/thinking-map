---
title: "Black on Paper, White on the Board"
mode: ui
createdAt: "2026-09-02T20:10:26Z"
source: manual
---

## Summary

Take the lime off every button and call to action: black pill on the paper
surfaces, white pill on the dark board. Leave it exactly where it is not
decoration — the ring on the node that just changed, and the agent's status dot
— because in those two places the colour is the message, and a black one would
say nothing. Along the way, retire three hardcoded lime hexes that were never
going through the token in the first place.

## Key Decisions

- **The rule is surface-dependent, so it is a variant, not a find-and-replace.**
  A CTA on the paper background becomes ink with light text; the same CTA on the
  black board becomes white with ink text. `SendButton` is rendered on BOTH — by
  `IdeaForm` on the landing screen and by `MapCardAnswer`, `ContributionBar` and
  `NodeQuestionComposer` on the board — so it takes a tone prop rather than a
  new colour. Swapping its class globally would make it invisible on one of the
  two surfaces whichever way it went.

- **No new tokens.** The palette already has what this needs: `--ink` for the
  dark pill, `--paper`/`--surface` for its text, and `--surface` (`#ffffff`) for
  the pill on the board. Minting a `--cta` token would add a name for something
  the existing tokens already say.

- **`--lime` stays defined, and keeps two jobs.** `nodeAppearance.ts` gives the
  updated node a lime border and lime glow — the design system's stated rule is
  that exactly one node per screen wears it, which is what makes "this just
  changed" findable. `AgentStatusDot` uses lime-deep for connected and working
  against `ink-soft` for unavailable. Blacking either out would leave two states
  that look alike: a black status dot is indistinguishable from the dark grey
  one beside it, and a black ring is what a subject card's border already is.
  The direction was about chrome; these two are signal.

- **Three hardcoded hexes go through the token system on the way.**
  `RoundControl` uses `bg-[#d9f27e]` and `BoardChat`'s send button uses
  `bg-[#e4ec4b]` — neither is `--lime` (`#d5f560`), so the product currently has
  three slightly different limes nobody chose. They are being restyled anyway;
  restyle them into classes rather than into new literals.

- **`AgentHandoff`'s lime band is left alone, deliberately.** Its
  `border-2 border-lime-deep` is a section border on a pitch panel, not a button
  — outside the stated scope. Flagged rather than silently included; if it should
  go too, that is a one-line follow-up.

- **`PhaseNav` is not touched because it is not rendered.** Its active-phase
  `bg-lime` is real code, but the component is imported only by its own isolate
  — `AppHeader`'s comment records that the phase track was removed from the
  chrome. Restyling a component nothing shows would be work with no visible
  result; whether it should exist at all is a separate question.

## Implementation

### 1. Give the send button two tones

**File**: `app/components/SendButton.tsx`

Add a tone prop — paper (default) and board — selecting ink-pill-with-light-text
or white-pill-with-ink-text. Keep the existing `size` prop, the absolute
positioning, the disabled opacity and the arrow untouched.

The doc comment opens by calling this "the only place lime appears in the
product". That was already untrue and is about to be untrue in the other
direction; rewrite it to state the new rule.

**Files**: `app/components/IdeaForm.tsx`, `app/components/MapCardAnswer.tsx`,
`app/components/ContributionBar.tsx`, `app/components/NodeQuestionComposer.tsx`

Pass the tone matching the surface each renders on. `IdeaForm` is the paper
landing screen; confirm the other three against their captures rather than
assuming — the board is dark, but a composer rendered over a light card is not.

### 2. Restyle the remaining calls to action

**File**: `app/components/CopyablePrompt.tsx`

`bg-lime` + `hover:bg-lime-deep` inside a `border-ink` pill becomes the ink
treatment. It sits on paper.

**File**: `app/components/RoundControl.tsx`

The "Next round →" button's `bg-[#d9f27e] text-black` becomes the white-on-board
treatment. Keep the spinner branch; its `border-black/25 border-t-black` is
drawn against the button's own fill and must stay legible against the new one.

**File**: `app/components/BoardChat.tsx`

The send button's `bg-[#e4ec4b] text-black` becomes the same white-on-board
treatment, so it and the round control match. The transcript bubbles are NOT
part of this change — they become theme-coloured under
`the-conversation-gets-out-of-the-way`, and the two plans must not both edit
that rule.

**File**: `app/isolated-components/WebMcpBridge/BridgeReadout.tsx`

Its lime button follows the same rule as any other CTA. Its lime status dot
does not — it mirrors `AgentStatusDot` and is a signal.

### 3. Say what the rule is, once

**File**: `app/globals.css`

The token block documents lime as "reserved for the one node that just
changed". That is now the whole of what lime is for, plus the status dot —
state it there, next to `--lime`, so the next person adding a button does not
reach for it.

## Reused existing code

- `SendButton` from `app/components/SendButton.tsx` (glossary entry:
  `SendButton`) — gains a tone, keeps everything else.
- `nodeShellClasses` from `app/lib/nodeAppearance.ts` (glossary entry:
  `nodeShellClasses`) — untouched, and the reason lime survives.
- `AgentStatusDot` from `app/components/AgentStatusDot.tsx` (glossary entry:
  `AgentStatusDot`) — untouched, same reason.
- `CopyablePrompt` from `app/components/CopyablePrompt.tsx`, `RoundControl` from
  `app/components/RoundControl.tsx`, `BoardChat` from
  `app/components/BoardChat.tsx` — the three CTAs being restyled.
- The `--ink`, `--paper` and `--surface` tokens and their `text-ink` /
  `bg-surface` Tailwind aliases from `app/globals.css`.
- `app/components/CopyablePrompt.render.test.tsx` already asserts a button's
  class does NOT match `/bg-lime/` in one state — check whether that assertion
  now holds for both states, and tighten it if it has become trivially true.

**Existing-implementation survey.** Every lime usage in the tree was
enumerated before writing this: `SendButton`, `CopyablePrompt`, `RoundControl`,
`BoardChat`, `BridgeReadout` (CTAs — in scope); `nodeAppearance` and
`AgentStatusDot` (signals — out of scope by decision); `AgentHandoff`'s section
border and `PhaseNav`'s active pill (flagged above); and `mapKinds`' accent
table, which names a family accent rather than a colour. There is no existing
CTA-tone or button-variant abstraction to reuse — `SendButton` has a `size`
prop and no tone, which is why one is added rather than found.

## Scenarios to Demonstrate

- The landing screen's send button, black on paper.
- The same component on the board, white on black — the pair that proves the
  variant is doing real work.
- `CopyablePrompt` with its ink CTA.
- The round control in both its states: "Next round →" and the waiting spinner,
  with the spinner still visible against the new fill.
- The board with exactly one node freshly updated — the lime ring still the one
  thing your eye goes to, on a board where nothing else is lime any more. This
  is the scenario that proves the exception was worth keeping.
- The agent status dot across connected, working and unavailable.
- A disabled send button on each surface, since the disabled opacity reads
  differently against black than against lime.