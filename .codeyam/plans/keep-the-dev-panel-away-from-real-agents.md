---
title: "Keep the Dev Panel Away From Real Agents"
mode: ui
createdAt: "2026-09-02T12:39:14Z"
source: manual
---

## Summary

The dev-only agent panel appears on every real map in development and is the most clickable thing on the screen, so an agent driving the browser presses it — and "Run the demo sequence" drives `window.__thinkingMapAgent`, the *real* bound catalog, against the person's *real* map. That is where the two unrelated nodes and the open question in this report came from. Worse, those calls run with `origin: 'agent'`, and `AgentHandoff` hides itself the moment any agent-origin event exists — so running the demo removed the one panel that names the doors an agent can actually come in through (`npm run mcp`, `/api/mcp`). The agent then reported, correctly, that it had no way to attach: the instructions had just been hidden from it. This plan gates the panel behind a deliberate opt-in instead of `NODE_ENV`, keeps the demo sequence off maps that hold real work, stops the handoff band vanishing on the first agent event, and makes the MCP endpoint copyable rather than merely mentioned.

## Key Decisions

- **`NODE_ENV !== 'production'` is the wrong gate.** It answers "is this a dev build", when the question is "can a real agent reach this page". Every `npm run dev` session is a dev build, including the ones where a genuine agent is working. The panel moves to an explicit per-tab opt-in — `?agentPanel=1` on the map URL — which no agent stumbles onto and which needs no server restart to toggle.
- **The scenario captures are unaffected**, which is what makes the gate safe. `agentsimulator-default`, `agentsimulator-open` and `agentpanellauncher-default` all render through `app/isolated-components/AgentSimulator/page.tsx`, not through the map page. Removing the map page's unconditional render costs no capture.
- **The demo sequence refuses a map that holds real work.** Even opted in, replaying fixture nodes over a map someone is actually thinking on is destructive, and the content is not obviously fake — "People reread their own notes" reads exactly like a real assumption. The panel checks the map first and says why it declined rather than writing.
- **`workedByAgent` becomes "demote", not "hide".** The original intent is right — a map an agent has already worked is not waiting for one, so it should not be pitched a big lime handoff band. But hiding it *entirely* means a person whose agent has detached has no on-screen route back, which is precisely the state this report describes. So: attached → render nothing (unchanged); not attached but previously worked → a compact reattach strip carrying the prompt and the MCP line; not attached and never worked → the full band (unchanged).
- **The MCP door becomes copyable, not described.** `attachHint` today is one sentence naming `npm run mcp` and `/api/mcp` in prose. An agent reading the page needs a command it can act on, so `handoffCopy` gains an `mcpCommand` rendered through the existing `CopyablePrompt`. `handoffCopy` stays pure, so the page's origin arrives as an argument rather than being read from `window` inside it.
- **No change to the tools, the catalog, or `agentDemo`'s content.** The sequence is still the best written description of one agent turn in the repo, and `app/isolated-components/AgentSimulator/page.tsx` is still where it is demonstrated. What changes is *where it can run*.

## Implementation

### 1. The map page stops rendering the panel unconditionally

**File**: `app/map/[id]/page.tsx`

Replace the `process.env.NODE_ENV === 'production' ? null : <AgentSimulator />` line with a render gated on an opt-in read from `searchParams` (`agentPanel=1`). The page already takes `params`; it gains `searchParams` alongside it, both `Promise`-typed as this Next version requires. The `NODE_ENV` check stays as an additional floor — the opt-in cannot summon the panel in a production build — but it is no longer sufficient on its own.

### 2. The demo sequence declines a map with real work on it

**File**: `app/components/AgentSimulator.tsx`

Before `runSequence` runs its first step, call `read_map` through the driver and count what is there. If the map holds more than the root seed node, or the log carries any event beyond the seed, do not run: append a line to the call log saying the sequence writes fixture content and this map already has real work on it, and stop. `runOne` is unaffected — a deliberate single call is the panel's other purpose and the person typing a tool name knows what they are doing.

**File**: `app/lib/agentDemo.ts`

Add the predicate as a pure function next to the sequence it guards — `demoWouldOverwrite(readMapResult): boolean` — so the rule is unit-testable rather than living inside a component callback, matching why `resultText` is already in this file.

### 3. The handoff band demotes instead of disappearing

**File**: `app/components/AgentHandoff.tsx`

`listening` keeps its current meaning and still returns `null`. `workedByAgent` stops being a second early return and instead selects a compact presentation: the eyebrow, the copyable start prompt, and the MCP command, without `HandoffInstruction`'s steps or `SeedIdeaQuote`. The full band is unchanged for a map nothing has touched.

**File**: `app/lib/handoffCopy.ts`

