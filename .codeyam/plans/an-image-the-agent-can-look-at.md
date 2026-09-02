---
title: "An Image the Agent Can Look At"
mode: ui
createdAt: "2026-09-02T20:03:48Z"
source: manual
dependsOn: ["a-link-is-a-brief-too"]
---

## Summary

A whiteboard photo, a screenshot of the competitor's flow, a diagram someone
sketched — these are briefs too, and today the product can only record that one
exists. `ThinkingMap.attachments` stores names and nothing else, so an image
someone attaches is a filename on a board and the agent has never seen it. Give
attachments bytes, let a person add one by pasting from the clipboard or
dropping it on the prompt, and — the whole point — give the agent a tool that
hands it the picture to look at.

This is deliberately NOT part of the link plan. A link becomes text and reuses
the entire brief pipeline unchanged; an image cannot become text and reuses
none of it.

## The stance this overturns, on purpose

`prisma/schema.prisma` states the current position on the `attachments` column
in as many words: *"Names, not bytes. The board's job is to record that a scope
doc or a screenshot is part of this thinking — storing the file itself is a
different product with a different set of problems (size, privacy, expiry), and
none of them are the one being solved here."*

This plan reverses that, as an explicit product decision, because the reason
given no longer holds: an agent with vision can read a diagram, and a filename
it cannot open is not a contribution to the thinking. The three problems the
comment names are real and are answered below rather than waived — size by a
hard cap, privacy by keeping the bytes inside the same SQLite file as
everything else, expiry by cascading deletes off the map. The schema comment
must be rewritten in this change; leaving it would document a position the code
no longer takes.

## Key Decisions

- **A `MapAttachment` table, not a wider JSON column.** The existing
  `attachments` column is a JSON string parsed by `parseAttachments` in
  `app/lib/attachments.ts`, whose stated rule is that a board must open even if
  the column is garbage. Base64 image data does not belong in a column with
  that contract, and a relation gives the per-attachment id the read tool and
  the thumbnail route both need. `bytes` is nullable so every existing
  name-only attachment migrates as a row rather than being dropped.

- **Bytes in SQLite, not an uploads directory.** `app/lib/briefText.ts` opens
  by noting the project "has no uploads directory and no story about serving
  one", and that remains worth keeping: one `dev.db` is still the entire state,
  backup and teardown story, and a cascade delete still really deletes. The
  cost is that a large attachment sits in a row; the caps below are what make
  that acceptable rather than a hope.

- **Hard caps, enforced server-side: 5MB per attachment, 4 per map, 10MB
  total.** Not advisory. This is the answer to the "size" objection the schema
  comment raises, and a cap that only the client enforces is not one.

- **Attachments are written AFTER the map exists, following the route that
  already does this.** `PUT /api/maps/[id]/attachments` is already a
  post-creation whole-list replace, and `IdeaPrompt` already routes to the map
  once `POST /api/maps` returns an id. Pending images are held in browser
  memory on the landing screen and uploaded between those two steps. The brief
  keeps its own rule — it travels in the same POST as the idea, created
  together or not at all — because a brief is the document the map is ABOUT and
  an attachment is something brought along.

- **A whole-list PUT cannot carry bytes; the route splits.** Replacing the list
  every time would mean re-uploading every image on every edit. Keep the
  existing PUT for renames and removals by id, and add a POST that appends one
  attachment with its bytes. The existing route's own doc comment explains why
  it is a whole-list PUT — that reasoning holds for names and breaks for bytes,
  which is the thing to say when changing it.

- **`McpToolResponse.content` has to widen, and that is the real work here.**
  It is typed in `app/lib/toolCatalog.ts` as
  `{ type: 'text'; text: string }[]` — text blocks only. An agent cannot be
  handed a picture through it. Widen the union with MCP's image block
  (`{ type: 'image'; data: string; mimeType: string }`), and update the places
  that build one: `app/lib/toolInvocation.ts`, and the marshalling behind
  `app/lib/mcpServer.ts` and `app/api/maps/[id]/tools/route.ts`. `ToolResult`
  in the same file gains an optional images field so a handler can return one
  without every handler changing shape.

