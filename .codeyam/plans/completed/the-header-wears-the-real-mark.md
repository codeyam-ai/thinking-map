---
title: "The Header Wears the Real Mark"
mode: ui
createdAt: "2026-09-02T19:50:23Z"
source: manual
---

## Summary

`Wordmark` currently draws a hand-coded placeholder — three circles and two
strokes on a 22x22 viewBox — next to the literal text "Thinking Map". The real
logo now exists as a file. It is a full lockup: a 127x31 mark plus the product
name already outlined as vector paths, so dropping it in retires the `<span>`
as well as the glyph. Swap it in, keeping every property the placeholder earned:
it follows the ink token instead of hardcoding a colour, it still names the link
home for a screen reader now that the name is paths rather than text, and it
still collapses to the mark alone on a narrow screen.

The asset is co-located with this plan:
`![The Thinking Map lockup](assets/the-header-wears-the-real-mark/thinking-map-logo.svg)`
(white on transparent — it will look blank in a light markdown viewer; the file
is the source of truth for the path data, not a preview).

## Key Decisions

- **Inline the paths into `Wordmark.tsx`; do not add a public/ dir and an img tag.**
  Three reasons, in order of weight. (1) The exported SVG is `fill="white"` on
  every one of its 14 shapes, and this product is light-only by design —
  `--paper: #f1efea`, `--ink: #0f0f0f`, with no dark mode anywhere in
  `app/globals.css`. A white logo on warm paper is an invisible logo. Fixing
  that means the fills have to inherit, and only an inline SVG can inherit
  `currentColor`; an `<img src="/logo.svg">` cannot be recoloured by the page.
  (2) It is the established pattern — `CardIcon`'s own doc comment says the
  product draws its marks inline "rather than pulled from an icon package",
  and `Wordmark` and `NodeAccentMark` do the same. (3) There is no public/
  directory in the repo at all, so the img-tag route means inventing a static
  asset pipeline to hold one file.

- **Replace every `fill="white"` with `fill="currentColor"`, and let the
  anchor carry the colour.** The placeholder hardcoded `var(--ink)` on each
  shape; `currentColor` is the same result said once instead of fourteen
  times, and it is what `CardIcon` already uses. `body` sets
  `color: var(--ink)`, so the correct colour arrives by inheritance —
  `text-ink` on the `<a>` is belt-and-braces against a future link colour
  rule.

- **Two `<svg>` elements sharing one mark constant, not one element with a
  hidden group.** The narrow-screen behaviour has to survive: today the name is
  a `<span>` that `hidden min-[520px]:inline` can simply drop. In a single
  lockup SVG, hiding the name paths with CSS would leave the `viewBox` still
  reserving all 127 units, so the mark would sit in ~100px of dead space.
  Cropping the `viewBox` to the mark's real bounding box is what actually
  collapses it, and `viewBox` is not a CSS property — so it takes a second
  element. Only the three mark rects are duplicated (via a shared constant),
  not the eleven letter paths.

- **The mark's crop is `viewBox="0 0 32 31"`.** Derived from the file, not
  guessed: `rect x=5 w=27` spans x 5..32; the two `rotate(90 ...)` rects
  resolve to x 0..10 and x 10..17.26; the first letter path starts at
  x=38.6. So x 0..32 is exactly the mark and nothing else.

- **Render at `h-[26px]`, confirmed against the captures rather than trusted.**
  The lockup's cap height is only ~12.4 of its 31 units, so matching the old
  22px glyph height would render the name at ~8.8px cap — visibly smaller than
  the 15px extrabold text it replaces. 26px puts the name near its old weight
  and makes the lockup ~106px wide, still narrower than the ~132px the glyph
  and span occupied together, which keeps the half-screen header constraint
  satisfied. The narrow-screen mark grows from 22px to 26px square. Both
  numbers are a starting point to check in the `AppHeader` and map-screen
  captures, not a settled fact.

- **`aria-label="Thinking Map"` moves onto the `<a>`.** Today the link's
  accessible name comes from the visible `<span>`, with the svg
  `aria-hidden`. Once the name is outlined paths there is no text node left,
  so without this the header's home link announces as an unnamed link — a real
  regression hiding inside a cosmetic change. Both svgs stay `aria-hidden`.

## Implementation

### 1. Rebuild the mark from the real asset

