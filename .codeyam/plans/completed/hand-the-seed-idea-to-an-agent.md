---
title: "Hand the Seed Idea to an Agent"
mode: ui
createdAt: "2026-09-01T16:49:21Z"
source: manual
---

## Summary

Someone types an idea into "What would you like to figure out?", presses send, and lands on a map with a single root node and a header that says "No agent attached". Nothing is wrong with the write path — `IdeaPrompt` POSTs `/api/maps`, `createMap` writes the root node, the opening message and revision 1, and the router pushes to `/map/<id>`. What is missing is any path from that write to an agent. `app/lib/exchange.ts` already states the constraint in its own header comment: *"WebMCP is pull-only. A page cannot wake an agent, there is no push channel."* That is true of the browser door — `navigator.modelContext` exposes `registerTool` / `unregisterTool` (and the legacy `provideContext`) and nothing that starts a turn. It is **not** true of the server doors: an agent connected over stdio or `/api/mcp` can park in a bounded blocking call, exactly as `await_user_activity` already lets it park on one map. This plan closes both halves of the gap — a `await_new_map` server-door wait that map creation releases, so a connected agent starts work the moment someone submits an idea; and an honest handoff panel on the map page for the ordinary case where no agent is connected at all, which is what the reporter hit.

This is filed as an enhancement rather than a bug fix: no code is behaving incorrectly, the capability was never built. There is no red-first unit repro to capture, so no `## Reproduction Test` section.

## Key Decisions

- **Push over the server door, not the browser door.** WebMCP genuinely has no page→agent channel; inventing one would mean pretending `navigator.modelContext` has a call it does not have. MCP the protocol has `sampling/createMessage` and elicitation (both present in the installed `@modelcontextprotocol/sdk`), but those are client capabilities the connected client must advertise, and they cannot reach an agent that is not connected. A bounded blocking wait needs neither: it is a tool call the agent makes, released by a write. Same idiom the codebase already ships.
- **Reuse `waitForUserActivity`'s three-way race verbatim.** Re-check first, then race an in-process emitter against a ~500ms database poll. The poll is not belt-and-braces: the page writes in the Next process and a stdio-connected agent waits in another, so an emitter alone would be silently correct in dev and silently wrong in the case that matters.
- **Cursor is a timestamp, not a revision.** `revision` is per-map and a brand-new map has none the waiter could have read. `createdAt` is the only ordering that exists across maps. The tool takes an optional `since` ISO string and defaults it to call time, and always hands back the cursor to resume from — so an agent that times out and re-parks cannot miss a map created in the gap.
- **A timeout is a normal result, never an error.** Matching `await_user_activity`: `timedOut: true` plus a cursor. An agent looping on this must never see a failure for the ordinary case of nobody having submitted anything.
- **The handoff panel is honest, not a spinner.** It says nothing is working on this map yet and why, and gives the person the one thing that actually helps — a copyable prompt naming this map's id. A progress indicator for work that will never start on its own would be a lie.
- **The panel's copy is a pure module, not strings in a component.** `app/lib/askPresence.ts` and `app/components/AskPresenceNote.tsx` already solve exactly this problem for the node-question composer, and their header comments make the same argument this plan makes: the wording IS the interface, and the only way to check a ternary buried in JSX is to look at a screenshot. So the handoff copy goes in a pure, test-pinned module beside `askPresence.ts`, with `AgentHandoff.tsx` as a thin renderer. This supersedes an earlier draft of this plan that proposed hoisting `UNAVAILABLE_HELP` out of the agent-status header component — that would have spread the copy across two idioms instead of adopting the one already established.
- **"Attached" means the same thing on both surfaces.** `askPresence` treats `working` as listening, not just `connected`, because a bridge mid-tool-call still sees the contribution when its turn comes round — `NodeQuestionComposer.tsx:53` computes it as `bridge.status !== 'unavailable'`. The handoff panel uses that identical predicate. Two surfaces on the same page disagreeing about whether an agent is attached would be worse than either one being wrong alone.
- **The panel keys off agent-origin events, not just bridge status.** A map an agent has already contributed to should not show a "waiting" panel just because the person reopened it in a browser with no agent.

## Implementation

### 1. A global "a map was created" channel and its waiter

**File**: `app/lib/exchange.ts`

