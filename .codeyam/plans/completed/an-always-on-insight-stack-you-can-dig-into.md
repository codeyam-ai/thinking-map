---
title: "An Always-On Insight Stack You Can Dig Into"
mode: ui
createdAt: "2026-09-02T20:54:30Z"
source: manual
dependsOn: ["insights-the-agent-keeps-supplying"]
---

## Summary

The far right of the board is a dashed empty ring for the whole of a session's useful life. `ConvergenceNode` shows something only when every row is finished AND at least one question has been answered AND a themeless `direction | finding | assumption` exists (`app/components/GalaxyBoard.tsx:104-148`) — three gates, all of which must pass before the partner is allowed to say anything about the idea as a whole. Before that it is a ring, or a cycling nonsense word. This plan replaces it with a stack of insights that is populated from the first one written and never gated, where each insight opens in place to show the thinking behind it — the questions it came out of, the detail, the ways forward — and carries a composer that asks the agent to go further on that specific insight. The digging path is not new machinery: `user.question` is fully implemented end to end (validated in the `user.question` branch of `app/api/maps/[id]/exchange/route.ts`, plumbed through `WebMcpBridge`, and listed in `USER_EVENT_KINDS` precisely so it wakes an agent parked on `await_user_activity`), and `NodeQuestionComposer` is a finished, tested component that is currently mounted nowhere but its own isolated fixture. This plan puts it on screen.

## Key Decisions

- **The convergence point becomes the stack; it is not a fourth surface.** The board's argument is left-to-right — one idea, several lines, back together at the far end — and the far end is exactly where a claim about the whole idea belongs. A dock floating over the board would be chrome competing with `BoardChat`; a new region would say the board has two conclusions. So `ConvergenceNode` is retired and `InsightStack` takes its coordinates.
- **No gate on "every row done".** That rule exists because a conclusion drawn before the rows are answered would be a conclusion about nothing. A *suggestion* is not a conclusion: it is a hunch the partner is willing to be wrong about in front of you, and the honest way to show one is early and marked as provisional. The staleness marker from `insightStream` is what carries that honesty — an insight written before your last four answers says so on its face rather than being silently withdrawn.
- **The `earned` gate stays retired with `CoreIdeaCard`'s insight slot, not moved.** `GalaxyBoard` currently also prints the newest insight on the core card. With a live stack at the far end that is the same node drawn twice on one plane, so `CoreIdeaCard` stops taking `insight` and the core card is the idea alone. This is a removal the ungating forces, not scope: two homes for one insight is worse than either home on its own.
- **Click opens in place; going deeper is a second, explicit act.** A single click that fired a request to the agent would spend the person's one attention-getting channel on a card they may only have wanted to read. So the card expands to what is already there — detail, sources, "where next" — and the composer underneath is what sends. The send control states whether anyone is listening, because `askPresence` already makes that distinction and the alternative is the UI implying an answer is coming when nothing is attached.
- **Reuse `NodeQuestionComposer` with a tone, rather than writing a second composer.** It carries the whole honest-presence argument in its own docstring and has its own tests and scenarios. It is styled for the light surface, so it gains `tone?: 'light' | 'dark'` defaulting to today's appearance — the existing fixture and its scenarios stay valid byte for byte, and the board passes `dark`.
- **The go-deeper prompts fill the box; they never send it.** Same rule as `AnswerChips` and `SuggestionChips`, for the same reason: a prompt that submitted would turn "dig into this" into a menu of two approved questions.
- **A row draws its line to the stack when it FED the stack.** `rowDone` gated the join line on the row being finished, which was right for a conclusion. With `fromNodeIds`, the board can draw the truer claim: this line of thinking produced something at the far end. `rowDone` stays as the fallback for insights that cite nothing, so a map whose agent never sends `fromRefs` looks exactly as it does today.

## Implementation

### 1. The stack

**New file**: `app/components/InsightStack.tsx`

Replaces `ConvergenceNode` at `layout.convergence`. Takes the `InsightStream` from `app/lib/insightStream.ts` (built by the dependency plan) plus the bridge status, and renders one of two things:

