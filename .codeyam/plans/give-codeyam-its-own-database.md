---
title: "Give CodeYam Its Own Database"
mode: backend
createdAt: "2026-09-02T19:38:35Z"
source: manual
---

## Summary

CodeYam's scenario captures and a person's own `npm run dev` session share one SQLite file. `.env` sets a single `DATABASE_URL=file:./dev.db`, there is no `.env.local`, and `.codeyam/editor.json` points the editor at `npm run dev` on port 3000 — the same command and the same port a person runs directly. So when the editor applies a scenario seed it runs `.codeyam/seed-adapter.ts`, which calls `deleteMany()` across every table before inserting, and the person's real thinking maps are gone, replaced by `map-game`, `map-a`…`map-h` and the rest of the fixture cast. Nothing warns, and nothing distinguishes a fixture map from a real one afterwards. This plan gives codeyam its own database and its own port, so a seeded capture can never reach the database a person is working in.

## Key Decisions

- **Use the path `.gitignore` already reserves.** Lines 45–49 of `.gitignore` carry `.codeyam/db.sqlite3` under the comment "CodeYam - local dev database (stack-specific)". The separate database is the design this template already assumes; this project simply never connected it. Adopting that path rather than inventing `codeyam.db` means the ignore rules, and anyone reading them, are already correct.
- **Split at the process, not per request.** One dev server holds one `DATABASE_URL` for its whole life, so a per-scenario or per-request database switch is not available — `app/lib/prisma.ts` builds its adapter once at module load. The separation therefore has to be two server processes on two ports with two env values. This is also why a query param or header cannot solve it, and the reason is worth recording so it is not re-proposed.
- **Route the split through `package.json` scripts, not through codeyam's command strings.** `.codeyam/stack.json` already indirects every command through an npm script (`dev`, `db:push`, `setup`). Adding codeyam-specific scripts beside the existing ones keeps the env value in one file a person can read, and leaves `npm run dev` meaning exactly what it means today — a person's own server against their own data.
- **`npm run dev` is the one that stays unchanged.** The human path keeps `dev.db` and port 3000. It is codeyam that moves. Changing the human default would break every muscle-memory invocation and every doc that names it, to solve a problem codeyam created.
- **Port 3100 for codeyam.** Far enough from 3000 that a person who forgets which server they are looking at gets an obvious answer from the URL bar, and outside the 300x range Next reaches for when 3000 is taken — so codeyam's port never collides with a second human server.
- **`editor.json`, not `editor.local.json`.** The port and start command go in the committed config so every clone gets the separation. `editor.local.json` is gitignored and per-developer; putting a safety property there means the next person to clone this repo has the hazard back.
- **The seed adapter is not modified.** It reads `DATABASE_URL` from the environment and never overwrites a key that is already set (`loadDotEnvFiles`, `.codeyam/seed-adapter.ts`), so an inline `DATABASE_URL=…` on its invocation wins over the `.env` cascade. Editing the adapter would put a project-specific path inside a file the editor regenerates.

## Implementation

### 1. CodeYam-facing npm scripts

**File**: `package.json`

Add three scripts beside the existing ones, each pinning `DATABASE_URL=file:./.codeyam/db.sqlite3`:

- `dev:codeyam` — the same `next dev --webpack -H 127.0.0.1` as `dev`, with the codeyam database and `-p 3100`.
- `db:push:codeyam` — `npx prisma db push && npx prisma generate` against the codeyam database, so its schema tracks `prisma/schema.prisma` without touching `dev.db`.
- `setup:codeyam` — install plus `db:push:codeyam`, the counterpart of `setup` for a fresh clone.

Leave `dev`, `db:push`, `db:seed`, `db:reset` and `setup` exactly as they are. The relative `file:./.codeyam/db.sqlite3` resolves against the project root, which is where every one of these scripts runs.

### 2. Point the editor at them

**File**: `.codeyam/stack.json`

In `commands`, change `dev` to `npm run dev:codeyam`, `dbPush` to `npm run db:push:codeyam`, `setup` to `npm run setup:codeyam`, and prefix `seedAdapter` with `DATABASE_URL=file:./.codeyam/db.sqlite3` so the adapter wipes and seeds the codeyam database rather than `dev.db`. `test` is unchanged — the test suite touches neither file.

**File**: `.codeyam/editor.json`

In `apps[0]`, change `port` to `3100` and `startCommand` to `npm run dev:codeyam`, so the editor launches its own server rather than adopting whichever one is already on 3000.

### 3. Say which database is which

**File**: `.env`

Extend the comment above `DATABASE_URL` to name both databases and which command reaches which. The value itself does not change — `.env` stays the human default.

**File**: `DATABASE.md`

Add a short section under "Where Credentials Go" recording the two databases, the reason they are separate (a seeded capture wipes every table), and the fact that `npm run db:reset` only ever touches `dev.db`. Someone who finds `.codeyam/db.sqlite3` in a directory listing should be able to learn what it is from the docs rather than from the ignore file.