`mapEvents` is keyed by `mapId`, which cannot carry an event about a map no waiter knows the id of. Add a reserved channel name alongside it (e.g. `MAP_CREATED = 'map.created'` — a constant, so the string is not repeated) and export:

```
export interface NewMapSummary {
  id: string; title: string; seedIdea: string;
  hasBrief: boolean; createdAt: Date;
}
export type NewMapWaitResult =
  | { timedOut: false; cursor: string; maps: NewMapSummary[] }
  | { timedOut: true; cursor: string; maps: [] };

export async function waitForNewMap(
  since: Date, timeoutMs: number, options?: { pollIntervalMs?: number },
): Promise<NewMapWaitResult>
```

Structure it as a near-copy of `waitForUserActivity` (`app/lib/exchange.ts:279` onward) so the two read as one pattern:

- `check()` queries `prisma.thinkingMap.findMany({ where: { createdAt: { gt: since } }, orderBy: { createdAt: 'asc' }, select: { id, title, seedIdea, createdAt, brief: { select: { mapId: true } } } })` and resolves when it is non-empty.
- Call `check()` **before** subscribing — a map created between the agent's last call and this one is already waiting.
- Race the emitter (`mapEvents.on(MAP_CREATED, onEvent)` — `mapEvents` is at `app/lib/exchange.ts:104`) against `setInterval(pollIntervalMs)`, default the same `POLL_INTERVAL_MS` (`app/lib/exchange.ts:262`).
- `poll.unref?.()` (`app/lib/exchange.ts:332`), and deliberately **do not** unref the deadline — the comment there explains why, and the same reasoning applies unchanged here.
- `cursor` is the ISO string of the newest `createdAt` returned, or of `since` on a timeout, so a re-park is always exact.

### 2. Release the waiter when a map is created

**File**: `app/lib/mapStore.ts`

In `createMap` (`app/lib/mapStore.ts:103`), after the `recordEvents` call (`app/lib/exchange.ts:152`) that mints revision 1, emit on the new channel with the same summary shape the waiter returns. It goes after `recordEvents` deliberately: a waiter woken before the root node's event exists would read a map whose log is empty and conclude there is nothing to do.

Emitting is best-effort in-process only; correctness across processes is the poll's job, per decision 2.

### 3. The `await_new_map` server-door tool

**File**: `app/lib/mcpServer.ts`

Register it beside `list_thinking_maps` and `create_thinking_map` in the server-door-only block (`app/lib/mcpServer.ts:34`-`61`). It does **not** go in `TOOL_CATALOG`: a page is already on a map and has no use for it, which is the exact reason given for the other two.

- Input: `{ since: z.string().optional(), timeoutSeconds: z.number().int().optional() }`. Clamp with the existing `timeoutMsFrom` from `app/lib/toolCatalog.ts:229` rather than a fresh cap. Absent/unparseable `since` means "now".
- Description carries the instruction, because the description is the only thing an agent reads before deciding to call it. It should say plainly: park here when you have nothing else to do; you will be handed maps as people start them, with the seed idea and whether there is a brief; then read the map and begin deconstructing it; a timeout is normal — re-call with the cursor.
- Result text lists each new map as id, title and seed idea, with the next call spelled out (`read_map` / `read_brief` with that `mapId`); `structuredContent` carries `{ timedOut, cursor, maps }`.

### 4. Pass the seed idea down to the map surface

This step is smaller than an earlier draft of this plan assumed: the brief half of it is already built.

**File**: `app/map/[id]/page.tsx`

The page already computes `brief` via `getBriefCoverage` (`app/map/[id]/page.tsx:28`) and passes it down (`:45`). `getMap` already selects `seedIdea`. So the only change is passing `seedIdea` alongside the `brief` prop that is already there — no new plumbing, and **no `hasBrief` prop at all**, since `brief !== undefined` already answers that question at the point of use.

**File**: `app/components/MapScreen.tsx`

`MapScreen` already declares `brief?: { sourceName: string; coverage: BriefCoverage }` (`app/components/MapScreen.tsx:30`). Add one optional `seedIdea?: string` beside it and render the handoff panel below `AppHeader`, above the workspace. Optional the whole way down, matching how `brief` and `mapId` are already threaded, so an isolated scenario can mount the map without inventing it.