- **A separate `read_attachment` tool, not attachments inside `read_map`.**
  `app/lib/mcpFormat.ts` already documents the principle for the brief:
  `read_map` carries metadata only, "never the text", because it is called
  constantly. An image is the strongest possible case of that — inlining one
  would put a megabyte of base64 into every turn. `read_map` lists what is
  attached; `read_attachment` fetches one deliberately.

- **Paste is a form-level handler, not a new box.** The clipboard gesture lands
  wherever focus is, so `IdeaForm` takes an `onPaste` that inspects
  `clipboardData.items` for an image and ignores everything else — a pasted
  screenshot attaches, pasted text still types into the input as it always did.

## Implementation

### 1. Give attachments bytes

**File**: `prisma/schema.prisma`

Add a `MapAttachment` model: `id`, `mapId` with a cascade delete onto
`ThinkingMap`, `name`, `mediaType`, `bytes Bytes?`, `byteSize Int`,
`createdAt`. Replace the `attachments String?` column's doc comment with the
new position (see the section above); keep the column itself for the migration
step, then drop it.

Migration: for every map with a non-null `attachments` JSON, create one
`MapAttachment` per name with `bytes = null`. A legacy attachment stays exactly
what it was — a recorded name — and simply has no picture to read.

### 2. Read them back, and keep the board unbreakable

**File**: `app/lib/attachments.ts`

`parseAttachments` reads a JSON string today. Give it a sibling that maps
`MapAttachment` rows to the `Attachment` shape the board renders, widened with
`id`, `mediaType` and whether bytes are present. Keep the module's existing
rule intact — an attachment that cannot be read must not take the board down —
and keep `parseAttachments` itself until the column is dropped.

**File**: `app/map/[id]/page.tsx`

It calls `parseAttachments(map.attachments)`. Point it at the relation instead.

### 3. Accept an upload

**File**: `app/api/maps/[id]/attachments/route.ts`

Keep `PUT` for the name-only whole-list edit. Add `POST` accepting a
`multipart/form-data` body with one file: enforce the three caps, accept
`image/png`, `image/jpeg`, `image/gif`, `image/webp` plus the document types
`ACCEPT` already lists, store the bytes, and return the created row's id and
metadata — never the bytes. Errors follow the house style already set by
`app/api/briefs/extract/route.ts`: a sentence naming what to do instead.

**New file**: `app/api/maps/[id]/attachments/[attachmentId]/route.ts`

`GET` returning the bytes with the stored `Content-Type` and an immutable cache
header. This is what a thumbnail's `src` points at. Scope the lookup by BOTH
`mapId` and `attachmentId`, so an id from one map cannot read another's file.

### 4. Hand it to the agent

**File**: `app/lib/toolCatalog.ts`

Widen `McpToolResponse.content` to a union of the existing text block and MCP's
image block. Add an optional images field to `ToolResult`. Register a
`read_attachment` tool taking an attachment id, described so an agent knows to
list first and fetch deliberately — the same discipline `read_brief`'s
description already teaches for sections.

**File**: `app/lib/toolRuntime.ts`

Implement `read_attachment`: return the image as a base64 block with its media
type, a text block for a readable document, and a plain sentence for an
attachment that has no bytes (a legacy name) — the `read_brief` handler's
no-brief branch is the model for that, deliberately not an `isError`, so the
agent moves on rather than retrying something that will never succeed.

**File**: `app/lib/toolInvocation.ts`

The helpers here build `McpToolResponse` bodies with a text block. Extend them
to pass an image block through.

**File**: `app/lib/mcpFormat.ts`

`MapDetail` grows an attachments list — id, name, media type, whether it can be
looked at — rendered into `read_map`'s output as metadata only, matching how
`brief` is already handled there.

### 5. Let a person add one

**File**: `app/components/IdeaForm.tsx`

