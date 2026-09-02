---
title: "Insights the Agent Keeps Supplying"
mode: backend
createdAt: "2026-09-02T20:52:57Z"
source: manual
---

## Summary

Today the board can show exactly one insight, and only after every row is finished: `GalaxyBoard` picks the last themeless `direction | finding | assumption` node and hands it to the convergence point, gated behind at least one answered question (`app/components/GalaxyBoard.tsx:42-148`). Nothing else about the product produces insights on purpose. There is no `suggestion` or `experiment` in the eighteen node kinds, no way for an insight to say which question it came out of, and nothing in what the agent reads that ever asks it for more. So a person who has answered four questions gets an empty far end of the board and no reason to believe anything more is coming. This plan is the agent's half of fixing that: two new node kinds, a provenance pointer from an insight back to the questions that produced it, one pure module that decides what counts as a live insight, and a standing ask in what `read_map` returns so that every read the agent does tells it how far behind the insight budget it currently is. It ships no new screen — the surface that displays all this is the plan that depends on this one.

## Key Decisions

- **Two new kinds rather than a new model.** `suggestion` and `experiment` join `NODE_KINDS`. They are nodes because everything else on this map is a node: they inherit `add_nodes`, the exchange log, the round grouping, the origin badge and the person's own ability to write one from `NodeKindPicker` — none of which a second table would get for free. `KIND_FAMILY` is declared total precisely so that a nineteenth kind cannot ship colourless (`app/lib/mapKinds.ts:150-176`), which is what makes this a compile-checked change rather than a hopeful one.
- **An insight is a THEMELESS node of an insight kind.** A `finding` the agent hangs inside a theme is a card in that row and stays one; a themeless one is a claim about the whole idea. That rule already exists informally as `CORE_INSIGHT_KINDS` plus `!n.themeId` in `GalaxyBoard`; this plan promotes it to a tested module and widens the kind set rather than inventing a second notion of "insight" beside `isInsightCard`. It is also the rule that stops the same node being drawn twice once the stack exists.
- **`fromNodeIds`, modelled exactly on `testsNodeId`.** An insight names the question or questions it came out of, as a JSON array of node ids on a new nullable column — resolved in code, never drawn as an edge, dangling ids tolerated. That is the contract `testsNodeId` already documents at length in `prisma/schema.prisma`, and the ref-resolution it needs is the resolution `testsRef` already does in `applyToolCalls` (`app/lib/mapStore.ts:292-295`). Deliberately not `parentId`: the map's one real edge is the tree, an insight has several sources, and hanging insights off questions would drag them into a row when the whole point is that they belong to none.
- **The standing ask lives in `read_map`'s rendering, not in a new tool.** The page cannot summon an agent — that is the product's founding constraint — so "constantly providing insights" can only mean the thing the agent already reads on every turn tells it what is owed. A dedicated `post_insights` tool was considered and rejected: it would be a second write path beside `add_nodes` with its own idempotency, ref-resolution and event shape, and none of that is what was missing. What was missing is the ask.
- **The ask states the budget, not a mood.** The block reports live insights, stale insights, and how many answers have landed since the newest one, then names the target. A number the agent can compare against is actionable in a way that "consider adding insights" is not, and it costs a few lines on a read that already renders the whole map.
- **Staleness is read off timestamps, not off the log.** An insight is stale when questions have been answered since it was written. `MapNode.updatedAt` moves when an answer lands, so `insightStream` can compute the whole picture from the nodes alone — which is what lets one pure module serve both the server-side `read_map` and the client-side board without either of them holding the event log. Deriving it from `MapEvent` revisions was the alternative and would have forced a second query into `read_map`'s delta branch on every turn.
- **The block appends to BOTH `read_map` branches.** The delta branch is the one a working agent actually calls, and an ask that only appears on the full read would be an ask the agent sees once. That costs the delta branch one `getMap` it does not do today. This is a deliberate, stated cost: it is the difference between a mechanism that works and one that reads well in a diff.

## Implementation

### 1. An insight can say where it came from

**File**: `prisma/schema.prisma`

Add `fromNodeIds String?` to `MapNode`, documented in the register the surrounding fields use. It holds a JSON array of node ids — the questions, answers or findings this insight was drawn from. Say explicitly, as `testsNodeId` does directly above it, that this is deliberately not a Prisma relation: the tree is the map's only edge, the pointer is resolved in code, it is never drawn, and a dangling id is tolerated because the node it names may have been deleted. Contrast it with `testsNodeId` (which points at the ONE node a slice would settle) and with `sourceRef` (which points into the brief).

SQLite, `prisma db push`, nullable — no backfill, and every existing row is already valid.

### 2. Two more kinds

**File**: `app/lib/mapKinds.ts`