- **Insights** — up to four `InsightCard`s in a column, newest at the top, headed by a small eyebrow ("What the partner is thinking"). More than four are behind a "show older" affordance rather than an unbounded column that would grow past the plane's bounds.
- **Nothing yet** — the honest empty state. Reuse the bounded-wait pattern the map column already uses rather than inventing a second one: `useBoundedWait(true, SETTLE_AFTER_MS, insightCount)` from `app/hooks/useBoundedWait.ts`, and once it elapses, `settledNote(status)` from `app/lib/pendingRow.ts` — the exported, tested sentence that says whether an agent can hear this page at all. Before it elapses, the dim marker. The cycling-word `composing` state goes with `ConvergenceNode`: it was honest for a wait the person had just earned by finishing every row, and it would be a lie on a board nobody is attached to.

The stack positions itself around its parent's origin the way `ConvergenceNode` did — the isolated fixture's comment at `app/isolated-components/ConvergenceNode/page.tsx` records that the states disagree about where that leaves them, so the new component should be consistent about it and the fixture should say so.

### 2. One insight

**New file**: `app/components/InsightCard.tsx`

Collapsed: the eyebrow from `cardEyebrow({ kind })` (so a suggestion says "Suggestion" and an experiment says "Try this", matching every other card in the app), the label, and — when `stale` — a quiet marker naming the gap ("written before your last 4 answers"). Clicking toggles expansion; the card is a container that takes the click, with no `role="button"`, for the reason `QuestionCard`'s comment at `app/components/QuestionCard.tsx:100-113` sets out at length: an accessible name computed from its contents would swallow every control inside it into one label.

Expanded, in order:

1. `detail`, when there is one.
2. **What this came out of** — the resolved `from` entries, each rendering the question's own words. Absent entirely when the agent cited nothing, rather than an empty heading.
3. **Where next** — `choices` as buttons, calling the same `onChoose` the convergence node had, which `BoardWorkspace` already turns into a `user.note` (`app/components/BoardWorkspace.tsx:58-70`). Unchanged behaviour, new home.
4. **Go deeper** — two prompt chips that FILL the composer ("Why do you think that?", "What would settle it?"), and `NodeQuestionComposer` bound to this insight's node id.

### 3. A composer that works on a dark ground

**File**: `app/components/NodeQuestionComposer.tsx`

Add `tone?: 'light' | 'dark'`, defaulting to `'light'` so nothing about the existing fixture or its scenarios changes. Dark swaps the shell, field and text classes for the board's palette (the values `QuestionCard` and `BoardChat` already use for cards on the plane). Add an optional `prefill` prop so a chip can put text in the field; the chip fills, the person sends.

Keep the `onPointerDown` stop — the board is a drag surface and without it dragging inside the field pans the plane.

### 4. Mount it, and stop drawing insights twice

**File**: `app/components/GalaxyBoard.tsx`

- Delete `CORE_INSIGHT_KINDS` and the `coreInsight` memo (`app/components/GalaxyBoard.tsx:42`, `104-148`); the selection rule now lives in `insightStream`.
- Delete the `convergenceState` memo and render `InsightStack` at `layout.convergence` instead, passing the stream and `onChoose`.
- Stop passing `insight` to `CoreIdeaCard`.
- The join-line condition becomes `join && (rowFeedsInsights(cluster, stream.insights) || rowDone(cluster))`.

**File**: `app/components/CoreIdeaCard.tsx`

Remove the `insight` prop and the block it renders, and the now-unused `CoreInsight` type. Retire the `CoreIdeaCard - WithInsight` fixture case at `app/isolated-components/CoreIdeaCard/page.tsx:45` and its scenario.

**File**: `app/components/ConvergenceNode.tsx` — deleted, along with `app/isolated-components/ConvergenceNode/page.tsx` and its registered scenarios. Its two live behaviours both survive: the ways-forward buttons move to `InsightCard`, and the honest-wait state is served by `pendingRow`'s tested sentence.

### 5. Which rows fed the stack

**File**: `app/lib/boardConnectors.ts`

Add, beside `rowDone`:

```ts
/** Whether this line of thinking produced something at the far end: a live
 *  insight cites one of its cards. Distinct from `rowDone`, which asks whether
 *  the row is finished — a row can feed an insight while still holding an open
 *  question, and that is exactly the case the old gate could not draw. */
export function rowFeedsInsights(
  cluster: PlacedCluster,
  insights: { from: { id: string }[] }[],
): boolean;
```

