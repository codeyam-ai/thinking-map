---
title: "The App Moves First"
mode: ui
createdAt: "2026-09-01T17:28:26Z"
source: manual
dependsOn: ["the-map-builds-downward", "app-chrome-that-fits-a-half-screen"]
---

## Summary

The loop waits on the person at every joint, and the card map makes that gap
impossible to hide: once the map is a column of rows you answer in place, the
question "what happens when I finish this row?" has to have an answer, and today
it does not. Nothing advances the phase, nothing acknowledges that a round is
complete, and nothing indicates that more is coming — so the page sits still and
the person has to go and prod the agent in the other window. On top of that,
`deconstruct` and `map` are two phases for one activity: you answer questions and
the map builds itself out of the answers, which is one thing described twice.

Make the page move first. Five phases instead of six. When a row is fully
answered, the next row appears immediately as shimmering placeholder cards and the
column scrolls to it, so the map visibly reaches for the next thing before anyone
asks it to. When a phase's work is done, the row's footer carries the one action
worth taking next. And because the page genuinely cannot start an agent's turn,
the shimmer is bounded and turns into an honest statement of what it is waiting
for rather than pulsing forever.

## Key Decisions

- **Merge `deconstruct` and `map` into one phase, labelled `02 Map`.** They are
  the same loop from the person's side — questions arrive, answers become the
  map — and the card design makes that literal: the questions and the map are now
  the same cards. Two labels invite the reading that the map is a separate thing
  you get to later. Five steps is also one fewer pill to fit in a narrow track.
- **`deconstruct` stays accepted, forever, as an alias.** `phase` is a plain
  `String` column (`prisma/schema.prisma:39`) and existing maps carry
  `"deconstruct"`. Rather than a data migration, add an alias resolver beside
  `isPhase()` in `app/lib/mapKinds.ts` that folds `deconstruct` → `map` on read,
  and keep `deconstruct` accepted by the `set_phase` tool while dropping it from
  the nav's list. An agent that learned the old vocabulary keeps working.
- **The shimmer is a real promise, so it has to be honest.** WebMCP is pull-only:
  the page cannot wake an agent, and the README and `AgentStatus` both already say
  so plainly. So a shimmering next row cannot mean "the agent is writing" — it
  means "your answers are on the log and we are waiting". It is bounded: after
  roughly 20 seconds the placeholders resolve into a plain statement, which is one
  of three sentences depending on what is actually true — an agent is attached and
  has been told; an agent is attached but is not currently in a turn; no agent can
  reach this page, so the answers are waiting in the log. A row that shimmers
  indefinitely is a lie, and it is the exact lie this codebase has been careful
  everywhere else not to tell.
- **The action lives in the row, not in the header.** The earlier design put a
  call-to-action line under the phase track. With the card flow it belongs where
  the eye already is: as the footer of the last row, in the column. "Ready to
  research →" appears under the round you just finished, not in the chrome.
- **Advancing the phase is a page-side act now.** The button posts a note to the
  log saying what was decided and calls `set_phase` through the same tools route
  the agent uses, so an agent reading the log sees the transition rather than
  inferring it. This is the first page-side caller of `set_phase`; the tool is
  unchanged.
- **Completion is "no open questions in the newest round", not "no open questions
  anywhere".** A question skipped three rounds ago must not hold the loop hostage.
  Older unanswered cards stay answerable in place and simply stop gating progress.
- **The polling stays as it is.** `useExchangeLog` already polls every 1500ms and
  refreshes the server-rendered map, so a new round genuinely does appear within a
  second and a half of the agent writing it. Nothing about the transport needs to
  change; what was missing was the page reaching for the next row before the data
  arrives, which is the shimmer.

## Implementation

### 1. Five phases, with the sixth accepted as an alias

**File**: `app/lib/mapKinds.ts`

- `PHASES` becomes `['idea', 'map', 'research', 'explore', 'next-steps']`.
- `PHASE_LABELS` renumbers: `01 Idea`, `02 Map`, `03 Research`, `04 Explore`,
  `05 Next steps`.
- Add a `LEGACY_PHASE_ALIASES` record mapping `deconstruct` → `map`, and a
  resolver `normalizePhase(value: string): Phase | null` that tries the alias
  before falling back to `isPhase`. Keep `isPhase` — it answers a different
  question (is this literally one of the five) and `toolCatalog` still wants it.
- Add a `PHASE_ASK` record: one sentence per phase naming what the step wants and
  the label of the action that ends it. This is the content behind change 4, and
  it belongs beside the labels so the two cannot disagree.

**File**: `app/lib/mapKinds.test.ts` — the existing test asserts the six-phase list
literally; update it, and add cases for the alias resolving to `map` and for an
unknown string resolving to null.

