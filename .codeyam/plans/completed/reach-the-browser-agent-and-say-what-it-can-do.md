---
title: "Reach the Browser Agent, and Say What It Can Do"
mode: ui
createdAt: "2026-09-02T22:19:59Z"
step: 11
source: prototype
---

## Summary

A browser agent could not discover or call this app's tools, and the page could
not tell anyone why. Three defects stacked: the binding read
`navigator.modelContext` when the browser keeps it on `document.modelContext`;
the descriptors carried live Zod schemas across an agent boundary that only
accepts structured-cloneable JSON Schema; and every resulting failure was
swallowed by a bare `catch {}`. The page reported "Agent attached · 9 tools"
while registering none of them.

Fixing discovery then exposed what the page says ABOUT agents. Presence meant
"a WebMCP binding exists in this tab", so an agent working the same map through
`/api/mcp` was invisible — the header said "No agent attached" and the handoff
strip said "the agent that was here has gone" while that agent wrote nodes onto
the board. And the handoff panel returned `null` the moment WebMCP bound, so the
page reached its most capable state and showed nothing to act on, while an
attached agent sat beside it with the whole catalog and no instruction. WebMCP
is pull-only: a page cannot start an agent's turn, so the prompt is the product,
not a fallback.

Prototyped end to end against a real Chromium with a simulated agent, and
verified before/after at every step.

## Key Decisions

- **`document.modelContext` first, `navigator` as fallback** — Chrome's
  imperative-API guide and ChatGPT's WebMCP docs both register on `document`.
  `navigator` is kept rather than replaced because earlier drafts and the
  `@mcp-b/global` polyfill put it there; reading both attaches to either host
  without caring which revision it implements.
- **Convert schemas once, at the boundary, with `z.toJSONSchema(…, {io:'input'})`**
  — the catalog stays Zod (the server doors and validation need it) and only the
  page door converts, because only the page door passes a schema across by
  itself. Memoized per tool: the catalog is frozen, and a stable identity means a
  re-registration hands the browser the same object.
- **`structuredClone` IS the pre-check, not a proxy for it** — it is the same
  algorithm the browser applies on the way out, so running it in
  `serializationProblem` turns an opaque `DataCloneError` thrown from inside
  Chrome into a named tool and a printable reason.
- **Registration reports what the browser ACCEPTED** — a per-tool failure stays
  survivable but stops being silent. A binding that registers nothing was
  previously indistinguishable from one that worked, which is precisely how the
  header came to lie.
- **Bind when the API appears, not once at mount** — the agent injects the
  object, and in an integrated browser that routinely lands after hydration. A
  bounded 30s watch plus `modelcontextready` / `mcp-ready` listeners; a page left
  open for hours must not keep an interval alive for an agent that is not coming.
- **Presence is read off the exchange log, not off the binding** — the log is the
  one thing every door writes to. A binding proves an agent CAN act; a recent
  `origin: 'agent'` event proves one IS acting. Either is enough to stop telling
  someone nobody is there.
- **90-second presence window** — a tool call is an instant, not a session, and
  the MCP doors are request/response with no disconnect to observe. The window
  prefers the recoverable failure: claiming presence a minute after an agent left
  costs one stale line, while dropping to "nobody is here" between two writes of
  one turn is the bug being fixed.
- **`webmcp` outranks `mcp` when both are true** — it is the stronger claim. A
  bound page can be ASKED (`ask_user` waits on a person); a map reached over HTTP
  cannot, so the two are not interchangeable.
- **Attached is not working** — the handoff renders a start cue instead of
  nothing, and clears only once the agent has actually written to the map.
- **The start prompt names the WRITE tools** — "deconstruct the idea" is
  something a model satisfies beautifully in its own chat window, and the first
  real agent given that prompt did exactly that: `read_map`, then five tidy
  paragraphs back in ChatGPT, and a board still showing nothing.
- **A 404 on the log is permanent, not a dropped poll** — `!res.ok` treated a
  deleted map as a network blip, so a stale tab went on advertising nine working
  tools over a map that answers "No such map".
