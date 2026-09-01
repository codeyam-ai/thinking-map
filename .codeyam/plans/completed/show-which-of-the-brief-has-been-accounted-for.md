---
title: "Show Which of the Brief Has Been Accounted For"
mode: ui
createdAt: "2026-09-01T13:13:59Z"
source: manual
dependsOn: ["start-a-map-from-a-client-brief"]
---

## Summary

A client who hands over a twenty-page spec wants one thing before they will
trust anything you say about it: evidence you read all of it. Once a brief is on
a map, the agent's nodes are assertions about a document — "your real user is a
teacher, not a student", "this deadline is an assumption, not a constraint" —
and right now a node arrives with no way back to the passage that produced it.
The client has to take twenty pills on faith and has no way to see which three
pages nobody has touched. This gives every node an optional reference to the
brief section it came from, renders that reference on the pill, and adds a brief
panel beside the map that marks each section as accounted-for or untouched. The
untouched half is the more valuable one: it is the difference between "the agent
read your brief" and "the agent read pages 1–4 and inferred the rest".

## Key Decisions

- **A section reference, not a quotation.** The node stores `s7`, and the panel
  resolves it against the sections derived from the immutable brief text. Storing
  the quoted passage instead would duplicate the document into the node table and
  invite the two copies to disagree; the reference cannot drift because the text
  it points into cannot change.
- **Provenance is optional and always will be.** A node the person typed, or one
  the agent inferred across the whole document, genuinely has no single source
  section — and forcing one would produce fabricated citations, which is worse
  than none. An unreferenced node renders exactly as it does today.
- **Coverage is counted, not asserted by the agent.** The panel derives its
  numbers from the nodes that actually cite each section. An agent cannot mark a
  section "covered"; it can only produce nodes that cite it. That makes the
  untouched list something the agent cannot talk its way out of, which is the
  only reason it is worth showing to a client.
- **Untouched is a prompt, not a scold.** A section with no nodes gets an
  affordance that writes a note naming it into the exchange log — the existing
  `user.note` path — so "you haven't dealt with §12" reaches the agent on its
  next turn through machinery that already exists, rather than a new channel.
- **The panel is a third pane, not a takeover.** `MapWorkspace` is currently the
  map plus the exchange column; the brief becomes a collapsible pane on the
  other side, absent entirely when the map has no brief. A map started from one
  line must look exactly as it does today.
- **`read_brief`'s outline reports coverage too.** The agent should be able to
  see which sections it has already accounted for without re-reading them —
  otherwise the panel tells the person something the agent cannot see, and the
  two halves of the exchange disagree about the same document.

## Implementation

### 1. The reference on the node

**File**: `prisma/schema.prisma`

`MapNode` gains `sourceRef String?` — the brief section id this node came from.
Optional, so no backfill and no default (per `DATABASE.md`). Comment it beside
`sourceUrl`, which is the deliberate contrast worth writing down: `sourceUrl`
points out of the map at the web, `sourceRef` points into the client's own
document.

### 2. Carry it through the write path

**File**: `app/lib/toolCatalog.ts`

Add `sourceRef` to `nodeShape`, described so the agent knows the contract: cite
the section a claim actually came from, and leave it off rather than guessing.

**File**: `app/lib/nodePlan.ts`

`PlannedInsert` gains `sourceRef`, and `planMapMutations` reads it in the
`add_nodes` branch the same way it reads `sourceUrl` — dropped when absent. It
should also be settable via `update_node`, since an agent often only works out
where a claim came from on a later pass.

**File**: `app/lib/mapStore.ts`

`applyToolCalls` writes `sourceRef` on insert and includes it in the
`node.added` event payload, so a second front door reading the log learns the
provenance rather than only seeing it in the database.

### 3. Compute coverage

**New file**: `app/lib/briefCoverage.ts`

Pure: sections plus nodes in, per-section counts out —
`{ id, heading, charCount, nodeCount, nodes }[]` plus an `untouched` list and a
covered/total headline. No database, no React. Worth testing: a node citing a
section id that does not exist (counted nowhere, and reported as a dangling
reference rather than silently dropped), a brief with no cited sections at all,
and a map with no brief.

### 4. The brief panel

**New file**: `app/components/BriefPanel.tsx`

The document beside the map: source name, the covered/total headline, and the
section list with each section's node count. Untouched sections are visibly
distinct and carry the "ask about this section" affordance, which calls
`bridge.contribute('user.note', …)` with the section named. Collapsible, and
mounted only when the map has a brief.

