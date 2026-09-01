---
title: "The Map Builds Downward"
mode: ui
createdAt: "2026-09-01T17:26:38Z"
source: manual
---

## Summary

Replace the map. Today it is a tidy tree of small pills on a zoomable plane,
sitting in the left column of a two-column workspace, with every question the
agent has asked collected into a separate panel on the right — so the thing you
are answering and the thing your answer builds are two different surfaces you look
at in turn. At half-screen width this is worse than untidy: the map frame is
narrower than one root pill, and the pills run off its edge mid-sentence.

Make the map a single column of **stage rows built out of cards**, growing
downward. Each round of questions the agent asks is one row. Each question is a
card, and the card holds the question, a few suggested answers, and the input you
answer it in — so you answer inside the map rather than beside it. Once answered,
the answer takes the card's body and stays editable. The next round appears as the
next row down. There is no second column, no zoom, no pan: the map is a page you
scroll.

### The card language

![Staggered rows of tall rounded cards — a counter top-left, an icon top-right, a bold title, body copy, and one lime card carrying the emphasis](assets/the-map-builds-downward/ref-cards.jpg)

That is the shape: tall rounded rectangles, staggered rather than aligned to a
strict grid, a small marker top-left and an icon top-right, a bold short title
over lighter body copy, and fills doing the work — near-white, grey, and one lime
card that is the thing to look at.

## Key Decisions

- **A row is a *round*, not a tree depth.** The obvious mapping — one row per
  `depth` in the existing tree — breaks the moment the agent asks a second batch
  of questions as further children of the root, which is the ordinary case: both
  batches land at depth 1 and collapse into one row. Derive the round from the
  event log instead: nodes added by one `add_nodes` write share a contiguous run
  of revisions, and `app/lib/exchange.ts` is the only place revisions are minted,
  so the grouping is well-founded. One `add_nodes` call is one row. Put the
  derivation in its own pure module so it is unit-tested rather than inferred
  inside a component. If it proves too clever in practice, the fallback is an
  explicit round column on `MapNode` — a schema change this plan deliberately does
  not take yet.
- **The tree stays in the data; only the drawing changes.** `parentId`, `order`,
  `kind`, `status` and the whole tool contract are untouched. No migration, no
  change to what an agent sends. This is a rendering change plus one additive tool
  field, which is what keeps it a plan rather than a rewrite.
- **The answer lives in the event log, not on the node — and that is already
  right.** `resolveAnswered` in `app/lib/contributions.ts` flips a question to
  `answered` and never stores the text; the text is in the `user.answer` event. So
  the card reads its answer back from the log the same way `askedNodeIds` already
  reads which nodes have been asked about. Editing an answer is simply posting
  another `user.answer` — and the existing comment on `resolveAnswered` says a
  second answer is logged without inventing a second change, so the server side
  already anticipates exactly this. No schema change, and edit history is free.
- **Suggested answers need one additive field on the tools.** `ask_user` takes
  `questions: string[]` and `add_nodes`'s node shape has no options — so there is
  nowhere for "who is this for? — *just me* / *a group of friends* / *any
  traveler*" to come from. Add an optional `options: string[]` to both, described
  as *a few likely answers to offer as one-tap chips; the person can always type
  their own*. Optional and additive, so every existing agent keeps working and a
  card with no options is just a card with an input.
- **This retires the plane, and that is the point.** Zoom, pan, fit-to-frame,
  drag-to-nudge, fold-a-branch, the connector layer and the stored position
  offsets all exist to make a large 2D tree navigable. A scrolling column of rows
  needs none of them, and keeping them would be keeping a second map alive
  underneath the first. Retire them in this plan rather than leaving them dead —
  see change 7 for the exact list. The `offsetX` / `offsetY` columns and the
  positions route are left in place but unread, because dropping columns is a
  migration and this plan is deliberately not one.
- **Scrolling is the navigation, so the earlier click-to-zoom idea is dropped.**
  It was the right answer for a 2D plane that outgrew its frame. A column that
  grows downward is navigated by scrolling, and the row you are being asked about
  is scrolled to for you (see the progression plan).