Pure and testable like everything else in that module: an empty insight list, an insight citing nothing, an insight citing a card in another row, and an insight citing a card in this one.

### 6. The new fields reach the board

**File**: `app/lib/galaxyLayout.ts`

`GalaxyNodeInput` gains `origin`, `createdAt`, `updatedAt` and `fromNodeIds` — the fields `insightStream` reads. `layOutGalaxy` itself is unchanged: insights are themeless, so they are already excluded from every cluster by the `n2.themeId === theme.id` filter, and no geometry moves.

**File**: `app/components/MapScreen.tsx`

Pass the new fields through the node mapping (alongside the existing `parseChoices` / `parseDiagram` work), parsing `fromNodeIds` with the same total, degrade-to-null discipline `parseChoices` uses at `app/components/MapScreen.tsx:19-29` — a malformed value yields no citations rather than throwing away the insight.

**File**: `app/components/BoardWorkspace.tsx`

Compute the stream once with `insightStream(nodes)` and pass it to `GalaxyBoard`. This is also where the existing live-refresh already re-renders on every revision bump (`app/components/BoardWorkspace.tsx:96-110`), so a newly written insight appears without anything new being wired.

### 7. The test the absence of which let this through

**File**: `app/components/BoardWorkspace.render.test.tsx`

The existing suite mocks `GalaxyBoard` out entirely (`app/components/BoardWorkspace.render.test.tsx:35`), so nothing today asserts that the board mounts an insight surface at all — the same shape of hole that let the handoff band go missing. Add a render test asserting that a map carrying one themeless insight puts its label on the screen, and that a map carrying none renders the empty state rather than nothing.

## Reused existing code

- `NodeQuestionComposer` from `app/components/NodeQuestionComposer.tsx` — finished, tested, and currently mounted nowhere but its isolated fixture. It carries the `askPresence` honesty rule and the `user.question` write.
- The `user.question` path end to end: `USER_EVENT_KINDS` in `app/lib/exchange.ts:58-63`, the node-existence validation and label denormalisation in the `user.question` branch of `app/api/maps/[id]/exchange/route.ts`, `contribute` on `WebMcpBridge`, and `describeEvent`'s rendering of it (glossary entry: `describeEvent`). No new endpoint, no new event kind.
- `settledNote` and `SETTLE_AFTER_MS` from `app/lib/pendingRow.ts`, and `useBoundedWait` from `app/hooks/useBoundedWait.ts` — the bounded, honest wait, already tested and already the answer to "how long may a page imply something is coming".
- `askPresence` from `app/lib/askPresence.ts` and `AskPresenceNote` — the send-label wording.
- `cardEyebrow` from `app/lib/cardEyebrow.ts` (glossary entry: `cardEyebrow`) — so an insight names its kind the same way every other card does.
- `AnswerChips` from `app/components/AnswerChips.tsx` — the fill-don't-submit chip, and the model for the go-deeper prompts.
- `rowDone`, `joinPath`, `fanPath` from `app/lib/boardConnectors.ts` — the connector math `rowFeedsInsights` joins.
- `onChoose` → `user.note` in `app/components/BoardWorkspace.tsx:58-70` — the ways-forward behaviour, moved not rewritten.
- `insightStream`, `TARGET_LIVE_INSIGHTS` and the `suggestion` / `experiment` kinds from the plan this one depends on.
- **Existing-implementation survey:** there is no insight panel, dock or list anywhere in the tree. `ConvergenceNode` is the only surface that ever displays a themeless insight, and `CoreIdeaCard`'s `insight` prop the only other place one is drawn; both are addressed above rather than left beside a third.

## Scenarios to Demonstrate

- Day one: a board with a seed idea, no themes, no insights — the stack reads as a place waiting to be filled, not as a failure.
- Nobody attached, the wait elapsed — the stack carries the real `settledNote('unavailable')` sentence.
- One live insight, collapsed.
- One insight expanded: detail, two cited questions, three ways forward, and the go-deeper composer with an agent attached.
- The same insight expanded with no agent attached — the send control says so.
- A stale insight: written before the person's last four answers, marked as such and still readable.
- Four insights stacked, with older ones behind the affordance.
- An insight citing a question in a row that still has an open question — the join line is drawn because the row fed the stack, which the old `rowDone` gate could not express.