### 4. Keep the ignore rules honest

**File**: `.gitignore`

`.codeyam/db.sqlite3` and its `-wal` / `-shm` siblings are already listed. Add `.codeyam/db.sqlite3-journal` alongside them to match the `dev.db-journal` entry directly above — better-sqlite3 runs in journal mode as well as WAL depending on how it is opened, and the existing block covers only one of the two.

### 5. Tests

**New file**: `app/lib/devDatabases.test.ts`

See the Reproduction Test section. The test reads `package.json` and `.codeyam/stack.json` and asserts the two paths never converge.

## Reused existing code

- `loadDotEnvFiles` from `.codeyam/seed-adapter.ts` — the reason an inline `DATABASE_URL=` on the `seedAdapter` command is enough: it never overwrites a key already present in the process environment, so the environment wins over the `.env` cascade. Relied on, not modified.
- `loadEnv` from `app/lib/loadEnv.ts` (glossary entry: `loadEnv`) — the same non-overriding precedence for every standalone entry point (`prisma.config.ts`, `prisma/seed.ts`, `vitest.config.ts`). This is what makes a DATABASE_URL-prefixed `npx prisma db push` behave, and why `db:push:codeyam` needs no new loader.
- `prisma` from `app/lib/prisma.ts` (glossary entry: `prisma`) — reads the DATABASE_URL environment variable once at module load and is deliberately untouched: it is already the single place the database path enters the app, which is exactly why the split can happen entirely outside it.
- `.codeyam/seed-adapter.ts` — the wipe-and-insert adapter whose blast radius this plan redirects. Not modified; the editor regenerates it.

**Existing-implementation survey**: there is no existing second-database mechanism in this repo. No .env.local file exists, `ls -la .env*` returns `.env` alone, and no script or config sets `DATABASE_URL` to anything but file:./dev.db. The nearest thing to a prior decision is `.gitignore` (lines 45-49), which reserves .codeyam/db.sqlite3 (new) with the comment "CodeYam - local dev database (stack-specific)" — a path with nothing writing to it. This plan connects that reservation rather than adding a parallel one, which is why it does not introduce a new field name.

## Reproduction Test

Pins that no codeyam command can reach the database `npm run dev` serves — the property whose absence let a seeded capture delete a person's maps.

**Target**: `app/lib/devDatabases.test.ts` (new) — run with
`codeyam-editor editor refresh-tests --test <name>`.

Config is asserted rather than mocked on purpose. The failure being pinned is a wiring failure — two strings that must differ — and no runtime test can observe it without actually wiping a database.

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const stack = JSON.parse(readFileSync('.codeyam/stack.json', 'utf8'));

/** The DATABASE_URL a command resolves to: its own inline value, else `.env`'s. */
const dbFor = (command: string): string => {
  const inline = /DATABASE_URL=(\S+)/.exec(command);
  if (inline) return inline[1];
  const script = /^npm run (\S+)/.exec(command);
  return script ? dbFor(pkg.scripts[script[1]] ?? '') : 'file:./dev.db';
};

describe('dev databases', () => {
  // The regression this pins: `.codeyam/seed-adapter.ts` runs deleteMany()
  // across every table before it inserts. While the editor's commands resolved
  // to the same DATABASE_URL as `npm run dev`, every seeded capture deleted the
  // maps a person was actually working on and left fixtures in their place.
  it('never lets a codeyam command reach the database npm run dev serves', () => {
    const human = dbFor('npm run dev');
    for (const key of ['dev', 'dbPush', 'seedAdapter', 'setup']) {
      expect(dbFor(stack.commands[key])).not.toBe(human);
    }
  });

  // The other half: the human default must stay where every doc and every
  // muscle-memory invocation already points.
  it('leaves npm run dev on dev.db', () => {
    expect(dbFor('npm run dev')).toBe('file:./dev.db');
  });
});
```

Status: PROPOSED — confirm red at execution. Expected failure: today every `stack.commands` entry resolves through an npm script with no inline `DATABASE_URL`, so `dbFor` falls through to `file:./dev.db` for all four keys and the first `not.toBe` assertion fails on `dev` — "expected 'file:./dev.db' not to be 'file:./dev.db'". The second case passes before the fix as well as after, which is why it cannot stand alone.

## Scenarios to Demonstrate

- **A person's own maps, after a capture run** — the map list at `/` in a direct `npm run dev` session, holding the same maps it held before the editor captured anything. The whole point.
- **The editor's own map list** — `/` on the codeyam server, showing the seeded fixture maps (`map-game`, `map-a`…`map-h`), which is what a capture is supposed to see.
- **A seeded scenario capture** — a scenario at `/map/map-game` rendering from the codeyam database, unchanged from what it captures today.
- **Empty codeyam database, first run** — the codeyam server before any seed has been applied: the empty-state map list, proving the new database starts clean rather than inheriting `dev.db`.
- **Both servers up at once** — the two ports side by side, each with its own map list, which is the state the separation exists to make possible.