- **The tool count moved behind a click rather than out of the product** — it
  answers a question nobody in front of a map is asking, and it only matters when
  something about it is wrong. The permanent dev badge over the board was the
  right information in the wrong place.

## Implementation

### 1. Bind to where the browser actually keeps the model context

**File**: `app/lib/webmcp.ts`

`modelContext()` prefers `document.modelContext`, falling back to
`navigator.modelContext`. `registerTool` is typed async and takes
`{ signal }`; registration awaits each promise so a rejection is handled rather
than surfacing as an unhandled rejection, while every call is still MADE in one
tick so a synchronous host behaves as before. Disposal fires an
`AbortController` (what Chrome documents) AND calls `unregisterTool` (what
earlier drafts expose). Adds `onModelContextReady` (bounded watch for a
late-injected API), `requestUserInteraction` (so this stays the only file naming
the surface), `BindReport`, and per-tool failure reporting.

### 2. Hand the browser JSON Schema

**File**: `app/lib/toolInvocation.ts`

Adds `jsonSchemaFor` (memoized `z.toJSONSchema`), the `JsonSchema` type, and
`serializationProblem`. `buildToolDescriptors` now emits JSON Schema.

### 3. Presence across every door

**New file**: `app/lib/agentPresence.ts`

Pure `agentPresence({ webMcpBound, events, now })` → `{ attached, channel,
lastAgentAt }`, with `PRESENCE_WINDOW_MS`. Tolerates `createdAt` as a Date (server
render) or an ISO string (poll), takes the latest agent event rather than the last
listed, and ignores user events.

### 4. The bridge composes it

**File**: `app/components/WebMcpBridge.tsx`

Binds through `onModelContextReady`; `connected` requires at least one tool
actually registered; exposes `channel`, `lastAgentAt`, `registered`,
`bindFailures`, `convention`, `mapMissing`. A 15s tick lets presence lapse with
no other re-render to trigger it. `log.missing` outranks every other signal.

### 5. Detect a map deleted underneath an open tab

**File**: `app/hooks/useExchangeLog.ts`

A 404 sets `missing` (permanent) instead of returning like a dropped poll
(transient).

### 6. Ask an attached-but-idle agent to start

**New file**: `app/components/AgentStartCue.tsx`
**File**: `app/lib/handoffCopy.ts` — adds `attachedStartCopy`
**File**: `app/components/AgentHandoff.tsx` — `if (listening) return null`
becomes: render the cue unless the agent has already worked the map.

### 7. One header line, detail behind a click

**New file**: `app/components/AgentStatusPanel.tsx`
**File**: `app/components/AgentStatus.tsx` — a button with a popover, dismissed
on Escape and outside click; only a deleted map stays inline.
**File**: `app/components/AppHeader.tsx` — drops `basis-full`, so the status
shares the top line at every width.
**Deleted**: `app/components/WebMcpDiagnostics.tsx` (the bottom-left dev badge),
its content folded into the panel.

### 8. Fixture

**File**: `app/isolated-components/BridgeFixture.tsx` — the new `BridgeState`
fields.

## Reused existing code

- `TOOL_CATALOG`, `findTool`, `ToolSpec` from `app/lib/toolCatalog.ts` (glossary:
  `TOOL_CATALOG`) — the single catalog all three doors share; unchanged, and
  deliberately still Zod.
- `buildToolDescriptors`, `toolSummaries`, `validateToolInput` from
  `app/lib/toolInvocation.ts` (glossary: `buildToolDescriptors`, `toolSummaries`)
- `bindTools`, `publishAgentDriver`, `webMcpUnavailableReason`,
  `isWebMcpAvailable` from `app/lib/webmcp.ts` (glossary: `bindTools`,
  `isWebMcpAvailable`, `webMcpUnavailableReason`)
