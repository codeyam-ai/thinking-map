---
title: "Ship on Vercel with Hosted Postgres"
mode: backend
createdAt: "2026-09-03T00:58:10Z"
source: manual
---

## Summary

The app persists to a local SQLite file through `better-sqlite3`, which cannot survive
a hosted deployment: on Vercel the filesystem is read-only and ephemeral, and no two
function instances share it, so the agent's writes and the judge's reads would land in
different places or vanish between requests. Move the datasource to hosted Postgres
(Supabase), swap the Prisma driver adapter, and clear the two build-time obstacles that
would otherwise break or badly slow a Vercel build. SQLite is named in only three
production places — the schema's `datasource` block, `app/lib/prisma.ts` and
`prisma/seed.ts` — so the application code is untouched; the real work beyond those is
the four integration tests that each stand up a temporary SQLite *file*.

## Key Decisions

- **Supabase Postgres, reached server-side through Prisma.** Not `supabase-js` in the
  browser, and not RLS. Every read in this app already happens on the server —
  `app/page.tsx` and `app/map/[id]/page.tsx` are server components that call `mapStore`
  directly, and six route handlers do the same — so a client-held database would mean
  rewriting every surface, plus inventing anonymous auth for RLS to scope against. That
  is a different product, not a deployment.

- **A static site is not an option, for a specific reason rather than a stylistic one.**
  Three surfaces are irreducibly server-side: `/api/maps/[id]/tools`, which is where
  every WebMCP tool the page registers actually executes; `/api/mcp`, the remote MCP
  front door; and `/api/briefs/extract` + `/api/briefs/fetch`, which parse PDF/DOCX with
  `unpdf`/`mammoth` and fetch cross-origin pages the browser could not. Storing maps in
  the browser would take the tools with them and leave the other two doors with nothing
  behind them.

- **Pooled connection string.** Serverless functions open many short-lived connections,
  so `DATABASE_URL` points at Supabase's pooler (port 6543), not the direct 5432 host.

- **`@prisma/adapter-pg`, keeping the driver-adapter pattern.** Prisma 7 requires an
  adapter — the note at the top of `prisma/seed.ts` says so explicitly — so this is a
  substitution inside an existing shape, not a new one.

- **Postgres in tests too, rather than a dual-provider schema.** Prisma fixes the
  provider at generate time, so "SQLite locally, Postgres in production" is not
  available. `@prisma/adapter-pglite` is not published (confirmed: the name 404s on the
  npm registry), so an in-process Postgres is not available either. The four integration
  tests therefore point at a real Postgres via `TEST_DATABASE_URL`, each run isolated in
  its own schema.

- **A real Postgres for local dev and tests, supplied by `embedded-postgres`.** Decided
  with the user at the plan-approval gate, replacing this plan's earlier framing of the
  test database as "the one genuinely unpleasant consequence of the migration" — it is
  not, because the database no longer has to be installed or hosted to run the suite.
  The package downloads an official PostgreSQL binary and runs it as a subprocess on a
  chosen port. Verified on the build machine before approval: installs in ~2s, and
  `initialise()` + `start()` completes in **1.97s** reporting a genuine
  `PostgreSQL 18.4` server, then shuts down cleanly.

  Pin the **17.x** line (latest `17.10.0-beta.17`), not the newest 18.x, so the test
  engine matches the major version Supabase actually serves. The package publishes only
  `-beta` version tags — that is its normal release channel rather than a pre-release of
  a stable line, and it is a `devDependency`, so it never reaches the Vercel build.

  Two environment-specific gotchas, both hit and solved during verification, both worth
  keeping out of the build's way: it refuses to run as root unless constructed with
  `createPostgresUser: true`, and after dropping privileges it cannot execute its own
  binary if any parent directory of `node_modules` is not traversable by that user
  (`drwx------` fails with `EACCES` on `spawn initdb`). Neither applies on a developer
  Mac; both apply in a root container.

  Rejected alternatives, for the record: Supabase's own local stack needs Docker, which
  is not available on the build machine and boots roughly ten containers to provide the
  one thing needed; a system-wide Postgres install works (confirmed installable after
  `apt-get update`) but is invisible to a fresh clone and to CI, and drifts from
  production's version silently; a second hosted Supabase project stays a valid fallback
  but makes every query a network round trip and prevents the suite running offline.

