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
  available. `@prisma/adapter-pglite` is not published, so an in-process Postgres is not
  available either. The four integration tests therefore point at a real Postgres via
  `TEST_DATABASE_URL`, each run isolated in its own schema. This is the one genuinely
  unpleasant consequence of the migration and it is named here rather than discovered
  mid-build.

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

### 6. Document the deployment

**File**: `DATABASE.md`

The file already has a "Where Credentials Go" section that `.env` points at. Add what
the deploy actually needs: the pooled `DATABASE_URL` in Vercel's environment, the direct
URL for one-off `db push` runs, `TEST_DATABASE_URL` for the integration suite, and the
fact that the production database is expected to be empty on first boot.

**File**: `.env`

This file is committed and holds placeholders only. Replace the SQLite `DATABASE_URL`
default with a commented Postgres placeholder plus a `TEST_DATABASE_URL` placeholder, so
a fresh clone is told what it needs rather than silently opening `dev.db`.

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