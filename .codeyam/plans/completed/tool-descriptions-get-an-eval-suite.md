---
title: "Tool Descriptions Get An Eval Suite"
mode: backend
createdAt: "2026-09-03T11:57:29Z"
source: manual
---

## Summary

`app/lib/toolCatalog.ts` is the only place this app can steer an agent, and it
is the only file that can change the product's behaviour with nothing to catch
it. The descriptions there are not labels — `add_nodes` spends three paragraphs
teaching the insight-vs-themed-node distinction, `set_phase` argues against a
named failure mode ("rounds that only ever add more questions never arrive
anywhere"), `read_brief` pleads with the agent to read the outline before
walking every section. That is prompt engineering, and it has no test suite.
The 58 test files under `app/lib/` prove the plumbing — that a tool registers,
that a descriptor survives a structured clone, that bad input is rejected — and
none of them prove a model reads the words and does the right thing.

This plan adds a WebMCP eval suite (`webmcp-evals`, the CLI from
GoogleChromeLabs/webmcp-tools) running in **local mode**: the model is shown the
catalog's JSON Schema and judged on which tool it calls with which arguments,
with no database, no server, and no tool execution. The schema file is
*generated* from `TOOL_CATALOG` rather than hand-maintained, so the thing under
test can never drift from the thing that ships. The outcome is that a diff to
`toolCatalog.ts` becomes reviewable: you can see whether a re-worded description
still produces the behaviour it was written to produce.

## Key Decisions

- **Local mode, not browser or smoke, for this first suite.** Local mode
  evaluates tool *selection* against a static schema — exactly the surface the
  descriptions own — and it does it without a dev server, without SQLite, and
  without executing anything. That matters more here than it would elsewhere:
  two of the ten tools (`ask_user`, `await_user_activity`) deliberately BLOCK
  waiting on a person, so any mode that actually runs tools would hang or need
  elaborate stubbing. Local mode never calls `execute`, so the blocking tools
  are testable for selection on day one.
- **Generate the schema file from `TOOL_CATALOG`; never hand-write it.** A
  checked-in copy of the tool schemas would be a fourth front door, and
  `toolCatalog.ts`'s own header comment explains why the app has exactly three.
  `jsonSchemaFor()` already performs the Zod-to-JSON-Schema conversion that the
  page binding depends on, and it is already tested — the emitter reuses it, so
  the evals run against the identical bytes the browser agent receives.
- **The generated file is committed, and a check proves it is current.** A
  generated artifact that only exists after you remember to run a script is a
  file that is silently stale. Committing it makes the schema diff visible in
  review next to the description diff that caused it, which is a large part of
  the point.
- **Vercel AI SDK backend through the AI Gateway.** `--backend vercel` with a
  plain `"provider/model"` string keeps the model swappable without touching
  config, and matches the platform this project already deploys to. The repo has
  no AI provider dependency today, so this adds `ai` as a **devDependency** —
  the app itself must stay free of it.
- **These evals do NOT join `npm test`.** They cost money per run and are
  probabilistic; wiring them into the blocking suite would make an unrelated
  commit fail on a coin flip. They get their own script and are run
  deliberately, on changes to `toolCatalog.ts`.
- **Six cases, each pinned to a seam in the prose.** Every case below exists
  because a specific sentence in a description is trying to prevent a specific
  mistake. A case that does not correspond to something a description argues for
  is a case that tests the model rather than the catalog, and is not worth
  paying for.
- **The standing wait is explicitly out of scope here.** The behaviour fixed by
  "The Agent Waits For Your Answers" is steered by tool *reply* text
  (`formatStandingWait`), which only exists when tools genuinely execute against
  a real map. Local mode cannot produce it. That case is the subject of the
  follow-on plan, which depends on this one.

## Implementation

### 1. Add the eval tooling as devDependencies

**File**: `package.json`

Add `webmcp-evals` (`^0.0.4`) and `ai` as devDependencies — never dependencies;
the shipped app must not gain an AI provider. Add three scripts:

- `evals:schema` — regenerates `evals/tools.schema.json` from the catalog.
- `evals:schema:check` — regenerates to a temp path and diffs against the
  committed file, failing when they differ. This is what makes the committed
  artifact trustworthy.
- `evals` — runs `webmcp-evals local -t evals/tools.schema.json -e evals/suites
  --backend vercel`, with `--model` and `--runs` left to the caller so a
  cheap smoke pass and a thorough multi-run pass are the same script.

### 2. Emit the tool schema from the catalog

**New file**: `scripts/emit-tool-schema.ts`

A small `tsx` script that imports `TOOL_CATALOG` and `jsonSchemaFor`, and writes
one entry per tool — `name`, `description`, and the JSON Schema — to
`evals/tools.schema.json` in the shape the CLI's local mode expects (OpenAI
function-schema form).

It must import from `toolCatalog.ts` and `toolInvocation.ts` ONLY. Both are
deliberately isomorphic and reach no database; `toolRuntime.ts` imports
`server-only` and would drag Prisma in, so the script would then need the
`--conditions=react-server` dance that `npm run mcp` needs. Keeping the import
surface to the two pure modules is what keeps this script a one-liner to run.

