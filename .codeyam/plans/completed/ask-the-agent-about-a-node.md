---
title: "Ask the Agent About a Node"
mode: ui
createdAt: "2026-09-01T12:33:48Z"
source: manual
dependsOn: ["direct-map-manipulation"]
---

## Summary

Let a person click a node and ask the agent about it, and make that question
reach the agent as directly as WebMCP currently allows. The exchange spine
already has most of what this needs: a user contribution wakes an agent parked
on `await_user_activity` near-instantly, so an asked question is not merely
queued when someone is listening. What is missing is a question that knows
which node it is about — today the only way to ask is a free-text note, leaving
the agent to work out from prose which of twenty pills you meant. This adds a
node-scoped question to the event vocabulary, an affordance on the pill, and
honest UI about whether anyone is actually there to hear it.

It also prepares for real push. WebMCP is pull-only today — the page can expose
tools and nothing else — but `notifyResourceUpdated()` and resource
subscriptions are an open proposal (webmachinelearning/webmcp issue 151), whose
own framing is that "the page owns reactive state but has no way to publish it".
This plan exposes the exchange log as a subscribable resource and calls the
notify hook behind a capability check, so the page starts pushing the day the
browser ships it and behaves exactly as it does now until then.

## Key Decisions

- **A node-scoped question is its own event kind, not a note with a name in it.**
  "user.question" carries the `nodeId` as data. Parsing a node out of prose is
  the kind of thing that works in a demo and fails on the map where two nodes
  are called "Vocabulary". The kinds list in `app/lib/exchange.ts` is a closed
  vocabulary with a guard, so adding one is a deliberate, checked act.
- **It rides the existing wake path rather than inventing a channel.**
  "user.question" joins `USER_EVENT_KINDS`, which is the set
  `waitForUserActivity` filters on — so a click wakes a waiting agent through
  machinery that already exists and is already tested, with no second mechanism
  to keep in sync.
- **The UI must say which case you are in.** The bridge already knows whether an
  agent is attached (`unavailable` / `connected` / `working`) and which
  questions are pending. Asking must render differently when an agent is
  listening versus when the question is going into the log for later. Implying
  an answer is coming when nothing is attached is the one genuinely misleading
  thing this feature could do.
- **Push is built behind a capability check, and is not load-bearing.** The page
  registers the exchange log as an MCP resource and calls
  `notifyResourceUpdated()` when a user event lands — but only if the method
  exists. Everything works identically without it; the notification is an
  optimisation that removes polling latency, never a path anything depends on.
  This is deliberately speculative work against an unshipped proposal, and it is
  scoped so that the proposal changing shape costs one function in
  `app/lib/webmcp.ts`, which is already the only file allowed to name
  navigator.modelContext.
- **A notification is not a turn.** Even once issue 151 ships, a notification
  tells a *subscribed* client that a resource changed; it cannot make an idle
  agent start reasoning. The honest ceiling stays: you can wake an agent that is
  waiting on you, and you cannot start a turn in one that is not attached. The
  UI copy must not overpromise past that.
- **Depends on the manipulation plan.** Click-to-ask and drag-to-nudge live on
  the same pill, and the click-versus-drag threshold has to exist before a click
  handler is meaningful. Building this first would mean writing pointer handling
  the other plan then rewrites.

## Implementation

### 1. Add the node-scoped question to the vocabulary

**File**: `app/lib/exchange.ts`

Add "user.question" to `EVENT_KINDS` and to `USER_EVENT_KINDS` — the second is
what makes it wake a waiter, and omitting it is the silent failure mode here.
Its payload carries `nodeId` and `text`. Document the shape beside the others.

### 2. Accept it at the exchange endpoint

**File**: `app/api/maps/[id]/exchange/route.ts`

Widen the accepted kinds to include "user.question", and validate that the
`nodeId` names a node on this map — the same belongs-to-this-map check the route
already performs, extended to the payload.

### 3. Ask from the pill

**File**: `app/components/MapNodePill.tsx`

