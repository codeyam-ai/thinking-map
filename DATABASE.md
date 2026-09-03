# Database

This project uses **Prisma 7 with PostgreSQL**, through the `pg` driver adapter.

All application code imports from `@/app/lib/prisma`. That file and
`prisma/seed.ts` are the only two places the database driver is named.

**You do not need to install anything to run the tests.** The integration suite
starts its own PostgreSQL and stops it afterwards — see
"Writing DB-Backed Integration Tests" below. You *do* need a `DATABASE_URL` to
run the app itself; see "Where Credentials Go".

## Quick Reference

```bash
# Edit your schema
vim prisma/schema.prisma

# Push schema changes (also regenerates Prisma client)
npm run db:push

# Seed demo data
npm run db:seed

# Reset database (drop every table + recreate + seed)
npm run db:reset

# Browse data visually
npx prisma studio
```

## One-Off: Attachments Backfill

Databases created before attachments held their files store them as names in a
JSON column on `ThinkingMap`. If yours is one, run this once after `db:push` to
turn those names into `MapAttachment` rows:

```bash
npx tsx prisma/backfill-attachments.ts
```

Every name becomes a row with no `bytes` — a legacy attachment stays exactly what
it was, a recorded name with nothing to open, rather than being dropped. The
script is idempotent and clears the old column as it goes, so a second run is a
no-op. A fresh database created by `db:push` or `db:reset` needs nothing.

## Where Credentials Go

**Real values go in `.env.local`. `.env` holds committed placeholders.**

`.gitignore` ignores `.env*.local`, so `.env.local` is the only file here
where a real secret can live without being committed. It is also where
codeyam's Home → Setup flow writes the variables it manages, and where
`AUTH_UPGRADE.md` tells you to put auth secrets. One file, one answer.

| File         | Committed? | What belongs in it                        |
| ------------ | ---------- | ----------------------------------------- |
| `.env`       | yes        | Commented placeholders, and nothing real  |
| `.env.local` | no         | Real connection strings, API keys, secrets |

There is no default `DATABASE_URL` any more. `app/lib/prisma.ts` throws when it
is missing rather than falling back to a local file — on a serverless host that
fallback would be a file no other function instance can see, which fails as
missing data rather than as a missing database.

Everything reads both. Next.js loads the cascade natively with `.env.local`
winning; standalone entry points (`prisma.config.ts`, `prisma/seed.ts`,
`vitest.config.ts`) get the same behavior by importing `app/lib/loadEnv.ts`.
Do **not** replace that import with `dotenv/config` — it reads `.env` only,
which produces a working dev server alongside a CLI that insists
`DATABASE_URL is not set`. If you add a new standalone entry point, import
`app/lib/loadEnv` from it too.

## Adding Columns to Existing Tables

When adding a new **required** column to a table that already has data, `db push` will fail because existing rows have no value for the new column. To avoid this:

- **Add a `@default(...)` value** so Prisma can fill existing rows automatically:
  ```prisma
  model Rating {
    userId String @default("anonymous")  // existing rows get "anonymous"
  }
  ```
- Once all rows have real values, you can remove the default if desired.
- **Never use `--force-reset`** — it drops ALL tables and deletes all data.
- Optional columns (`String?`) don't need a default — existing rows get `null`.

## Using the Database

```typescript
import { prisma } from '@/app/lib/prisma';

// In API routes or server components:
const items = await prisma.yourModel.findMany();
const item = await prisma.yourModel.create({ data: { title: 'New item' } });
```

## Writing DB-Backed Integration Tests

To test data functions against a **real** database (not mocks), call
`setUpTestSchema` from `app/lib/testDatabase.ts`. It gives the test file its own
empty PostgreSQL schema with the tables pushed into it, and a `teardown` that
drops it. Your own database is never touched.

**Nothing needs to be installed or running.** If `TEST_DATABASE_URL` is unset —
the normal case — the helper starts a real PostgreSQL server via
`embedded-postgres` and stops it when the last test file finishes. `npm test`
works on a fresh clone, offline, with no Docker and no system service.

```typescript
import { beforeAll, afterAll, it, expect } from 'vitest';
import { setUpTestSchema } from '@/app/lib/testDatabase';

let teardown: (() => Promise<void>) | undefined;
let prisma: typeof import('@/app/lib/prisma').prisma;

beforeAll(async () => {
  // Assigns DATABASE_URL and pushes the schema.
  ({ teardown } = await setUpTestSchema('drinks'));

  // AFTER the line above — see rule 1.
  ({ prisma } = await import('@/app/lib/prisma'));
}, 120_000);

afterAll(async () => {
  await prisma?.$disconnect();
  await teardown?.();
});

it('reads and writes against its own schema', async () => {
  await prisma.drink.create({ data: { title: 'Matcha' } });
  const drinks = await prisma.drink.findMany();
  expect(drinks).toHaveLength(1);
});
```

Three rules make this reliable on this stack. The helper handles all three; they
are written down because breaking them from the outside is easy:

1. **`setUpTestSchema` must be awaited _before_ importing the Prisma client.**
   `app/lib/prisma.ts` reads `DATABASE_URL` at module-load time, so the client
   must be imported *dynamically*, after the helper has set it. A static
   `import { prisma }` at the top of the file binds to the wrong database — or,
   now that there is no fallback, throws before the test runs.
2. **The schema is created with `prisma db push --url <url>`.** The `--url`
   override is required, not cosmetic: this Prisma reads its datasource from
   `prisma.config.ts`, so `DATABASE_URL` alone would push to your dev database.
   Do **NOT** pass `--skip-generate` — that flag does not exist for `db push` in
   Prisma 7 and the command fails.
