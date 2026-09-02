---
title: "Lead With the Prompt to Hand the Agent"
mode: ui
createdAt: "2026-09-02T10:51:17Z"
source: manual
---

## Summary

Someone types an idea, presses return, and lands on a map that nothing is
working on. The pieces that fix that by hand already exist — `AgentHandoff`
renders a start prompt naming the map, and `CopyablePrompt` offers a button
that copies it — but the panel sits in the same weight as everything else on
the page, opens by explaining why nobody is attached, and reaches the prompt
third. It never says the one thing the person actually needs to be told:
*paste this into your agent's chat window*. It reads as a footnote about agent
availability rather than as the next step.

This makes the handoff the headline of arriving on an unattached map. Same
showing condition, same prompt, same copy behaviour, promoted to a hero band
directly under the header: an instruction at heading weight telling them to
copy the prompt and paste it into their agent's chat, the prompt itself, and a
copy button that reads as the primary action on the screen. The explanation
stays, demoted, below the prompt. The map remains visible underneath, because
it is what they just made and hiding it to explain the tooling would be the
wrong trade.

Nothing about the write path changes. The prompt is already built the moment
the map exists, `IdeaPrompt` needs no new behaviour, and no new state is
introduced. This is a wording and presentation change across three components
that already exist.

## Key Decisions

- **A band above the map, not a takeover or a modal.** A takeover hides the
  thing the person just made in order to explain the tooling. A modal is
  dismissible, and a dismissed modal needs a re-entry point that would itself
  have to be findable — new state and a new affordance for a case that is not
  rare. A band is unmissable while it is true and gone the moment it is not.
- **The showing condition does not change.** `AgentHandoff` already hides when
  an agent is listening (using the same predicate `NodeQuestionComposer` uses,
  so the two surfaces cannot contradict each other) and when the log carries an
  agent-origin event. No `?new=1` flag, no storage, no "seen it once" state.
  While the condition holds the map genuinely has not been picked up, so saying
  so on every visit is not nagging — it is the state of the map.
- **The instruction leads; the explanation follows.** Today `handoffCopy`
  returns an eyebrow and an explanation first, and the prompt after the quoted
  idea. That order is backwards for someone who just pressed return: they want
  to know what to do, not why. The steps go first at heading weight, the honest
  paragraph moves below the prompt where it is available to whoever wants it.
- **The new wording goes in `handoffCopy`, not into the component.** That
  module's whole argument is that the wording IS the interface here and belongs
  somewhere tests can pin it. Adding the instruction as strings inside
  `AgentHandoff` would put the most important sentence on the page in the one
  place the tests cannot see it.
- **Copy/paste is named as the path that works, not as a fallback.** The
  `await_new_map` door is real but conditional — it only helps an agent already
  connected and already parked in that call. For the person on this page,
  pasting the prompt is the thing that works, and the copy should say so rather
  than implying that attaching an agent would have made this automatic.
- **The copy confirmation must be announced, not just seen.** `CopyablePrompt`
  already flips its label to "Copied"; promoted to the primary action, that flip
  needs `aria-live` so it is not a purely visual success signal.
- **The band must not squeeze the map into nothing.** `MapScreen` is a
  `flex h-screen flex-col`, so a taller child competes with `MapWorkspace` for
  height. The band takes its natural height and the workspace keeps the
  remainder, so a short viewport scrolls the map rather than collapsing it.

## Implementation

### 1. Add the instruction to the copy

**File**: `app/lib/handoffCopy.ts`

Extend `HandoffCopy` with the instruction the panel currently lacks: a headline
in the register of "Hand this to your agent", and the two steps stated as steps
— copy the prompt, paste it into your agent's chat window. Keep `explanation`
and `attachHint` as they are; they stay honest and simply move down the page.

The existing `startPrompt` branching on `hasBrief` is unchanged.

**File**: `app/lib/handoffCopy.test.ts`

Extend the existing wording tests to pin the new fields, including that the
steps name pasting into an agent's chat — the sentence this whole plan exists
to add is exactly the kind of wording the module says tests should hold.

### 2. Reshape the panel into a hero band

**File**: `app/components/AgentHandoff.tsx`