- **`TEST_DATABASE_URL` stays the single seam.** The helper in step 5 uses the embedded
  server only when `TEST_DATABASE_URL` is unset, and otherwise honours whatever is in
  the environment. That keeps the rejected alternatives above reachable by setting one
  variable, so this decision picks a default rather than forking the architecture.

- **`db push`, not migrations.** `prisma/` has no `migrations/` directory and the
  production database starts empty by design, so `db push` against the Supabase instance
  is the whole deployment step.

## Implementation

### 1. Change the datasource provider

**File**: `prisma/schema.prisma`

Change `datasource db { provider = "sqlite" }` to `provider = "postgresql"`. The schema
needs no other edit: the comment above `ThinkingMap` notes that `kind`, `phase` and
`status` are `String` because SQLite has no enum support, and they should **stay**
`String` — their allowed values live in `app/lib/mapKinds.ts`, which is the single place
they are defined, and converting them to native enums now would be a second change
riding along on this one. Update that comment to say the strings are kept deliberately
rather than forced.

### 2. Swap the driver adapter

**File**: `app/lib/prisma.ts`

Replace `PrismaBetterSqlite3` with `PrismaPg` from `@prisma/adapter-pg`, constructed
from `process.env.DATABASE_URL`. Drop the `'file:./dev.db'` fallback — a missing
connection string should fail loudly at startup rather than silently open a local file
that will never be the right database. The file's own header comment says it is "the
ONLY file that changes when upgrading to a hosted database"; that promise is very nearly
true and should be updated to name `prisma/seed.ts` as the second.

### 3. Match the adapter in the seed script

**File**: `prisma/seed.ts`

Same substitution, for the reason its header already gives: the seed must use the same
adapter pattern as `app/lib/prisma.ts`. The `main()` body is still a no-op placeholder
and should stay one — the production database starting empty is a deliberate product
decision, not an oversight.

### 4. Clear the two build-time obstacles

**File**: `next.config.ts`

Remove `better-sqlite3` from `serverExternalPackages`; with the native module gone there
is nothing to exclude from bundling.

**File**: `package.json`

Remove `better-sqlite3`, `@prisma/adapter-better-sqlite3` and `@types/better-sqlite3`
from dependencies, add `@prisma/adapter-pg` and `pg`, and drop the matching
`allowScripts` entry. Separately, gate the `postinstall` script — it currently runs
`playwright install chromium` unconditionally, which downloads a browser on every Vercel
build to serve a devDependency the deployed app never uses. Make it a no-op when
`process.env.VERCEL` (or CI generally) is set, keeping the local behaviour intact.

### 5. Point the integration tests at Postgres

**File**: `app/lib/exchange.integration.test.ts`

**File**: `app/lib/contributions.integration.test.ts`

**File**: `app/lib/insightProvenance.integration.test.ts`

**File**: `app/api/maps/[id]/exchange/route.integration.test.ts`

Each of these creates a temp directory with `mkdtempSync`, sets `DATABASE_URL` to a
`file:` URL *before* importing the modules (deliberately — `app/lib/prisma.ts` reads the
variable at import time), runs `npx prisma db push --url <url>`, and deletes the
directory in `afterAll`. Replace the temp-file dance with a per-run Postgres schema:
read a base `TEST_DATABASE_URL`, append a unique `?schema=test_<random>` to it, push to
that, and drop the schema in `afterAll` instead of `rmSync`. The import-time ordering
constraint and the `--url` flag both still apply and their comments should be kept —
the reason for `--url` (Prisma reads its datasource from `prisma.config.ts`, so the env
variable alone would push to the dev database) is unchanged.

