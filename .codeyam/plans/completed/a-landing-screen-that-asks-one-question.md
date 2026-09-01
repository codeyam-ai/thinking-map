---
title: "A Landing Screen That Asks One Question"
mode: ui
createdAt: "2026-09-01T17:22:22Z"
source: manual
---

## Summary

The landing screen is supposed to ask one question, and instead it asks one
question surrounded by five other things. Below the oversized hero sit the input,
a dashed brief-intake panel three lines tall carrying its own sentence, two
buttons and a format hint, four suggestion chips that wrap onto two rows, and the
saved-map list — so the question the whole product opens with competes for
attention with the machinery around it. At half-screen width, which is where this
will mostly be read, it is worse: the chips break to two rows and the intake panel
takes a quarter of the fold. Give the question the screen. Shrink the hero to fit
its frame, collapse the entire brief intake behind a single `+` button beside the
input that opens a small menu, cut the chips to one row, and demote the saved-map
list to a quiet strip.

![The landing screen today at half width — the question is one of six things competing](assets/a-landing-screen-that-asks-one-question/landing-half-screen.png)

## Key Decisions

- **`+` opens a menu, not an inline panel.** The intake is a *capability*, not a
  step: most arrivals type a sentence and never touch it. A `+` button inside the
  input's own frame, opening a two-item popover — *Upload a file* / *Paste a
  brief* — states the capability in 28px of width instead of 140px of height.
  This is what the user asked for directly.
- **Drag-and-drop survives the collapse.** The whole form region stays a drop
  target: dropping a `.pdf` anywhere over it highlights the frame and attaches the
  document exactly as today. The dashed panel was the *advertisement* for drag and
  drop, not the mechanism, so removing it costs discoverability, not function —
  and the `+` menu is the replacement advertisement. A one-line hint under the
  input (`PDF, Word, Markdown or plain text — or drop one here`) keeps the file
  types stated without a panel.
- **The hero shrinks by fixing its clamp, not by cutting words.** `clamp(40px,
  5.6vw, 72px)` floors at 40px, so a 760px window renders the hero at its
  *minimum* — 40px over two lines plus a 17px subtitle plus 44px of margin. Retune
  to `clamp(28px, 4.6vw, 64px)` and cut the subtitle's bottom margin from `mb-11`
  to a fluid `mb-6 lg:mb-11`. The question keeps its showcase treatment on a
  desktop and stops dominating a half screen.
- **Chips go to one row and stay one row.** Four chips wrap at half width. Show
  three under `lg` and all four above it, in a single `flex-nowrap` row that
  scrolls horizontally if it must — a wrapped second row of chips is the single
  biggest source of the crowding in the screenshot.
- **Saved maps become a strip, not a section.** `mt-16` plus a centred eyebrow
  plus full-width rows is a section heading's worth of ceremony for a list that is
  usually empty and never the reason someone opened the page. Tighten to `mt-8`,
  cap at three visible rows with a `Show all N` disclosure, and keep the rows
  themselves as they are.
- **Nothing is removed from the product.** Every capability on this screen — file
  upload, paste, suggestions, resuming a map — is still one click away. This plan
  changes how much space each one claims when nobody is using it.

## Implementation

### 1. A `+` menu inside the input frame

**New file**: `app/components/BriefMenu.tsx`

A client component rendering a `+` button and, when open, a small popover with two
items: **Upload a file** (opens the hidden file input) and **Paste a brief**
(switches the intake into paste mode). Props: `busy`, `onChooseFile`, `onPaste`,
and the attached brief's name when one is in hand, so the button can render as a
filled chip showing the attachment instead of a `+`.

Shape follows the design system: `border-radius: 999px` on the button, `20px` on
the popover, `--line` hairline, no shadow beyond the one already used on
`NodeQuestionComposer`. Close on outside click, on `Escape`, and on selection.
`aria-haspopup="menu"` / `aria-expanded`, and the items are real `button`s in a
`role="menu"`, so it is reachable by keyboard — the current two buttons are, and
this must not regress that.

### 2. The input frame hosts the menu, the send button, and the drop target

**File**: `app/components/IdeaForm.tsx`