`AppHeader` is unchanged by this plan — it is named here only as the element the panel renders below.

### 5. The handoff panel — copy module first, renderer second

This step follows `askPresence` rather than inventing its own shape. Two files, split the same way `askPresence.ts` / `AskPresenceNote.tsx` are split.

**New file**: `app/lib/handoffCopy.ts`

Pure. No React, no bridge, no DOM. Takes what it needs as arguments and returns the strings:

```
export interface HandoffCopy {
  eyebrow: string;
  explanation: string;   // why nothing is working on this map yet
  startPrompt: string;   // copyable, names this map's id and the first tool
  attachHint: string;    // the two ways to attach an agent
}

export function handoffCopy(input: {
  mapId: string;
  seedIdea?: string;
  hasBrief: boolean;
}): HandoffCopy
```

Carry a header comment in the same voice as `askPresence.ts`'s, stating the same reason: the wording IS the interface here, and a person being told work is underway when nothing is attached is the exact thing this feature could mislead about.

The content it returns:

- One plain sentence on why nothing is working on this map yet — WebMCP is pull-only, so a map does not summon an agent.
- A start prompt naming this map's id and the first tool to call: `read_brief` when `hasBrief`, otherwise `read_map`. This is why the brief-only case is a `handoffCopy` argument rather than a branch in JSX.
- One line on the two ways to attach: a browser agent (Chrome 146+, top-level, secure context) or the MCP server (`npm run mcp` / `/api/mcp`), where `await_new_map` means the next idea is picked up with no copying at all.

Do **not** hoist `UNAVAILABLE_HELP` out of the agent-status header component. An earlier draft of this plan called for that; it predates `askPresence` and would spread this project's honest-copy handling across two idioms. That component keeps its string; the panel's wording lives here.

**New file**: `app/lib/handoffCopy.test.ts`

Pins the wording, exactly as `app/lib/askPresence.test.ts` does for its module — no DOM needed. Cover: the start prompt contains the map id; it names `read_map` for a seed-idea map and `read_brief` for a brief-only one; the explanation never promises that an agent is coming.

**New file**: `app/components/AgentHandoff.tsx`

A thin client renderer. It reads the bridge through `useOptionalWebMcpBridge()` (`app/components/WebMcpBridge.tsx:96`), which returns `null` outside a provider instead of throwing — so the panel is mountable in an isolated scenario with no bridge at all.

It renders only when **both** hold:

- **Nothing is listening**, using the identical predicate `NodeQuestionComposer.tsx:53` uses: `bridge.status !== 'unavailable'` is *listening*, so the panel shows on `!listening`. `working` counts as listening, same as `connected`. A `null` bridge is treated as not listening.
- **`events` carries no event whose `origin === 'agent'`** — a map an agent has already worked is not waiting for one.

Everything it displays comes from `handoffCopy(...)` plus the seed idea quoted back, so the person sees their input was kept. Visuals follow the established card idiom — see `DirectionsCard` (`app/components/DirectionsCard.tsx`) and `BriefWarning` (`app/components/BriefWarning.tsx`) for the border/radius/type conventions.

**New file**: `app/components/AgentHandoff.render.test.tsx`

Mount through the existing `app/isolated-components/BridgeFixture.tsx`, which supplies a bridge state the browser cannot produce. Cover: renders when unavailable with no agent events; renders nothing when `connected`; **renders nothing when `working`** (the shared-predicate guarantee — this is the case that would drift if the two surfaces disagreed); renders nothing when the log already has an agent-origin event; renders without a provider at all via `useOptionalWebMcpBridge`.

### 6. Tests for the wait

**File**: `app/lib/exchange.integration.test.ts`

Add a `waitForNewMap` block beside the existing `waitForUserActivity` one (`app/lib/exchange.integration.test.ts:214`):

- Returns immediately when a map already exists after `since` (the check-first guarantee).
- Releases when `createMap` runs while the wait is in flight.
- Times out cleanly with `timedOut: true` and a usable cursor, using a short `pollIntervalMs` as the existing tests do.
- The cursor it returns, fed back into a second wait, does not re-deliver the map it already handed over.

## Reused existing code

