---
title: "ne -- Answer A Question With More Than One Thing"
mode: ui
createdAt: "2026-09-03T17:06:38Z"
prefix: "ne"
source: manual
---

## Summary

A question card lets you say exactly one thing. Tapping an option on the board
sends it immediately, and the free-text box appears INSTEAD of the shortlist,
never beside it — so "these two, plus a caveat" cannot be said at all. Editing is
worse: the pencil opens a bare textarea seeded from the recorded answer, with the
options gone entirely, so amending a choice means retyping it from memory.

This plan makes an answer a set: any number of the offered options, a write-in of
your own, or both. Tapping toggles rather than sends; an explicit Save commits.
Editing reopens that same control fully populated — the options you took are
checked, the ones you passed over are still there to reconsider, and your typed
words are back in the field ready to change.

Two things make this a restoration rather than an invention. The design system
already rules that a suggestion chip "fills the prompt input rather than
submitting, so the person stays in control of their words" — the board's
send-on-tap is the one place in the app that breaks that rule, and
`app/lib/toolCatalog.ts` already describes to the agent the behaviour this plan
builds. And `dr-design changes: Harden the Galaxy Board` specified these cards as
"option pills … sit **above** the free-text 'Other' field, so a shortlist never
removes the ability to say something else" — both present, which is what the card
later abandoned when stacking them overflowed a fixed-height card. The scrolling
column below is how that original intent finally fits.

The answer stays a single string in the exchange log, so every downstream reader
is untouched, and the structure behind it travels alongside as an additive field.
A single option picked and nothing else still records byte-identical text to
today, so no existing card or log line changes meaning.

## Key Decisions

- **Multi-select is always available on any card with choices.** No new tool
  field, no agent retraining, no node schema change. The agent's `choices` keeps
  the exact meaning it has, and no question can be accidentally over-restricted
  by an agent that guessed wrong about how many answers there are.
- **Tapping toggles; Save sends.** One rule for every question, whether you take
  one option or three. It costs a tap on the simplest question and buys a
  gesture that means the same thing everywhere — and it brings the board into
  line with the design system's suggestion-chip rule and with what
  `toolCatalog.ts` already tells the agent. Enter still saves, so a keyboard
  answer is no slower than it is today.
- **One scrolling column with the commit pinned, rather than a taller card.**
  Cards are a fixed 300x360 (`CARD_W`, `CARD_H` in `app/lib/galaxyLayout.ts`),
  and that height feeds the layout's row spacing and bounds — growing a card
  while it is answered is a layout change with its own tests. The options scroll
  in the space they have while the commit row stays pinned, which is the pattern
  `CardChoiceList` already uses to stop its escape hatch falling off the bottom.
- **The write-in is progressive, and shares the pinned row with the escape
  hatch — it does not sit open permanently.** This is the decision the vertical
  budget forces, and it is worth the arithmetic. Inside `p-7` a card has roughly
  244x304 of content; an eyebrow and a two-line question take about 72, leaving
  about 216 for the answer area. An option row is about 40 with an 8 gap. Today's
  48-high escape row leaves ~168 — about three options visible. A permanently
  open field plus its own Save row costs about 100, cutting that to ~116 and
  about two. Since the agent is told to offer "two to four concrete options",
  making the common case scroll would be a real loss of scannability. Putting
  "Say something else…" and Save in ONE pinned row costs about 46 and leaves
  ~170 — the same three-plus options visible as today, with multi-select gained
  for free. **These figures are estimates from the current classes; confirm them
  visually at execution before settling the field's height.**
- **Never three controls in that row.** At 244 of usable width a row cannot hold
  an escape hatch, a Cancel and a Save. It does not have to: while the field is
  closed the row is [Say something else…] [Save]; once it is open the escape
  hatch has done its job and the row becomes [Cancel] [Save]. This preserves
  `AnswerComposer`'s existing rule that Cancel appears only when there is
  somewhere to go back to.