**File**: `app/components/Wordmark.tsx`

Take the shapes verbatim from
`assets/the-header-wears-the-real-mark/thinking-map-logo.svg`, changing only
`fill="white"` to `fill="currentColor"` on all 14 of them. Do not retype the
path data — copy it.

Structure the file as:

- A module-level `MARK` constant holding the three `<rect>` elements (the two
  with `transform="rotate(90 ...)"` keep their transforms exactly as exported).
  A constant because both svgs render it and the duplication is the only thing
  the two-element approach costs.
- A module-level `LOCKUP_NAME` constant (or an inline fragment) holding the
  eleven letter paths.
- The component: an `<a href="/">` keeping `suppressHydrationWarning` — the
  preview proxy rewrites `href` in server HTML, and `app/not-found.tsx:20` documents
  why every anchor here needs it — plus `aria-label="Thinking Map"` and
  `className="flex shrink-0 items-center text-ink"`. The old `gap-2.5` goes:
  the space between mark and name is baked into the lockup's geometry now.
- Inside it, the mark-only svg (`viewBox="0 0 32 31"`, `aria-hidden="true"`,
  `className="h-[26px] w-auto min-[520px]:hidden"`) and the full lockup svg
  (`viewBox="0 0 127 31"`, `aria-hidden="true"`,
  `className="hidden h-[26px] w-auto min-[520px]:block"`).

Keep a doc comment in the spirit of the one being replaced, and keep the
narrow-screen comment's reasoning — "under ~520px the mark stands alone,
because a lockup that wraps mid-name reads as broken in a way a mark on its own
does not" — since that judgment is still the reason the second element exists.

Nothing outside this file changes. `AppHeader` renders `<Wordmark />` with no
props and needs no edit; the glossary entry's description ("The product mark:
three nodes and the connectors between them...") should be refreshed to
describe the real lockup, which the workflow's glossary step handles.

### 2. Re-capture what the header appears in

**File**: `.codeyam/scenarios/wordmark-default.json`

The existing `Wordmark - Default` scenario captures at `Tablet` only, which
only ever exercises the lockup branch. Add a narrow dimension so the
`min-[520px]` crop is actually demonstrated rather than asserted — the mark-only
svg is new code and no current capture would show it.

`appheader-default` and `appheader-explore` re-capture as a consequence of the
component change; no edit to those files is expected.

## Reused existing code

- `Wordmark` from `app/components/Wordmark.tsx` (glossary entry: `Wordmark`) —
  the file being rewritten; its anchor semantics, `suppressHydrationWarning`,
  and `min-[520px]` breakpoint are all kept.
- `AppHeader` from `app/components/AppHeader.tsx` (glossary entry: `AppHeader`)
  — the sole consumer, unchanged, but the surface every capture reviews.
- `CardIcon` from `app/components/CardIcon.tsx` (glossary entry: `CardIcon`) —
  the precedent for `fill="currentColor"` on an inline mark, and the doc comment
  stating the draw-inline convention this plan follows.
- The `--ink` token and its `text-ink` Tailwind alias from `app/globals.css`
  (`:root` at line 10, `@theme inline` at line 67).
- `app/not-found.tsx` (line 20) for the `suppressHydrationWarning` rationale
  that must survive the rewrite.

**Existing-implementation survey.** Checked before writing this plan: the repo
has no public/ directory, no app-router icon or favicon file of any kind, and no
img-tag or file-referenced logo anywhere under `app/` — every mark in the
product is drawn inline (`Wordmark`, `CardIcon`). So nothing
equivalent to a static-asset logo path exists to reuse or duplicate; inlining is
the only pattern already present.

## Scenarios to Demonstrate

- `Wordmark - Default` at Tablet — the full lockup, ink on paper, at its
  chosen height.
- `Wordmark` at a narrow width (under 520px) — the mark alone, cropped, with
  no dead space where the name used to be. This is the capture that proves the
  `viewBox` crop rather than the CSS hide.
- `AppHeader - Default` — lockup left, `BoardMenu` right, on one line.
- `AppHeader - Returning` — the same with a populated board menu, the tightest
  case for horizontal room.
- The map screen at half-screen width — the constraint "App Chrome That Fits a
  Half Screen" established; the lockup is narrower than what it replaces, so
  this should confirm rather than surprise.
- The not-found page, which renders `AppHeader` with no `status`.