- `waitForUserActivity` from `app/lib/exchange.ts` (glossary entry: `waitForUserActivity`) — the check-first / emitter-vs-poll / bounded-deadline structure `waitForNewMap` copies, including the unref reasoning.
- `mapEvents` and `recordEvents` from `app/lib/exchange.ts` — the emitter the new channel joins, and the write the creation emit must follow.
- `timeoutMsFrom` from `app/lib/toolCatalog.ts:229` — the existing clamp, so `await_new_map` cannot be talked into an unbounded wait.
- `createMap` from `app/lib/mapStore.ts:103` — the single creation path, so one emit covers the page door, the HTTP door and `create_thinking_map`.
- `useOptionalWebMcpBridge` from `app/components/WebMcpBridge.tsx:96` — returns `null` outside a provider rather than throwing, so `AgentHandoff` is mountable without a bridge. `status`, `reason` and `events` are all already on `BridgeState`; the panel adds no new state.
- `askPresence` / `AskPresenceNote` (`app/lib/askPresence.ts`, `app/components/AskPresenceNote.tsx`) — the pure-copy-module + thin-renderer split that `handoffCopy` / `AgentHandoff` copies, and the source of the `listening` rule that counts `working` as attached.
- `app/lib/askPresence.test.ts` — the shape of a test that pins wording without a DOM, which `handoffCopy.test.ts` follows.
- The `listening` predicate at `app/components/NodeQuestionComposer.tsx:53` — reused verbatim so the composer and the handoff panel cannot contradict each other about whether an agent is attached.
- The existing `brief` threading (`app/map/[id]/page.tsx:28`, `app/components/MapScreen.tsx:30`) — already built, so `seedIdea` joins the prop that is already there rather than adding new plumbing.
- `BridgeFixture` from `app/isolated-components/BridgeFixture.tsx` — how a bridge-dependent component is mounted under test.
- `DirectionsCard` / `BriefWarning` (`app/components/DirectionsCard.tsx`, `app/components/BriefWarning.tsx`) — the card and alert visual conventions the panel follows.

**Existing-implementation survey.** Grepped for a cross-map or global waiter before proposing one: `app/lib/exchange.ts` has `waitForUserActivity` (map-scoped, revision-cursored) and `currentRevision`, and `mapEvents` is emitted only under a `mapId` key. There is no global channel, no `createdAt`-cursored query, and no server-door tool that blocks on anything. Nothing equivalent exists to reuse or extend; `waitForNewMap` is genuinely new surface, deliberately shaped as a sibling of the existing waiter.

**Re-verified against `main` at plan-confirmation time.** This plan was investigated on `feat/thinking-map`, several commits behind `main`, and its citations were rechecked against the merged tree before approval. Still true: nothing named `waitForNewMap`, `await_new_map`, `MAP_CREATED` or `AgentHandoff` exists anywhere; `TOOL_CATALOG` still ends at `await_user_activity` (`app/lib/toolCatalog.ts:208`, array closes `:218`); the server-door-only block still holds only `list_thinking_maps` and `create_thinking_map`. Changed since the investigation, and reflected above: every line number in this plan, the `askPresence` prior art that reshapes step 5, the already-built `brief` prop that shrinks step 4, and the availability of `useOptionalWebMcpBridge`. Steps 1-3 and 6 stand as written apart from the line numbers. `AppHeader` already exists and is not created by this plan — it is only the anchor the panel renders below.

## Scenarios to Demonstrate

- **Idea submitted, no agent anywhere** — the reported case. The map page shows the root node and the handoff panel with the seed idea quoted and a copyable prompt.
- **Idea submitted while an agent is parked in `await_new_map`** — the wait releases with the new map's id, title and seed idea, and the agent's first `add_nodes` lands; the panel never appears because the log already carries agent-origin events.
- **Agent parked, times out, re-parks with the cursor, then a map is created** — nothing is missed across the gap.
- **Map created between two waits** — the check-first path returns it immediately rather than sleeping through it.
- **Brief-only map** (no seed sentence) — the wait reports `hasBrief`, and `handoffCopy` returns a prompt pointing at `read_brief` rather than quoting an empty idea.
- **Agent mid-tool-call (`working`) on a map with no agent events yet** — no handoff panel, because `working` counts as attached under the shared `listening` rule.
- **Reopening a map an agent already worked** — no handoff panel, even with no agent attached.
- **Two maps created in quick succession** — one wait returns both, in creation order.