- **Selection must be legible without colour.** The options are pills on a card
  already saturated in its theme hue, so a chosen pill cannot be distinguished by
  fill alone. Selected options carry a check glyph and `aria-pressed`, so the
  state is announced as well as drawn. This also keeps the markup within the
  constraint two existing tests defend: the card root is not a `button` and
  carries no `role="button"`, and the options stay real buttons inside a plain
  container.
- **The recorded answer stays a string; the structure rides alongside.** The
  `user.answer` payload gains optional `selected` and `other` fields next to the
  existing `answer`. `the-conversation-gets-out-of-the-way` established that
  payload's shape and colours each chat bubble by its node id, so the fields must
  be additive: every reader keeps reading `answer` and ignores what it does not
  know. Re-parsing prose back into selections was the alternative and it is
  guesswork — an option containing the separator, or a write-in that happens to
  equal an option, both break it.
- **One selection and no write-in records exactly the option text.** No
  separator, no wrapper. This is what keeps every answered card, chat line and
  rail entry already in the database reading precisely as it does now.
- **Legacy answers still edit sensibly.** An event written before this change has
  no `selected`, so the reader falls back: text matching one of the node's
  choices exactly is treated as that option checked; anything else is treated as
  a write-in. Old maps get a populated editor rather than an empty one.
- **A question becomes answered on Save, which improves the round.**
  `the-round-ends-itself` auto-advances once `openCount` reaches zero, after a
  grace countdown that any typing cancels. Under send-on-tap a stray tap can
  close the last question and start that countdown; under Save a half-made
  selection leaves the question open, which is the truthful state. The
  always-reachable write-in also means typing to cancel the countdown is
  possible from the card itself. No change to that plan's code is needed —
  this is a consequence to verify, not a coupling to build.
- **The pinned row lands in the corner the chat is known to swallow.** The
  queued `a-card-s-pencil-cannot-be-clicked-under-the-chat` documents the chat
  overlay eating clicks in the bottom-right of the viewport, and moves the
  pencil to the card's bottom-left. Save sits at the right end of the pinned row
  and is therefore exposed to exactly that collision. The composer's button row
  already sits there today, so this is not a new defect — but this plan makes it
  reachable on every card with choices instead of only after "Say something
  else…", so it is newly common. Enter-to-save is the existing keyboard escape.
  Whichever plan lands second should re-check the other's control; not a
  `dependsOn`, because neither blocks the other.
- **`CardChoiceList` keeps its name and grows a selection API** rather than being
  replaced. It is already the tested home of the two rules that matter here —
  the options scroll, the escape stays pinned — and those rules survive intact.
- **Out of scope, noted:** `app/components/MapCardAnswer.tsx` and
  `app/components/AnswerChips.tsx` are a second answering surface whose chips
  already fill rather than send. Nothing live renders it — its only route in is
  `app/components/MapWorkspace.tsx`, which no page mounts. Left alone
  deliberately; if it is ever revived it should adopt this control.

## Implementation

### 1. Options become selectable, and the bottom row commits

**File**: `app/components/CardChoiceList.tsx`

Replace `onPick: (choice: string) => void` with a selection API: a `selected:
string[]` prop and `onToggle: (choice: string) => void`. Each option keeps its
`button` element and gains `aria-pressed` plus a check glyph when chosen, so the
state is announced and not carried by fill alone. The scrolling body is
unchanged — it is what makes the fixed height work.

The pinned bottom row becomes the card's commit row. With the write-in closed it
holds "Say something else…" on the left and Save on the right; with it open the
escape hatch is replaced by Cancel. Save is enabled once anything is selected or
typed.

### 2. The write-in field learns to sit under a list

**File**: `app/components/AnswerComposer.tsx`

Add a `compact` mode for when the field shares a card with a list: a short fixed
field that does not grow, so the options keep their room, with its buttons
supplied by the pinned row rather than drawn again underneath. Full-height
behaviour is unchanged for a question with no choices, which is still the common
case, and Enter-to-save and Escape-to-cancel apply in both.

### 3. The card composes both, and holds a set

**File**: `app/components/QuestionCard.tsx`

- Replace the `draft` / `otherOpen` pair with selection state: the set of chosen
  options plus the write-in text and whether its field is open.
