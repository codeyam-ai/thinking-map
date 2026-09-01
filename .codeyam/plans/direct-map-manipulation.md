---
title: "Direct Map Manipulation"
mode: ui
createdAt: "2026-09-01T12:32:39Z"
source: manual
---

## Summary

Make the map directly manipulable: zoom and pan it, nudge a node where you want
it, and collapse a branch you are done with. Today the map plane is entirely
automatic — `useFitToFrame` scales it to fit down to a legibility floor and
centres the scroll, and the person has no say in any of it. That was the right
first answer, and the sprawling scenario proved its limit: past the floor the
map scrolls, and a 3820px-wide tree becomes something you pan blindly rather
than read. Collapse is the real fix for that, zoom is the fix for wanting a
closer look, and a nudge is the fix for the one node the tidy tree puts
somewhere unhelpful. All three are listed as nice-to-have in the project scope
doc and were held out of the three-day build.

## Key Decisions

- **Manual viewport takes over from auto-fit, and does not fight it.** Auto-fit
  becomes the *initial* state rather than a standing invariant. `useFitToFrame`
  currently re-fits on every `ResizeObserver` tick, which would stamp on a
  person's zoom the moment the window moved. Once the viewport is touched it
  stays where it was put; an explicit "fit to map" control puts it back. The
  existing centre-the-scroll layout effect stays, but only on the initial fit.
- **A drag is a nudge, not a coordinate.** The dragged position persists as an
  *offset* from the node's computed tidy position, not as an absolute x/y. This
  keeps the tidy tree authoritative: siblings still never overlap by default,
  parents still centre over children, and a node an agent adds tomorrow still
  places itself sensibly instead of landing on top of something the person
  moved last week. It also means the offsets degrade gracefully — drop them and
  the map is exactly what it is today.
- **Offsets persist on the node, but stay out of the agent's view of the map.**
  They go in the database so an arrangement survives a refresh and is the same
  for every viewer. They do NOT go into `read_map`'s rendering: `formatMapDetail`
  and `summarizeMap` describe the *thinking*, and pixel offsets are arrangement,
  not thinking. Feeding an agent coordinates it cannot act on is noise in a
  context window that is better spent on the map's content.
- **Moving a node is not an exchange event.** Every other change to the map
  becomes an ordered `MapEvent`, and this deliberately does not. The activity
  rail is the record of what the two sides *thought*; "moved a node 40px left"
  would bury that under furniture-rearranging. The honest cost is that a move
  does not bump `revision`, so a second viewer sees it on next load rather than
  immediately — acceptable for a tool that is one person and their agent, and
  called out here so it is a decision rather than a surprise.
- **Collapse is per-viewer and unpersisted.** It is a reading posture, not a
  property of the map — two people can reasonably want different branches folded
  at the same moment, and an agent has no business seeing a subtree disappear.
  It lives in component state.
- **Collapse works by filtering the layout input, not by hiding rendered nodes.**
  A collapsed subtree is removed from the array handed to `layoutMap`, so the
  remaining tree genuinely re-tidies and gets narrower — which is what lets
  `useFitToFrame` scale it back up above the legibility floor. Hiding nodes
  after layout would leave the holes and keep the map just as wide, delivering
  none of the benefit.
- **A pointer threshold separates a click from a drag.** The pill needs to carry
  both, and the follow-on plan adds click-to-ask on the same element. Movement
  under a few pixels before pointerup is a click; beyond it is a drag. Settling
  this here means the next plan does not have to rewrite the pill's pointer
  handling.

## Implementation

### 1. Store a per-node arrangement offset

**File**: `prisma/schema.prisma`

Add `offsetX Float @default(0)` and `offsetY Float @default(0)` to `MapNode`,
with a comment saying what the earlier decision established: these are a nudge
away from the computed tidy position, not a position, and they are deliberately
absent from the agent's rendering of the map. Defaulting to `0` rather than
making them nullable means every existing row is already valid and `db push`
needs no backfill.

### 2. Apply offsets in the layout, and grow the bounds to match

**File**: `app/lib/mapLayout.ts`

`FlatNode` gains optional `offsetX` / `offsetY` (optional for the same reason
`origin` is: a caller that only wants geometry should not have to carry them).
After the existing tidy placement pass, add each node's offset to its `x`/`y`.
The bounds computation must run *after* offsets are applied, or a node nudged
right of the widest column gets clipped out of the scroll extent. Everything
before that — depth, subtree widths, sibling ordering, parent centring — is
untouched, so the existing invariants and their tests still hold.

### 3. Filter collapsed subtrees before layout

**New file**: `app/lib/collapse.ts`