### 2. Accept the alias everywhere a phase is read

**Files**: `app/lib/toolCatalog.ts`, `app/lib/mapStore.ts`,
`app/components/SavedMapRow.tsx`, `app/lib/exchangeRail.ts`, and the map route at
`app/map/[id]/page.tsx` (the citation checker cannot glob a dynamic segment, so it
reports that path as unresolved — it exists and was read while planning)

- `app/lib/toolCatalog.ts:182` — `set_phase`'s `z.enum(PHASES)` widens to accept
  `deconstruct` as well, with a schema description saying it is treated as `map`.
  The contract widens rather than breaking.
- `app/lib/mapStore.ts:86` — a new map starts in `'map'` rather than
  `'deconstruct'`.
- The map route's `isPhase(map.phase) ? map.phase : 'deconstruct'` becomes the
  alias resolver with a `'map'` default.
- `app/components/SavedMapRow.tsx:21` and `app/lib/exchangeRail.ts:83` both index
  `PHASE_LABELS` after an `isPhase` check; route both through the resolver so a
  stored `"deconstruct"` renders as `Map` rather than falling through to the raw
  string.

### 3. The scenario and fixture corpus

**Files**: the ten `.codeyam/scenarios/*.json` files whose seed carries
`"phase": "deconstruct"`, plus `app/isolated-components/LandingScreen/page.tsx`,
`app/isolated-components/SavedMapList/page.tsx` and
`app/isolated-components/SavedMapRow/page.tsx`

Update the seeded phase to `"map"` — these are fixtures, and they should
demonstrate the vocabulary the product uses. Leave exactly one seeded with
`"deconstruct"`: a new `legacy-phase-on-a-saved-map` component scenario on
`SavedMapRow`, so the alias path is demonstrated rather than only unit-tested.

### 4. The row footer: what to do when the round is done

**New file**: `app/components/RowFooter.tsx`

Rendered under the newest row, and only there. It shows one of:

- **Still answering** — `2 of 3 answered`, updating live as cards are filled. No
  button; the cards are the action.
- **Round complete, more expected** — nothing but the shimmer below (change 5).
- **Round complete, phase's work done** — the `PHASE_ASK` sentence and the phase's
  action button: **Ready to research →** at the end of `map`, **Explore a
  direction →** at the end of `research`, **Draw up the plan →** at the end of
  `explore`. `next-steps` has no button — `KeepThinkingPanel` is already the
  action on that screen, and `idea` never renders here.

The button handler does two things in one go: `contribute('user.note', …)` with a
sentence naming the transition, and `set_phase` through the tools route. When
`status === 'unavailable'` it renders a muted line beneath saying the note is
waiting in the log for whenever an agent next reads it — reuse the wording of
`AskPresenceNote` rather than inventing a second phrasing for the same honest
thing.

### 5. The next row reaches for itself

**New file**: `app/components/PendingRow.tsx`

Two or three placeholder cards at the card's exact dimensions, carrying a soft
shimmer — a slow background-position sweep, defined as a keyframe in
`app/globals.css` beside `node-in` and covered by the same
`prefers-reduced-motion` guard, which for this animation means a static resting
state rather than a pulse.

It mounts when the newest round has no open questions and the phase is not
`next-steps`, and unmounts the moment a new round arrives — which the poll already
delivers within 1500ms.

**New file**: `app/lib/pendingRow.ts` — the pure decision: given the rounds, the
open-question counts, the bridge status and how long the wait has run, return
`'hidden' | 'waiting' | 'settled'` plus, for `settled`, which of the three honest
sentences applies. Kept out of the component so the three-way honesty rule is
unit-tested rather than tangled in JSX, in the manner of `askPresence.ts`, which
already does exactly this job for the ask composer.

**File**: `app/components/MapWorkspace.tsx` — render the pending row and the row
footer beneath the rows, and scroll the newest row into view when the round rises,
so the map visibly moves down as it grows. Guard `scrollIntoView` for jsdom, and
skip the scroll when the person has scrolled up to read an earlier round — moving
the page under someone who is reading is worse than not moving it.

### 6. Say that something arrived

Edit the card component the prerequisite card-map plan introduces at
`app/components/MapCard.tsx` — it does not exist in the tree yet, which is why
this plan declares that dependency.

A card whose node status is `updated` already gets the lime treatment from
`nodeShellClasses`; give a newly arrived card the existing `.node-in` entry
animation so a round lands rather than appears. That is the same event class the
animation was written for.

Also edit the map route at `app/map/[id]/page.tsx` — set the document title to
carry `(N)` while questions are open, so a page sitting in the other half of the
screen says there is something waiting from the tab strip alone.

