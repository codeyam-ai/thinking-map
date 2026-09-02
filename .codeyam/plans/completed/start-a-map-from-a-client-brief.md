---
title: "Start a Map From a Client Brief"
mode: ui
createdAt: "2026-09-01T13:12:42Z"
source: manual
---

## Summary

A client arrives with a twenty-page spec, not a sentence. Today the only way in
is one line: `IdeaPrompt` POSTs `seedIdea` to `/api/maps`, `createMap` slices the
first 57 characters into a title, and the agent's only view of it is `read_map`,
which prints `seedIdea` verbatim inside every full read. Paste a real brief into
that and you get a nonsense title, a root pill nobody can read, and a document
that either swamps the agent's context on every single read or is not reachable
at all. This makes the brief a first-class part of a map: it comes in whole
(pasted, or a `.pdf` / `.docx` / `.md` / `.txt` file whose text is extracted
server-side), it is stored immutably as the map's source, and the agent reads it
the way anyone reads a long document — an outline first, then the passages that
matter — through one new shared tool, `read_brief`. Nothing here makes the agent
smarter; it makes the brief *legible* to the agent that is already there, which
is the precondition for it asking the questions the document does not answer.

## Key Decisions

- **The brief is stored; the uploaded file is not.** Extraction happens in a
  request and only the resulting text is persisted. That keeps
  `FEATURE_PATTERNS.md`'s `public/uploads/` path — and its whole
  swap-to-S3-later story — out of scope entirely, because there is no file to
  serve. A brief is text; the `.docx` it arrived in is packaging.
- **One brief per map, written at creation, never overwritten.** This is the
  same rule `seedIdea` already lives under, and it is what makes the next
  decision safe. A revised brief is a new map — a v2 spec is a different
  conversation, not an edit to this one. Attaching or replacing a brief on a
  running map is deliberately out of scope; it needs a document-version model
  and a story for references pointing into a passage that no longer exists.
- **Sections are derived from the text, not stored as rows.** Because the text
  is immutable, a pure splitter yields the same `s1..sN` every time it runs, so
  section ids are stable without a table to keep in sync — and the splitter can
  be tested as pure logic rather than through a database. This is also what lets
  a later plan hang node provenance off a section id.
- **`read_brief` gives an outline by default and one passage on request.** A
  no-argument call returns the section list — number, heading, character count —
  which is cheap enough to call on every turn. A call naming a section returns
  that passage in full. An agent that needs the whole document can walk it, but
  it can never be handed 40,000 characters by accident. This is the central
  design constraint: the tool that reads a long document must not be able to
  blow up a context window in one call.
- **The brief never rides inside `read_map`.** `formatMapDetail` gains one line
  saying a brief exists, how long it is, and which tool reads it — not the text.
  A full `read_map` is called constantly; the brief is called deliberately.
- **Extraction failure is visible before the map exists.** A scanned PDF
  extracts to almost nothing. The intake shows the character count and the first
  extracted lines *in the landing screen*, so a client sees the empty extraction
  and pastes instead — rather than starting a map whose source is silently
  blank and only discovering it three questions later.
- **`unpdf` for PDF and `mammoth` for `.docx`, behind one module.** Both are
  reached only from `app/lib/briefText.ts`, so the choice is one file's problem.
  Note for execution: `pdf-parse` is a common first reach and is known to run a
  debug branch at import that reads a fixture file off disk; `unpdf` wraps the
  same pdfjs without that. Whatever is chosen, the extraction route must be the
  Node runtime, not edge.

## Implementation

### 1. The brief on the schema

**File**: `prisma/schema.prisma`

A `MapBrief` model: `id`, `mapId` (unique — one per map, `onDelete: Cascade`
like the other three relations), `sourceName` (the filename, or "pasted"),
`mediaType`, `text`, `charCount`, `createdAt`. A separate model rather than
columns on `ThinkingMap` so that `listMaps` and every `getMap` do not drag tens
of thousands of characters into memory on every page render — the brief is read
only when something asks for it. Add the back-relation `brief MapBrief?` to
`ThinkingMap`, and document above the model that it is write-once, in the same
voice the other models are commented in. `npm run db:push` after; per
`DATABASE.md` this needs no default because the relation is optional.

