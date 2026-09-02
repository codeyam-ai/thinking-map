---
title: "dr-design changes: Harden the Galaxy Board"
prefix: "dr-design changes"
mode: ui
createdAt: "2026-09-02T16:32:17Z"
source: manual
---

## Summary

The board redesign (fan layout, agent-named themes with golden-angle hues, question cards with choices and inline editing, reference images and diagrams, the always-on chat, attachments on the core, live refresh on revision change, and the convergence conclusion) shipped verified entirely by hand: Playwright driving the real app, and me acting as the MCP agent against the live endpoint. The registries say so plainly. `.codeyam/test-registry.json` holds 586 tests and none of them touch this work; the glossary holds 238 entries and none of them name it. Two of the three genuinely load-bearing pure functions in the new board, `layoutGalaxies` and `hueForIndex`, have no test at all, and the one bug that a test did catch (a phantom revision on re-answering) is exactly the class of bug the untested parts are now free to have.

This plan closes that gap. It adds tests where the value is highest (pure geometry and colour, the card's three states, the pull-only refresh contract, the `create_themes` door), registers the new surface in the glossary so the next session can find it, and closes the merge seams where our components reimplement helpers that main already ships tested.

## Key Decisions

- **Test the logic, not the picture.** The layout is a pure function from nodes to coordinates, and the palette is a pure function from an index to a hue. Both are fully testable without a renderer, and both are where a real regression would hide (a wide card that fails to push its neighbours, two themes that come out the same colour). Screenshot diffing the board is deliberately out of scope: it is slow, it is flaky, and it would fail on every intentional design tweak.
- **Reuse main's `cardEyebrow` instead of our inline copy.** `QuestionCard` computes its own eyebrow (`Shape` / `Reference` / `Insight`) in JSX. Main ships `cardEyebrow` in `app/lib/cardEyebrow.ts` with `app/lib/cardEyebrow.test.ts` behind it, built for precisely this rule, and its doc comment names the exact failure we are exposed to: an answered question that still says "Open" contradicts the answer printed directly underneath it. Two implementations of one design rule will drift; the tested one should win.
- **Follow the repo's existing test conventions rather than inventing a shape.** `*.test.ts` for pure lib logic, `*.render.test.tsx` for components (the pattern in `AgentHandoff.render.test.tsx`, `BriefMenu.render.test.tsx`, `PhaseNav.render.test.tsx`), `*.integration.test.ts` for anything that touches Prisma.
- **Pin the particles by their seed, not their pixels.** `ThemeParticles` is deliberately deterministic (a mulberry32 seeded PRNG) so server and client render identically. That determinism is the testable property and the one whose loss causes a real, user-visible hydration error. The animation itself is CSS and stays untested.
- **Give the board isolated-components fixtures.** Every comparable component from main has one, and the board (the product's main surface) has none, so it cannot be captured or reviewed in isolation. `app/isolated-components/MapScreen/page.tsx` already carries board-shaped fixture data (a seed idea and three themes with hues 318 / 96 / 233 written as literals) and is the model to follow.

## Implementation

### 1. Cover the fan geometry

**New file**: `app/lib/galaxyLayout.test.ts`

`layoutGalaxies` in `app/lib/galaxyLayout.ts` decides the whole shape of the board and is completely untested. Cover the properties that the drawing depends on:

- Cards for a theme run left to right from the hub, each one placed at the running sum of the widths before it, so a wide card pushes its neighbours right instead of overlapping them. This is the `run` accumulator and it is the single most breakable line in the file.
- `widthFor` returns the wide width for a node carrying a `diagram` or an `imageUrl`, and the standard width otherwise. A card that gained a diagram but kept the narrow width is the regression.
- Themes stack by `ROW_GAP` in theme order, and a theme with no cards still gets a hub position (it is a line of thinking that has not produced questions yet, not an absent one).
- `convergence.x` sits to the right of the longest run, so the conclusion is never drawn on top of the last card of the longest theme. Assert the relationship against a multi-theme fixture with runs of different lengths, not against a hardcoded number.
- An empty map returns a layout that is safely renderable (no themes, no cards, a defined core) rather than throwing.

### 2. Cover the palette

**New file**: `app/lib/themeHue.test.ts`

`hueForIndex` in `app/lib/themeHue.ts` walks the hue circle by the golden angle so that themes stay distinguishable no matter how many the agent invents. Test the contract, not the constant:

- The first three themes produce 318, 96 and 233, the values already hardcoded into the `MapScreen` fixture. Pinning them here means the fixture and the function can no longer disagree silently.
- Every hue is an integer in `[0, 360)`, including for large indices where the raw value wraps several times, and for index 0.
- No two of the first twelve themes land within a small threshold of each other on the circle. This is the actual promise the golden angle makes and the reason it was chosen over a fixed palette.
- `themeColor` emits `hsl(h s% l%)` with no alpha channel at `a === 1` and the `/ a` slash form otherwise. An always-present `/ 1` would be valid CSS but a pointless diff on every colour in the app.

### 3. Cover the pan threshold that made cards clickable

**New file**: `app/hooks/useBoardCamera.test.ts`

The most expensive bug of the session lived here: capturing the pointer on `pointerdown` retargeted the eventual click to the canvas, so no card on the board could be clicked. The fix was to wait for `PAN_THRESHOLD` pixels of movement before capturing. Test it as behaviour:

- A pointerdown followed by pointerup with no movement leaves the camera untouched and never calls `setPointerCapture`, which is what lets the click reach the card underneath.
- Movement beyond the threshold pans, and the delta is divided by the current scale so a drag tracks the cursor identically at every zoom level.
- Movement below the threshold does not pan, so a hand tremor during a click does not nudge the board.
- Zoom stays inside its clamp at both ends and does not invert.

### 4. Give the question card render tests and main's eyebrow

**File**: `app/components/QuestionCard.tsx`
**New file**: `app/components/QuestionCard.render.test.tsx`

Replace the inline eyebrow computation with `cardEyebrow` from `app/lib/cardEyebrow.ts`, rendered through `MapCardEyebrow` where the markup matches. Then cover the three states the card actually has:

- **Open**: the theme colour, the question, and a textarea that is present without being clicked. This was an explicit product requirement (an unanswered card must always look typeable) and nothing currently defends it.
- **Answered**: the dark surface, the question demoted to the small accent line, the answer in white, and a pencil control that returns the card to editing.
- **Insight**: the eyebrow reads the right word for the kind.
- **Choices**: option pills render as real `button` elements and sit above the free-text "Other" field, so a shortlist never removes the ability to say something else.

Two structural regressions are worth explicit assertions because both already happened once and both are invisible to a type checker: the card's root must not be a `button` (a button nested in a button is invalid HTML and the parser hoists the inner one out, which silently killed the choice pills), and the root must not carry `role="button"` (it made the card announce its entire contents as its accessible name and produced ambiguous matches for assistive technology and for tests alike).

### 5. Cover the chat's filter

**New file**: `app/components/BoardChat.render.test.tsx`

`BoardChat` turns the exchange log into conversation. Its `line` mapper deliberately drops `node.added`, `theme.added` and `phase.set`, because those events are already visible as things on the board and repeating them as chat messages would make the panel a debug log. That editorial decision is invisible in the code's behaviour until someone "fixes" it. Assert that `user.note`, `user.answer`, `agent.note` and `question.asked` become bubbles on the correct side, that the three board-visible kinds produce nothing, and that an empty log renders the panel rather than a blank box.

### 6. Cover the live refresh contract

**New file**: `app/components/BoardWorkspace.render.test.tsx`

WebMCP is pull-only: the page cannot be woken by an agent, so the board watches `bridge.revision` and calls `router.refresh()` when it advances. This is what makes answers and new questions appear without a reload, and it is one `useEffect` with three easy ways to be wrong. Cover them with a mocked router:

- The first observed revision only seeds the ref. Refreshing on mount would re-fetch the page the user just loaded.
- A higher revision refreshes exactly once.
- A repeated or lower revision does not refresh, so a retried poll cannot put the page in a refresh loop.
- A null or undefined revision (the bridge is not bound, which is the normal state inside an iframe) is ignored rather than treated as zero.

### 7. Cover the `create_themes` door

**File**: `app/lib/nodePlan.test.ts`

`planMapMutations` validates everything a language model sends, and its existing suite is thorough about nodes: unknown kinds dropped, blank labels dropped, order preserved, malformed input survived. `create_themes` arrived with the redesign and has no equivalent coverage; the word "theme" appears in that file exactly once, in the empty-plan assertion. Add cases in the established style:

- A valid theme survives with its ref and label intact.
- A theme with no ref is dropped, because no node could ever name it.
- A theme with a blank label is dropped, since it would draw a hub labelled nothing.
- No hue is assigned here. The hue depends on the theme count, which this pure function cannot see, and the split (the agent names the theme, the app colours it) is the reason the palette stays coherent no matter what the agent invents. A test that pins the absence of a hue keeps someone from "helpfully" adding one.
- A node naming a theme ref from the same turn keeps that `themeRef` for `applyToolCalls` to resolve.

### 8. Cover attachments end to end

**File**: `app/lib/contributions.integration.test.ts`

The attachments PUT at `app/api/maps/[id]/attachments/route.ts` persists what the user browses for on the first card. The bug already found by hand was that the names were collected in the UI and never sent; the corresponding server-side risk is that they are sent and not durably stored. Add integration coverage that attachments written to a map survive a re-read, that replacing the list replaces rather than appends, and that an empty list clears cleanly instead of storing an empty JSON string that later renders as a stray empty row.

### 9. Fixtures for the board

**New files**: `app/isolated-components/GalaxyBoard/page.tsx`, `app/isolated-components/QuestionCard/page.tsx`, `app/isolated-components/BoardChat/page.tsx`

Follow `app/isolated-components/MapScreen/page.tsx` exactly, including its practice of writing hues as literals so a capture pins the palette the layout produces rather than re-deriving it. Scenarios per the list below. These are what let the board be reviewed and captured without running the full app and binding an agent, which is impossible inside an iframe anyway.

### 10. Register the new surface

**Files**: `.codeyam/glossary.json`, `.codeyam/test-registry.json` (via the editor CLI, not by hand)

Nothing built this session is in either registry, which is why an investigation of this codebase currently cannot find the board at all. Register `hueForIndex`, `themeColor`, `layoutGalaxies`, `widthFor`, `useBoardCamera`, `QuestionCard`, `BoardChat`, `CardDiagram`, `ConvergenceNode` and `ThemeParticles`, each linked to the tests added above. Keep the descriptions in the voice the existing 238 entries use: what the thing guarantees and which failure it is guarding against, not a restatement of its signature.

## Reused existing code

- `cardEyebrow` from `app/lib/cardEyebrow.ts` (glossary entry: `cardEyebrow`), with `app/lib/cardEyebrow.test.ts` already behind it
- `MapCardEyebrow` from `app/components/MapCardEyebrow.tsx`
- `contributionEvents` from `app/lib/contributions.ts` (glossary entry: `contributionEvents`), and its existing case "does not report a second close when the question is already answered", which is the model for the attachment cases
- `planMapMutations` from `app/lib/nodePlan.ts` and the validation-case style of `app/lib/nodePlan.test.ts`
- `BridgeFixture` from `app/isolated-components/BridgeFixture.tsx` and the scenario shape in `app/isolated-components/MapScreen/page.tsx`
- The `*.render.test.tsx` convention from `app/components/AgentHandoff.render.test.tsx` and `app/components/BriefMenu.render.test.tsx`
- `isNodeKind` and `KIND_EYEBROW` from `app/lib/mapKinds.ts`

## Scenarios to Demonstrate

- A board with three themes of unequal length, one theme holding a wide diagram card, showing the fan and the conclusion clear of the longest run
- A first-time board: one yellow core card, no themes, the attachment browser and the arrow button, and nothing else
- An open question card with a shortlist of choices plus the free-text "Other" field
- The same card answered, showing the question demoted and the pencil available
- A card carrying a reference image and a card carrying a diagram, both at the wide width
- The chat open over a populated board, showing only conversational events and none of the board-visible ones
- An empty exchange log: the chat panel present and inviting rather than blank
- A twelve-theme board, the palette stress case, proving the hues stay distinguishable