Add an `onPaste` reading `clipboardData.items` for an image and calling up to
the parent; leave ordinary text paste alone. The `onDrop` handler already takes
`dataTransfer.files[0]` and routes it to the brief — route an image-typed file
to attachments instead, and accept more than one file while there.

**File**: `app/components/IdeaPrompt.tsx`

Hold pending attachments in state, upload them after `POST /api/maps` returns
an id and before `router.push`, and surface a per-file error without losing the
map that was just created.

**New file**: `app/components/AttachmentStrip.tsx`

A row of thumbnails under the input — image preview or a document chip, name,
size, and a remove control. This is the only way a person can tell what they
actually attached, and the only way to undo a mis-paste.

**File**: `app/components/BriefMenu.tsx`

The label the link plan sets to "Add a doc or link" becomes "Add docs, images
or a link", and the menu gains an item for images. This plan depends on that
one purely so the label is written once per capability rather than churned.

**File**: `app/components/BriefFileInput.tsx`

`ACCEPT` gains the image types, keeping it in step with what the upload route
accepts — the constant exists for exactly that reason.

## Reused existing code

> Note on the citation check: it reports the three dynamic-route paths below
> (`app/map/[id]/page.tsx`, `app/api/maps/[id]/attachments/route.ts`,
> `app/api/maps/[id]/tools/route.ts`) as unresolved. That is a false positive —
> the checker reads Next's `[id]` segment as a glob character class. All three
> files exist and were read while writing this plan.

- `parseAttachments` and the `Attachment` interface from
  `app/lib/attachments.ts` (glossary entry: `parseAttachments`) — the
  must-not-break-the-board rule is kept, not rewritten.
- `app/api/maps/[id]/attachments/route.ts` — the existing PUT stays; POST is
  added beside it.
- `createMap` from `app/lib/mapStore.ts` and `app/api/maps/route.ts` — both
  already thread an attachments list; unchanged by this plan.
- `ToolResult` and `McpToolResponse` from `app/lib/toolCatalog.ts` — the two
  types that gate whether an agent can be handed anything but text.
- `read_brief` in `app/lib/toolRuntime.ts` — the model for a read tool that
  degrades gracefully when there is nothing to read.
- `formatMapList` / `MapDetail` from `app/lib/mcpFormat.ts` — and its stated
  rule that `read_map` carries metadata, never contents.
- `errorResponse` and `answeredResponse` from `app/lib/toolInvocation.ts` — the
  response builders that widen.
- `app/lib/mcpServer.ts` and `app/api/maps/[id]/tools/route.ts` — the two doors
  that marshal a `ToolResult`; `app/lib/webmcp.ts` consumes the same type in
  the browser.
- `ACCEPT` from `app/components/BriefFileInput.tsx`.
- `withFailure` from `app/lib/apiFailure.ts` and `readJson` from
  `app/lib/readJson.ts`.

**Existing-implementation survey.** An attachments concept ALREADY EXISTS and
this plan extends it rather than inventing one: the `attachments` column, the
PUT route, `parseAttachments`, board rendering in `app/map/[id]/page.tsx`, and
fixtures in `app/isolated-components/GalaxyBoard/page.tsx` already naming a
whiteboard photo. What does not exist anywhere in
the tree: any byte storage, any file-serving route, any image content block in
the MCP types, and any clipboard-paste handler. There is no OCR or vision
dependency in `package.json` and none is added — the agent does the looking.

## Scenarios to Demonstrate

- A screenshot pasted onto the landing screen, showing as a thumbnail before
  the map is created.
- Two images and a PDF attached together, with the strip naming all three.
- An image dropped on the prompt while a brief is already attached — the brief
  is untouched, the image joins the strip.
- A 12MB image refused by the cap, with the sentence the person sees.
- A map opened later, its board listing what was brought along.
- A legacy map whose attachment is a name with no bytes — it renders, and
  `read_attachment` says plainly that there is nothing to look at.
- The agent's view: `read_map` listing the attachments as metadata, then
  `read_attachment` returning the picture.