Prefer emitting with stable key ordering and a trailing newline so the
`evals:schema:check` diff is meaningful rather than noisy.

### 3. Commit the generated schema

**New file**: `evals/tools.schema.json`

The generated artifact, checked in. Head it with a comment-bearing sibling
(see step 5) rather than trying to put a comment in the JSON.

### 4. The six eval cases

**New file**: `evals/suites/tool-selection.json`

One suite file, six cases, each naming the description sentence it defends:

1. **Themes before nodes.** `create_themes` says "Create the themes first, then
   pass each node a themeRef." Given a request that implies several clusters of
   questions, assert an `ordered` expectation: `create_themes` then `add_nodes`.
2. **Insight vs themed node.** Given a claim about the whole idea, assert
   `add_nodes` with a node whose `themeRef` is absent; given a finding inside one
   line of thinking, assert `themeRef` is present. Use `$type` and `$any`
   constraints rather than pinning exact strings — the distinction under test is
   the presence of the field, not the model's wording.
3. **Outline before passages.** With a brief attached, assert the FIRST
   `read_brief` call carries no `section`. This is the single most expensive
   mistake the catalog tries to prevent — walking a long spec into context — and
   it is invisible to every existing test.
4. **Incremental re-read.** On a returning turn, assert `read_map` is called
   with a `sinceRevision` rather than bare. Constrain with `$type: number`.
5. **The arc ends.** Given "everything on the board is answered", assert
   `set_phase` with `phase: "next-steps"` — not another `add_nodes` round. This
   is the failure mode `set_phase`'s description argues against in prose, and
   nothing currently checks that the argument works.
6. **The old name still works.** Assert an agent that was taught `deconstruct`
   still produces a valid `set_phase` call, since `ACCEPTED_PHASE_NAMES` keeps it
   accepted and the description promises it resolves to `map`.

Use `$pattern` / `$contains` for free-text arguments throughout. A case that
asserts an exact `label` string is testing the model's prose, will flake, and
will train you to ignore the suite.

### 5. Document how to run it and why it exists

**New file**: `evals/README.md`

What the suite is for (making `toolCatalog.ts` diffs reviewable), the gateway
key it needs in `.env.local` — which is already the only uncommitted-secret file
in this repo per `loadEnv.ts`'s cascade — how to run a cheap pass vs a thorough
one, that `evals/tools.schema.json` is generated and must not be hand-edited,
and the explicit statement that these are not part of `npm test` and why.

### 6. Keep eval reports out of the tree

**File**: `.gitignore`

Ignore the CLI's report output directory. A JSON/HTML report per run is
scratch, not history.

## Reused existing code

- `jsonSchemaFor` from `app/lib/toolInvocation.ts` (glossary entry:
  `jsonSchemaFor`, covered by `app/lib/toolInvocation.test.ts`) — the emitter's
  whole conversion step, already proven against the structured-clone boundary.
- `toolSummaries` from `app/lib/toolInvocation.ts` (glossary entry:
  `toolSummaries`) — the existing name/title/description projection; the emitter
  should follow its shape rather than invent a parallel one.
- `TOOL_CATALOG` from `app/lib/toolCatalog.ts` — the single source the emitter
  reads. Its isomorphic-by-design rule is what makes a plain `tsx` script
  viable.
- `findTool` from `app/lib/toolCatalog.ts` (glossary entry: `findTool`, covered
  by `app/lib/toolCatalog.test.ts`) — available if the emitter needs
  single-tool lookup.
- `loadEnv` from `app/lib/loadEnv.ts` — the dotenv cascade every non-Next entry
  point in this repo imports, including `prisma/seed.ts` and `vitest.config.ts`.
  The emitter does not need env, but any eval-adjacent script that does must use
  this rather than the bare dotenv config import.
- `formatStandingWait` from `app/lib/mcpFormat.ts` — named here only to mark the
  boundary: it is the steering this suite CANNOT reach, and the reason the
  follow-on plan exists.

**Existing-implementation survey:** nothing equivalent exists today. There is no
evals directory, no scripts directory, no eval or model-facing test of any
kind, and no AI provider dependency in `package.json`. The 58 `app/lib/*.test.ts`
files are all deterministic vitest units. This is net-new surface, not a
duplicate of an existing mechanism.

## Scenarios to Demonstrate

This is tooling with no UI surface, so there is no visual scenario to register
and none should be invented. What is demonstrable is the suite's own output:

- A full pass — all six cases green — against the committed schema.
- A deliberate regression: delete the "Create the themes first" sentence from
  `create_themes` and watch case 1 go red. This is the proof the suite is worth
  running at all, and should be performed once at execution rather than left as
  a claim.
- `evals:schema:check` failing after a description edit with no regeneration,
  and passing after `npm run evals:schema`.
- A `$pattern`-constrained case passing across `--runs 3`, showing the
  constraints are loose enough not to flake.