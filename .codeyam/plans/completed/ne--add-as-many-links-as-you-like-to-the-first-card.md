---
title: "ne -- Add As Many Links As You Like To The First Card"
mode: ui
createdAt: "2026-09-03T15:33:14Z"
prefix: "ne"
source: manual
---

## Summary

The first card lets you attach exactly one link. Once a page is fetched, "Add a
link" greys out — `linkDisabled={brief !== null}` — so a second source is
offered only by throwing the first away. That restriction is real, not a slip:
`MapBrief.mapId` is `@unique` and the brief is write-once, and that immutability
is load-bearing, because `briefSections.ts` derives stable `s1..sN` ids from the
text by a pure splitter and nodes cite those ids as provenance.

This plan lets the card carry as many links as you want without touching that
model. The card holds a LIST of fetched pages; at Start they are merged into the
single brief the server already accepts, each page under its own `# <sourceName>`
markdown heading. The existing splitter then cuts the merged document on exactly
those headings, so the brief outline an agent reads back is the list of pages you
attached, in order, with stable ids. One link merges to byte-identical text, so
nothing about today's single-link map changes.

Because links become uncapped, the chip strip has to survive a card carrying a
dozen things: it gets a bounded height that scrolls, plus a count so what is out
of sight is still stated.

Browse was checked separately and needs no change — see Key Decisions.

## Key Decisions

- **Merge into one brief rather than allowing many.** Considered dropping the
  `@unique` on `MapBrief.mapId`, and rejected it: the schema comment at
  `prisma/schema.prisma:406` records that attaching or replacing a brief on a
  running map would need a document-version model and a story for references
  pointing into a passage that no longer exists. Merging at intake gets multiple
  links with zero schema change and no new state for `read_brief` or `sourceRef`
  provenance to account for.
- **Merge on the client, at Start, not in the route.** The POST body keeps its
  current shape — one `brief` object — so `parseBriefInput` and `createMap` are
  untouched and the server contract does not fork. The merge is a pure function
  in its own module, which is where it can actually be tested at the edges.
- **One link merges to itself, verbatim.** `mergeBriefs` passes a single brief
  through with no heading added and no media type rewrite. Wrapping it would
  shift every section id on the most common map there is, for no gain.
- **Headings carry the page names.** `briefSections.ts` splits on markdown
  headings, so `# <sourceName>` per page makes the outline the list of sources.
  A page whose own text already contains headings simply splits finer — that is
  the splitter working, not a defect.
- **Dedupe links by `sourceName`, mirroring files.** `admitFiles` refuses a file
  whose name is already held; a link door that silently attached the same page
  twice would be the odd one out, and a duplicated page would appear twice in
  the merged brief.
- **The link box still closes after a successful attach.** The ask is that the
  button stay selectable, and it will be. Leaving the box open was considered —
  it saves a click per link — but it is a change to a flow nobody complained
  about, and an address field that never goes away crowds a card whose emptiness
  is deliberate.
- **No cap on links; the strip absorbs the consequence.** Files keep their cap of
  4 (`MAX_ATTACHMENTS_PER_MAP`), which is server-enforced in the upload route and
  is not in scope. Links have none, so the strip gets a bounded scrolling height
  rather than growing the card without limit.
- **Scroll rather than expand-on-hover.** `max-h-[…] overflow-y-auto` is the
  pattern already used for a list that must not grow the surface it sits in
  (`BoardMenu.tsx:83`, `MapWorkspace.tsx:70`). Hover disclosure would invent a
  gesture this app does not otherwise use, and it is unreachable by touch.
- **Browse is left alone — it already does this.** Its button carries no
  `disabled` prop at all, the picker is `multiple`, and `addFiles` appends and
  dedupes. Clicking it repeatedly already accumulates files; the only wall is
  the cap of 4, which reports itself as a sentence rather than a greyed button.
  Checked and deliberately unchanged.

## Implementation

### 1. The merge itself

**New file**: `app/lib/briefMerge.ts`

A pure module, no React and no fetch, exporting one function:

`mergeBriefs(briefs: FetchedBrief[]): BriefInput | undefined`

- Empty list returns `undefined`, so "no brief" stays one case for the caller.
- A single brief returns `{ text, sourceName, mediaType }` verbatim — no heading,
  no rewriting.
- Two or more return the pages joined as `# <sourceName>` followed by a blank
  line and that page's text, separated by blank lines; `sourceName` becomes
  `"<n> pages"`; `mediaType` becomes `text/markdown`, which is what the merged
  document now honestly is.

Normalise each page's text the way the rest of the intake does before joining
(trailing whitespace trimmed) so the join cannot produce runs of blank lines that
change where the splitter cuts.

### 2. The card holds a list

**File**: `app/components/FirstCard.tsx`

- Replace the `brief` state with `briefs: FetchedBrief[]`, starting empty.
- `attachLink` appends rather than assigns: on a successful fetch, refuse the
  page when a held brief already has that `sourceName` (report it through the
  existing `error` state), otherwise append, clear the address, and close the
  box as it does today.
- `canStart` becomes `value.trim().length > 0 || briefs.length > 0`.
- `start` calls `mergeBriefs(briefs)` and spreads the result into the POST body
  in place of the current inline single-brief object; when it returns
  `undefined`, the body carries no `brief` key, exactly as now.
- Drop the `linkDisabled` prop from the `FirstCardControls` call site.
- Pass `briefs` and an `onRemoveBrief` that removes by index to
  `FirstCardAttachments`.

### 3. The button stops greying out

**File**: `app/components/FirstCardControls.tsx`