### 2. Extract text from what the client actually sends

**New file**: `app/lib/briefText.ts`

`extractBriefText(bytes: ArrayBuffer, mediaType: string, filename: string):
Promise<{ text: string; warning: string | null }>`. Dispatches on media type and
extension: PDF via `unpdf`, `.docx` via `mammoth`'s raw-text extraction,
`.md`/`.txt` decoded directly. Normalises line endings and collapses runs of
more than two blank lines so the section splitter sees consistent input. Returns
a `warning` rather than throwing when the extraction is suspiciously thin
(roughly under 200 characters for a file over 50KB — the scanned-PDF signature)
or when the type is unsupported. Add the two dependencies to `package.json`.

### 3. The extraction endpoint

**New file**: `app/api/briefs/extract/route.ts`

`POST` multipart form data, one `file` field, returning
`{ text, sourceName, mediaType, charCount, warning }`. Deliberately does not
create anything: it turns a file into text and hands it back to the browser,
which then submits it with the rest of the form. That keeps map creation a single
transaction and means an abandoned upload leaves nothing behind. Cap the accepted
body (10MB is generous for a spec) and return a readable message rather than a
stack trace on an unparseable file.

### 4. Paste or drop it on the landing screen

**New file**: `app/components/BriefDrop.tsx`

The intake affordance under the idea input: a drop target / file picker, and a
"paste it instead" textarea. Once text is in hand it renders what was actually
extracted — source name, character count, an approximate page count, and the
first few lines — plus any `warning` from extraction, with a control to discard
and try again. This readout is the point of the component: it is where a client
finds out their PDF was a photograph.

**File**: `app/components/IdeaPrompt.tsx`

Hold the brief alongside `value`, mount `BriefDrop`, and include the brief in the
POST body. When a brief is attached the one-line input becomes optional and its
label shifts to what it now means — the sentence that says what you want out of
the document, not the idea itself.

**File**: `app/components/IdeaForm.tsx`

Take a `hasBrief` prop that switches the placeholder and the send label
("Start thinking this through" reads wrong over a spec), and allow submission
with an empty line when a brief is present.

### 5. Carry the brief into map creation

**File**: `app/api/maps/route.ts`

Accept an optional `brief: { text, sourceName, mediaType }` beside `seedIdea`,
and relax the current hard 400 so a request carrying a brief and no `seedIdea`
is valid. A request with neither is still an error.

**File**: `app/lib/mapStore.ts`

`createMap(seedIdea, brief?)` writes the `MapBrief` in the same
`prisma.thinkingMap.create` as the root node. Title derivation moves out of the
inline 57-character slice into a small helper: when there is a brief, prefer its
first markdown heading, else its first non-empty line, trimmed to 60 characters;
otherwise the existing behaviour, unchanged. `getMap` should select the brief's
metadata but **not** its `text` — the text has exactly one reader, and that is
`read_brief`. Add a `getBrief(mapId)` for that reader.

### 6. Section the brief

**New file**: `app/lib/briefSections.ts`

`splitIntoSections(text): BriefSection[]` — pure, no database. A section is
`{ id: 's1', index, heading, text, charCount }`. Split on markdown headings
where the document has them, and fall back to paragraph groups under a target
size (roughly 1,500–2,500 characters) where it does not, so a plain-prose brief
still sections sensibly instead of returning one enormous block. Worth testing:
stable ids across repeated runs, a heading-less document, a document that is one
long paragraph, and an empty document (returns `[]`, not one empty section).

### 7. The `read_brief` tool

**File**: `app/lib/toolCatalog.ts`

Add a `read_brief` spec to `TOOL_CATALOG` with
`{ section?: string }` and `annotations: { readOnlyHint: true }`. The description
is load-bearing — it is the only channel this app has for steering an agent that
brings its own reasoning — so it should say what the tool is *for*: read the
outline first, pull only the passages you need, and remember the client wants
their document interrogated, not summarised back at them. Because
`buildMcpServer` loops the catalog and splices `mapId` onto each schema, and the
page's `bindTools` reads the same catalog, adding it here lights it up on all
three front doors with no per-door work.