Give the four files one shared helper rather than four copies of the schema-per-run
logic; the current duplication is tolerable for four identical `mkdtempSync` calls and
much less so once it involves creating and dropping schemas.

**File**: `app/lib/testDatabase.ts` (new)

That shared helper, and the place the embedded-Postgres decision is implemented. It
exposes the base URL the four test files build their per-run schema onto, resolved in
one of two ways:

- If `TEST_DATABASE_URL` is set, use it verbatim and start nothing. This is the seam
  that keeps a hosted Supabase test project or a system-wide Postgres working for
  anyone who prefers one.
- Otherwise, start an `embedded-postgres` instance on an ephemeral port and return its
  URL. Construct it with `createPostgresUser: true` so it does not refuse to run as
  root in CI containers, and `persistent: false` so the cluster is discarded rather
  than accumulating between runs.

Start the server **once per test process**, not once per file — `initialise()` costs
about two seconds and the per-run schema isolation the four files already use is what
keeps them from colliding, so a second server buys nothing. Stop it on process exit.

The import-time ordering constraint from the four test files applies to this helper
too: it must resolve the URL and assign `DATABASE_URL` *before* anything imports the
Prisma singleton.

**File**: `package.json` (continued from step 4)

Add `embedded-postgres` to `devDependencies`, pinned to the `17.x` line
(`17.10.0-beta.17` is current) so the test engine matches the major version Supabase
serves rather than jumping to 18.x. It is dev-only and must not appear in
`dependencies`, or Vercel will download a PostgreSQL binary on every production build.

### 6. Document the deployment

**File**: `DATABASE.md`

The file already has a "Where Credentials Go" section that `.env` points at. Add what
the deploy actually needs: the pooled `DATABASE_URL` in Vercel's environment, the direct
URL for one-off `db push` runs, and the fact that the production database is expected to
be empty on first boot.

Then add a short "Running the tests" section, because the answer is now genuinely
short and worth stating: **nothing is required** — the suite starts its own PostgreSQL
and tears it down, so a fresh clone runs `npm test` with no database setup and no
network. Document `TEST_DATABASE_URL` as the opt-out for anyone who would rather point
at their own Postgres or a second Supabase project, and note the two root-container
gotchas (`createPostgresUser`, and the `EACCES` on `spawn initdb` when a parent
directory of `node_modules` is not traversable) so the next person to hit them in CI
does not have to rediscover them.

**File**: `.env`

This file is committed and holds placeholders only. Replace the SQLite `DATABASE_URL`
default with a commented Postgres placeholder, so a fresh clone is told what it needs
rather than silently opening `dev.db`. Add `TEST_DATABASE_URL` as a **commented-out**
placeholder with a line saying it is optional and that leaving it unset is the normal
case — an uncommented empty value here would defeat the helper's "is it set?" check and
send the tests at nothing.

### 7. Repoint codeyam's own capture pipeline (discovered during the build)

Not anticipated when this plan was written, and load-bearing: **codeyam seeds and
captures every scenario against a sandbox database of its own**, declared in
`.codeyam/stack.json`. That declaration said SQLite, so the moment the datasource
moved the dev server was handed a `file:` URL for a `postgresql` client and every
one of the 507 scenarios failed to render — `User was denied access on the
database`. Nothing in `app/` was wrong; the harness was pointed at the old world.

**File**: `.codeyam/stack.json`

- `data.database` → `{ "type": "postgresql", "url": "${DATABASE_URL}" }`. The
  `${VAR}` reference is required, not stylistic: a literal DSN in this committed
  file trips the `TrackedConfigContainsProbableCredential` audit invariant. The
  value lives in gitignored `.codeyam/stack.local.json` under `env`.
- `data.seedAdapterType` → `prisma-postgres`.
- `data.schemaLoadCommand` → `npx prisma db push`. Codeyam derives a capture
  database named `<db>_codeyam_capture` and needs a command to load the schema
  into it; an empty capture database fails one step later on missing tables.