A pure `visibleNodes(nodes, collapsedIds)` that drops every descendant of a
collapsed node while keeping the collapsed node itself, plus a
`collapsedDescendantCount(nodes, id)` so a folded pill can say how much is
underneath it. Pure and separate from the layout so it is unit-testable without
a DOM, in the same spirit as `mapCaption` and `nodeShellClasses`.

### 4. Give the viewport to the person

**New file**: `app/hooks/useMapViewport.ts`

Owns `scale` and pan offset, seeded from the initial auto-fit and thereafter
under the person's control: wheel and trackpad pinch to zoom about the pointer,
drag on empty canvas to pan, and a `fitToMap()` reset. Tracks whether the
viewport has been touched, which is the flag `useFitToFrame` needs to stop
re-fitting.

**File**: `app/hooks/useFitToFrame.ts`

Becomes initial-fit-only: keep the `MIN_SCALE` floor and the centre-the-scroll
layout effect, but stop re-fitting once the viewport is user-controlled. Do not
delete the floor — it is still the right initial scale, and the `sprawling`
scenario depends on it.

### 5. Wire the plane and add zoom controls

**File**: `app/components/ThinkingMapView.tsx`

Drive the existing scaled plane from the viewport hook instead of directly from
`useFitToFrame`, filter `nodes` through `visibleNodes` before `layoutMap`, and
add a small control cluster — zoom in, zoom out, fit to map — plus a live
percentage. Keep the `min-w-0` comment and the `marginInline` centring rule
intact; both are load-bearing and were each a real bug once.

### 6. Make the pill draggable and foldable

**File**: `app/components/MapNodePill.tsx`

Pointer handlers implementing the drag threshold, reporting a committed drag
upward as an offset delta. A node with children gains a fold affordance showing
the hidden count when collapsed. The pill is currently a pure presentational
component and should stay one: it takes `onNudge` / `onToggleCollapse`
callbacks rather than reaching for a store.

### 7. Persist a nudge

**New file**: `app/api/maps/[id]/positions/route.ts`

A `PATCH` taking `{ nodeId, offsetX, offsetY }` (batched as an array, since a
drag can settle several nodes at once) and writing straight to `MapNode`. It
deliberately does not go through `recordEvents` — see the Key Decision above.
It must still verify the node belongs to the map in the route, the same check
`app/api/maps/[id]/exchange/route.ts` already performs.

## Reused existing code

- `layoutMap` and `connectorPath` from `app/lib/mapLayout.ts` (glossary entries:
  `layoutMap`, `connectorPath`) — offsets are applied inside the existing
  placement pass rather than in a parallel layout path.
- `measureWidth` from `app/lib/mapLayout.ts` (glossary entry: `measureWidth`) —
  unchanged; node sizing is independent of arrangement.
- `useFitToFrame` from `app/hooks/useFitToFrame.ts` and its `MIN_SCALE` floor —
  narrowed to initial fit rather than replaced.
- `MapNodePill` and `MapConnectors` from `app/components/` (glossary entries:
  `MapNodePill`, `MapConnectors`) — both already consume `LaidOutNode`
  coordinates, so both pick up offsets with no change to their own geometry.
- `nodeShellClasses` from `app/lib/nodeAppearance.ts` (glossary entry:
  `nodeShellClasses`) — the fold affordance must not disturb the
  status-precedence rule this owns.
- `ThinkingMapView` from `app/components/ThinkingMapView.tsx` (glossary entry:
  `ThinkingMapView`).

**Existing-implementation survey.** `MapNode` has no position, coordinate, or
layout column today — checked against `prisma/schema.prisma`, whose `MapNode`
carries only `kind`, `label`, `detail`, `status`, `sourceUrl`, `order` and
`origin`. There is no existing viewport, zoom, or collapse state anywhere in the
app: `useFitToFrame` is the only thing that computes a scale, and grepping
`app/` for the browser storage APIs (local storage and session storage) returns
nothing, so there is no per-viewer persistence convention this should follow. `order` is sibling
sequence, not position, and is not a candidate for reuse here.

## Scenarios to Demonstrate

- Default view — a researched map at its initial auto-fit, unchanged from today
- Zoomed in — the viewport at ~150%, proving the person's scale survives
- A nudged node — one node visibly offset from its tidy position, with the
  connector still meeting it correctly
- A collapsed branch — a folded parent showing its hidden-descendant count
- Collapse rescues the sprawling map — the 21-node map that today scrolls past
  the legibility floor, folded down until it fits and is readable
- Empty map — the day-one state, where there is nothing to zoom, drag or fold
  and the controls must not imply otherwise