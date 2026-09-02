---
title: "Restore the Agent Handoff Surface the Merge Dropped"
mode: ui
createdAt: "2026-09-02T19:16:51Z"
source: manual
---

## Summary

The merge in `e842ce6` took the redesigned branch's version of the map screen and the map route wholesale, and in doing so silently dropped two pieces of agent-handoff behaviour that main had shipped and reviewed. Today a person who opens a map with no agent attached sees "No agent attached" in the header, an unexplained `r14` badge beside it, and nothing else — no start prompt, no MCP command, no route to change the situation. Meanwhile the dev agent panel is back to rendering on every `npm run dev` session, which is the exact bug `e3673c1` fixed: an agent driving the browser finds the panel, presses "Run the demo sequence", and writes invented nodes onto a real map. This plan restores both, removes the cryptic revision badge, and adds the screen-level test whose absence let both regressions through a 586-test suite.

## Key Decisions

- **Restore the band above the board, not as an overlay.** The full lime `AgentHandoff` band goes back between `AppHeader` and the workspace as a `shrink-0` flex child, exactly as main had it, with `dense={phase === 'next-steps'}`. An overlay over the board was considered and rejected: this band is the one thing on the screen asking to be acted on, and it has to win that comparison against a whole board — floating it would make it competing chrome beside `BoardChat` rather than the page's instruction. Costing the board height on a map nobody is attached to is the correct trade, because a board nobody is working is not the thing the person needs right now.
- **Delete the revision badge rather than labelling it.** `r{revision}` is a debugging aid that leaked into the product header, and next to "No agent attached" it reads as a build tag on an error. The log it counts is already visible in `BoardChat`, so the number buys the person nothing. `BridgeState.revision` itself stays — `BoardWorkspace` depends on it for the live-refresh trigger and the waiting-for-activity check — only the header's display of it goes.
- **Reuse `agentPanelRequested` as-is.** The helper and its tests survived the merge intact and are currently imported by nothing; this is a two-line reconnection, not a re-implementation. No behavioural change to the gate itself.
- **The new test asserts mounting, not appearance.** Every existing test renders `AgentHandoff` and `agentPanelRequested` in isolation, and all of them still pass against the broken screen — that is precisely why the regressions were invisible. The test this plan adds asserts that `MapScreen` puts the band on the page, which is the assertion that was missing.

## Implementation

### 1. Render the handoff band again

**File**: `app/components/MapScreen.tsx`

`AgentHandoff` is imported at the top of the file and never used; `brief` is declared as a prop and never read. The merge kept main's import list and prop signature but the branch's body, which is why both are dangling.

Render the band between `<AppHeader>` and the phase branch, guarded on `currentId` being present, passing `seedIdea`, `hasBrief`, and `dense={phase === 'next-steps'}`. Do **not** wrap it in a sizing div: this main is a flex column with a `gap`, and `AgentHandoff` hides itself by returning `null` — a wrapper would remain a zero-height flex item collecting a gap on either side and push the board down on every map an agent has already worked. The band carries its own `shrink-0`. Main's original comment recording that reasoning was lost in the merge and should come back with the code.

Retype the `brief` prop from `unknown` to something the screen can actually ask a question of. All this component needs from it is whether a brief exists, for `hasBrief`; keep the prop optional so an isolated scenario can mount the screen without inventing one.

### 2. Pass the brief through from the route

**File**: `app/map/[id]/page.tsx`

The route computes `const brief = map.brief ?? null` and passes it nowhere. Pass it to `MapScreen` so `hasBrief` is answerable — `handoffCopy` uses it to decide which tool the start prompt names, so getting it wrong hands the person a prompt naming the wrong entry point.

### 3. Restore the `?agentPanel=1` gate

**File**: `app/map/[id]/page.tsx`

Replace `{process.env.NODE_ENV === 'production' ? null : <AgentSimulator />}` with the opt-in gate, importing `agentPanelRequested` and `QueryParams` from `app/lib/agentPanel.ts`. This also revives `const query = await searchParams`, which is currently dead — the gate was its only consumer.

The production floor lives inside `agentPanelRequested`, so no separate `NODE_ENV` check belongs at the call site. `AgentSimulator`'s docstring already describes this behaviour ("Rendered only where a person has deliberately asked for it — `?agentPanel=1`, with a production floor underneath"); after this change the docstring is true again.

### 4. Remove the revision badge

**File**: `app/components/AgentStatus.tsx`

Drop the `r{revision}` span and `revision` from the `useWebMcpBridge()` destructure. Leave `status`, `reason` and `tools` alone — the headline and the `UNAVAILABLE_HELP` tooltip are doing their job.

`BridgeReadout` in `app/isolated-components/WebMcpBridge/BridgeReadout.tsx` keeps its own revision display and is deliberately untouched: it is a diagnostic readout that exists to make bridge state visible, where a raw revision is the point rather than an intrusion.

### 5. Reconnect the JustArrived scenario

**File**: `app/isolated-components/MapScreen/page.tsx`

The scenario table still carries `mapId` and `seedIdea` fields on the `JustArrived` fixture, with a comment reading "Passing one mounts the handoff band" — but `<Component>` passes neither, using a module-level `SEED_IDEA` constant instead. Both fixture fields are dead, which means `mapscreen-justarrived` currently captures the same screen as `mapscreen-noagent` and demonstrates nothing about the feature it was written for.