- **One column at every width.** This is what removes the half-screen problem
  rather than accommodating it: cards are `min-w-[220px] max-w-[300px]` and a row
  wraps, so a 760px window shows two cards abreast and a 1440px window shows four.
  Nothing needs a breakpoint to decide which layout it is in.

## Implementation

### 1. Derive the rounds

**New file**: `app/lib/mapRounds.ts`

`groupIntoRounds(nodes: FlatNode[], events: ExchangeEvent[]): Round[]`, where a
`Round` is `{ index: number; nodes: FlatNode[] }`. Walk the log's `node.added` /
`user.node` events in revision order, cut a new round whenever the origin changes
or the revisions are not contiguous, and fall back to grouping by `depth` for any
node the log does not account for (a seeded scenario, a map written before this
shipped). The root idea is always its own first round.

Pure and dependency-free, in the manner of `mapLayout.ts` and `collapse.ts`. Test
it for: an empty map; root only; one batch; two batches at the same depth landing
in two rounds (the case that motivates the whole decision); a user-added node
between two agent batches; and a map with no events at all falling back to depth.

### 2. The card

**New file**: `app/components/MapCard.tsx`

One node, rendered in the reference's language:

- **Top row** — the round marker (`2/3`) on the left, the kind icon on the right.
- **Title** — `node.label`, `text-[15px] font-bold leading-snug`, up to three
  lines.
- **Body** — one of three things: `node.detail` for a statement card; the answer
  affordance for an unanswered question; the recorded answer for an answered one.
- **Shape** — `rounded-[20px]`, `p-5`, `min-h-[240px]`, `flex flex-col`, with the
  body pushed to the bottom the way the reference does. Fill and treatment come
  from the existing status precedence and are the subject of the card-visual plan;
  this plan gives every card the neutral `bg-surface border border-line` and lets
  that plan colour them.

**New file**: `app/components/MapCardAnswer.tsx`

The answer affordance, which is where the product's whole loop now happens:

- Suggested-answer chips from the node's `options`, in the existing
  `SuggestionChips` idiom — clicking one fills the input rather than submitting,
  so the person keeps their own words. That rule is already written down in
  `SuggestionChips` and should not be quietly reversed here.
- A text input with the `SendButton` inside it, exactly as `OpenQuestionRow` has
  today.
- Once answered: the answer as body text with a subtle *Edit* affordance; clicking
  it returns the input pre-filled, and saving posts another `user.answer`.

**New file**: `app/lib/mapAnswers.ts` — `answersByNodeId(events): Map<string, string>`,
taking the latest `user.answer` per question id. Modelled directly on
`askedNodeIds` in `app/lib/exchangeRail.ts`, and unit-tested alongside it: no
answers, one answer, a re-answer overriding the first, an answer for a node that
no longer exists.

### 3. The row

**New file**: `app/components/MapRow.tsx`

A round: an eyebrow naming it (`ROUND 2 · 3 QUESTIONS`, or the phase name for the
round that opened a phase), then the cards in a wrapping, staggered band —
`flex flex-wrap gap-4`, with a repeating vertical offset applied by
`nth-child` so the band steps the way the reference does rather than sitting on a
rule. The stagger is decoration and must not affect reading order or hit targets.

### 4. The map surface

**File**: `app/components/ThinkingMapView.tsx`

Gutted and rebuilt as composition: take `nodes` and the bridge's `events`, call
`groupIntoRounds`, render `MapRow` per round inside a single
`min-h-0 flex-1 overflow-y-auto` column. The `mapId`, `caption` and the `Live map`
eyebrow header survive. Everything about the plane — `layoutMap`, the scale
transform, the absolute plane, `useMapViewport`, the drag state, the collapse
state, the `MapConnectors` layer, `NodeQuestionComposer` anchoring — goes.

Asking about a node stays, and gets simpler: the composer becomes a control on the
card itself rather than a popover positioned in map coordinates.

### 5. Collapse the two columns into one

**File**: `app/components/MapWorkspace.tsx`

