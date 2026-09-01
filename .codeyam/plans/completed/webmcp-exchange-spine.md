---
title: "WebMCP Exchange Spine"
mode: backend
createdAt: "2026-09-01T00:30:30Z"
source: manual
---

## Summary

Thinking Map currently has two front doors — the browser UI (with an in-page chat
that calls Anthropic server-side) and an MCP server on HTTP/stdio. The product is
being repositioned as a **WebMCP** app: the agent lives in the user's browser
(Chrome 146+ `navigator.modelContext`), the conversation happens in the agent's own
surface, and this page is the shared artifact both parties work on. That inverts the
data flow. The agent no longer owns the whole loop — the user edits the map directly,
and the agent has to find out. WebMCP is pull-only: a page cannot wake an agent, and
there is no push channel. So the exchange has to be built out of a durable, ordered,
resumable record that either side can read at any time.

This plan builds that spine and binds it to WebMCP. A monotonic per-map `revision`
and an append-only `MapEvent` log turn every change — agent or human — into an ordered
fact with an origin. One tool catalog defines the tools once and is consumed by both
the existing server MCP and the new page-side WebMCP binding, so a third front door
cannot drift from the other two. Two tools carry the give-and-take specifically:
`ask_user`, which pauses the agent's turn via `client.requestUserInteraction` until the
person answers in the page, and `await_user_activity`, a bounded long-poll so an idle
agent can wait on the human instead of busy-polling. No UI changes here; the chat-free
surface and the contribution affordances are the follow-on plan.

## Key Decisions

- **One append-only `MapEvent` log, not three mechanisms.** Deltas for the agent, the
  inbox of unread user contributions, and the activity feed the UI will render are the
  same question asked three ways: "what happened after revision N?". One table answers
  all three, and it also covers node deletion, which a diff over `MapNode` rows cannot.
- **Revision is a column on `ThinkingMap`, bumped in the same transaction as the write** —
  not an in-memory counter. The stdio MCP server runs in a separate process from Next;
  a process-local counter would hand two front doors two different notions of "now".