- Render the list and the commit row TOGETHER when the card has choices — the
  mutual exclusion at the `composing` / `!composing` branches goes away. The
  answer area becomes one column: options scrolling in the flexible space, the
  optional field and the pinned row beneath.
- `onAnswer` is called only from Save, and receives the composed answer plus its
  parts. Nothing is sent on a tap.
- Save is refused when nothing is selected and nothing is typed, as an empty
  answer is refused now.
- Opening the pencil seeds BOTH pieces of state from the recorded answer, and
  opens the field already expanded when the restored answer has a write-in, so
  the editor shows what was chosen, what was not, and what was typed.
- A card with no choices behaves exactly as it does today: the full-height box,
  no list, and Save.

### 4. The answered face survives a longer answer

**File**: `app/components/QuestionCard.tsx`

A compound answer is systematically longer than a single option, and the
answered face prints `card.detail` at 16px in a fixed-height card. Clamp it to
the space available so a three-part answer degrades to a truncated statement
rather than overflowing the card, leaving the pencil and the existing
`CopyTextButton` as the ways to the full text. Confirm the clamp visually at
execution.

### 5. Composing and reading back the answer

**New file**: `app/lib/answerSelection.ts`

A pure module, the counterpart to `app/lib/mapAnswers.ts`:

- `composeAnswer(selected: string[], other: string): string` — options in the
  order the card shows them, joined with ` · `; a write-in appended after ` — `
  so typed prose is distinguishable from chosen options. One selection and no
  write-in returns that option verbatim; a write-in alone returns it verbatim.
- `restoreSelection(answer, choices, recorded?)` — what the editor opens with.
  Prefers the recorded `selected` / `other` when the event carried them; falls
  back to the legacy rule in Key Decisions otherwise.

Keeping this out of the component is what lets the joining and the fallback be
tested at their edges rather than through a rendered card.

### 6. The structure travels with the answer

**File**: `app/lib/mapAnswers.ts`

Add `selectionsByNodeId(events)` alongside `answersByNodeId`, returning the
latest `{ selected, other }` per node id for events that carried them. Same
tolerance for malformed entries: a bad payload is skipped, never thrown.
`answersByNodeId` is not modified — it keeps returning the display string.

**File**: `app/hooks/useMapAnswers.ts`

Widen `AnswerWriter.answer` and the hook's own `answer` so a selection can be
passed rather than only a string. The optimistic-pending layer keeps working on
the display string; the parts ride with it. Expose the restored selection per
node so the card can seed its editor.

**File**: `app/components/WebMcpBridge.tsx`

In the `answer` callback, carry `selected` and `other` into each entry of the
`resolved` array written to `user.answer`. `settle(resolved)` is unchanged — the
agent's `ask_user` result still resolves with `answer` as a string, so nothing
agent-facing moves.

### 7. Tell the agent what a list now means

**File**: `app/lib/toolCatalog.ts`

Update the `choices` description so it states what is now true: the person may
take several of the options, or none and write their own, and nothing is sent
until they save. The current text already says a chip "fills the box rather than
sending it" — which the board did not honour — so this is the description and the
behaviour meeting rather than a new promise.

### 8. Tests

**File**: `app/components/QuestionCard.render.test.tsx`

Three existing tests encode decisions this plan reverses and must be rewritten
rather than patched, each keeping its intent:

- `answers with an option the moment one is picked` becomes: a tap marks the
  option chosen and sends nothing until Save.
- `swaps the options for a text box rather than stacking them` becomes: the
  options and the commit row are visible together, and the options scroll rather
  than pushing the row off the card.
- `gives the options back when the free-text box is cancelled` becomes: Cancel
  restores the recorded answer, discarding the in-progress selection.

The two structural assertions that the card root is neither a `button` nor
`role="button"` must keep passing unchanged — they exist because both
regressions already happened once and both silently broke the option pills.

Add: several options selected save as one answer; an option plus a write-in save
together; a chosen option is announced as pressed, not merely coloured; the
pencil opens with chosen options checked and unchosen ones still offered; the
pencil opens the field expanded when the restored answer has a write-in;
deselecting everything and typing leaves only the write-in; Save stays refused
when nothing at all is chosen or typed.