Keep the contract and the hiding logic exactly as they are — same props, same
`useOptionalWebMcpBridge` reads, same early return. Only the arrangement
changes: headline and steps first at heading weight, then the prompt and its
copy button, then the quoted idea demoted, then the explanation and attach hint
at small type. Give the band a visual weight distinct from the surrounding
cards — it is the one thing on this screen asking to be acted on; `--lime` /
`--lime-deep` in `app/globals.css` are the existing accent tokens.

It stays a renderer: every string still comes from `handoffCopy`.

**File**: `app/components/AgentHandoff.render.test.tsx`

Keep the existing cases, which pin the hiding logic this plan does not touch.
Add that the instruction and both steps render, and that they appear before the
explanation in document order — the ordering is the change, so asserting only
presence would let a regression back in.

### 3. Let the copy button read as the primary action

**File**: `app/components/CopyablePrompt.tsx`

It is currently a bordered pill sized like a secondary control. Give it an
emphasis it can carry in the band without breaking its other callers — either a
size/tone prop defaulting to today's appearance, or a restyle if this is its
only caller (check before choosing). Add `aria-live="polite"` to the copied
state.

Its deliberate failure behaviour stays: a refused clipboard leaves the text on
screen and the label unflipped, so the select-and-copy path underneath is
untouched.

**New file**: `app/components/CopyablePrompt.render.test.tsx`

It has no test of its own today, and it is about to become the most important
button on the arrival screen. Cover: the text renders; clicking writes exactly
that text with `navigator.clipboard.writeText` stubbed and flips the label; a
rejected `writeText` neither throws nor claims success.

### 4. Give the band its own row in the map layout

**File**: `app/components/MapScreen.tsx`

The conditional render and the props are already in place. What this adds is
layout correctness: the band takes its natural height and `MapWorkspace` keeps
`min-h-0 flex-1` beneath it, so the map region absorbs the remainder and
scrolls instead of being crushed on a short viewport. Confirm the summary phase
(`next-steps`) still reads sensibly with a band above it, or scope the band to
the working phases.

### 5. Refresh the isolated scenarios

**File**: `app/isolated-components/AgentHandoff/page.tsx`

The scenario page exists; extend its `scenarios` record so the band is captured
in the states that matter: a short idea, a long idea that wraps the prompt
block, a brief-only map, and the attached case that renders nothing.

## Reused existing code

- `handoffCopy` from `app/lib/handoffCopy.ts` (glossary entry: `handoffCopy`) —
  the wording module the new instruction joins, and its existing `startPrompt`
  and `hasBrief` branching, which are unchanged.
- `AgentHandoff` from `app/components/AgentHandoff.tsx` (glossary entry:
  `AgentHandoff`) — the panel being reshaped, including the hiding predicate
  this plan deliberately leaves alone.
- `CopyablePrompt` from `app/components/CopyablePrompt.tsx` (glossary entry:
  `CopyablePrompt`) — the copy behaviour and its refused-clipboard handling.
- `SeedIdeaQuote` from `app/components/SeedIdeaQuote.tsx` (glossary entry:
  `SeedIdeaQuote`) — blank-in-nothing-out, so the brief-only case needs no
  branch in the band.
- `useOptionalWebMcpBridge` from `app/components/WebMcpBridge.tsx` (glossary
  entry: `useOptionalWebMcpBridge`) — how the panel reads presence without
  crashing in an isolated scenario.
- `MapScreen` from `app/components/MapScreen.tsx` (glossary entry: `MapScreen`)
  — already renders the panel; this only adjusts the row it gets.

**Existing-implementation survey.** Grepped for prompt-building and copy
behaviour before proposing any: `handoffCopy` is the only builder of a start
prompt, and `CopyablePrompt` is the only component that touches the browser
clipboard. This plan adds no prompt logic and no copy logic — it adds one
wording field and rearranges what already exists, which is why it is a
presentation plan rather than a feature.

## Scenarios to Demonstrate

- **Just arrived from the landing input** — the band leads the page with the
  paste instruction, the prompt names this map, and the map is visible below.
- **Brief-only map** — no sentence quoted, and the prompt points at
  `read_brief`.
- **A long seed idea** — the prompt block wraps without pushing the copy button
  off screen or crushing the map.
- **Copy pressed** — the confirmation is visible and announced.
- **Clipboard refused** — the prompt stays on screen and nothing claims success.
- **An agent has already contributed** — no band; the map has the full height.
- **An agent is attached right now** — no band, header reads "Agent attached".
- **Short viewport** — the band keeps its height and the map scrolls beneath it.