- `name` → "Next.js + Prisma + Postgres", or the `STACK_IDENTITY_DATABASE_DRIFT`
  invariant fires on the mismatch with `data.database.type`. The top-level `id`
  and `scaffoldedFrom` stay as scaffold provenance — the invariant says so
  explicitly.
- Drop the `npm rebuild better-sqlite3` entry from `devServerRepair`; it repairs
  a native module the project no longer has.

**File**: `.codeyam/seed-adapter.ts`

The SQLite and PostgreSQL adapters are different implementations, not variants —
the Postgres one wipes with `TRUNCATE CASCADE` and inserts through a direct `pg`
client. Reinstall it from the shipped template.

The installed copy carried one local customisation that must be re-applied on top,
and would otherwise be lost silently: `decodeBytesFields`, which base64-decodes
`Bytes` columns. JSON has no binary literal, so a seeded image can only travel as
base64, and without this `MapAttachment.bytes` stores the literal characters of the
string — the "An Image the Agent Can Look At" feature captures a broken image and
nothing reports it. Ported as `buildBytesFieldSet` + `encodeBytesParam`, mirroring
the adapter's own `Json` handling and composed into the same encode step.

Verified rather than assumed: the seeded attachment lands as 1563 bytes (matching
its declared `byteSize`) with magic `89504e470d0a1a0a`, the PNG signature. The
un-decoded failure mode would be 2084 bytes beginning `6956424f`.

### 8. `?schema=` must be lifted out of the URL (discovered at Extract TDD)

The per-schema test isolation in step 5 silently did nothing, and the symptom was
all 61 integration tests failing at once with Postgres `42P01`,
`relation "public.ThinkingMap" does not exist`.

`?schema=` is a **Prisma datasource convention, not a PostgreSQL one**. The
Prisma CLI honours it — `prisma db push --url '…?schema=x'` really does build the
tables in `x` — but the runtime driver adapter connects through `pg`, which does
not parse that parameter and leaves the session on the default `search_path`. So
the CLI built the tables in `test_…` while the adapter read from `public`.

**File**: `app/lib/databaseUrl.ts` — `databaseConnection()` returns
`{ connectionString, schema }`, reading the parameter out of the URL;
`app/lib/prisma.ts` and `prisma/seed.ts` pass it as `PrismaPg`'s second-argument
`schema` option, which is what actually qualifies generated queries.

Worth having beyond the tests: it means a `DATABASE_URL` naming a non-`public`
schema now works in production too, instead of appearing to work and reading the
wrong tables.

Measured, not inferred: 62 failed / 979 passed before, 0 failed / 1046 passed
after, with no other change.

### 9. The seed adapter dropped columns that only later rows carry (discovered at Reconcile)

The most consequential bug in this migration, and it would have shipped silently
with a green suite. It is a defect in the **shipped** `prisma-postgres` template,
not something hand-written here — but installing that template made it this
project's bug.

`fillClientManagedFields` built the INSERT column list from the FIRST row alone:

```js
const fieldNames = Object.keys(rows[0]);
```

Seed rows are not uniform. Any optional column absent from row 0 but present on
a later row was dropped from **every** row of that table — no error, no warning,
and nothing in the test suite that could see it. The old SQLite adapter went
through Prisma's `createMany`, which handles per-row keys, so the defect only
appears on the PostgreSQL path.

**How it surfaced.** `distinct-capture-check` failed with
`a-plan-with-a-gap-one-slice-proves-nothing == complete-what-to-do-next`: two
scenarios rendering byte-identical frames. Those two seeds differ by exactly one
field — `mapNode[17].testsNodeId` — and row 0 does not carry `testsNodeId`, so
the column never reached the database and the two scenarios collapsed into the
same screen. Git settled that this was a regression rather than pre-existing
debt: the committed screenshots were distinct (`e1c86ba…`, `db6a264…`) and both
had become `c32d19e…`.