- **`await_user_activity` = in-process emitter + a bounded poll.** The emitter makes the
  same-process case instant; the poll (every ~500ms, under the caller's timeout) is what
  makes a write from the stdio process still wake a waiter in the web process. Emitter
  alone would be silently correct in dev and silently wrong across front doors.
- **Every waiting tool is bounded and resumable.** `ask_user` and `await_user_activity`
  take a timeout and, on expiry, return `status: "pending"` with the cursor to resume
  from — never a hang. An agent that gives up mid-question loses nothing: the question
  stays on screen and the answer lands in the log for the next read.
- **Conflicts are results, not errors.** `update_node` takes an optional
  `expectedRevision`; if the human changed that node since, the tool returns a normal
  content result describing both versions and declines the write. Last-write-wins would
  silently erase what the user typed — the exact failure this plan exists to prevent.
- **`origin: "user" | "agent"` on nodes and events.** Without it an agent re-reading the
  map cannot tell its own writes from the human's, and will re-ingest its own output as
  new information. It is also what lets the UI mark what the person contributed.
- **A thin adapter around `navigator.modelContext`, not direct calls at call sites.**
  The spec is a W3C Community Group draft and has already moved once — `provideContext()`
  was removed in the March 2026 revision in favour of `registerTool()`/`unregisterTool()`,
  and the `@mcp-b/global` polyfill still exposes the older convention. Isolating the
  binding in one file means the next revision is one edit, not a sweep.
- **A headless driver seam (`window.__thinkingMapAgent`) ships with the binding.**
  WebMCP is top-level secure-context only, and codeyam renders the app inside a capture
  iframe, so `navigator.modelContext` is genuinely absent in every preview and scenario.
  The driver calls the same catalog entries the real agent would, so the tools are
  exercisable without a browser agent. The visible dev panel that drives it belongs to
  the follow-on UI plan.
- **Server MCP keeps `mapId` arguments; page tools bind the current map.** A page is
  already scoped to one map, so making the agent pass an id it cannot see would be a
  needless failure mode. Same catalog, different context injection.

## Implementation

### 1. Revision, origin, and the event log

**File**: `prisma/schema.prisma`

Add `revision Int @default(0)` to `ThinkingMap` — monotonic, bumped once per committed
change. Add `origin String @default("agent")` to `MapNode` and to `Message`.

Add a `MapEvent` model: `id`, `mapId` (cascade), `revision Int`, `kind String`,
`origin String`, `payload String` (JSON), `requestId String?`, `createdAt`. Index
`[mapId, revision]`, unique on `[mapId, revision]` and on `[mapId, requestId]` — the
second is the idempotency key that makes an agent's retry a no-op rather than a
duplicate. Event kinds: `node.added`, `node.updated`, `phase.set`, `agent.note`,
`question.asked`, `user.answer`, `user.note`, `user.node`.

Extend `.codeyam/seeds/*.json` handling and `prisma/seed.ts` so seeded maps carry a
coherent `revision` and a short event history — otherwise every seeded scenario starts
with an empty log and the follow-on UI has nothing to render.

### 2. The exchange module

**New file**: `app/lib/exchange.ts`

The one place revisions are minted and events are read.

- `recordEvents(mapId, events[], { requestId })` — inside a single transaction, bumps
  `ThinkingMap.revision` once per event and inserts the rows; returns the new revision.
  A repeat `requestId` returns the original revision without writing.
- `readSince(mapId, cursor)` — `{ revision, events[] }`, ordered. `cursor` omitted means
  the full current state.
- `waitForUserActivity(mapId, cursor, timeoutMs)` — re-checks the log first (an event may
  already be waiting), then races an in-process emitter against a ~500ms poll and the
  caller's timeout. Resolves `{ events, revision }` or `{ timedOut: true, revision }`.
- A small `mapEvents` emitter, fired by `recordEvents`.

### 3. Route the existing writes through it

**File**: `app/lib/mapStore.ts`

`applyToolCalls` currently writes nodes and phase directly. Have it emit the matching
events in the same transaction and accept an `origin`. `createMap` records a
`node.added` event for the root and sets revision 1. Keep `planMapMutations` untouched —
the pure planning layer is already right; this is the executor gaining a second output.

### 4. One tool catalog for every front door

**New file**: `app/lib/toolCatalog.ts`

An array of `{ name, title, description, inputSchema (zod), annotations, run(ctx, input) }`
where `ctx = { mapId, origin, client? }`. Tools:

- `read_map({ sinceRevision? })` — full map or delta, plus the current revision.
  `readOnlyHint`. Renders through the existing `formatMapDetail`.
- `add_nodes({ nodes, requestId? })`, `update_node({ id, …, expectedRevision?, requestId? })`,
  `set_phase({ phase })` — the current three, now returning the new revision, and
  `update_node` returning a conflict result rather than clobbering.
- `post_note({ text })` — the agent's one-line "what I changed and why". This is what
  replaces the assistant chat bubble: a note attached to the map, not a conversation.
- `ask_user({ questions[], timeoutSeconds? })` — writes `open-question` nodes, raises the
  questions in the page, and awaits the answers.
- `await_user_activity({ sinceRevision, timeoutSeconds? })` — the bounded long-poll.

`list_thinking_maps` and `create_thinking_map` stay server-door-only; the page is already
on a map.

### 5. Rebuild the server MCP on the catalog

**File**: `app/lib/mcpServer.ts`

Replace the six hand-registered tools with a loop over the catalog, injecting
`mapId` from each tool's input and `origin: "agent"`. Keep `textResult` and the
`nodeShape` schema, which move to the catalog. `app/api/mcp/route.ts` and `mcp/stdio.ts`
need no change — they consume `buildMcpServer`. `ask_user` over the server door has no
page to raise questions in, so it degrades to writing the question nodes and returning
immediately with the cursor to poll.

### 6. The WebMCP binding

**New file**: `app/lib/webmcp.ts`

The adapter, and the only file that names `navigator.modelContext`.

- `isWebMcpAvailable()` — `'modelContext' in navigator`, `window.isSecureContext`, and
  `window.top === window` (top-level only; the codeyam capture iframe fails this by
  design).
- `bindTools(tools, ctx)` — registers each via `registerTool`, falling back to the
  `provideContext` polyfill shape when only that exists; returns a disposer that calls
  `unregisterTool` for each name. Re-registering a live name throws `InvalidStateError`,
  so unregister-then-register is the only safe update path.
- Results marshalled to MCP shape: `{ content: [{ type: 'text', text }], structuredContent }`.
  `isError` is reserved for genuine faults — a conflict or a timeout is a normal result
  the agent is expected to reason about.
- Agent input is untrusted: every call is validated against the tool's zod schema before
  it reaches `run`, and a validation failure returns a readable message rather than throwing.
- In dev, always publish `window.__thinkingMapAgent = { listTools, callTool }` over the
  same bound catalog, whether or not a real agent is present.

### 7. The bridge component

**New file**: `app/components/WebMcpBridge.tsx`

A client component mounted by the map page. Binds the catalog for the current `mapId` on
mount, disposes on unmount and on map change. Holds the pending-`ask_user` state and
exposes it via context so the follow-on UI can render the questions and resolve the
promise. Wraps the wait in `client.requestUserInteraction(...)` when the running agent
provides one, so the browser knows to bring the page forward. Reports connection state
(`unavailable | connected | working`) through the same context.

### 8. HTTP surface for page-side writes

**New file**: `app/api/maps/[id]/exchange/route.ts`

`GET ?since=<revision>` returns `readSince`; `POST` records a user-origin event
(`user.answer`, `user.note`, `user.node`). The tools run in the page but the log lives in
SQLite, so this is how both the bridge and the follow-on UI affordances write. Validates
that the map exists and rejects an unknown event kind.

### 9. Documentation

**File**: `README.md`

Rewrite the "MCP server" section as three front doors: WebMCP in the page (what it needs —
Chrome 146+, HTTPS or localhost, top level, not an iframe), HTTP, and stdio. State plainly
that WebMCP is pull-only and describe the revision/cursor contract an agent should follow:
read with a cursor, write with a `requestId`, wait with `await_user_activity`.

## Reused existing code

- `applyToolCalls`, `createMap`, `getMap`, `listMaps`, `summarizeMap` from
  `app/lib/mapStore.ts` (glossary entries: `applyToolCalls`, `createMap`, `getMap`,
  `listMaps`, `summarizeMap`) — the store stays the single write path; this plan adds
  event emission to it rather than a parallel one.
- `planMapMutations` from `app/lib/nodePlan.ts` (glossary entry: `planMapMutations`) —
  pure, tested, and unchanged; the ref-resolution and ordering rules are reused verbatim.
- `formatMapDetail`, `formatMapList` from `app/lib/mcpFormat.ts` (glossary entries:
  `formatMapDetail`, `formatMapList`) — the text rendering every tool result uses.
- `buildMcpServer` from `app/lib/mcpServer.ts` (glossary entry: `buildMcpServer`) —
  kept as the server-door entry point, re-implemented over the catalog.
- `NODE_KINDS`, `NODE_STATUSES`, `PHASES`, `isPhase` from `app/lib/mapKinds.ts` (glossary
  entries: `isPhase`, `isNodeKind`, `isNodeStatus`) — the controlled vocabulary the new
  tool schemas bind to, so a WebMCP agent can only emit kinds the map can draw.
- `prisma` from `app/lib/prisma.ts` — the transaction handle the new event-recording helper runs in.

**Existing-implementation survey.** Grepped the app for any existing revision, cursor,
version, origin, or idempotency mechanism before proposing these fields. There is none.
The only change marker on a map today is its updatedAt timestamp, which is not monotonic,
is bumped once per turn rather than once per change, and records nothing about who made
the change. `applyToolCalls` has no dedupe path either — a retried tool call today inserts
duplicate nodes. So the revision counter, the origin column, the idempotency key, and the
event-log table proposed above are all genuinely new; nothing existing is duplicated.

## Scenarios to Demonstrate

- A map mid-exchange: agent notes and user contributions interleaved in the log, revision
  visible, two open questions awaiting the human.
- The pending-question state: `ask_user` in flight, the agent's turn paused.
- A timed-out `ask_user`: questions still on screen, agent released, nothing lost.
- A conflict: the human edited a node the agent then tried to update with a stale
  `expectedRevision`; both versions present, neither destroyed.
- No agent attached (the iframe/preview case) — tools unregistered, map fully readable.
- A map whose last three events came from the stdio front door, proving the log is shared.