**New file**: `app/components/BriefSectionRow.tsx`

One section row — heading, character count, node count or the untouched marker,
and the ask affordance. Its own component so it gets an isolated scenario per
state, matching how `SavedMapRow` and `OpenQuestionRow` are split out.

**File**: `app/components/MapWorkspace.tsx`

Take optional brief coverage and mount `BriefPanel` to the left of
`ThinkingMapView`. Optional the whole way down, as `mapId` already is, so an
isolated scenario mounts the map without inventing a brief.

**File**: `app/map/[id]/page.tsx`

Fetch the brief and its sections server-side, compute coverage, and pass it to
`MapScreen`. This is where the pieces meet; keep the route to fetching and
mounting, as it does now.

**File**: `app/components/MapScreen.tsx`

Thread the coverage through to `MapWorkspace`. The summary branch does not take
it — the plan view has no map to annotate.

### 5. The reference on the pill

**File**: `app/components/MapNodePill.tsx`

When `node.sourceRef` is set, the eyebrow carries a small section marker beside
the kind and the `· yours` badge, and the pill's `title` names the section. This
follows the badge precedent exactly: a fact already stored on the node, shown
where the node already narrates itself.

**File**: `app/lib/mapLayout.ts`

`FlatNode` gains optional `sourceRef`, alongside `origin` and the offsets, which
are optional for the same stated reason — a caller that only wants geometry
should not have to carry it.

### 6. Let the agent see its own coverage

**File**: `app/lib/toolRuntime.ts`

The outline the brief-reading tool returns gains a node count per section and a
closing line naming the sections nothing cites yet. An agent that has been
working for twenty turns should be able to ask "what have I not dealt with?" and
get an answer, rather than re-reading the whole document to find out.

## Reused existing code

- `MapNodePill` from `app/components/MapNodePill.tsx` (glossary entry:
  `MapNodePill`) — the eyebrow already renders kind, `just updated`, and the
  `yours` badge; the section marker is the fourth thing in that same line.
- `planMapMutations` and `PlannedInsert` from `app/lib/nodePlan.ts` (glossary
  entry: `planMapMutations`) — `sourceUrl` is the exact precedent for an
  optional passthrough field, including how it is dropped when absent.
- `applyToolCalls` from `app/lib/mapStore.ts` (glossary entry: `applyToolCalls`)
  — the insert-and-log path, unchanged apart from one more column and one more
  payload field.
- `nodeShape` in `app/lib/toolCatalog.ts` — the one schema every door validates
  a node against.
- `MapWorkspace` and `ThinkingMapView` from `app/components/` (glossary entries:
  `MapWorkspace`, `ThinkingMapView`) — the pane arrangement the panel joins.
- `useWebMcpBridge` and `contribute` from `app/components/WebMcpBridge.tsx`
  (glossary entry: `WebMcpBridge`) — the untouched-section prompt rides the
  existing user-note contribution path, so it wakes a waiting agent with no new
  mechanism.
- `FlatNode` from `app/lib/mapLayout.ts` — the optional-field convention this
  follows.
- `SavedMapRow` and `OpenQuestionRow` from `app/components/` (glossary entries:
  `SavedMapRow`, `OpenQuestionRow`) — the row-component split this copies.

**Existing-implementation survey.** No provenance field of any kind exists on
`MapNode` today. Its columns are `parentId`, `kind`, `label`, `detail`,
`status`, `sourceUrl`, `order`, `origin`, `offsetX`, `offsetY`. `sourceUrl` is
the only reference-shaped one and is documented as "where a research finding
came from" — an external web URL hung off a `finding`, not a pointer into the
client's document; overloading it would make the same column mean two
incompatible things and break the research card's link rendering. `origin`
records which *side* wrote a node, never what it was derived from. Nothing
computes coverage of anything, and there is no third pane in `MapWorkspace`.

## Scenarios to Demonstrate

- Mid-deconstruction — a brief roughly half covered, the panel showing counts
  beside the sections that have nodes and the untouched ones marked
- Fully accounted for — every section cited, the headline saying so; the state a
  client is actually being shown before they approve anything
- Nothing cited yet — a brief just attached, the panel entirely untouched, which
  is the honest day-one picture rather than an empty component
- A pill carrying its section marker beside the kind eyebrow and the `yours`
  badge, next to a pill with no reference at all
- A dangling reference — a node citing a section id the brief does not have,
  reported rather than silently dropped
- A map with no brief — the workspace exactly as it is today, no third pane