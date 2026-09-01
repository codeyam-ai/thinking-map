# Database

This project uses **Prisma 7 with SQLite** for local development. No external services needed.

All application code imports from `@/app/lib/prisma` — this is the only file that changes when you upgrade to a hosted database.

## Quick Reference

```bash
# Edit your schema
vim prisma/schema.prisma

# Push schema changes (also regenerates Prisma client)
npm run db:push

# Seed demo data
npm run db:seed

# Reset database (delete + recreate + seed)
npm run db:reset

# Browse data visually
npx prisma studio
```

## Where Credentials Go

**Real values go in `.env.local`. `.env` holds committed placeholders.**

`.gitignore` ignores `.env*.local`, so `.env.local` is the only file here
where a real secret can live without being committed. It is also where
codeyam's Home → Setup flow writes the variables it manages, and where
`AUTH_UPGRADE.md` tells you to put auth secrets. One file, one answer.

| File         | Committed? | What belongs in it                             |
| ------------ | ---------- | ---------------------------------------------- |
| `.env`       | yes        | The local SQLite default and empty placeholders |
| `.env.local` | no         | Real connection strings, API keys, secrets      |

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

To test data functions against a **real** database (not mocks), spin up a
throwaway SQLite DB per test file. `dev.db` is never touched.

Three rules make this reliable on this stack:

1. **Set `process.env.DATABASE_URL` _before_ importing the Prisma client.**
   `app/lib/prisma.ts` reads `DATABASE_URL` at module-load time
   (`new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ... })`), so the
   client must be imported *dynamically*, after the env var is set — otherwise
   it binds to `dev.db`.
2. **Create the schema with `prisma db push --url "file:<tmp>"`.** The `--url`
   override targets the temp DB and skips client regeneration. Do **NOT** pass
   `--skip-generate` — that flag does not exist for `db push` in Prisma 7 and
   the command fails.
3. **Never suppress the push output** (`stdio: 'ignore'`). Capture it with
   `stdio: 'pipe'` and rethrow on failure, so a broken schema push reports its
   real Prisma error instead of an opaque `beforeAll` throw.

```typescript
import { beforeAll, afterAll, it, expect } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

let tmpDir: string;
let prisma: typeof import('@/app/lib/prisma').prisma;

beforeAll(async () => {
  // A throwaway directory holds the test DB — dev.db is left alone.
  tmpDir = mkdtempSync(join(tmpdir(), 'itest-'));
  const dbUrl = `file:${join(tmpDir, 'test.db')}`;

  // Rule 1: point the client at the temp DB BEFORE it is imported.
  process.env.DATABASE_URL = dbUrl;

  // Rule 2 + 3: --url override (no --skip-generate), and capture output so a
  // failed push surfaces its real cause instead of a silent beforeAll throw.
  try {
    execFileSync('npx', ['prisma', 'db', 'push', '--url', dbUrl], {
      stdio: 'pipe',
    });
  } catch (err) {
    const e = err as { stderr?: Buffer; stdout?: Buffer };
    throw new Error(
      `prisma db push failed:\n${e.stderr?.toString() ?? ''}${e.stdout?.toString() ?? ''}`,
    );
  }

  // Rule 1: dynamic import AFTER DATABASE_URL is set.
  ({ prisma } = await import('@/app/lib/prisma'));
});

afterAll(async () => {
  await prisma?.$disconnect();
  rmSync(tmpDir, { recursive: true, force: true });
});

it('reads and writes against the temp DB', async () => {
  await prisma.drink.create({ data: { title: 'Matcha' } });
  const drinks = await prisma.drink.findMany();
  expect(drinks).toHaveLength(1);
});
```

Replace `drink` with one of your own models. The `dev.db` file is never read
or written — every query runs against the temp DB, which is deleted in
`afterAll`.

## Important: Do NOT Change These Settings

- **Generator must be `prisma-client-js`** (not `prisma-client`). The `prisma-client` generator requires a custom output path that breaks Turbopack.
- **Do NOT add an `output` field** to the generator.
- **Do NOT add `url` to the datasource block** in `schema.prisma`. Prisma 7 moved the URL to `prisma.config.ts`.
- **Keep `serverExternalPackages: ["better-sqlite3"]`** in `next.config.ts`.
- **Keep `turbopack: { root: "." }`** in `next.config.ts`.
- **Always run `npx prisma generate`** after `npx prisma db push` (or use `npm run db:push` which does both).
- **Database file is at project root** (`./dev.db`), not in `prisma/`.

## Upgrading to a Hosted Database

When you're ready for production, you'll want a hosted database. SQLite is great for prototyping, but doesn't support concurrent connections or run in serverless environments (Vercel, etc.).

### Option 1: Supabase (PostgreSQL)

Free tier available. Gives you PostgreSQL + auth + realtime + storage.

1. Create a project at https://supabase.com/dashboard
2. Get your credentials from Project Settings > Database > Connection string (URI)
3. Replace packages:
   ```bash
   npm uninstall better-sqlite3 @prisma/adapter-better-sqlite3 @types/better-sqlite3
   npm install @prisma/adapter-pg pg @supabase/supabase-js
   npm install -D @types/pg
   ```
4. Update `prisma/schema.prisma`:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
5. Update `app/lib/prisma.ts`:

   ```typescript
   import { PrismaClient } from '@prisma/client';
   import { PrismaPg } from '@prisma/adapter-pg';

   const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };
   const connectionString = process.env.DATABASE_URL!;
   const adapter = new PrismaPg({ connectionString });
   export const prisma =
     globalForPrisma.prisma ?? new PrismaClient({ adapter });
   if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
   export default prisma;
   ```

6. Put the connection string in `.env.local` (NOT `.env` — see "Where
   Credentials Go" above; `.env.local` is gitignored, and it is what every
   entry point reads with highest precedence):
   ```
   DATABASE_URL=postgresql://postgres.YOUR_PROJECT_ID:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
   ```
7. Remove `serverExternalPackages` from `next.config.ts`
8. Run `npm run db:push` to create tables in Supabase
9. Update `prisma/seed.ts` to use the new adapter (same pattern as `prisma.ts`)

### Option 2: Other PostgreSQL Hosts (Neon, Railway, etc.)

Same steps as Supabase above (steps 3-9), just use your provider's connection string.

### Option 3: PlanetScale / MySQL

1. Replace packages:
   ```bash
   npm uninstall better-sqlite3 @prisma/adapter-better-sqlite3 @types/better-sqlite3
   npm install @prisma/adapter-planetscale @planetscale/database
   ```
2. Update `schema.prisma` datasource to `provider = "mysql"`
3. Update `app/lib/prisma.ts` to use `PrismaPlanetScale` adapter
4. Follow PlanetScale setup docs for connection string

### What Stays the Same

Your application code doesn't change at all. Every file that uses the database already imports from `@/app/lib/prisma`, which is the only file that gets updated. Your Prisma schema models, API routes, and server components all work identically regardless of which database backs them.

## Writing Seed Scripts

Seed scripts run outside of Next.js, so they must create their own PrismaClient with the adapter (they cannot import from `@/app/lib/prisma`). See `prisma/seed.ts` for the correct pattern.