3. **Never suppress the push output** (`stdio: 'ignore'`). It is captured with
   `stdio: 'pipe'`, so a broken schema push reports its real Prisma error
   instead of an opaque `beforeAll` throw.

### Pointing the tests at your own PostgreSQL

Set `TEST_DATABASE_URL` and no server is started — useful if you already run
Postgres locally, or want the suite to run against a second hosted project:

```bash
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/postgres npm test
```

Use a **direct** connection (Supabase port 5432), not a pooled one — `db push`
needs a real session. Each test file still isolates itself in its own
`test_<name>_<random>` schema and drops it afterwards, so runs do not collide.

### If the embedded server fails to start

Two failures are specific to running as root, which is normal in CI containers
and never happens on a developer machine:

- Postgres refuses to run as root. The helper passes `createPostgresUser: true`
  so it creates an unprivileged user and drops to it.
- Having dropped privileges, it must still execute its binary inside
  `node_modules`. If any parent directory is not traversable by that user — a
  `0700` home or checkout — this surfaces as `EACCES` on `spawn initdb`. Fix it
  with `chmod a+rX` on the directories above `node_modules`, or set
  `TEST_DATABASE_URL`. The helper rewrites this error to say so.

## Important: Do NOT Change These Settings

- **Generator must be `prisma-client-js`** (not `prisma-client`). The `prisma-client` generator requires a custom output path that breaks Turbopack.
- **Do NOT add an `output` field** to the generator.
- **Do NOT add `url` to the datasource block** in `schema.prisma`. Prisma 7 moved the URL to `prisma.config.ts`.
- **Keep `turbopack: { root: "." }`** in `next.config.ts`.
- **Always run `npx prisma generate`** after `npx prisma db push` (or use `npm run db:push` which does both).
- **Keep `kind`, `phase` and `status` as `String`**, not native enums. Their allowed values live in `app/lib/mapKinds.ts`; native enums would split that definition in two and make every added value a migration.

## Deploying

The app runs on Vercel against hosted PostgreSQL (Supabase). Three surfaces
make a static export impossible, so there is a server either way:
`/api/maps/[id]/tools` is where every WebMCP tool the page registers actually
executes, `/api/mcp` is the remote MCP front door, and `/api/briefs/extract`
plus `/api/briefs/fetch` parse PDF/DOCX and fetch cross-origin pages a browser
could not.

### Local development

You need a `DATABASE_URL` to run the app. Any PostgreSQL will do — a local
install, a Docker container, or a Supabase project of your own. Put it in
`.env.local`, never `.env`:

```
DATABASE_URL=postgresql://user:password@localhost:5432/thinking_map
```

Then `npm run db:push` to create the tables.

(The *test* suite needs none of this — it brings its own PostgreSQL. See
"Writing DB-Backed Integration Tests" above.)

### Two connection strings, and which is which

Supabase gives you both under Project Settings → Database. They are not
interchangeable:

| Which                       | Port   | Use it for                                     |
| --------------------------- | ------ | ---------------------------------------------- |
| **Pooled** (pgbouncer)      | `6543` | `DATABASE_URL` in Vercel — what the app runs on |
| **Direct**                  | `5432` | One-off `prisma db push` / `prisma studio`      |

Serverless functions open many short-lived connections, which is exactly what
the pooler exists to absorb — a direct connection from Vercel will exhaust the
database's connection limit under any real traffic. But `db push` needs a real
session and will fail or misbehave through the pooler, so schema changes go over
the direct URL.

**Supabase's direct endpoint is IPv6-only.** If `db.<ref>.supabase.co` fails to
resolve — `ENOTFOUND`, on a host with no IPv6 route — that is the cause, not a
wrong password or a typo. Use the **session pooler** (the pooler host on port
5432) for `db push` instead; it is the IPv4-reachable equivalent.

**You do NOT need `?pgbouncer=true`.** That flag disables prepared statements
for Prisma's own query engine, which is not the path this app uses. With the
`pg` driver adapter, `performIO` passes `name: statementNameGenerator?.(query)`
to `pg.Client#query()`, and we supply no generator — so every statement is
unnamed and never cached, which is precisely what transaction-mode pooling
supports. Adding the flag would be cargo-culting a fix for a problem this stack
does not have.

### Deploying to Vercel

1. Create the Supabase project. Note both connection strings.
2. Set `DATABASE_URL` in Vercel's environment to the **pooled** string (6543).
3. Create the tables, once, over the **direct** string (5432):
   ```bash
   npx prisma db push --url "postgresql://…@…:5432/postgres"
   ```
   `prisma/` has no `migrations/` directory — `db push` is the whole schema
   deployment step.
4. Deploy.

The production database is expected to be **empty on first boot**. That is a
product decision, not an oversight: a new visitor starts with no saved maps, and
`prisma/seed.ts` is deliberately a no-op. The landing screen's day-one state is
what an empty database is supposed to look like.

### If the database is unreachable

`classifyLoadError` (`app/lib/loadError.ts`) turns a Prisma failure into a
readable `ErrorScreen` on both the landing page and the map page, and every
route handler is wrapped in `withFailure` (`app/lib/apiFailure.ts`) so an outage
reaches the browser as `{ error }` rather than an unparseable body. A database
outage should look like a stated problem, never like the app being gone.

### What stays the same

Application code does not change with the database. Every file that touches it
imports from `@/app/lib/prisma`; the schema models, API routes and server
components all work identically regardless of what backs them.

## Writing Seed Scripts

Seed scripts run outside of Next.js, so they must create their own PrismaClient with the adapter (they cannot import from `@/app/lib/prisma`). See `prisma/seed.ts` for the correct pattern.