**File**: `app/lib/toolRuntime.ts`

Implement it in `IMPLEMENTATIONS` beside the others: no `section` argument
returns the outline (source name, total characters, and one line per section);
a `section` returns that passage in full, and an unknown section id returns the
outline again with a line saying which ids exist rather than an error. When the
map has no brief, say so plainly — that is a normal state, not a fault, so it
must not set `isError`.

### 8. Let the brief announce itself

**File**: `app/lib/mcpFormat.ts`

`MapDetail` gains optional brief metadata, and `formatMapDetail` prints one line
— source, character count, section count, and "read it with `read_brief`" —
between the seed idea and the conversation. Never the text.

**File**: `app/lib/agentDemo.ts`

Add a `read_brief` step to `DEMO_SEQUENCE` before the `read_map` step, with a
note explaining that the agent orients on the outline before deciding what to
pull. WebMCP cannot bind inside the capture iframe, so this scripted sequence is
the only way the new tool is exercisable in a preview or a scenario.

## Reused existing code

- `createMap`, `getMap`, `listMaps`, `applyToolCalls` from `app/lib/mapStore.ts`
  (glossary entries: `createMap`, `getMap`, `applyToolCalls`) — the brief is
  written inside the existing creation transaction; nothing about the root-node
  or revision-1 behaviour changes.
- `TOOL_CATALOG`, `findTool`, `ToolContext`, `ToolResult` from
  `app/lib/toolCatalog.ts` — the new tool is one more entry in the list every
  door already loops, which is the whole reason a fourth tool costs almost
  nothing.
- `runTool` and the `IMPLEMENTATIONS` table in `app/lib/toolRuntime.ts` — the
  validate-then-dispatch path, including the rule that a normal-but-empty result
  is text rather than `isError`.
- `buildMcpServer` from `app/lib/mcpServer.ts` (glossary entry: `buildMcpServer`)
  — no change needed; it splices `mapId` onto every catalog schema already.
- `formatMapDetail` and `MapDetail` from `app/lib/mcpFormat.ts` (glossary entry:
  `formatMapDetail`) — extended by one line.
- `DEMO_SEQUENCE` from `app/lib/agentDemo.ts` (glossary entry: `DEMO_SEQUENCE`).
- `IdeaPrompt`, `IdeaForm`, `SendButton` from `app/components/` (glossary
  entries: `IdeaPrompt`, `IdeaForm`, `SendButton`) — the intake is added beside
  the existing input rather than replacing it.
- `prisma` from `app/lib/prisma.ts` and the temp-database integration-test
  pattern in `DATABASE.md` — `app/lib/contributions.integration.test.ts` and
  `app/lib/exchange.integration.test.ts` are the two worked examples in-tree.

**Existing-implementation survey.** Nothing document-shaped exists anywhere in
the app today. `grep -rniE "brief|document|upload|multipart|formdata|pdf|docx"`
over `app/`, `mcp/` and `prisma/` returns only `document` as the DOM global in
`app/lib/textSelection.ts` and two prose comments. There is no upload route, no
uploads directory, no multipart handling, and no PDF or docx dependency in
`package.json` — so all three of those are genuinely new, not duplicates.
The `seedIdea` column is the closest existing thing and is a single verbatim
string with no notion of length, structure, or sections; extending it would mean
giving one column two meanings and putting a 40,000-character field into every
`listMaps` row.

## Scenarios to Demonstrate

- Landing with a brief attached — the readout showing source name, character
  count, page estimate and the first extracted lines under the idea input
- Landing with a thin extraction — a scanned PDF's warning, and the paste
  fallback offered rather than the map being started blind
- Landing with an unsupported file — the message naming what is accepted
- Landing day one, no brief — the existing one-line flow, visibly unchanged
- A map started from a brief — the title taken from the brief's first heading
  and a root pill that reads as a project rather than a truncated paragraph
- A map with no brief at all — every surface behaving exactly as it does now