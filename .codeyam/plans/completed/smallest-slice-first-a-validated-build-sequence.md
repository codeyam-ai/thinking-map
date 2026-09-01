---
title: "Smallest Slice First - a Validated Build Sequence"
mode: ui
createdAt: "2026-09-01T13:15:06Z"
source: manual
---

## Summary

The loop currently ends at five next steps: `NextStepsTrack` renders the
`next-step` nodes in order, first one unboxed because it is where you start
tomorrow. That is the right ending for a vague idea. It is the wrong ending for
a client who has just had a large brief taken apart, because a numbered list of
steps is indistinguishable from a plan to build the whole thing in order — which
is exactly the failure mode this product exists to prevent. What that client
needs is a build sequence: the smallest thing worth building first, what it
would prove, and what changes if it proves the opposite. This adds a `slice`
node kind that carries the node it would settle, a pure function that resolves
the sequence, and a build-sequence region on the summary screen where a slice
that tests nothing is visibly marked as such rather than sitting there looking
like progress.

## Key Decisions

- **A slice must name what it would settle, and the UI says so when it does
  not.** This is the whole opinion of the feature. An increment that tests no
  assumption is not a validating slice, it is just work scheduled early — so a
  slice with no linked node renders as "proves nothing yet" instead of blending
  into the sequence. Making the omission visible is what stops the sequence
  degenerating into a Gantt chart with rounded corners.
- **The link is an explicit column, not the tree.** A slice could have been made
  a child of the assumption it tests, reusing `parentId` and adding no schema —
  but `MapNode.parentId` is the map's only edge, and hijacking it would drag
  every tested assumption out of where it belongs in the tree and into a
  branch under the plan. `testsNodeId` says one thing and changes nothing about
  how the map draws.
- **No seventh phase.** `PHASES` is a closed six-value vocabulary rendered as a
  fixed nav, and `next-steps` already means "where to start". The build sequence
  joins that screen rather than adding an `07` nobody asked for. Smaller change,
  and it keeps the two outputs — what to find out, what to build — on one page
  where a client compares them.
- **Slices sit beside the next steps, not instead of them.** They answer
  different questions: a next step can be "interview three teachers", which is
  not something you build. Replacing one with the other would lose the research
  half of the plan.
- **Size is stated by the agent, in its own words, and not validated.** A slice
  carries a rough effort note ("about two days") in `detail`. Any attempt to
  make that a structured, checkable field would be inventing precision the agent
  does not have; a sentence a human can argue with is more honest than a number
  that looks computed.
- **Ordering is `order`, which already exists.** `groupSummaryNodes` sorts every
  bucket by `order` precisely because the steps are numbered on screen, and a
  build sequence is the same requirement with higher stakes.

## Implementation

### 1. The slice kind

**File**: `app/lib/mapKinds.ts`

Add `slice` to `NODE_KINDS` and an eyebrow to `KIND_EYEBROW`. Because the tool
schema builds its enum from `NODE_KINDS`, this is what makes the kind emittable
by an agent on all three doors at once — and the guard in `isNodeKind` is what
keeps a typo out of the map. Consider whether it earns an `ACCENT_KINDS` entry;
a slice is the thing you act on, so it likely wants a treatment of its own
rather than the neutral one.

### 2. What the slice would settle

**File**: `prisma/schema.prisma`

`MapNode` gains `testsNodeId String?` — the id of the assumption, risk, or open
question this slice would settle. Optional, so no backfill and no default. Not a
Prisma relation: a self-relation on `MapNode` would collide with the existing
`NodeChildren` relation's semantics and make the tree harder to read for a
pointer that is deliberately not an edge on the map. Resolve it in code, and
tolerate a dangling id — the node it names may have been deleted.

**File**: `app/lib/toolCatalog.ts`

Add `tests` to `nodeShape`, described so the contract is unambiguous: name the
node this slice would settle, and if it settles nothing, say so by leaving it
off rather than picking the nearest node. Extend `update_node` too — a slice's
purpose usually sharpens after the sequence is laid out.

**File**: `app/lib/nodePlan.ts`

`PlannedInsert` gains `testsNodeId`, read in the `add_nodes` branch exactly as
`sourceUrl` is. Because a slice may name a node created earlier in the same
call, this value has to go through the same ref-resolution `parentRef` gets.

**File**: `app/lib/mapStore.ts`

`applyToolCalls` resolves a `tests` ref through `refToId` alongside `parentRef`,
writes the column, and includes it in the `node.added` payload so the log
carries the link.

### 3. Resolve the sequence

**New file**: `app/lib/buildSequence.ts`

Pure: nodes in, an ordered slice list out, each entry carrying the slice, the
resolved node it tests (label and kind), and a `provesNothing` flag when the
link is absent or dangling. No database, no React — the same split
`summaryGroups` and `mapLayout` already use. Worth testing: slices ordered by
`order` rather than insertion, a slice testing a node that no longer exists, a
slice with no link at all, and a map with no slices (returns `[]`).

