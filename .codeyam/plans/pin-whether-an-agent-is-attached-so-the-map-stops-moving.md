---
title: "Pin whether an agent is attached, so the map stops moving"
mode: ui
createdAt: "2026-09-03T19:33:15Z"
source: manual
---

## Summary

Whether the map gets the whole screen or half of it is decided by a live network
connection that no scenario controls, so the same scenario captures two entirely
different layouts depending on what happened to be running at capture time.

`AgentHandoff` gates on `listening = bridge !== null && bridge.status !== 'unavailable'`
(`app/components/AgentHandoff.tsx:61`), where `bridge` comes from `useWebMcpBridge()`
in `app/components/BoardWorkspace.tsx:70` — a real WebMCP client attached to the page.
Every application scenario seeds agent-origin events, so `workedByAgent` is true, and
the branch that runs is decided purely by `listening`:

- **bridge present** → `return null`, and the map fills the viewport under the header.
- **bridge absent** → `HandoffReattach` renders "THE AGENT THAT WAS HERE HAS GONE /
  Pick this back up", a tall panel carrying the full start prompt and the MCP command.

Measured on 2026-09-03: the committed frames for `sprawling-a-deep-wide-map`,
`mid-exchange-agent-and-human-on-one-map`, `brief-attached-nothing-cited-yet`,
`brief-fully-accounted-for`, `partly-answered-two-settled-one-open` and
`the-map-builds-downward-four-rounds` all showed the map starting 9.2% down the frame
and filling 87.5% of it. A plain `recapture-stale` on those same six slugs, changing
nothing, moved every one of them to 50–58% down and 39–46% tall. Nothing about the
scenarios changed; only the presence of a bridge did.

Two costs. The public README gallery silently degrades — a routine recapture replaced
the map with a handoff panel under captions that promise a map. And the app's primary
state, *a map with an agent working on it*, has no scenario that reliably reproduces
it, so it cannot be reviewed, diffed, or regression-tested.

## Key Decisions

- **Make bridge presence a declared property of the scenario, not an accident of the
  environment.** The point of a scenario is that it pins a state. `listening` is
  currently the one input to this screen's layout that the scenario cannot state, which
  is why the output is not reproducible. Everything else on these boards — nodes,
  answers, agent notes, briefs — is already seeded.

- **Model the bridge's real states, not a boolean.** `useWebMcpBridge` returns `null`
  or an object with a `status`, and `AgentHandoff` distinguishes `'unavailable'` from
  the rest while `NodeQuestionComposer` uses the same predicate. A scenario should be
  able to say *absent*, *attached and idle*, or *attached and working*, because those
  are three genuinely different screens and at least two of them are worth capturing.
  A boolean would collapse the distinction the code already draws.

- **Absent stays the default.** A scenario that says nothing keeps today's behaviour,
  so this cannot change any existing capture that does not opt in. `AgentHandoff`'s own
  comment already calls no-bridge "an isolated scenario — honest absence", and that
  remains right; the defect is that it is currently the *only* reachable answer some
  days and not others.

- **Do not fake it by seeding an agent event.** `workedByAgent` is already true on
  every one of these maps and does not help — it selects *which* handoff panel renders,
  not whether one does. Any fix that works by adding seed rows is addressing the wrong
  predicate.

- **Fix the flakiness, then fix the gallery — in that order.** Re-picking README
  images first would just re-arm the same trap: the next recapture would swap them
  back. The gallery is only durable once the state is pinned.

## Implementation

### 1. Let a scenario declare the bridge state

**File**: `app/components/WebMcpBridge.tsx`

`useWebMcpBridge()` is the single seam — `BoardWorkspace` is its only consumer for
this purpose. Give it an override read at capture time, checked before it looks for a
real WebMCP client, accepting the three states above (absent / attached-idle /
attached-working) and shaped so the returned object is indistinguishable from a real
bridge to every consumer.

Read the override from something a scenario can set without a live agent — the same
mechanism the project already uses to put a scenario into a state. Prefer whatever
`.codeyam/scenario-handlers.js` and the seed adapter already have available over
inventing a new channel; a URL parameter or a seeded row are both better than a
build-time flag, because the dev server starts once and a launch-time value cannot
vary per scenario.

### 2. Confirm the two other consumers agree

**File**: `app/components/NodeQuestionComposer.tsx`

`AgentHandoff:57` records that this component deliberately shares the `listening`
predicate, and that the two disagreeing would be worse than either being wrong. Check
it and the header's "Agent attached" indicator resolve from the same overridden value,
so a scenario cannot produce a frame whose header and body contradict each other.