### 7. Say what the loop is now

**File**: `README.md`

The loop table lists six phases with `02 Deconstruct` and `03 Map` as separate
rows; merge them and renumber. Add a paragraph to the WebMCP contract section
stating that the page now advances its own phase and posts a note when it does,
and that the pending-row indicator is a statement about the log rather than about
the agent — that distinction is the whole point of the pull-only contract the
section is about.

## Reused existing code

- `useExchangeLog` from `app/hooks/useExchangeLog.ts` (glossary entry:
  `useExchangeLog`) — the poll, the revision cursor, the dedupe-by-revision
  `absorb`, and the router refresh that re-renders the server-rendered map are all
  already correct and unchanged. A new round appearing is a case it already
  handles.
- `askPresence` from `app/lib/askPresence.ts` (glossary entry: `askPresence`) —
  the existing pure module that decides what to honestly say about agent presence
  when the person acts. The pending-row decision is modelled on it and should
  reuse its vocabulary; it is the single closest precedent in the codebase.
- `AskPresenceNote` from `app/components/AskPresenceNote.tsx` (glossary entry:
  `AskPresenceNote`) — already renders the honest line for a question posted with
  no agent attached, in two registered scenarios. The row footer reuses its
  wording and shape.
- `contribute('user.note', …)` and the bridge's status field in
  `app/components/WebMcpBridge.tsx` (glossary entry: `useWebMcpBridge`) — the
  existing path for putting a sentence on the log, and the existing source of
  truth for whether anyone can hear it.
- `PHASES` / `PHASE_LABELS` / `isPhase` from `app/lib/mapKinds.ts` (glossary
  entries: `PHASES`, `PHASE_LABELS`, `isPhase`) — the controlled vocabulary the
  tool schema also imports, so widening it in one place widens it everywhere.
- `.node-in` and its `prefers-reduced-motion` guard in `app/globals.css` — the
  existing entry animation and the established pattern for how motion is handled;
  the shimmer keyframe joins it rather than defining its own approach.
- `KeepThinkingPanel` from `app/components/KeepThinkingPanel.tsx` (glossary entry:
  `KeepThinkingPanel`) — already the "the plan is a starting point, not a dead end"
  action on the summary screen, which is why `next-steps` needs no button.
- `PhaseNav` from `app/components/PhaseNav.tsx` (glossary entry: `PhaseNav`) — it
  renders whatever `PHASES` holds, so dropping to five needs no change to it
  beyond what the half-screen chrome plan already does.
- **Existing-implementation survey (phase advancement).** Grepped `app/` for any
  page-side phase transition: there is none. `set_phase` exists only as an agent
  tool (`app/lib/toolCatalog.ts:182`) and a phase-set event kind appears in the
  log; nothing in the UI calls it. The row footer is the first page-side caller
  (new file), not a duplicate of one.
- **Existing-implementation survey (loading / skeleton states).** Grepped `app/`
  for any skeleton, shimmer, spinner or pending-placeholder component: there is
  none. Busy states today are a disabled input and a changed label
  (`BriefDropTarget`'s "Reading it…", and the disabled-while-sending input in
  `ContributionBar`). The pending row
  is genuinely new, and its keyframe is the second animation in the stylesheet.
- **Existing-implementation survey (notification).** No badge, toast, or
  title-count mechanism exists. `notifyExchangeUpdated` in `app/lib/webmcp.ts`
  exists but is a documented no-op on every browser shipping today, and it
  notifies *agents* rather than people — it is not the seam for this.

## Scenarios to Demonstrate

- **A round part-answered** — `2 of 3 answered` in the footer, no shimmer, no
  button.
- **A round just completed, waiting** — the shimmering placeholder row beneath,
  the column scrolled to it.
- **The wait settled, agent attached** — placeholders resolved into the honest
  sentence, still answerable above.
- **The wait settled, no agent attached** — the third sentence: the answers are
  waiting in the log. This is the state most at risk of being quietly dishonest.
- **End of `02 Map`** — the **Ready to research →** button in the row footer.
- **End of `02 Map` with no agent attached** — the same button plus the muted
  line saying the note waits.
- **A new round arriving while you watch** — cards enter with the existing
  animation and the shimmer disappears.
- **An older unanswered question, three rounds up** — still answerable, and not
  blocking the newest row's completion.
- **A saved map still stored as `deconstruct`** — the `SavedMapRow` legacy
  scenario, rendering `02 Map`.
- **`05 Next steps`** — no footer button; `KeepThinkingPanel` is still the action.
- **`prefers-reduced-motion`** — the pending row resting rather than shimmering,
  and cards arriving without the entry animation.
- **Scrolled up to read round one while round four arrives** — the page does not
  yank the reader down.