Wire `mapId={fixture.mapId}` and the fixture's own `seedIdea` (falling back to `SEED_IDEA`) through to the component, so the JustArrived capture shows the band again and the two scenarios differ by what they mean to show.

### 6. Add the screen-level test

**New file**: `app/components/MapScreen.render.test.tsx`

See the Reproduction Test section below.

## Reused existing code

- `agentPanelRequested` from `app/lib/agentPanel.ts` (glossary entry: `agentPanelRequested`) — the query-param gate with the production floor, already covered by `app/lib/agentPanel.test.ts`. Currently orphaned; this plan reconnects it without changing it.
- `AgentHandoff` from `app/components/AgentHandoff.tsx` (glossary entry: `AgentHandoff`) — the band itself, including its own decision about when to appear at all and when to demote to `HandoffReattach`. Fully intact and tested; only its mounting was lost.
- `HandoffReattach` from `app/components/HandoffReattach.tsx` (glossary entry: `HandoffReattach`) — the one-row variant for a map an agent has already worked, reached through `AgentHandoff`'s own `workedByAgent` branch. Nothing in this plan calls it directly.
- `handoffCopy` from `app/lib/handoffCopy.ts` (glossary entry: `handoffCopy`) — every string the band shows, including the `hasBrief`-dependent start prompt and the origin-dependent `mcpCommand`. Pinned by `app/lib/handoffCopy.test.ts`.
- `BridgeFixture` from `app/isolated-components/BridgeFixture.tsx` — supplies a bridge state an isolated render cannot produce; the new test mounts through it exactly as `app/components/AgentHandoff.render.test.tsx` does.
- `AgentSimulator` from `app/components/AgentSimulator.tsx` (glossary entry: `AgentSimulator`) — unchanged; only its render gate at the call site moves.

**Existing-implementation survey:** no new config field, threshold, or gate dimension is introduced. `agentPanelRequested` is the already-implemented gate and is reused verbatim rather than reproduced.

## Reproduction Test

Pins that `MapScreen` actually mounts the handoff band when no agent is attached — the assertion whose absence let the band become a dangling import that still type-checked and still passed every existing test.

**Target**: `app/components/MapScreen.render.test.tsx` (new) — run with
`codeyam-editor editor refresh-tests --test <name>`.

The board is stubbed out deliberately, following the pattern in `app/components/BoardWorkspace.render.test.tsx`: what is under test is whether the screen composes the band, not the canvas, and rendering the real board drags in a router, a layout and a camera to assert nothing about any of them.

```tsx
// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import BridgeFixture from '../isolated-components/BridgeFixture';

vi.mock('./BoardWorkspace', () => ({
  default: () => <div data-testid="board" />,
}));
vi.mock('./SummaryScreen', () => ({
  default: () => <div data-testid="summary" />,
}));

const { default: MapScreen } = await import('./MapScreen');

const props = {
  phase: 'idea' as const,
  seedIdea: 'A tool for tracking what I read',
  currentId: 'map-under-test',
  themes: [],
  nodes: [],
};

afterEach(cleanup);

describe('MapScreen', () => {
  // The regression this pins: the band was a dangling import for the whole of
  // the board redesign. It type-checked, and every AgentHandoff test kept
  // passing, because they all render the band directly. Nothing asserted the
  // screen put it on the page — so a person on a map with no agent got the
  // header's "No agent attached" and no route to change that.
  it('mounts the handoff band when no agent is attached', () => {
    render(
      <BridgeFixture status="unavailable" events={[]}>
        <MapScreen {...props} />
      </BridgeFixture>,
    );
    expect(screen.getByText(/No one is on this yet/i)).toBeTruthy();
  });

  // The other half of the same contract: an attached agent means the band must
  // NOT be there, and a screen that never mounts it also passes that. Asserting
  // both is what makes the pair meaningful.
  it('leaves the band off when an agent is attached', () => {
    render(
      <BridgeFixture status="connected" events={[]}>
        <MapScreen {...props} />
      </BridgeFixture>,
    );
    expect(screen.queryByText(/No one is on this yet/i)).toBeNull();
  });
});
```

Status: PROPOSED — confirm red at execution. Expected failure: the first case fails at `getByText`, because `MapScreen` imports `AgentHandoff` but never renders it, so the band's copy is absent from the tree — testing-library reports "Unable to find an element with the text: /No one is on this yet/i". The second case passes before the fix as well as after, which is exactly why it cannot stand alone.

The wording matched here comes from `handoffCopy` and is pinned there; if that copy changes, this test should follow it rather than duplicate the assertion about wording.

## Scenarios to Demonstrate

- **Just arrived, nobody attached** — a map one node old, no agent, the full lime band leading the page with the copyable start prompt and the board visible underneath it. The moment the whole feature exists for, and the scenario `mapscreen-justarrived` was written for before it went dead.
- **Started from a brief, nobody attached** — same state with `hasBrief` true, so the start prompt names the brief-reading entry point rather than the seed-idea one.
- **Agent has worked this map and left** — the log carries agent-origin events and no agent is attached, so the band demotes to the one-row `HandoffReattach` strip: the prompt naming this map and the MCP command, and none of the first-meeting steps.
- **Finished plan, nobody attached** — `phase: 'next-steps'`, where `dense` collapses the strip to a single row so the summary the person came back to read keeps the screen.
- **Agent attached** — the band absent entirely, the header saying so without a revision badge beside it, the board holding the full height.
- **Dev panel, opted in vs not** — the map route at `?agentPanel=1` showing the collapsed launcher, and the same map without the param showing nothing at all.