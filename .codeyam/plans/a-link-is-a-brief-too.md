---
title: "A Link Is a Brief Too"
mode: ui
createdAt: "2026-09-02T19:58:04Z"
source: manual
---

## Summary

The intake accepts a file or pasted text. A great many briefs are neither —
they are a page: a Notion doc, a public spec, a client's landing page. Add a
link as a third door into the same pipeline, so a URL becomes brief text the
same way a `.docx` does, and rename the attach control so the door is visible
before it is used.

This plan is deliberately the *text-shaped* half of the intake widening. Images
are a separate plan (`an-image-the-agent-can-look-at`) because they cannot
become text and therefore cannot reuse any of this.

## What already exists — do not rebuild it

Investigated before planning, because two of the four capabilities requested
are already shipped and a plan that re-adds them would be pure waste:

- **Drag-and-drop already works.** `app/components/IdeaForm.tsx` makes the
  whole `<form>` the drop target (`onDragOver` / `onDragLeave` / `onDrop`),
  with a `dragging` state that swaps the input's border and background. The
  dashed panel that used to advertise it was removed on purpose —
  `app/components/BriefFileInput.tsx` and `app/components/BriefDrop.tsx` both
  document why. This plan EXTENDS that handler; it does not add it.
- **Choosing a file already works.** `BriefMenu`'s "Upload a file" item calls
  up a hidden `<input type="file">` in `BriefFileInput`, gated by an `ACCEPT`
  list kept next to the extractor so the two cannot drift.

What is genuinely missing is the URL: no component collects one, no route
fetches one, and `app/lib/briefText.ts` has no HTML branch.

## Key Decisions

- **A third menu item and a small box, mirroring the paste door exactly.**
  `BriefPasteBox` is already the pattern for "a second way in that needs one
  field and two buttons"; `BriefLinkBox` is that shape with a URL field. The
  alternative — sniffing a URL out of the main idea input — was rejected: that
  input's job is the question you are asking, and a person who types a sentence
  containing a link would have a document attached without asking for one.

- **The server fetches the page, not the browser.** A browser `fetch` of an
  arbitrary third-party URL is blocked by CORS for almost every page worth
  attaching, so the request has to originate server-side. This is also the
  decision that makes the next bullet mandatory.

- **A server that fetches a user-supplied URL is an SSRF hole until it is
  closed, so the guard is part of this plan, not a follow-up.** Without it,
  anyone can point the intake at `http://169.254.169.254/`, `http://localhost`,
  or a private-range address and read the response back out of the attached
  brief. `app/lib/briefUrl.ts` (new) is the single place that decides a URL is
  allowed: https/http scheme only, no credentials in the URL, hostname resolved
  and rejected if it lands on loopback, link-local, or any private range —
  **re-checked after every redirect**, since a permitted host can 302 to
  `127.0.0.1`. Its own module for the same reason `briefInput.ts` is one: this
  is real logic worth testing directly rather than `if`s buried in a handler.

- **Extract readable article text, not the whole DOM.** A brief pulled off a
  page carrying nav, cookie banner and footer is mostly noise, and the noise
  then flows into `briefSections.ts` and becomes sections an agent reads. Use
  `@mozilla/readability` over a `linkedom` document, falling back to body text
  when Readability declines to parse. This adds two dependencies — acceptable
  precisely here, because `briefText.ts` is the module whose stated job is to
  keep every format-specific dependency in one file. The cheaper alternative
  (one dep, `cheerio`, strip `script`/`style` and take `.text()`) is a real
  option if the reviewer would rather not take two; it produces a noticeably
  worse brief.

- **A fetched page needs no schema change.** `MapBrief` already stores
  `sourceName` and `mediaType` as free strings, so the URL goes in
  `sourceName` and `text/html` in `mediaType`, and `parseBriefInput` accepts it
  unchanged. This is the whole reason links are a small plan and images are
  not.

- **Relabel the trigger now, and accept that the label changes again.** The
  bare `+` says nothing about what it takes, which is why drag-and-drop reads
  as missing when it has worked all along. It becomes a labelled control. The
  label states what is TRUE when this plan lands — a doc or a link — and the
  images plan updates it. Shipping the eventual "docs, images, etc." wording
  today would advertise a capability that does not exist yet.

## Implementation

### 1. Decide whether a URL may be fetched

**New file**: `app/lib/briefUrl.ts`

A pure-ish validator returning either a normalized `URL` or a sentence the
person can act on. Rejects: any scheme but http/https; a URL carrying
credentials; a hostname that resolves to loopback, link-local (`169.254/16`,
`fe80::/10`), private ranges (`10/8`, `172.16/12`, `192.168/16`, `fc00::/7`),
or unspecified. Exported separately from the fetch so the redirect check can
call it again per hop.

### 2. Fetch it and hand back text

**New file**: `app/api/briefs/fetch/route.ts`

`runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, wrapped in `withFailure`
from `app/lib/apiFailure.ts` — the same shape as
`app/api/briefs/extract/route.ts`, which this should read as a sibling of.
POST `{ url }`; validate via `briefUrl`; fetch with `redirect: 'manual'` so
each hop is re-validated, an abort timeout (~10s), and the same 10MB ceiling
the upload route uses. Responds with the identical body shape the upload route
returns — `{ text, sourceName, mediaType, charCount, warning }` — so the client
needs no second code path for the result. Errors follow the existing house
style: a sentence naming what to do instead, never a stack.

`sourceName` is the page's `<title>` when it has one, falling back to
`host + pathname`; the full URL belongs in there too if the title is short
enough, since it is the only record of where the brief came from.

### 3. Add an HTML branch to the extractor

**File**: `app/lib/briefText.ts`

A private `extractHtml(bytes | string)` alongside `extractPdf` and
`extractDocx`, dispatched from `extractBriefText` on `text/html` or an `html`
extension — which also makes a dropped or picked `.html` file work, for free
and consistently. Route the result through `normalizeBriefText` and
`extractionWarning` from `app/lib/briefFormat.ts` exactly as the other formats
do, so a thin page produces the same warning a thin PDF does. Extend `ACCEPT`
in `app/components/BriefFileInput.tsx` with `.html,text/html` in the same
change, since that constant exists to stay in step with this function.

### 4. Collect the URL

**New file**: `app/components/BriefLinkBox.tsx`

Modeled on `app/components/BriefPasteBox.tsx`: one `type="url"` input focused
on mount through a ref (not `autoFocus` — the comment there explains that
captures render in a cross-origin frame), an "Attach it" button disabled while
empty, and a Cancel. Reports the URL up; it does not fetch.

**File**: `app/components/BriefDrop.tsx`

It already renders exactly one of readout / paste box / nothing. Add the link
box as a fourth branch driven by a `linking` prop, keeping the component's
single-question shape.

### 5. Wire it and extend the drop target

**File**: `app/components/IdeaPrompt.tsx`

Add a `linking` state beside `pasting`, and a `fetchLink(url)` beside
`upload(file)` — same `readJson` handling, same `setBrief`, same `reading`
flag, because the response shape is deliberately identical.

**File**: `app/components/BriefMenu.tsx`

A third `role="menuitem"`, "Add a link". Replace the icon-only trigger with a
labelled control — a paperclip plus text reading "Add a doc or link" — keeping
the existing attached-name chip state, the `aria-haspopup`/`aria-expanded`
wiring, and the close-on-outside-click/Escape effect untouched. Note the
button is absolutely positioned inside the input frame at `left-3` with the
input reserving `pl-16`; a wider trigger means that padding has to grow with
it, or the placeholder will run underneath. Keep the neutral tokens
(`surface`/`line`/`ink-soft`) — the design system reserves `--lime` for the
single node that just changed, and spending it here would retire that meaning.

**File**: `app/components/IdeaForm.tsx`

The `onDrop` handler currently reads `e.dataTransfer.files?.[0]` only. Dragging
a link out of another tab yields no file — it yields `text/uri-list`. Check
files first, then fall back to `getData('text/uri-list')` (or `text/plain`
when it parses as a URL) and route that to `onDropLink`. Grow the `pl-16`
padding to match the new trigger width.

**File**: `app/components/IntakeHint.tsx`

The muted line under the input names the accepted formats. Add links to it, so
the sentence and the menu agree.

## Reused existing code

- `BriefPasteBox` from `app/components/BriefPasteBox.tsx` — the exact shape
  `app/components/BriefLinkBox.tsx` (new) copies, including the
  focus-through-a-ref workaround.
- `BriefDrop` from `app/components/BriefDrop.tsx` (glossary entry: `BriefDrop`)
  and its `AttachedBrief` interface — the attached-brief shape is unchanged by
  this plan.
- `BriefMenu` from `app/components/BriefMenu.tsx` (glossary entry: `BriefMenu`)
  — extended, not replaced.
- `IdeaForm` from `app/components/IdeaForm.tsx` and `IdeaPrompt` from
  `app/components/IdeaPrompt.tsx` — the drop target and the intake state owner.
- `withFailure` from `app/lib/apiFailure.ts` and `readJson` from
  `app/lib/readJson.ts` — the error contract both ends of this already speak.
- `extractBriefText` from `app/lib/briefText.ts`, plus `normalizeBriefText` and
  `extractionWarning` from `app/lib/briefFormat.ts`.
- `parseBriefInput` from `app/lib/briefInput.ts` — unchanged, and the check
  that a fetched brief needs no new validation.
- `ACCEPT` from `app/components/BriefFileInput.tsx` — extended in step 3.
- `app/api/briefs/extract/route.ts` — the sibling route the new one mirrors.

**Existing-implementation survey.** Checked before writing: there is no URL or
link intake anywhere in the tree — no `fetch` of a user-supplied address, no
uri-list drop handling, no HTML branch in `extractBriefText`, and no
SSRF/host-allowlist helper to reuse. `app/lib/briefUrl.ts` (new) has nothing
equivalent to reuse or duplicate.
The drop handler and the file picker, by contrast, both exist and are extended
rather than created.

## Scenarios to Demonstrate

- The attach control at rest, labelled — the state that has to read as "you can
  add things here" without being opened.
- The menu open, showing three doors: upload, paste, link.
- `BriefLinkBox` empty, with the button disabled.
- A link attached: the readout naming the page title, the chip on the trigger.
- A fetched page that came back thin — the `extractionWarning` path, shown on a
  link rather than a PDF.
- A refused URL: `http://localhost:3000` rejected by the guard, with the
  sentence the person sees. This is the security behaviour made visible rather
  than asserted.
- A page that redirects to a private address — refused at the hop, not at
  entry.
- The form mid-drag with a link dragged over it.