---
title: "The Round Ends Itself"
mode: ui
createdAt: "2026-09-02T20:11:55Z"
source: manual
dependsOn: ["the-conversation-gets-out-of-the-way"]
---

## Summary

Answering the last open question on the board should end the round by itself.
Today it lights up a button and waits. Worse, the thing that button is a step
towards — the conclusion, the scope, the how-you-might-build-this — cannot be
reached from the board at all: the only component that moves a map's phase from
the page hangs off a view the app stopped rendering. Make the round close
itself when the board is fully answered, reconnect phase advancement to the
board, and give the agent an explicit basis for the decision it is being asked
to make each time — another row of questions, or the conclusion.

## The gap this actually closes

Phase advancement exists and is orphaned. The chain is
`MapWorkspace → ThinkingMapView → RowFooter → PhaseAdvance → useAdvancePhase`,
and `MapWorkspace` is imported by nothing but its own isolate. `MapScreen`
renders `BoardWorkspace` instead, which has no phase control of any kind.

So on the board a person is looking at today, **nothing on the page can move
the phase**. `useAdvancePhase`'s own doc comment says it was written to fix
precisely this — *"until now the phase only ever moved because an agent moved
it, which meant a person who had answered everything had to go to the other
window and ask"* — but it was wired into the view that the galaxy board
replaced. `MapScreen` renders `SummaryScreen` when the phase is `next-steps`,
so the destination is built and reachable; the road to it is not.

That is why "give me a conclusion and next steps" reads as a missing feature.
Most of it is built. It is disconnected.

## Key Decisions

- **The round ends on the board being answered, not on a click.**
  `BoardWorkspace` already computes `openCount` — open questions of kind
  `open-question` — and `RoundControl` already renders "Everything on the board
  is answered" when it reaches zero. That condition, plus at least one answer
  given this round, is the trigger. It is a state the app already knows and
  already says out loud; this plan acts on it instead of narrating it.

- **A grace window, not an instant fire.** Auto-advancing the moment the last
  answer lands takes away the person's chance to add a general note about the
  round they just finished — the exact channel
  `the-conversation-gets-out-of-the-way` is making prominent. A short countdown
  with a visible cancel, that any typing also cancels, keeps automation from
  being a thing done TO them. The countdown replaces "Next round →" as what
  `RoundControl` renders in that state; the manual press stays available as
  "go now".

- **The agent decides more-or-conclude; the app only tells it that it must.**
  Whether another row of questions is needed is a judgment about the thinking,
  and the app cannot make it. What the app can do is stop sending the flat note
  it sends today — *"Ready for the next round — bring what you have made of
  this"* — and send one that names the fork: everything on the board is
  answered; either add what is still missing, or draw the conclusion. Without
  that, an agent has no reason to ever stop adding cards.

- **Termination comes from the phase arc, which already has an end.**
  `PHASE_ASK` runs map → research → explore → next-steps, and `next-steps` has
  `next: null` and no action — the loop arrives there. A self-advancing round
  needs a stopping condition, and this is it: the rounds carry the map along
  that arc, and the arc ends. Do not invent a round counter.

- **Reconnect `PhaseAdvance` to the board rather than rebuild it.** It renders
  `PHASE_ASK[phase].sentence` and `.action`, and delegates the note-then-phase
  ordering to `useAdvancePhase` — including the deliberate detail that the note
  lands BEFORE the phase so an agent reading the log finds an explanation
  rather than a phase that changed under it. All of that is correct and none of
  it should be written twice.

- **`BoardWorkspace` does not currently receive the phase.** `MapScreen` has it
  and uses it for `dense` and for the `next-steps` switch, but does not pass it
  down. It has to, and that is the smallest part of this plan and the one
  without which none of the rest works.

## Implementation

### 1. Let the board know where it is

**File**: `app/components/MapScreen.tsx`

Pass `phase` into `BoardWorkspace`. It already holds it.

**File**: `app/components/BoardWorkspace.tsx`

Accept `phase`. It already holds `mapId` and the bridge's `contribute`, which
is everything `useAdvancePhase` needs.

### 2. Close the round when the board is answered