Add `suggestion` and `experiment` to `NODE_KINDS`, with eyebrows in `KIND_EYEBROW` ("Suggestion", "Try this" — the eyebrow is what the card prints, so it should read as an instruction rather than as a taxonomy label) and both in `KIND_FAMILY` under `forward`, alongside `approach`, `direction`, `next-step` and `slice`. They are things to do about the thinking, which is what that family means.

Leave `ACCENT_KINDS` alone. Its comment records that exactly one card wears the lime, and giving two new kinds an accent would break the claim `nodeShellClasses` enforces.

**File**: `app/lib/mapKinds.test.ts`

`app/lib/mapKinds.test.ts:161` asserts `NODE_KINDS` has length 18. Move it to 20. The per-kind family and eyebrow loops above it (from line 153) already cover the new entries with no edit.

### 3. The new kinds read as the partner's own thinking

**File**: `app/lib/cardPresentation.ts`

Add `suggestion` and `experiment` to `INSIGHT_KINDS`. Without this a themed suggestion renders as an unanswered question — a saturated card with a text field asking the person to answer something nobody asked. The existing table-driven test at `app/lib/cardPresentation.test.ts:22-45` iterates the kinds, so extend its list rather than adding a case.

### 4. What counts as a live insight

**New file**: `app/lib/insightStream.ts`

Pure and dependency-free, in the manner of `mapRounds.ts` and `boardConnectors.ts`: the rules are the interesting part, so they are pinned by tests rather than inferred from a screenshot. No Prisma import — this module is read by the server door and by the browser.

```ts
export const INSIGHT_STREAM_KINDS: ReadonlySet<string>;  // assumption, finding, gap, risk, direction, approach, suggestion, experiment

export interface InsightNode {
  id: string; kind: string; label: string; detail: string | null;
  themeId: string | null; choices?: string[] | null;
  fromNodeIds?: string[] | null;
  createdAt: Date | string; updatedAt: Date | string;
}

export interface Insight extends InsightNode {
  /** Answers that landed after this was written. Zero means nothing has
   *  happened since; anything else means the insight predates what the
   *  person has said, which is what "stale" is. */
  answersSince: number;
  stale: boolean;
  /** The questions this came out of, resolved. Dangling ids are dropped —
   *  the node may since have been deleted. */
  from: { id: string; label: string }[];
}

export interface InsightStream {
  insights: Insight[];   // newest first
  live: number;
  stale: number;
  /** Answers landed since the NEWEST insight. The number the standing ask
   *  reports, and zero on a map with no insights at all. */
  answersSinceNewest: number;
}

export function insightStream(nodes: InsightNode[]): InsightStream;
```

Rules to pin with tests:

- An insight is a node whose `kind` is in `INSIGHT_STREAM_KINDS` **and** whose `themeId` is null. A themed node of the same kind is a card in its row and is absent here.
- Newest first, by `createdAt`, ties broken by array order (`getMap` already orders `createdAt asc, order asc`).
- `answersSince` counts nodes of kind `open-question` with status `answered` whose `updatedAt` is later than the insight's `createdAt`.
- `stale` is `answersSince > 0`. Nothing is deleted or hidden by being stale — an insight the thinking has moved past is still worth reading, and hiding it would silently shrink the board.
- `from` resolves each id in `fromNodeIds` against the node set and drops what it cannot find, exactly as a dangling `testsNodeId` is tolerated. A malformed or absent value yields `[]` rather than throwing.
- An empty node set yields `{ insights: [], live: 0, stale: 0, answersSinceNewest: 0 }` — the day-one state, and the one every capture actually produces.

`TARGET_LIVE_INSIGHTS = 3` is exported from here too, so the standing ask and any surface that wants to say "one short" read the same number.

### 5. The agent can name what an insight came from

**File**: `app/lib/toolCatalog.ts`

Add to `nodeShape`:

```ts
fromRefs: z.array(z.string()).optional().describe(
  'Only for an insight — a suggestion, experiment, finding, risk or direction. The refs (from this same call) or real ids of the questions and answers this came OUT of. Naming them is what lets the person click the insight and see the thinking behind it instead of taking it on trust. Leave it off rather than guessing; an insight drawn from the whole map has no single source, and a wrong citation is worse than none.',
)
```

Then extend the `add_nodes` description with the standing ask in the agent's own terms: an insight is a themeless node of one of those kinds; keep at least three live; each should name what it came out of and, where it can, an experiment small enough to actually run. Note that a themed node of the same kind stays in its row — that is the difference between a finding about one line of thinking and a claim about the whole idea.

### 6. Refs become ids on the way in

**File**: `app/lib/nodePlan.ts`

