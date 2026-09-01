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

Structure it as a near-copy of `waitForUserActivity` (`app/lib/exchange.ts:239` onward) so the two read as one pattern:

- `check()` queries `prisma.thinkingMap.findMany({ where: { createdAt: { gt: since } }, orderBy: { createdAt: 'asc' }, select: { id, title, seedIdea, createdAt, brief: { select: { mapId: true } } } })` and resolves when it is non-empty.
- Call `check()` **before** subscribing — a map created between the agent's last call and this one is already waiting.
- Race the emitter (`mapEvents.on(MAP_CREATED, onEvent)`) against `setInterval(pollIntervalMs)`, default the same `POLL_INTERVAL_MS`.
- `poll.unref?.()`, and deliberately **do not** unref the deadline — the comment at `app/lib/exchange.ts:315` explains why, and the same reasoning applies unchanged here.
- `cursor` is the ISO string of the newest `createdAt` returned, or of `since` on a timeout, so a re-park is always exact.

### 2. Release the waiter when a map is created

**File**: `app/lib/mapStore.ts`

In `createMap`, after the `recordEvents` call that mints revision 1, emit on the new channel with the same summary shape the waiter returns. It goes after `recordEvents` deliberately: a waiter woken before the root node's event exists would read a map whose log is empty and conclude there is nothing to do.

Emitting is best-effort in-process only; correctness across processes is the poll's job, per decision 2.

### 3. The `await_new_map` server-door tool

**File**: `app/lib/mcpServer.ts`

Register it beside `list_thinking_maps` and `create_thinking_map` in the server-door-only block (`app/lib/mcpServer.ts:36`-`60`). It does **not** go in `TOOL_CATALOG`: a page is already on a map and has no use for it, which is the exact reason given for the other two.

- Input: `{ since: z.string().optional(), timeoutSeconds: z.number().int().optional() }`. Clamp with the existing `timeoutMsFrom` from `app/lib/toolCatalog.ts:211` rather than a fresh cap. Absent/unparseable `since` means "now".
- Description carries the instruction, because the description is the only thing an agent reads before deciding to call it. It should say plainly: park here when you have nothing else to do; you will be handed maps as people start them, with the seed idea and whether there is a brief; then read the map and begin deconstructing it; a timeout is normal — re-call with the cursor.
- Result text lists each new map as id, title and seed idea, with the next call spelled out (`read_map` / `read_brief` with that `mapId`); `structuredContent` carries `{ timedOut, cursor, maps }`.

### 4. Pass the seed idea down to the map surface

**File**: `app/map/[id]/page.tsx`

`getMap` already selects `seedIdea` and the brief's metadata. Pass `seedIdea` and whether a brief exists through to `MapScreen`.

**File**: `app/components/MapScreen.tsx`

Take the two new optional props and render the handoff panel below `AppHeader`, above the workspace. Optional the whole way down, matching how `mapId` is already threaded, so an isolated scenario can mount the map without inventing them.

### 5. The handoff panel

**New file**: `app/components/AgentHandoff.tsx`

A client component reading `useWebMcpBridge()`. It renders only when `status === 'unavailable'` **and** `events` contains no event whose `origin === 'agent'` — a map an agent has already worked is not waiting for one.

Content, in the established card idiom (see `DirectionsCard` at `app/components/DirectionsCard.tsx` and `BriefWarning` at `app/components/BriefWarning.tsx` for the border/radius/type conventions):

- An eyebrow and one plain sentence: nothing is working on this map yet, and why — reuse the honest wording already written as `UNAVAILABLE_HELP` in `app/components/AgentStatus.tsx`, and hoist that string into the shared copy so the header tooltip and this panel cannot drift.
- The seed idea, quoted back, so the person sees their input was kept.
- A copyable start prompt naming this map's id and the first tool to call. Build it in a small pure helper so it is testable without a DOM.
- One line on the two ways to attach: a browser agent (Chrome 146+, top-level, secure context) or the MCP server (`npm run mcp` / `/api/mcp`), where `await_new_map` means the next idea is picked up with no copying at all.

**New file**: `app/components/AgentHandoff.render.test.tsx`

Mount through the existing `app/isolated-components/BridgeFixture.tsx`, which supplies a bridge state the browser cannot produce. Cover: renders when unavailable with no agent events; renders nothing when connected; renders nothing when the log already has an agent-origin event; the copy prompt contains the map id and the seed idea.

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
- `timeoutMsFrom` from `app/lib/toolCatalog.ts:211` — the existing clamp, so `await_new_map` cannot be talked into an unbounded wait.
- `createMap` from `app/lib/mapStore.ts:75` — the single creation path, so one emit covers the page door, the HTTP door and `create_thinking_map`.
- `useWebMcpBridge` / `BridgeState` from `app/components/WebMcpBridge.tsx` — `status`, `reason` and `events` are all already on the context; the panel adds no new state.
- `BridgeFixture` from `app/isolated-components/BridgeFixture.tsx` — how a bridge-dependent component is mounted under test.
- `UNAVAILABLE_HELP` from `app/components/AgentStatus.tsx` — the honest unavailability wording, hoisted rather than restated.
- `DirectionsCard` / `BriefWarning` (`app/components/DirectionsCard.tsx`, `app/components/BriefWarning.tsx`) — the card and alert visual conventions the panel follows.

**Existing-implementation survey.** Grepped for a cross-map or global waiter before proposing one: `app/lib/exchange.ts` has `waitForUserActivity` (map-scoped, revision-cursored) and `currentRevision`, and `mapEvents` is emitted only under a `mapId` key. There is no global channel, no `createdAt`-cursored query, and no server-door tool that blocks on anything. Nothing equivalent exists to reuse or extend; `waitForNewMap` is genuinely new surface, deliberately shaped as a sibling of the existing waiter.

## Scenarios to Demonstrate

- **Idea submitted, no agent anywhere** — the reported case. The map page shows the root node and the handoff panel with the seed idea quoted and a copyable prompt.
- **Idea submitted while an agent is parked in `await_new_map`** — the wait releases with the new map's id, title and seed idea, and the agent's first `add_nodes` lands; the panel never appears because the log already carries agent-origin events.
- **Agent parked, times out, re-parks with the cursor, then a map is created** — nothing is missed across the gap.
- **Map created between two waits** — the check-first path returns it immediately rather than sleeping through it.
- **Brief-only map** (no seed sentence) — the wait reports `hasBrief`, and the panel's prompt points at `read_brief` rather than quoting an empty idea.
- **Reopening a map an agent already worked** — no handoff panel, even with no agent attached.
- **Two maps created in quick succession** — one wait returns both, in creation order.