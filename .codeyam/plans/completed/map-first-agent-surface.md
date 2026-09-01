---
title: "Map-First Agent Surface"
mode: ui
createdAt: "2026-09-01T00:30:47Z"
source: manual
dependsOn: ["webmcp-exchange-spine"]
---

## Summary

With the agent living in the browser rather than inside the app, the in-page chat is
both unnecessary and impossible: the page has no access to the agent's conversation, and
under WebMCP it never will. So the chat comes out — `ConversationPanel`, `ReplyForm`, the
two bubble components, and the server-side model loop in `thinkingPartner.ts` that only
existed to run the conversation here. The map becomes the whole surface.

What replaces the chat is not a smaller chat. It is the half of the exchange the page is
actually responsible for: showing what the agent just did and what it is waiting on, and
giving the person direct ways to put information into the map — answer an open question
inline, add a node, leave a note for the agent — each of which lands in the event log the
agent reads on its next turn. The map stops being a read-only render of the agent's
output and becomes a shared artifact both parties write to. Depends on the exchange spine
plan for the log, the revision cursor, and the `ask_user` pending state this UI resolves.

## Key Decisions

- **An activity rail, not a transcript.** The rail lists events — "Agent added 4 nodes",
  "You answered: who this is for", "Agent: narrowed to teachers, your original idea is
  still on the map" — each one line, timestamped, origin-marked. It is a record of what
  happened to the artifact, which the page legitimately owns, rather than a reconstruction
  of a conversation it cannot see.
- **Open questions get their own panel, not just dashed pills.** An `open-question` node
  is a request addressed to the human. Leaving it only as a shape in the tree buries the
  one thing the person is meant to act on. The panel lists them with inline answer fields
  and empties as they are answered.
- **Answering resolves a pending `ask_user` when one is in flight, and is still a valid
  contribution when none is.** The person should never have to know whether an agent is
  currently blocked on them. Same input, same event; the bridge resolves the promise if
  there is one to resolve.
- **A contribution is an event, not a message.** "Leave a note for the agent" writes a
  `user.note` event and renders in the rail — it does not create a conversation thread the
  agent is expected to reply to in the page. The reply comes back in the agent's own
  surface, which is where it belongs.
- **User-origin nodes are visibly marked.** The map is now co-authored, and it should be
  possible to see at a glance which parts came from the person. This is also what stops
  the agent re-ingesting its own writes, so the badge and the tool contract agree.
- **Agent presence is stated plainly, including its absence.** `unavailable` is the normal
  case in a preview iframe, in Safari, and on any page opened without an agent — so it
  gets a real state that explains how to attach one, not an error.
- **Delete the server-side model loop rather than keeping it behind a flag.**
  `thinkingPartner.ts` and `turnInterpreter.ts` exist solely to drive the conversation from
  the server. Keeping them as a fallback means maintaining two products; their glossary
  entries and registered tests come out with them.
- **A dev-only agent panel drives the real tools.** WebMCP is top-level-only and codeyam
  captures render in an iframe, so scenarios can never carry a real agent. The panel calls
  `window.__thinkingMapAgent` — the same bound catalog — so a scripted give-and-take
  sequence in a scenario exercises the genuine tool paths, not a mock of them.

## Implementation

### 1. Remove the chat

**File**: `app/components/MapWorkspace.tsx`

Drop the `ConversationPanel` import and the two-panel split.

Delete `app/components/ConversationPanel.tsx`, `app/components/ReplyForm.tsx`,
`app/components/UserBubble.tsx`, `app/components/AssistantBubble.tsx`, their
`app/isolated-components/*/page.tsx` pages, and the scenarios naming them
(`conversationpanel-*`, `assistantbubble-*`, and the rest under `.codeyam/scenarios/`).

**File**: `app/lib/thinkingPartner.ts`

Delete, along with `app/lib/turnInterpreter.ts` and both `.test.ts` files. `@anthropic-ai/sdk`
comes out of `package.json`. Their entries leave the glossary and test registry with them —
expect the registry counts to drop, which is correct, not a regression.

**File**: `app/api/maps/[id]/messages/route.ts`

Delete. Page-side writes go to the exchange route from the spine plan.

`SendButton` is used by `IdeaForm` too, so it stays.

### 2. The map-first workspace

**File**: `app/components/MapWorkspace.tsx`

Rebuild as: the map filling the frame, with a narrow (~300px) exchange column holding —
top to bottom — agent status, open questions, the contribution input, and the activity
rail. `ThinkingMapView` and its `useFitToFrame` behaviour are unchanged; it simply gets
most of the width now.