### 4. The build sequence on the summary screen

**New file**: `app/components/BuildSequence.tsx`

The region: slices in order, each showing what it builds, what it would prove,
and its stated effort. A `provesNothing` slice is marked, not hidden — the
client should see the gap and ask about it. Empty state is a hint in the voice
`EmptyHint` already uses, not a blank box.

**New file**: `app/components/SliceCard.tsx`

One slice — its own component so each state gets an isolated scenario, following
the `BulletCard` / `DirectionsCard` split.

**File**: `app/lib/summaryGroups.ts`

`SummaryGroups` gains `slices`, picked and sorted by the existing `pick` helper.
`SummaryNode` gains the fields the card needs — `testsNodeId` at minimum — and
the resolution against the full node list happens in `buildSequence`, not here;
this module's job is selection.

**File**: `app/components/SummaryView.tsx`

Mount `BuildSequence` above `NextStepsTrack`: what you build first comes before
what you go and find out. Composition only, as its comment already promises.

### 5. Steer the agent toward slicing

**File**: `app/lib/toolRuntime.ts`

When the phase moves to `next-steps`, the tool's reply should say what a good
ending looks like on this map — smallest buildable increment first, each naming
what it settles. The tool replies are this app's only channel for steering an
agent that brings its own reasoning, and they are already written that way.

**File**: `app/lib/agentDemo.ts`

Extend `DEMO_SEQUENCE` with a step that adds a slice linked to the assumption it
tests, so the path is exercisable in a preview where WebMCP cannot bind.

**Note for execution.** Sections 2's edits to `prisma/schema.prisma`,
`app/lib/toolCatalog.ts`, `app/lib/nodePlan.ts` and `app/lib/mapStore.ts` touch
the same four files as the brief-coverage plan's own optional-field passthrough.
They are independent fields with no shared logic, but whichever plan lands
second will rebase over the first's edit rather than applying cleanly.

## Reused existing code

- `groupSummaryNodes`, `SummaryGroups`, `SummaryNode` from
  `app/lib/summaryGroups.ts` (glossary entry: `groupSummaryNodes`) — the
  select-and-sort-by-order helper the slices bucket joins.
- `SummaryView` from `app/components/SummaryView.tsx` (glossary entry:
  `SummaryView`) — composition-only, which is exactly what the new region needs
  from it.
- `NextStepsTrack`, `BulletCard`, `DirectionsCard`, `EmptyHint` from
  `app/components/` (glossary entries: `NextStepsTrack`, `BulletCard`,
  `DirectionsCard`, `EmptyHint`) — the card vocabulary and empty-state voice the
  sequence should match rather than invent.
- `NODE_KINDS`, `KIND_EYEBROW`, `ACCENT_KINDS`, `isNodeKind` from
  `app/lib/mapKinds.ts` (glossary entry: `isNodeKind`) — the closed vocabulary
  the tool enum is built from, which is why one entry here reaches all three
  doors.
- `planMapMutations` and `PlannedInsert` from `app/lib/nodePlan.ts` (glossary
  entry: `planMapMutations`) — `sourceUrl` for the optional passthrough and
  `parentRef` for the ref resolution the new link needs.
- `applyToolCalls` from `app/lib/mapStore.ts` (glossary entry: `applyToolCalls`)
  — the `refToId` map that turns a same-call ref into a real id.
- `layoutMap` from `app/lib/mapLayout.ts` (glossary entry: `layoutMap`) — no
  change needed; a slice is a node and lays out like every other one.
- `DEMO_SEQUENCE` from `app/lib/agentDemo.ts` (glossary entry: `DEMO_SEQUENCE`).

**Existing-implementation survey.** There is no build-sequencing concept in the
tree. `NODE_KINDS` holds seventeen kinds — idea, user, problem, goal,
constraint, assumption, open-question, research, finding, gap, approach, pro,
risk, known, unknown, direction, next-step — and `next-step` is the closest; it
is an undifferentiated action with no notion of what it would validate, and
overloading it would mean the existing five-step track and the build sequence
render the same rows twice. No node-to-node reference field exists at all:
`parentId` is the tree, `sourceUrl` is an external web URL, and nothing else on
`MapNode` points at another node. A grep for "slice" across `app/` finds only
array-slice calls and one comment about a visible subset. Nothing
computes an ordered plan beyond `groupSummaryNodes` sorting by `order`.

## Scenarios to Demonstrate

- A validated sequence — three slices in order, each naming the assumption it
  settles, the first one clearly the smallest
- A slice that proves nothing — marked in place beside validated ones, which is
  the state the feature exists to make visible
- A dangling link — a slice testing a node that has since been deleted, reported
  rather than rendered as a blank
- A single first slice — the day-one plan, one increment and nothing after it
- No slices yet — the summary screen with next steps but an empty sequence,
  showing the hint rather than a blank region
- The existing summary untouched — a map that ended in next steps with no
  slices, looking as it does today