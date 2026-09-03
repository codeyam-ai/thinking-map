---
title: "The Agent Waits For Your Answers"
mode: ui
createdAt: "2026-09-03T10:54:58Z"
source: manual
---

## Summary

A person answers the questions on their map and nothing happens: the agent
never comes back. This is not a lost message — it is an agent that was never
parked. The map `cmtle62i9…` ("fixing up an old car") shows the whole failure
in one log: the agent wrote 8 `open-question` nodes with `add_nodes` (r6–r13),
left a note (r17), and ended its turn. Three minutes later the person answered
six of them one at a time (r18–r29) and then typed a note by hand saying
everything was answered (r30). No `question.asked` event exists on that map, so
`ask_user` was never called; `await_user_activity` was never called either. The
answers landed in a log nobody was reading. Fix it where this app's only
steering channel is — the words an agent reads on every turn: the kickoff
prompts, the write-tool replies, and `await_user_activity`'s own replies, which
today actively invite the agent to stop waiting.

## Key Decisions

- **Steer through tool-reply text, not a new mechanism.** WebMCP is pull-only
  and the app is explicit that a page can never start an agent's turn. The
  established answer is `standingAskSentence()` in `mcpFormat.ts`, whose own
  comment says it: "the only place the ask can live is inside what the agent
  already reads on every turn." A standing *wait* is the same mechanism applied
  to the same constraint — not a second invention.
- **State a fact and a next call, the way the standing ask states a budget.**
  "N question(s) on this map are still open" plus the exact call to make
  (`await_user_activity` with `sinceRevision` and a real timeout) is actionable
  in a way "consider waiting" is not, and matches how `set_phase` and
  `read_brief` already steer.
- **`await_user_activity` returning per event is already the behavior the
  person expected.** It resolves the moment one user event lands, so
  answer-by-answer refinement needs no new plumbing — only an agent that is
  actually sitting in the call, and a reply that sends it back in afterwards.
- **Delete "or carry on" from the timeout reply.** That clause is a direct
  instruction to stop waiting, sitting in the one reply whose job is to send the
  agent back around. It is the single highest-leverage word change in the plan.
- **Raise `DEFAULT_TIMEOUT_SECONDS` from 30 to 300.** Thirty seconds is far
  below how long a person takes to answer a question thoughtfully — in the
  recorded session the first answer arrived three minutes after the agent
  stopped. `MAX_TIMEOUT_SECONDS` (600) is unchanged, so the ceiling that stops a
  confused agent pinning a connection open still holds.
- **Do not forbid `add_nodes` from writing open-questions.** The agent's batch
  call (8 questions + a gap + a direction + an experiment) is the natural and
  correct shape. The fix is that writing an open question now tells the agent
  what it owes, not that it is rejected.
- **The "agent has left" case is largely already handled** by `HandoffReattach`
  via `handoffCopy({ worked: true })`, which is what that map would have
  rendered. The only gap worth closing there is that its resume prompt does not
  mention the answers already waiting — one copy change, not a new surface.

## Implementation

### 1. A standing wait, beside the standing ask

**File**: `app/lib/mcpFormat.ts`

Add `standingWaitSentence({ open, revision })` and `formatStandingWait(...)`
next to `standingAskSentence` / `formatInsightStanding`, pure and testable on
the same reasoning those are. When one or more open questions are on the map it
returns the fact and the call — the number still open, and
`await_user_activity` with `sinceRevision: <revision>` and a timeout in the
hundreds of seconds — plus the sentence that closes the loop: it returns as soon
as one answer lands, and the agent should handle it and call again rather than
finish. With nothing open it returns an empty string, so callers can append
unconditionally and a map with no questions gains no noise.

### 2. Count open questions on the server side

**File**: `app/lib/mcpFormat.ts`

`roundProgress` in `app/lib/roundProgress.ts` is the page-side definition and
operates on `FlatNode` with an answers map, so it is not reusable here. Add the
server-side equivalent as a small pure helper taking the node rows `getMap`
already returns (`app/lib/mapStore.ts:157`): nodes of kind `open-question` whose
`status` is not `answered`. Keep it beside the formatter so the count and the
sentence that reports it cannot drift.

### 3. Append the standing wait to the replies that end a turn

**File**: `app/lib/toolRuntime.ts`

Four replies today end on a revision number and nothing else, which reads as a
completed turn:

- `add_nodes` (line 224) — `"Added N node(s)…"`. This is the call that created
  every question in the recorded session.
- `post_note` (line 325) — `"Noted…"`. The natural last call of a batch, and
  the last thing the agent did before going quiet.
- `create_themes` (line 89) and `set_phase` (line 303) — same shape; `set_phase`
  already demonstrates the append-guidance pattern with its `next-steps` clause,
  so the wait goes after that guidance rather than replacing it.

Append `formatStandingWait(...)` to each, computed from the post-write revision.
Follow `read_map`'s delta branch (line 61), which already pays for a `getMap`
specifically so the standing ask appears on the call a working agent actually
makes — the same trade applies here and for the same stated reason.

### 4. Stop `await_user_activity` inviting the agent to leave