No longer a split. It renders the map column and, beneath it, the contribution bar
and the activity rail as two compact disclosures — the two things in the old
exchange column that are not questions, and that no longer have a column to live
in. Its doc comment currently argues that the map gets the frame and the column
beside it is what the page owns; rewrite it, because the answer changed: the page
owns the map *and* the answering, and they are the same surface now.

**File**: `app/components/ExchangeColumn.tsx` — deleted. `OpenQuestions` and
`OpenQuestionRow` are deleted with it: the questions are in the cards.
`ContributionBar` and `ExchangeRail` survive and move into `MapWorkspace`.

### 6. Offer suggested answers through the tools

**File**: `app/lib/toolCatalog.ts`

- `nodeShape` gains `options: z.array(z.string()).optional()`, described as above
  and noted as meaningful only on an `open-question`.
- `ask_user`'s `questions` widens from `z.array(z.string())` to accept either a
  string or `{ text: string; options?: string[] }`, so the simple form keeps
  working verbatim.

**File**: `prisma/schema.prisma` — `MapNode` gains `options String?` holding a JSON
array, in the same manner the schema's own comment describes for enum-less
Strings. This is additive and nullable, so `npm run db:push` covers it.

**Files**: `app/lib/mapStore.ts`, `app/lib/toolRuntime.ts` — carry `options`
through the write path and back out on read. `app/lib/mapLayout.ts`'s `FlatNode`
gains an optional `options` field alongside `origin` and `offsetX`, for the same
stated reason those are optional.

### 7. Retire the plane

**Deleted**: `app/components/MapConnectors.tsx`, `app/components/MapNodePill.tsx`,
`app/components/NodeFoldToggle.tsx`, `app/components/MapViewportControls.tsx`,
`app/hooks/useMapViewport.ts`, `app/hooks/useFitToFrame.ts`,
`app/hooks/useNodeDrag.ts`, `app/lib/collapse.ts`, `app/lib/nodePositions.ts`, and
the tidy-tree half of `app/lib/mapLayout.ts` (`layoutMap`, `connectorPath`,
`measureWidth`, `LaidOutNode` and the geometry constants). `FlatNode` stays — it is
the shape every caller passes around.

Their tests and registry entries go with them
(`app/lib/mapLayout.test.ts`, `app/lib/collapse.test.ts`,
`app/lib/nodePositions.test.ts`, `app/components/MapNodePill.render.test.tsx`, and
the viewport cases in `app/components/ThinkingMapView.render.test.tsx`), as do
their glossary entries and their registered scenarios — use
`codeyam-editor editor delete <slug>` rather than removing the JSON by hand.

`PATCH /api/maps/:id/positions` and the `offsetX` / `offsetY` columns stay but
become unread. Leave a one-line comment on each saying so and naming this plan, so
the next reader knows it is vestigial rather than load-bearing.

**File**: `README.md` — the *Handling the map* section describes zoom, pan, nudge
and fold, and two deliberate limits about folding and moving. All of it is about
a surface that no longer exists. Replace it with how the card map is handled:
scrolling, answering in place, editing an answer. The *Two notes for anyone
picking this up* section and the WebMCP contract section are unaffected.

## Reused existing code

- `FlatNode` from `app/lib/mapLayout.ts` (glossary entry: `FlatNode`) — the shape
  every consumer already passes; it survives the plane's retirement and gains one
  optional field.
- `askedNodeIds` from `app/lib/exchangeRail.ts` (glossary entry: `askedNodeIds`) —
  the working precedent for deriving per-node facts from the event log, which is
  exactly what the new answer lookup does. It also keeps working unchanged.
- `resolveAnswered` in `app/lib/contributions.ts` (glossary entry:
  `contributionEvents`) — already only touches a node that is *genuinely still
  open*, and its doc comment already states that answering twice logs the second
  answer without a second change. Editing an answer needs no server change at all.
- `bridge.answer(answers, questions)` in `app/components/WebMcpBridge.tsx` — takes
  a map of answers and the questions they belong to, writes to the log before
  releasing any parked `ask_user`, and is called identically from a card as from
  the old row.
