---
title: "The Standing Wait Is Proved Against A Live Map"
mode: backend
createdAt: "2026-09-03T11:58:30Z"
source: manual
dependsOn: ["tool-descriptions-get-an-eval-suite"]
---

## Summary

The most recent behavioural fix in this repo — "The Agent Waits For Your
Answers" — has no test. It could not have one: the fix was not code, it was
words, and the words live in tool *reply* text rather than tool descriptions.
`formatStandingWait` in `app/lib/mcpFormat.ts` counts the open questions on a
map and appends "Call await_user_activity with sinceRevision: N" to what the
agent reads after every write. That sentence only exists when a tool genuinely
executes against a real map with real open questions, which is precisely why the
local-mode suite from the prerequisite plan cannot reach it.

This plan adds a second, smaller eval run in **browser mode**: the eval CLI
drives a real Chrome against a running dev server on a seeded map, the WebMCP
binding registers the real catalog, tools execute for real, and the assertion is
that the agent calls `await_user_activity` after writing questions instead of
ending its turn. It is the only way to prove that a fix made entirely of prose
stays fixed.

## Key Decisions

- **Browser mode, because the steering is in the reply.** Local mode shows the
  model a static schema and never calls `execute`, so `formatStandingWait` never
  runs and the sentence under test is never produced. Smoke mode executes tools
  but uses no model, so it cannot judge what the agent does next. Only browser
  mode has both halves.
- **A dedicated seeded map, created and torn down by the eval run.** The tools
  write to SQLite. Pointing an eval at a map that matters would corrupt it, and
  pointing it at a fresh map per run keeps the assertion about open-question
  count deterministic. The seed script creates the map, prints its id, and the
  run targets `/map/<id>`.
- **Seed through the same Prisma adapter pattern as `prisma/seed.ts`.** That
  file's header is explicit that `new PrismaClient()` without the
  `PrismaBetterSqlite3` adapter is wrong under Prisma 7. The eval seeder is a
  second standalone entry point and has to follow the identical pattern,
  including the `loadEnv` import before any env read.
- **Never run against `dev.db`.** Point `DATABASE_URL` at a throwaway file for
  the eval run. The README already states the production database starts empty
  by design; an eval that leaves maps behind quietly breaks that property.
- **A bounded, short timeout on the blocking tools.** `ask_user` and
  `await_user_activity` block by design and return `pending` / `timedOut` on
  expiry rather than failing. The eval passes a small `timeoutSeconds` so the
  run cannot wedge — the assertion is that the call is MADE, not that a person
  answers it.
- **This is a separate plan, not part of the local suite.** It needs a running
  server, a seeded database, a real Chrome, and DB isolation — none of which the
  local suite needs. Merging them would hold a cheap, already-useful suite behind
  infrastructure, and would make one plan that needs "and also" to describe.
- **One case, deliberately.** Browser runs are slow and expensive. This plan
  buys exactly the regression the repo has already been bitten by once; more
  cases can follow once the harness is proven.

## Implementation

### 1. Seed a disposable map with open questions

**New file**: `scripts/seed-eval-map.ts`

Creates a map in the phase where questions have been asked, with a known number
of `open-question` nodes at `status: "open"`, then prints the map id to stdout so
the run script can build the URL. Follows `prisma/seed.ts` exactly on the adapter
and the `loadEnv` import; takes `DATABASE_URL` from the environment so the caller
decides which database it lands in.

The node shape must match what `formatStandingWait` actually counts — nodes of
kind `open-question` whose status is not `answered`. Seeding anything else
produces an empty standing-wait sentence and a test that passes for the wrong
reason. Confirm empirically at execution that the seeded map really does yield a
non-empty `formatStandingWait` before trusting the fixture.

### 2. The standing-wait eval case

**New file**: `evals/suites/standing-wait.json`

One case. The user message asks for the map to be taken forward; the expected
call sequence is `add_nodes` (or `read_map` then `add_nodes`) followed by
`await_user_activity` carrying a numeric `sinceRevision`. Express the tail as an
`ordered` constraint with `$type: number` on `sinceRevision` — the point is that
the agent parks itself, not which revision it happens to name.

A second assertion worth encoding in the same case: `await_user_activity` is
called rather than the turn ending. If the CLI cannot express "and then stop" as
a negative, express it as the ordered pair and let the absence of the second call
be the failure.

### 3. Wire up the run

**File**: `package.json`

An `evals:browser` script that seeds the throwaway database, starts the dev
server, and runs `webmcp-evals browser -u <url> -e evals/suites/standing-wait.json
--backend vercel`. Keep it a single entry point so nobody has to remember the
three-step dance, and make it clean up the throwaway database afterwards.

Note that `npm run dev` binds `-H 127.0.0.1` — the eval URL must use that host,
not `localhost`, if the two ever resolve differently on the runner.

### 4. Extend the eval documentation

**File** (created by the prerequisite plan `tool-descriptions-get-an-eval-suite`): `evals/README.md`

Section on browser mode: what it needs that local mode does not (Chrome, a
server, a database), why the standing-wait case can only live here, and an
explicit warning never to point it at `dev.db`.

## Reused existing code

- `formatStandingWait` from `app/lib/mcpFormat.ts` — the exact behaviour under
  test. The eval asserts the agent obeys the sentence this function emits.
- `standingAskSentence` from `app/lib/mcpFormat.ts` — the established precedent
  for steering through tool-reply text; named so the eval's framing matches the
  mechanism the app already documents.
- `TOOL_CATALOG` from `app/lib/toolCatalog.ts` — registered for real by the page
  binding in browser mode, so no schema file is involved on this path.
- `bindTools` from `app/lib/webmcp.ts` (glossary entry: `bindTools`, covered by
  `app/lib/webmcp.test.ts`) — the registration the eval depends on succeeding in
  a real browser. If a browser run finds no tools, this is the first place to
  look.
- `isWebMcpAvailable` from `app/lib/webmcp.ts` (glossary entry:
  `isWebMcpAvailable`) — its secure-context and top-level-frame conditions are
  the prerequisites the eval's Chrome must satisfy.
- `loadEnv` from `app/lib/loadEnv.ts` — required by the seeder, before any env
  read, per the pattern in `prisma/seed.ts`.
- `prisma/seed.ts` — the adapter pattern the new seeder must copy rather than
  reinvent.

**Existing-implementation survey:** no browser-driven or model-driven test
exists in this repo today. `postinstall` installs Playwright Chromium, but
nothing in the tree drives it — there are no Playwright specs and no e2e
directory. The eval CLI uses its own Chrome channel, so the existing Chromium
install is unrelated and should not be assumed to satisfy it.

## Scenarios to Demonstrate

Tooling with no UI surface; nothing to register. The demonstrable outcomes are:

- A green run: the agent writes questions and then calls
  `await_user_activity`.
- The regression caught: strip the "rather than ending your turn" clause from
  `formatStandingWait` and watch the case go red. Perform this once at
  execution — a browser eval that has never been seen to fail is not yet
  evidence of anything.
- The seeded map genuinely producing a non-empty standing-wait sentence, checked
  before the first full run.
- A run that leaves `dev.db` untouched.