Remove the `linkDisabled` prop, its type, its doc comment about one brief per
board, and the `disabled` attribute on the "Add a link" button. Keep
`disabled:opacity-30` off that button's class list once nothing sets it. The
Browse button and the Start button are untouched.

### 4. The strip shows many chips without growing the card

**File**: `app/components/FirstCardAttachments.tsx`

- Prop `brief: FetchedBrief | null` becomes `briefs: FetchedBrief[]`, and
  `onClearBrief` becomes `onRemoveBrief: (index: number) => void`. Render one
  inverted chip per brief, keyed by index — two pages can legitimately share a
  display name, so the index is the only stable key.
- Render nothing when `briefs.length === 0 && files.length === 0`, unchanged.
- Give the `ul` a bounded height that scrolls when the contents exceed it, using
  the `max-h-[…] overflow-y-auto` pattern cited above — roughly three rows of
  chips, so the card's proportions hold. Add the `aria-label="Attached to this
  idea"` that `AttachmentStrip.tsx:39` already uses, so the two strips name
  themselves the same way.
- When the combined count of briefs and files is greater than four, show a small
  count above the list (e.g. "7 attached") so the items below the fold are
  stated rather than merely scrollable.

### 5. Keep the isolated-component harnesses honest

**File**: `app/isolated-components/FirstCardControls/page.tsx`

Drop `linkDisabled` from the preset type and from all four presets. The
`BriefOnly` preset now differs from `Ready` only in intent, so either fold it
into `Ready` or keep it and re-describe it as "startable from a page alone" —
whichever the scenario registry ends up cleaner with.

**File**: `app/isolated-components/FirstCardAttachments/page.tsx`

Switch every preset to the `briefs` array shape and add two: several links
attached at once, and a card carrying enough links and files to make the strip
scroll. These are what prove the overflow behaviour visually.

### 6. Tests

**New file**: `app/lib/briefMerge.test.ts`

Cover the edges the merge actually has: an empty list, a single brief passing
through byte-identical, several pages joined under their own headings, the
derived `sourceName` and `mediaType`, and a page whose text already carries
headings.

**File**: `app/components/FirstCardAttachments.render.test.tsx`

Extend for the list shape: several brief chips rendered at once, removal
reporting the right index, and the count line appearing only past the threshold.
The existing cases keep their meaning with a one-element array.

**File**: `app/lib/briefSections.test.ts`

Add one case asserting a merged two-page document splits into `s1` and `s2` with
the page names as headings. That is the join between the two modules, and it is
the assertion that would catch a change to either one breaking the other.

Re-register affected scenarios after the UI changes.

## Reused existing code

- `FetchedBrief` from `app/lib/briefFetch.ts` — the shape the card already holds;
  the list is a list of these, no new type.
- `fetchBriefFromLink` from `app/lib/briefFetch.ts` — unchanged; the second link
  goes through exactly the same server-side guarded fetch as the first.
- `BriefInput` from `app/lib/briefInput.ts` — the return type the new merge helper
  is written against, so the merged brief is typed as the thing the route
  already parses.
- `parseBriefInput` from `app/lib/briefInput.ts` — untouched, and that is the
  point: the POST body shape does not change.
- `splitIntoSections` from `app/lib/briefSections.ts` (glossary entry: `briefSections`)
  — the heading splitter the merged document is written to feed. Not modified.
- `admitFiles` and `MAX_ATTACHMENTS_PER_MAP` from `app/lib/attachments.ts` — the
  file path, unchanged, and the precedent for deduping by name that the link
  dedupe copies.
- `shortenName` from `app/lib/attachments.ts` — already truncates each chip's
  label; it needs nothing new to serve more chips.
- `useFilePreviews` from `app/hooks/useFilePreviews.ts` — file chip thumbnails,
  unchanged.
- `FirstCardFileChip` from `app/components/FirstCardFileChip.tsx` (glossary
  entry: `FirstCardFileChip`) — unchanged.
- `FirstCardLinkBox` from `app/components/FirstCardLinkBox.tsx` (glossary entry:
  `FirstCardLinkBox`) — unchanged; it is reopened rather than altered.
- `AttachmentStrip` from `app/components/AttachmentStrip.tsx` — not modified;
  its `aria-label` wording is the precedent the strip's label copies.

**Existing-implementation survey.** There is no merge, concatenate, or join
helper for briefs anywhere in `app/lib` today — the fourteen `brief*` modules
cover fetching, extraction, sectioning, formatting, coverage and URL guarding,
and none of them combines two documents, so the merge helper in Implementation
step 1 is genuinely new rather than a duplicate of something already here. There
is likewise no existing overflow/disclosure component to reuse for the chip
strip; `max-h-[…] overflow-y-auto` is a repeated inline pattern, not a
component, and this plan follows it inline rather than extracting one for two
call sites.

**Out of scope, noted.** `app/components/IdeaPrompt.tsx` and
`app/components/BriefLinkBox.tsx` are a second, older intake surface, reachable
only through `app/components/LandingScreen.tsx`, which nothing but the isolated-component
harness renders. It carries the same one-brief assumption. Left alone
deliberately; it is dead-ish surface and changing it would double the diff for
no user-visible gain.

## Scenarios to Demonstrate

- One link attached — the unchanged case, proving "Add a link" is now still
  selectable beside it.
- Three links attached, chips listed in the order they were added.
- A dozen links and four files — the strip scrolls inside its bounded height and
  the count states the total.
- Links and browsed files together, each kind still readable as its own sort of
  chip against the yellow.
- The same URL added twice — the second is refused with a sentence, and the
  first is still there.
- A link removed from the middle of the list, the rest keeping their order.
- Empty card — the strip renders nothing at all, as it does today.
- A merged brief read back through the outline: page names as section headings,
  ids `s1..sN` in attach order.