- `OpenQuestionRow`'s draft/busy/submit logic and its per-question `SendButton`
  label (`app/components/OpenQuestionRow.tsx`) — lifted into the card's answer
  component (change 2, new file) rather than reinvented, including the reason the
  label names the question.
- `SendButton` from `app/components/SendButton.tsx` (glossary entry: `SendButton`)
  — unchanged, in its small size, inside the card's input.
- `SuggestionChips` from `app/components/SuggestionChips.tsx` (glossary entry:
  `SuggestionChips`) — the chip idiom and, more importantly, its rule that a chip
  *fills* the input rather than submitting it.
- `KIND_EYEBROW` and `ACCENT_KINDS` from `app/lib/mapKinds.ts` (glossary entries:
  `KIND_EYEBROW`, `ACCENT_KINDS`) — the card's eyebrow and its icon slot read from
  the same vocabulary the pill did.
- `nodeShellClasses` from `app/lib/nodeAppearance.ts` (glossary entry:
  `nodeShellClasses`) — its status precedence (root, updated, open, accent,
  answered) transfers to card fills intact; the rule is right and only the shapes
  it names change.
- `mapCaption` from `app/lib/mapCaption.ts` (glossary entry: `mapCaption`) — still
  the header line above the column.
- `readSince` / `ExchangeEvent` from `app/lib/exchange.ts` (glossary entries:
  `readSince`, `ExchangeEvent`) — the log is already fetched on the server render
  and polled in the page, so the round and answer derivations need no new data
  fetching whatsoever.
- **Existing-implementation survey (round / batch grouping).** Grepped `app/` for
  any existing grouping of nodes by write, batch, or revision: there is none.
  `app/lib/summaryGroups.ts` groups by `kind` for the summary screen's cards and
  `app/lib/buildSequence.ts` orders slices — neither answers "which nodes arrived
  together". The round grouping in change 1 is genuinely new (new file).
- **Existing-implementation survey (suggested answers on a question).** Grepped
  the tool schemas and the Prisma schema for any options/choices field: none.
  `ask_user` takes bare strings (`app/lib/toolCatalog.ts`) and `nodeShape` has
  `label` / `detail` / `kind` / `status` / `sourceUrl` / `tests` only. `SUGGESTIONS`
  in `app/lib/suggestions.ts` is a fixed landing-page list, not per-question. The
  `options` field is genuinely new, not a duplicate.
- **Existing-implementation survey (card components).** `SliceCard` and
  `BulletCard` exist but are summary-screen list items, not the map's card;
  `SavedMapRow` is a row. None is reusable as the map card, though `SliceCard`'s
  eyebrow-plus-title-plus-detail composition is the closest existing shape and is
  worth reading before writing the card component in change 2.

## Scenarios to Demonstrate

- **Round one, unanswered** — the root idea card, then a row of three question
  cards each with chips and an input. The first thing anyone sees.
- **Round one, partly answered** — one card showing its recorded answer, two still
  asking. The mixed state is the one most likely to look wrong.
- **Editing an answer** — the input returns pre-filled with the previous answer.
- **A question with no options** — just the input, proving the field is genuinely
  optional and an agent that never learned it still produces a usable card.
- **Three rounds deep** — the column scrolled to the third row, the earlier rounds
  readable above it. This is the "the map builds downward" claim.
- **Two batches at the same tree depth** — the case that motivates round-grouping:
  they must be two rows, not one.
- **A map with seeded nodes and no event log** — the depth fallback, so an old map
  or a captured scenario still renders as rows.
- **A user-added node** — still badged *yours*, now on a card.
- **Half screen (760×1000)** — two cards abreast, one column, nothing clipped. The
  direct answer to the original screenshot.
- **Desktop (1440×900)** — four cards abreast, the same layout, no breakpoint.
- **An empty map** — `The map fills in as you answer.` with no rows.
- **The summary phase** — `SummaryScreen` still renders instead of the card map;
  confirm it is untouched by the workspace collapse.