**New file**: `app/lib/answerSelection.test.ts`

The joining and the restore rules at their edges: one option verbatim, several
joined, a write-in alone, options plus write-in, an empty selection, and the
legacy fallback for an answer recorded before `selected` existed.

**File**: `app/lib/mapAnswers.test.ts`

Cover `selectionsByNodeId`: the latest selection per node wins, an event with no
selection is passed over rather than blanking a previous one, and a malformed
entry is skipped.

**File**: `app/hooks/useMapAnswers.test.ts`

The widened writer: a selection reaches the writer intact, and a failed write
still rolls the optimistic answer back.

Re-register affected scenarios after the UI changes.

## Reused existing code

- `CardChoiceList` from `app/components/CardChoiceList.tsx` (glossary entry:
  `CardChoiceList`) — kept, with its scrolling-body / pinned-row structure
  intact; only its selection API changes.
- `AnswerComposer` from `app/components/AnswerComposer.tsx` (glossary entry:
  `AnswerComposer`) — kept; gains a compact mode rather than a replacement, and
  its "Cancel only when there is somewhere to go back to" rule is carried into
  the pinned row.
- `answersByNodeId` from `app/lib/mapAnswers.ts` — unchanged, and still the one
  reader of the display string.
- `parseOptions` from `app/lib/mapAnswers.ts` — how a node's stored choices
  already become a string list; nothing new is needed to read them.
- `useMapAnswers` from `app/hooks/useMapAnswers.ts` — the optimistic-answer
  layer, widened rather than rebuilt; its pending-entry rules still hold.
- `isAnsweredCard`, `isOpenCard`, `isInsightCard` from
  `app/lib/cardPresentation.ts` — which face the card wears is unaffected by how
  many parts the answer has.
- `cardEyebrow` from `app/lib/cardEyebrow.ts` — the "Editing your answer"
  vocabulary is already handled here.
- `CopyTextButton` from `app/components/CopyTextButton.tsx` — the existing route
  to a full answer the clamped face truncates.
- `themeColor` from `app/lib/themeHue.ts` — selected and unselected options are
  drawn from the card's existing accent, no new colours.
- `CARD_SIZE` from `app/lib/galaxyLayout.ts` — the fixed geometry this design is
  built to respect, not modify.
- `ExchangeEvent` from `app/lib/exchange.ts` — the log shape the new optional
  fields ride inside.

**Existing-implementation survey.** There is no multi-select, checkbox, or
toggle-group control anywhere in `app/components` today — every option list in
the app (`CardChoiceList`, `AnswerChips`, `SuggestionChips`) is single-shot, and
none of them tracks a selection. There is likewise no helper that composes or
splits a compound answer: `app/lib/mapAnswers.ts` reads a string out of the log
and `parseOptions` reads a list off a node, and nothing joins the two. The
module in Implementation step 5 is genuinely new rather than a duplicate. The
user.answer payload carries no selection field today, so the two keys added in
Implementation step 6 collide with nothing.

## Scenarios to Demonstrate

- An open question with four options, none chosen — all four visible without
  scrolling, the commit row pinned beneath, Save refused. This is the case the
  vertical budget exists to protect.
- Two options chosen, saved as one answer.
- One option chosen plus a written caveat, saved together.
- No option chosen, write-in only — the same result today's "Say something
  else…" produces.
- Editing an answer: chosen options checked, passed-over options still offered,
  the typed words back in the field.
- Editing an answer recorded before this change whose text matches an option
  exactly — it opens with that option checked.
- Editing a legacy free-text answer — it opens as a write-in with every option
  still offered.
- Eight options — the list scrolls and the commit row never leaves the card.
- An answered card carrying a three-part answer — clamped, not overflowing.
- A question with no options at all — the full-height box, unchanged.
- A card whose bottom-right sits under the open chat panel, showing what the
  commit row has to survive.
- Cancel during an edit — the previously recorded answer stands untouched.