**New file**: `app/components/ExchangeRail.tsx` — the event list, newest last, scrolled to
the end. Renders an empty state describing how to attach an agent when there is nothing yet.

**New file**: `app/components/ExchangeRow.tsx` — one event. Agent rows carry `AgentAvatar`;
user rows are marked as the person's. Note text runs through `splitAssistantLines` so a
question in an agent note keeps its emphasis.

**File**: `app/components/SummaryScreen.tsx`

Replace the embedded `ConversationPanel` under the plan with the contribution input and
the rail, so "keep thinking" still works without a chat.

### 3. What the user can contribute

**New file**: `app/components/OpenQuestions.tsx`

Lists `open-question` nodes with `status: "open"`, each with an inline answer field.
Submitting posts a `user.answer` event (node id + text) to the exchange route, marks the
node answered, and resolves a pending `ask_user` through the bridge context when one is
waiting. Optimistic: the row clears immediately and restores on failure.

**New file**: `app/components/ContributionBar.tsx`

One input with two actions — leave a note for the agent (`user.note`), or add a node to
the map (`user.node`, with a kind picker over `NODE_KINDS`). Deliberately not a chat box:
one line, no history under it, and the rail is where it lands.

**File**: `app/components/MapNodePill.tsx`

Mark user-origin nodes — a small badge in the eyebrow row, using the existing appearance
helpers rather than a new visual language.

### 4. Agent presence

**New file**: `app/components/AgentStatus.tsx`

Three states from the bridge context: connected (agent attached, tools registered),
working (a tool call in flight), unavailable (with a one-line explanation of what WebMCP
needs — Chrome 146+, a secure top-level page).

**File**: `app/components/AppHeader.tsx`

Accept an optional status slot so the map screen shows it beside the phase nav; the
landing screen passes nothing.

**File**: `app/map/[id]/page.tsx`

Mount the bridge from the spine plan around the workspace and pass the event log and
revision from the server render.

### 5. The dev agent panel

**New file**: `app/components/AgentSimulator.tsx`

Rendered only outside production. Lists the bound tools from `window.__thinkingMapAgent`,
runs one with a small JSON input, and shows the result — plus a "run the demo sequence"
button that walks the loop (create questions, ask, wait for the answer, add nodes, post a
note, advance the phase). This is what makes the exchange demonstrable in scenarios and in
the codeyam preview, where no real agent can exist.

### 6. Documentation

**File**: `README.md`

Replace the chat description with the exchange model: the agent is the user's browser
agent, the page is the shared artifact, here is what the person can put into it, and here
is how to drive it without an agent in development.

## Reused existing code

- `ThinkingMapView` from `app/components/ThinkingMapView.tsx` (glossary entry:
  `ThinkingMapView`) and `useFitToFrame` from `app/hooks/useFitToFrame.ts` — the map render
  and its fit-and-centre behaviour are unchanged and simply gain the width.
- `AgentAvatar` from `app/components/AgentAvatar.tsx` — reused by agent rows in the rail,
  which is what keeps it alive when `AssistantBubble` is deleted.
- `splitAssistantLines` from `app/lib/messageLines.ts` (glossary entry: `splitAssistantLines`)
  — same question-emphasis rule, now applied to agent notes.
- `nodeShellClasses` from `app/lib/nodeAppearance.ts` (glossary entry: `nodeShellClasses`)
  — the user-origin badge extends this rather than introducing a second treatment.
- `NODE_KINDS`, `KIND_EYEBROW` from `app/lib/mapKinds.ts` — the kind picker in the
  contribution bar reads the same vocabulary the agent's tools are bound to.
- `mapCaption` from `app/lib/mapCaption.ts` (glossary entry: `mapCaption`) — unchanged.
- `SendButton` from `app/components/SendButton.tsx` (glossary entry: `SendButton`) — reused
  by the contribution bar and the answer fields.
- `groupSummaryNodes` from `app/lib/summaryGroups.ts` (glossary entry: `groupSummaryNodes`)
  — the summary screen's grouping is untouched; only the panel beneath it changes.

## Scenarios to Demonstrate

- The working map with an agent attached: map filling the frame, two open questions
  waiting, three events in the rail.
- The paused moment: an `ask_user` in flight, the agent's turn blocked on the person.
- Just answered: a question resolved, the node flipped to answered and highlighted, the
  answer in the rail.
- A user-authored node sitting in the map beside agent-authored ones, visibly marked.
- No agent attached: the unavailable state explaining how to attach one, map still fully
  readable.
- The sprawling map with a long rail — the oversized case that previously exposed the
  overflow clipping.
- The summary screen with the plan above and the contribution bar beneath it.
- The dev agent panel mid-demo-sequence.