`planMapMutations` carries `fromRefs: string[] | null` on the planned insert, beside `testsRef` (`app/lib/nodePlan.ts:27`) and read the same way it is read at line 176 — strings only, blanks dropped, an empty array normalised to null so a node that named nothing is indistinguishable from one that never had the field.

**File**: `app/lib/mapStore.ts`

In `applyToolCalls`, resolve each ref through `refToId` exactly as `testsNodeId` is resolved at `app/lib/mapStore.ts:292-295` — a ref from this call, or a real id already on the map, with unresolvable values written through rather than dropped for the reason that comment already gives. Store as `JSON.stringify(ids)` in `fromNodeIds`, and carry the resolved ids on the `node.added` payload under `fromNodeIds`, omitted entirely when absent, in the manner `testsNodeId`, `sourceRef` and `options` are carried at `app/lib/mapStore.ts:335-341`. The log speaks the contract's language, so the payload gets the array and not the JSON string.

`getMap` needs no change — it selects whole node rows.

### 7. Every read says what is owed

**File**: `app/lib/mcpFormat.ts`

Add an exported `formatInsightStanding(stream: InsightStream): string` and call it from `formatMapDetail`, as a `## Insights` section after `## Map`. Shape:

```
## Insights
live: 1 · stale: 2 · target: 3
4 answers have landed since the newest insight.
Standing ask: keep at least 3 live insights on the board — themeless nodes of
kind suggestion, experiment, finding, risk, gap, assumption, direction or
approach. Each should name what it came out of (fromRefs), and where you can,
an experiment small enough to actually run.
```

The empty case reads as an invitation rather than as a fault: no insights yet, here is what one is, here is the target. `MapDetail` grows the fields `insightStream` needs on its `nodes` (`kind`, `themeId`, `createdAt`, `updatedAt`, `fromNodeIds`, `choices`, `detail`) — it is a structural type over what `getMap` already returns, so this is a widening, not a query change.

### 8. On the delta read too

**File**: `app/lib/toolRuntime.ts`

`read_map` (`app/lib/toolRuntime.ts:41-55`) appends the same block on both branches. The full branch already holds the map. The delta branch calls `getMap` for it — the deliberate extra query recorded in Key Decisions above — and appends after the changes. Carry `insights: { live, stale, answersSinceNewest, target }` on `structured` in both branches, so an agent reading structured output does not have to parse the prose.

## Reused existing code

- `testsNodeId` on `MapNode` in `prisma/schema.prisma` and its ref resolution in `applyToolCalls` (`app/lib/mapStore.ts:287-294`) — the exact pattern `fromNodeIds` copies: a pointer resolved in code, never drawn, dangling tolerated.
- `INSIGHT_KINDS` / `isInsightCard` from `app/lib/cardPresentation.ts` (glossary entry: `isInsightCard`) — the existing rule for "the partner's own thinking", widened rather than duplicated.
- `KIND_FAMILY`, `KIND_EYEBROW`, `NODE_KINDS`, `familyOf` from `app/lib/mapKinds.ts` (glossary entries: `familyOf`, `isNodeKind`) — the controlled vocabulary the tool schema binds to, so the two new kinds reach the agent's schema for free.
- `serialiseOptions` and `readDiagram` in `app/lib/nodePlan.ts` — the normalise-or-null convention `fromRefs` follows.
- `formatMapDetail` and `summarizeMap` (`app/lib/mcpFormat.ts`, `app/lib/mapStore.ts:207`) — the rendering the standing ask is appended to.
- `app/lib/mapRounds.ts` and `app/lib/boardConnectors.ts` — the precedent for a pure, dependency-free, test-pinned rules module, which `insightStream.ts` follows.
- **Existing-implementation survey:** nothing equivalent exists. `grep -n "suggestion\|experiment" app/lib/mapKinds.ts app/lib/toolCatalog.ts` returns nothing; the only insight logic in the tree is `CORE_INSIGHT_KINDS` in `app/components/GalaxyBoard.tsx:42` and `INSIGHT_KINDS` in `app/lib/cardPresentation.ts:13`, and this plan widens both rather than adding a third. There is no `fromNodeIds`, no insight-count reporting, and no tool other than `add_nodes` that writes nodes.

## Scenarios to Demonstrate

- Day one: a map with a seed idea and no insights — the standing ask reads as an invitation, `insightStream` returns all zeros.
- A map with one live insight and three answers landed since it — the ask reports `live: 1 · stale: 1` and names the four-answer gap.
- Three live insights, nothing answered since — the ask says the target is met.
- An insight citing two questions by `fromRefs` created in the same `add_nodes` call, with the refs resolved to real ids.
- An insight whose `fromNodeIds` names a node that has since been deleted — the dangling id is dropped, the insight still reads.
- A `suggestion` written into a theme rather than themeless — it stays a card in its row and is absent from the stream.