**File**: `app/lib/toolRuntime.ts`

In `await_user_activity` (line 425):

- **Timeout branch** (line 434): the text currently reads *"Nothing from them
  yet. The map is still at revision N — wait again from there, or carry on."*
  Drop "or carry on" and make waiting again the instruction, naming the call and
  the cursor. Keep it honest about the ceiling: an agent that genuinely has
  other work is not being forbidden anything, but the default this reply
  suggests must be the loop.
- **Answered branch** (line 444): after reporting what the person did, append
  the standing wait — with questions still open, the agent's next move after
  acting on this answer is another `await_user_activity` from the new revision.
  This is the sentence that turns one answer into the answer-by-answer
  refinement the person expected.

Also raise `DEFAULT_TIMEOUT_SECONDS` in **`app/lib/toolCatalog.ts`** (line 367)
from 30 to 300, and update `await_user_activity`'s description (line 351) so a
discovering agent reads the loop, not just the single call. `MAX_TIMEOUT_SECONDS`
stays at 600.

### 5. Put the loop in the prompt the person actually pastes

**File**: `app/lib/handoffCopy.ts`

`startPrompt` (line 213) currently reads *"Work on thinking map X — '…'. Start
with read_map, then deconstruct the idea."* and `attachedStartCopy.prompt`
(line 87) names `create_themes` and `add_nodes` explicitly. Both describe a
one-shot turn, and the recorded session followed them exactly. Extend both with
the second half of the job: after writing the questions, wait on
`await_user_activity` and keep waiting — each answer is a turn, not the end of
one. Keep the existing "the map is the output" clause; this adds to it rather
than replacing it.

Also extend the `worked: true` branch: its eyebrow ("The agent that was here has
gone") and `startPrompt` should carry the revision to resume from, so pasting it
picks up the answers already sitting unread rather than re-reading from scratch.
This needs a resume revision passed into `HandoffCopyInput` — the board already
knows it as `bridge.revision`.

## Reused existing code

- `standingAskSentence` / `formatInsightStanding` from `app/lib/mcpFormat.ts` —
  the pattern this plan extends, including the reasoning for why steering lives
  in reply text at all.
- `getMap` from `app/lib/mapStore.ts` — already used by `read_brief` and by
  `read_map`'s delta branch for exactly this kind of append.
- `roundProgress` from `app/lib/roundProgress.ts` — the page-side definition of
  "open questions" this mirrors; deliberately not reused, since it takes
  `FlatNode` and a client answers map.
- `handoffCopy` / `attachedStartCopy` from `app/lib/handoffCopy.ts` (glossary
  entries: `handoffCopy`, `attachedStartCopy`), already pinned by
  `app/lib/handoffCopy.test.ts`.
- `waitForUserActivity` from `app/lib/exchange.ts:335` — unchanged. It already
  returns on the first user event, which is why no new plumbing is needed.
- `HandoffReattach` from `app/components/HandoffReattach.tsx` — the existing
  "an agent worked here and has since detached" surface; reused, not replaced.

**Existing-implementation survey.** Grepped for an existing standing-wait or
open-question-count on the tool-reply side: nothing equivalent exists.
`standingAskSentence` covers insights only, and `roundProgress` is page-side.
The only existing timeout knobs are the two
constants declared in `app/lib/toolCatalog.ts:367`; this plan changes one
default and adds no new field.

## Reproduction Test

The prompt a person copies to start an agent describes a one-shot turn and
never tells it to wait, which is why the agent that wrote eight questions
stopped instead of parking.

**Target**: `app/lib/handoffCopy.test.ts` — run with
`codeyam-editor editor refresh-tests --test handoffCopy`.

```ts
// The start prompt has to name the WAIT, not just the write. An agent told to
// deconstruct and nothing more does exactly that and ends its turn, which is
// how a person's answers land in a log nobody is reading.
it('tells the agent to keep waiting after it writes the questions', () => {
  const copy = handoffCopy({ mapId: 'm1', seedIdea: 'fix up an old car', hasBrief: false });
  expect(copy.startPrompt).toContain('await_user_activity');
});
```

Status: PROPOSED — confirm red at execution. Expected failure: `startPrompt` is
currently `Work on thinking map m1 — "fix up an old car". Start with read_map,
then deconstruct the idea.`, which contains no `await_user_activity`, so the
`toContain` assertion fails.

The tool-reply half of the fix is pinned by further tests added at execution
against `app/lib/mcpFormat.test.ts` (the standing-wait sentence, and its empty
string when nothing is open) — those name a function that does not exist yet, so
they are not the red-first repro.

## Scenarios to Demonstrate

- A map with eight open questions and none answered — the state the agent
  should be parked on.
- The same map after one answer lands, with seven still open: the reply an
  agent gets back, showing the answer and the instruction to wait again.
- A map with every question answered — the standing wait is absent, and the
  agent is free to move the phase on.
- A map with no questions at all — no wait sentence anywhere, no added noise.
- The handoff panel on a map an agent worked and left, with six answers waiting
  unread and a resume prompt carrying the revision.
- A timed-out `await_user_activity`, showing the reply that sends the agent back
  into the wait rather than out of it.