- `useExchangeLog`, `useAskUser` (glossary: `useExchangeLog`, `useAskUser`)
- `ExchangeEvent`, `Origin`, `readSince` from `app/lib/exchange.ts`
- `handoffCopy` from `app/lib/handoffCopy.ts`, and `CopyablePrompt`,
  `HandoffReattach`, `AgentStatusDot`, `BridgeFixture` as the components the new
  ones sit beside and match.
- `askPresence` (`app/lib/askPresence.ts`) — its `listening` predicate is the one
  `AgentHandoff` shares, which is why presence had to be fixed in one place.

## Existing-implementation survey

Grepped for an existing presence/channel notion before adding one: presence was
computed inline in three components as `bridge.status !== 'unavailable'`
(`AgentHandoff.tsx`, `AgentStatus.tsx`, and via `askPresence` in
`NodeQuestionComposer.tsx`). No shared module existed, and no `channel` concept
existed anywhere — hence a new pure module rather than an extension of one.
`z.toJSONSchema` is provided by the installed Zod 4.5; no conversion helper
existed in the repo (the server doors get it from the MCP SDK internally).

## Tests written during the prototype

All red-first where a bug was being fixed; the full suite is green at 734.

- `app/lib/toolInvocation.test.ts` — descriptors survive `structuredClone`;
  `read_map` carries real JSON Schema; `serializationProblem` is null for every
  catalog tool and non-null for a bad one. Confirmed red against the Zod
  descriptors with the browser's own `DataCloneError: function () { [native
  code] } could not be cloned.`
- `app/lib/webmcp.test.ts` — binds to `document.modelContext`; reports accepted
  vs refused; registers through a browser that structured-clones the descriptor;
  passes an abort signal that disposal fires.
- `app/lib/agentPresence.test.ts` — MCP-door agent counts as attached; `webmcp`
  outranks `mcp`; presence lapses past the window and holds inside it; a user
  event is not an agent; JSON-string timestamps; latest-wins.
- `app/components/AgentStatus.render.test.tsx` — no tool count on the line, the
  detail opens and closes on click, a deleted map stays visible without a click.
- `app/components/AgentHandoff.render.test.tsx` — rewritten: the two tests
  pinning "render nothing when connected" encoded the defect. Now: asks an idle
  attached agent to start, does not re-pitch attaching, renders nothing once the
  agent has worked the map.
- `app/components/WebMcpBridge.render.test.tsx` — a 404 log says the map is gone
  rather than claiming a binding.

## Verification performed (browser, not just unit)

Playwright against a real Chromium with a simulated agent whose `registerTool`
structured-clones the descriptor exactly as a browser does.

- Discovery: 1 tool (`post_note` only) → 9 tools including `read_map`.
- `read_map` call: `{"error":"read_map not registered"}` → 281 chars of map text
  plus `structuredContent: { revision, delta }`.
- Late injection: 0 tools → 9 tools.
- Board-to-board client-side navigation: 9 tools on both, zero stale-name
  `InvalidStateError`s, `read_map` returns the NEW board.
- MCP-door presence with no WebMCP at all: header `Agent attached · via MCP`,
  handoff hidden, lapsing to `No agent attached` between t=60s and t=110s.
- Start cue appears on a bound-but-idle map and disappears the moment the agent
  calls `create_themes` / `add_nodes`.
- Stale tab: deleting the map underneath it flips the header to
  `No agent attached — this map no longer exists — reload to start a new one`.
- Header height below `lg`: 72px → 38px at 900/720/390px, verified by stashing
  the change and re-measuring.

## Scenarios to Demonstrate

No scenarios were registered during the prototype — the states below are the
ones worth capturing, and each is reachable through `BridgeFixture`.

- Attached via WebMCP, agent idle — header one line, start cue above the board
- Attached via WebMCP, panel open — channel copy, nine tool chips, dev row
- Attached via MCP with no WebMCP — `Agent attached · via MCP`, no handoff
- No agent attached — full lime handoff pitch, panel explaining the gate
- Map deleted underneath an open tab — inline red `— map deleted, reload`
- Registration partially refused — panel listing the failed tools and reasons
  (dev only); the state that was previously invisible
- Narrow viewport (390px) — status still on the top line