- Take an optional `origin` (the page's own origin) and a new `worked` flag.
- Add `mcpCommand: string` — the `claude mcp add --transport http thinking-map <origin>/api/mcp` form when an origin is given, falling back to `npm run mcp` when it is not (server render, before the client knows its origin).
- Add a `reattach` eyebrow/instruction pair for the demoted state — wording that says the map has been worked and how to pick it back up, not "no one is on this yet", which would be false.
- `attachHint` keeps its prose, which is still the honest explanation of *why* two doors exist.

**File**: `app/components/HandoffFootnote.tsx`

Render the `mcpCommand` through `CopyablePrompt` with `tone` left at its secondary default, beneath the existing explanation — the start prompt stays the primary action.

### 4. Tests

**File**: `app/components/AgentHandoff.render.test.tsx`

The existing agent-origin case flips from "renders nothing" to "renders the reattach strip" (see Reproduction Test). The connected and working cases still assert empty output and are untouched.

**File**: `app/lib/handoffCopy.test.ts`

New cases: `mcpCommand` names the given origin; with no origin it falls back to `npm run mcp`; the `worked` variant does not claim nobody is on it.

**New file**: `app/lib/agentDemo.test.ts` additions — `demoWouldOverwrite` is false for a map holding only its root seed node and true once anything else is on it.

**New file**: `app/components/AgentSimulator.render.test.tsx`

Opting in renders the launcher; the demo button on a map with real work logs the refusal and calls no write tool.

## Reused existing code

- `AgentSimulator` from `app/components/AgentSimulator.tsx` (glossary entry: `AgentSimulator`) — the panel being gated; its body is unchanged apart from the sequence guard.
- `AgentHandoff` from `app/components/AgentHandoff.tsx` (glossary entry: `AgentHandoff`) — the band whose disappearance hid the door.
- `handoffCopy` from `app/lib/handoffCopy.ts` (glossary entry: `handoffCopy`) — every string stays here, where the tests pin it; the new `mcpCommand` follows the same rule.
- `CopyablePrompt` from `app/components/CopyablePrompt.tsx` (glossary entry: `CopyablePrompt`) — already handles a clipboard refusal and keeps the text selectable, which is exactly what the MCP command needs; its `tone` prop means adding a second caller cannot restyle the primary one.
- `BridgeFixture` from `app/isolated-components/BridgeFixture.tsx` — how the render tests give a bridge state an isolated render cannot produce.
- `resultText` and `DEMO_SEQUENCE` from `app/lib/agentDemo.ts` — the guard joins them rather than being inlined into the component.
- **Existing-implementation survey**: there is no opt-in mechanism for dev-only UI anywhere in the repo today — `grep -rn "searchParams" app/map` returns nothing and no component reads a query flag, so the `?agentPanel=1` gate is genuinely new. `isWebMcpAvailable` / `webMcpUnavailableReason` in `app/lib/webmcp.ts` are the nearest existing gates and are deliberately NOT reused: they answer whether WebMCP can bind in this frame, which is false in captures *and* in an ordinary Chrome tab, so gating the panel on them would either hide it where it is needed or show it where it is not.

## Reproduction Test

Pins the trap: after any agent-origin event, a map with nothing attached shows no route back to an agent at all.

**Target**: `app/components/AgentHandoff.render.test.tsx` — run with `codeyam-editor editor refresh-tests --test AgentHandoff`.

Change to the existing case `renders nothing when the log already carries an agent-origin event`:

```diff
-  // Reopening a map an agent has already contributed to, in a browser with no
-  // agent. Bridge status alone would wrongly show the panel here.
-  it('renders nothing when the log already carries an agent-origin event', () => {
-    const { container } = render(
-      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
-        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
-      </BridgeFixture>,
-    );
-    expect(container.textContent).toBe('');
-  });
+  // Reopening a map an agent has already contributed to, in a browser with no
+  // agent. The full pitch would be wrong — but so is showing nothing: this is
+  // exactly the state where someone needs the way back in.
+  it('still offers a way back in on a map an agent has already worked', () => {
+    const { container } = render(
+      <BridgeFixture status="unavailable" events={[userEvent(), agentEvent()]}>
+        <AgentHandoff mapId={MAP_ID} seedIdea="A chore app" hasBrief={false} />
+      </BridgeFixture>,
+    );
+    expect(container.textContent).not.toBe('');
+    expect(screen.getByText(new RegExp(MAP_ID))).toBeTruthy();
+    expect(container.textContent).not.toMatch(/No one is on this yet/i);
+  });
```

Status: PROPOSED — confirm red at execution. Expected failure: `AgentHandoff` returns `null` on the `workedByAgent` branch today, so `container.textContent` is `''` and the `not.toBe('')` assertion fails first, with `getByText` then unable to find the map id.

## Scenarios to Demonstrate

- **A real map in dev, no opt-in** — the map with no agent panel anywhere on it, which is the whole point.
- **The same map with `?agentPanel=1`** — the collapsed launcher back in its corner.
- **The demo sequence declining** — the panel open on a map with real work, the call log carrying the refusal and no nodes added.
- **The demo sequence running** — the panel open on a fresh map holding only its seed, the sequence proceeding as it does today.
- **Reattach strip** — an unattached map an agent has already worked: the compact strip with the start prompt and the MCP command, and no "No one is on this yet".
- **Full handoff band, unchanged** — a brand-new map nothing has touched.
- **Attached agent** — nothing from this plan on screen at all.