A click (as distinguished from a drag by the threshold the manipulation plan
establishes) opens a small composer anchored to the node. The pill stays
presentational: it takes an `onAsk` callback.

**New file**: `app/components/NodeQuestionComposer.tsx`

The composer itself — the node it is about, a text field, and a send control
whose label states the real situation: asking an attached agent, or leaving it
in the log. It reads agent presence from the bridge rather than being told.

### 4. Route it through the bridge

**File**: `app/components/WebMcpBridge.tsx`

Widen `contribute`'s kind union to include "user.question". This is the existing
path a contribution already takes, so nothing else about the bridge changes.

**File**: `app/lib/webmcp.ts`

Widen `postUserEvent`'s kind union to match.

### 5. Render questions in the rail

**File**: `app/lib/exchangeRail.ts`

Give "user.question" a rail rendering naming the node it is about, so the
activity record reads as an exchange rather than an unattributed note. Check the
existing formatter for how the other seven kinds phrase themselves and match it.

### 6. Expose the log as a resource, and notify when it moves

**File**: `app/lib/webmcp.ts`

Register the exchange log as an MCP resource alongside the tools, and add a
`notifyExchangeUpdated(mapId)` that calls the browser's notifyResourceUpdated() hook on navigator.modelContext
when the method exists and no-ops when it does not — the same
feature-detection shape the file already uses for `registerTool` versus
`provideContext`. Keep it in this file: it is the only place allowed to name
navigator.modelContext, and that boundary is what made the March 2026 spec
change a one-file edit.

**File**: `app/hooks/useExchangeLog.ts`

Call the notify hook when a user event is posted. It already owns the cursor and
sees every local contribution, so it is the natural site; no new subscription
bookkeeping is needed.

## Reused existing code

- `recordEvents`, `readSince`, `waitForUserActivity`, `USER_EVENT_KINDS` and
  `isUserEventKind` from `app/lib/exchange.ts` — the whole wake path is reused
  unchanged; this plan only widens the vocabulary it operates on.
- `WebMcpBridge` and its `contribute` from `app/components/WebMcpBridge.tsx`
  (glossary entry: `WebMcpBridge`) — the existing contribution path.
- `bindTools` and the feature-detection pattern in `app/lib/webmcp.ts` — the
  `registerTool` / `provideContext` fallback is the precedent the notify
  capability check should copy.
- `MapNodePill` from `app/components/MapNodePill.tsx` (glossary entry:
  `MapNodePill`) — the affordance's host.
- `mapExists` from `app/api/maps/[id]/exchange/route.ts` (glossary entry:
  `mapExists`) — the ownership check the new payload validation extends.
- `useExchangeLog` from `app/hooks/useExchangeLog.ts` — already polls the log
  forward and sees every local contribution.

**Existing-implementation survey.** There is no node-scoped user event today:
`EVENT_KINDS` in `app/lib/exchange.ts` holds exactly "node.added",
"node.updated", "phase.set", "agent.note", "question.asked", "user.answer",
"user.note" and "user.node", and only "question.asked" carries a question — in
the agent-to-person direction, which is the opposite of this one. "user.note" is
the closest existing thing and is deliberately unstructured, so extending it
would mean giving an untyped kind a typed meaning. No resource registration or
notification code exists anywhere: `app/lib/webmcp.ts` names only
`registerTool`, `unregisterTool` and `provideContext`, and nothing in the app
calls `notifyResourceUpdated`.

**Mechanism feasibility.** The notify hook is read at call time from
navigator.modelContext, not captured once at module load, so a browser that
gains the capability mid-session is picked up without a reload. This matters
because it is the difference between a capability check and a startup snapshot.

## Scenarios to Demonstrate

- Asking with an agent attached — the composer open on a node, its send control
  saying an agent is listening
- Asking with nothing attached — the same composer, honestly stating the
  question will sit in the log until an agent reads it
- The question in the rail — a "user.question" row naming the node it is about,
  beside the other event kinds
- A node with a question already asked — the pill marked, so you can see what
  you have already asked about without opening anything
- Empty composer — the send control disabled, matching how the contribution bar
  already behaves