**File**: `app/components/BoardWorkspace.tsx`

`openCount` and `answeredThisRound` already exist. When `openCount` reaches
zero with `answeredThisRound > 0` and the phase is not `waiting`, start the
grace countdown; on expiry, do what `onNext` does today. Cancel on an explicit
press, and on the person typing into the chat.

Keep the existing wait mechanism untouched: `phase === 'waiting'` already ends
when `bridge.revision` rises past where it stood at the ask, which is the right
condition — the round ends when the map actually moves, not on a timer.

Note for execution: `router.refresh()` fires on every revision bump, so the
countdown state must survive a re-render of the server component. Hold it in a
ref or key it off something stable, or an agent writing anything at all will
reset it.

### 3. Say what is being asked for

**File**: `app/components/BoardWorkspace.tsx`

Replace the flat `user.note` in `onNext` with one that names the fork — the
board is fully answered; add what is missing, or draw the conclusion — and
include the phase so the note is specific about which conclusion is due.
`PHASE_ASK[phase].sentence` is already written for exactly this moment and
should be the source of those words rather than a second set beside it.

**File**: `app/lib/toolCatalog.ts`

`set_phase`'s description should teach the same arc: this is how a map reaches
`next-steps`, and `next-steps` is where the plan, the scope and the suggested
build order belong. This is the half of the change that determines whether the
agent actually produces a scope and references when it gets there, rather than
another row of questions — the app can only ask.

### 4. Offer the step, on the board

**File**: `app/components/BoardWorkspace.tsx`

Render `PhaseAdvance` where the round control lives, so once a phase's work is
done the person can move the map on from the board instead of from a view the
app no longer shows. It returns null for `idea` and `next-steps` on its own, so
it costs nothing on the phases that have no page-side end.

Check `RowFooter` while here: it is `PhaseAdvance`'s only current caller and it
sits on the orphaned chain. If nothing else revives that chain, say so rather
than leaving two callers where one is dead.

## Reused existing code

- `useAdvancePhase` from `app/hooks/useAdvancePhase.ts` — the note-then-phase
  ordering, reused rather than reimplemented.
- `PhaseAdvance` from `app/components/PhaseAdvance.tsx` (glossary entry:
  `PhaseAdvance`) — reconnected, not rewritten.
- `PHASE_ASK`, `PHASE_LABELS` and `PHASES` from `app/lib/mapKinds.ts` — the arc,
  its sentences and its end.
- `RoundControl` from `app/components/RoundControl.tsx` — its open/answered
  counts and waiting state already describe this moment; it gains the countdown
  state.
- `BoardWorkspace` from `app/components/BoardWorkspace.tsx` — `openCount`,
  `answeredThisRound`, `onNext`, and the revision-watching effect all stay.
- `SummaryScreen` from `app/components/SummaryScreen.tsx`, with `BuildSequence`
  and `NextStepsTrack` — the destination, already built. Confirm what they
  cover against the ask for scope, references and a build order; anything
  genuinely missing there is a separate plan, not a quiet addition to this one.
- `set_phase` in `app/lib/toolRuntime.ts` and `app/lib/toolCatalog.ts` — the
  tool the hook already calls.

**Existing-implementation survey.** The phase machinery, the advance hook, the
advance button, the summary destination and the open-question count ALL exist.
Nothing here is a new mechanism. What does not exist: any automatic trigger on
the round, any path from the galaxy board to a phase change, and any note that
tells the agent it is at a decision point rather than at another round.

## Scenarios to Demonstrate

- The last open question answered — the countdown running, with its cancel
  visible. The moment this plan is about.
- The countdown cancelled by typing in the chat, the board holding.
- The round fired, the board waiting on the partner.
- A board with questions still open — no countdown, the ordinary state, proving
  the trigger is the condition and not the passage of time.
- An agent that answers the fork by adding another row — new cards, a new
  round.
- An agent that answers it by concluding — the map at `next-steps` and
  `SummaryScreen` on screen, which is the whole point and is currently
  unreachable from the board.
- The board mid-phase with `PhaseAdvance` showing its sentence and action.
- `next-steps` reached, where `PhaseAdvance` correctly draws nothing.