The input already reserves `pl-8 pr-24` for a large `SendButton` on the right.
Reserve the left as well — `pl-16` — and absolutely position `BriefMenu` at
`left-3`, mirroring how `SendButton` is positioned at `right-4`. Add the
drag-over handlers to the `form` element itself (they currently live on
`BriefDropTarget`'s panel) and a `border-ink bg-surface` treatment while a file is
over it, so the whole prompt reads as the drop zone.

Below the input, replace nothing and add one muted line:
`PDF, Word, Markdown or plain text — or drop one here`, `text-[12.5px] text-muted`,
shown only when no brief is attached.

### 3. Rewire the intake around the menu

**Files**: `app/components/BriefDrop.tsx`, `app/components/BriefDropTarget.tsx`

`BriefDrop` keeps every responsibility it has today — it owns whether a document
is attached, performs the `POST /api/briefs/extract` upload, and shows one of
three things — but the third thing changes. `BriefDropTarget` is reduced from a
dashed panel to a headless piece: the hidden `<input type="file">`, the `ACCEPT`
list, and the error line. Its panel markup, its two buttons and its format hint
all move out (to `BriefMenu` and to change 2). Rename it to `BriefFileInput.tsx`
if that reads better once the panel is gone — the `ACCEPT` constant and its
comment about the picker and the extractor staying in step must travel with it.

`BriefPasteBox` and `BriefReadout` are unchanged. `BriefReadout` already renders
compactly when a document is in hand, which is the state that earns the space.

### 4. Retune the hero

**File**: `app/components/IdeaHero.tsx`

`text-[clamp(40px,5.6vw,72px)]` → `text-[clamp(28px,4.6vw,64px)]`, and
`max-w-[13ch]` → `max-w-[15ch]` so the smaller type still breaks after "you".
Subtitle margin `mt-5 mb-11` → `mt-3 mb-6 lg:mt-5 lg:mb-11`, and its size
`text-[17px]` → `text-[15px] lg:text-[17px]`.

### 5. One row of chips

**File**: `app/components/SuggestionChips.tsx`

`flex-wrap` → `flex-nowrap overflow-x-auto no-scrollbar` (the utility added in the
half-screen chrome plan), `gap-2.5` → `gap-2 lg:gap-2.5`, and render
`SUGGESTIONS.slice(0, 3)` under `lg` with all four above it. Chips keep their
current `px-4 py-2.5`; they are already the right size.

### 6. Saved maps as a strip

**File**: `app/components/SavedMapList.tsx`

`mt-16` → `mt-8 lg:mt-12`. Cap the rendered rows at three with a
`Show all {maps.length}` text button beneath when there are more, holding the
expanded state locally (this makes the component a client component). Keep the
eyebrow and keep `SavedMapRow` exactly as it is.

### 7. Let the column breathe rather than centre in a void

**File**: `app/components/LandingScreen.tsx`

`justify-center pb-24` centres the stack vertically and then pushes it up by 96px,
which at half-screen height leaves the hero floating with the saved maps pressed
toward the bottom. Change to `justify-start pt-8 pb-10 lg:justify-center lg:pt-0
lg:pb-24` — anchored to the top where height is scarce, centred where it is not.

## Reused existing code

- `BriefDrop` from `app/components/BriefDrop.tsx` (glossary entry: `BriefDrop`) —
  keeps ownership of the attached-brief question and the upload; only its resting
  presentation changes.
- `ACCEPT` from `app/components/BriefDropTarget.tsx` — the picker/extractor
  agreement moves intact rather than being restated in the new menu.
- `BriefPasteBox` and `BriefReadout` (glossary entries: `BriefPasteBox`,
  `BriefReadout`) — unchanged; the menu's *Paste a brief* item routes into the
  existing `pasting` state.
- `SendButton` from `app/components/SendButton.tsx` (glossary entry: `SendButton`)
  — the precedent for a control absolutely positioned inside the input's frame
  (`right-4 h-[52px] w-[52px]` in its `large` size). `BriefMenu` mirrors it on the
  left rather than inventing a second pattern.
- `NodeQuestionComposer` from `app/components/NodeQuestionComposer.tsx` (glossary
  entry: `NodeQuestionComposer`) — the existing small floating panel in this app
  (`rounded-2xl border border-line bg-surface p-3 shadow-lg`); the popover matches
  it so the two read as one component family.
- `SUGGESTIONS` from `app/lib/suggestions.ts` (glossary entry: `SUGGESTIONS`) —
  the chip content is untouched; only how many render at a given width changes.
- `.no-scrollbar` from `app/globals.css` — introduced by the half-screen chrome
  plan for the phase track; the chip row is its second consumer. If this plan
  lands first, add the utility here instead.
- **Existing-implementation survey (attachment menus).** Grepped `app/` for an
  existing popover, dropdown, or menu component: there is none. `NodeKindPicker`
  is a native `<select>`, and `ContributionTabs` is a two-button segmented
  control — neither is a menu and neither is reusable here. The `+` menu
  introduced by change 1 is genuinely new (new file), not a duplicate.

## Scenarios to Demonstrate

- **Day one at half screen (760×1000)** — no saved maps, nothing attached: hero,
  input with `+` and send, one line of file-type hint, three chips. The whole
  screen is the question.
- **Day one at Desktop (1440×900)** — the showcase hero at its full size, four
  chips, unchanged in character from today.
- **The `+` menu open** — two items, keyboard-focusable, over the landing ground.
- **A brief attached** — the `+` renders as a chip naming the file, the hint line
  and the chips are gone, and `BriefReadout` shows the source. The input's label
  and placeholder switch to the brief wording `IdeaForm` already implements.
- **Dragging a file over the prompt** — the form frame highlights; no dashed panel
  anywhere on screen.
- **A scanned PDF that extracts nothing** — the existing `BriefWarning` path still
  renders under the compact intake, so a document that came back empty still says
  so.
- **Eleven saved maps** — three rows plus `Show all 11`, at both widths.
- **Extraction failed** — the error line renders under the input rather than
  inside a panel that no longer exists.