**Fix, in two parts — the second only became visible once the first landed.**
Take the union of keys across all rows in first-seen order, so column order
stays deterministic. Then, for a row that OMITS one of those columns, emit the
SQL `DEFAULT` keyword rather than a NULL parameter.

That second part is not a detail. `offsetX` is `Float @default(0)` — NOT NULL
*with* a default — so an explicit NULL fails with Postgres `23502` while
`DEFAULT` yields `0`. Widening the column list is what created the question at
all: before it, an absent column was simply not in the statement and Postgres
applied the default itself. `DEFAULT` restores exactly that, per row, and where
a column has no default it yields NULL — the same answer. Caught by
`old-arrangement-data-now-inert`, whose seed carries `offsetX` on 2 of 7 rows.

No silent-corruption window exists between the two parts: every one of this
schema's 24 `@default` columns is NOT NULL, so the interim version could only
fail loudly (as it did, once) rather than quietly write a wrong value.

**Verified two ways.** The capture database went from 0 to 3 rows carrying
`testsNodeId` and 0 to 3 carrying `detail`; and re-capturing the pair restored
both screenshots to their exact committed hashes, byte-for-byte, with
`collisions_before: 0, collisions_after: 0`.

Worth stating plainly: no test caught this and no test could have. The scenario
capture pipeline caught it — which is the argument for having it.

### Out of scope, found while verifying

`AttachmentChip.tsx:45` hardcodes `src={`/api/maps/${mapId}/attachments/${id}`}`.
Under codeyam's preview iframe the app is served beneath `/__codeyam_preview/`, so
the client rewrites that path after hydration and React reports a hydration
mismatch on the attachment image. It is a preview-harness interaction with a
hardcoded root-relative path, identical on SQLite, and unrelated to the datasource
— recorded here rather than fixed, since this plan is backend-only and does not
touch UI.

## Reused existing code

- `prisma` singleton from `app/lib/prisma.ts` — the adapter swap happens inside it and
  every caller is unaffected.
- `loadEnv` from `app/lib/loadEnv.ts` (imported by `prisma/seed.ts` and
  `prisma.config.ts`) — the dotenv cascade that makes `.env.local` win over `.env`
  already covers a hosted connection string; nothing new is needed to read it.
- `classifyLoadError` from `app/lib/loadError.ts` (glossary entry: `classifyLoadError`,
  tested by `app/lib/loadError.test.ts`) — already turns a Prisma failure into a readable
  screen on both `app/page.tsx` and the map page. Its `prismaCode` branch (glossary
  entry: `prismaCode`) matches on Prisma error codes rather than SQLite text, so it
  carries over; confirm at execution that a Postgres connection failure still lands in a
  sensible branch rather than the generic one.
- `withFailure` from `app/lib/apiFailure.ts` (glossary entry: `withFailure`, tested by
  `app/lib/apiFailure.test.ts`) — every route handler is already wrapped, so a database
  outage reaches the browser as `{ error }` rather than an unparseable body. No change.
- **Existing-implementation survey:** nothing in the repo currently abstracts over
  database providers — no `provider` switch, no adapter factory, no second
  `PrismaClient` construction beyond `app/lib/prisma.ts` and `prisma/seed.ts`. There is
  no existing seam to extend, so the substitution is made in place in both files.

## Scenarios to Demonstrate

- Landing page against an empty hosted database — the day-one state, one card and no
  saved-map strip.
- Landing page with several saved maps, so the strip and its "Show all" affordance are
  exercised against Postgres.
- A map page rendering a rich map (themes, nodes, an attached brief) read from Postgres.
- Database unreachable — the `ErrorScreen` path through `classifyLoadError`, which is the
  one failure a judge is most likely to hit and the one most likely to look like the app
  is gone.
- A WebMCP tool call arriving at `/api/maps/[id]/tools` and committing a write, proving
  the agent's half works against the hosted store.