### 3. Pin the primary state as its own scenario

**New file**: `.codeyam/scenarios/the-agent-is-working-on-the-map.json`

An application scenario declaring an attached, working bridge over a map with enough
substance to read at gallery size — several branches, a mix of answered and open
questions, insights standing at the far end. This is the state the product is *for*
and currently the only major state with no capture. Seed it from the same shape as
`sprawling-a-deep-wide-map`, which is already the richest board in the set.

### 4. Re-pin the six scenarios that flip

**Files**: the scenario definitions for `sprawling-a-deep-wide-map`,
`mid-exchange-agent-and-human-on-one-map`, `brief-attached-nothing-cited-yet`,
`brief-fully-accounted-for`, `partly-answered-two-settled-one-open`,
`the-map-builds-downward-four-rounds`

Declare the bridge state each one means, then recapture and confirm the frames stop
moving: two consecutive `recapture-stale` runs must produce byte-identical PNGs. That
equality is the actual proof this plan worked, and it is not provable today.

Keep at least one scenario deliberately declaring *absent*, so the handoff panel keeps
its own coverage — it is a real state a real visitor sees, and it should be captured on
purpose rather than by accident.

### 5. Rebuild the README gallery on the pinned frames

**File**: `README.md`

With the frames stable, choose gallery images for what they show rather than for what
survived the last recapture, and write the captions against the frames. Note that the
gallery currently sits outside the `codeyam:scenario-gallery` markers because
`readme-sync` overwrites anything inside them.

## Reused existing code

- `useWebMcpBridge` from `app/components/WebMcpBridge.tsx` — the single seam every
  consumer of bridge state already goes through, so an override there needs no changes
  at the call sites.
- `AgentHandoff` from `app/components/AgentHandoff.tsx` — the `listening` /
  `workedByAgent` predicates stay exactly as written; this plan changes what feeds
  them, not how they decide.
- `BoardWorkspace` from `app/components/BoardWorkspace.tsx` — holds the only
  `useWebMcpBridge()` call for the board.
- `.codeyam/scenario-handlers.js` and the seed adapter — the existing per-scenario
  state channel, to be reused rather than duplicated.

**Existing-implementation survey.** Nothing equivalent exists. There is no scenario
field, URL parameter, or mock covering bridge presence today: `AgentHandoff` reads only
the live hook, and the existing `boardworkspace-*` component scenarios (including
`boardworkspace-working-agent` and `boardworkspace-noagent`) reach their states by
passing props directly to the component in isolation — which is why they render
correctly and the application scenarios do not. That isolated-component path is the
proof the states are renderable; what is missing is a way to reach them through the
real page.

## Reproduction Test

Pins the flakiness itself: the rendered handoff state is decided by ambient bridge
presence rather than by the scenario, so the same inputs produce two different screens.

**Target**: `app/components/AgentHandoff.render.test.tsx` (new) — run with
`codeyam-editor editor refresh-tests --test agent_handoff_respects_declared_bridge_state`.

```tsx
// A scenario that declares an attached, working bridge gets the map, not the
// handoff panel. Today `listening` comes only from a live WebMCP client, so a
// capture with no agent connected renders "Pick this back up" over the top half
// of the screen — which is how a routine recapture silently replaced the README
// gallery's map screenshots with a panel.
it('agent_handoff_respects_declared_bridge_state', () => {
  renderWithScenarioBridge({ bridge: 'attached-working' }, <AgentHandoff {...props} />);

  expect(screen.queryByText(/Pick this back up/i)).toBeNull();
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `renderWithScenarioBridge`
does not exist yet, so this does not compile. Once it exists as a thin wrapper that
renders with no real bridge, the assertion fails because `listening` is false and
`workedByAgent` is true, so `HandoffReattach` renders "Pick this back up". Step 1 is
what turns it green.

The declared-state vocabulary here (`'attached-working'`) is provisional — settle it in
step 1 and update this test to match rather than bending step 1 to this string.

## Scenarios to Demonstrate

- **The primary state, finally capturable** — a rich map with an agent attached and
  working, filling the viewport under the header. The new scenario from step 3.
- **The same map, agent absent** — the handoff panel, captured deliberately, so the
  reattach route keeps its coverage.
- **Attached but not yet working** — the third branch (`AgentStartCue`), which is
  reachable in code today and captured by nothing.
- **Two consecutive recaptures of all six re-pinned scenarios produce identical PNGs** —
  the regression this plan exists to prevent, and the only demonstration that actually
  proves it.