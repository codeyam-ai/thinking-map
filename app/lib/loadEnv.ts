// Dotenv loader for entry points that run OUTSIDE Next.js.
//
// Import this for its side effect — before anything that reads
// `process.env` — from any standalone entry point (Prisma config, seed
// scripts, the test runner config):
//
//   import './app/lib/loadEnv';   // from the project root
//   import '../app/lib/loadEnv';  // from prisma/
//
// ---------------------------------------------------------------------------
// Why this file exists
// ---------------------------------------------------------------------------
//
// `import 'dotenv/config'` reads `.env` and NOTHING ELSE. Next.js, by
// contrast, reads the whole cascade below natively and lets the `.local`
// files win. codeyam writes managed credentials to `.env.local` (see
// `crates/control-api/src/env_convenience_file.rs`), and `.gitignore`
// ignores `.env*.local` — which is exactly why `.env.local` is the only
// file in this template where a real secret can live uncommitted.
//
// The result, without this loader, is a maximally confusing split brain: the
// dev server serves HTTP 200 against the database while `npm run db:seed`,
// `npm run db:check`, and `npx prisma migrate` all insist `DATABASE_URL is
// not set`. The app works; every standalone entry point is blind.
//
// So: one loader module, imported by every non-Next.js entry point. Adding a
// new entry point means adding one import, not re-deciding how env loading
// works.
//
// ---------------------------------------------------------------------------
// Precedence
// ---------------------------------------------------------------------------
//
// dotenv applies array `path` entries first-wins, so this list is in
// DESCENDING precedence. It is the exact reverse of the editor's own
// `DOTENV_FILES_ASCENDING` (`crates/process-manager/src/auth_shim.rs`) and
// matches Next.js's development-mode order. Keeping all three readers —
// the app, the editor, and the CLI — on one order is the point: a project
// with an empty `VAR=` placeholder in `.env` and the real value in
// `.env.local` must resolve to the real value everywhere.
//
// ---------------------------------------------------------------------------
// `quiet` is not cosmetic — do not "clean it up"
// ---------------------------------------------------------------------------
//
// dotenv v17 prints an `[dotenv@17] injected env (N) from …` banner to
// STDOUT by default. This module is imported from `vitest.config.ts`, so
// that banner would land ahead of `--reporter=json` output and corrupt the
// runner's machine-readable stdout. Stdout from a config file is never
// acceptable. Leave `quiet: true` in place.

import { config } from 'dotenv';

config({
  path: ['.env.development.local', '.env.local', '.env.development', '.env'],
  quiet: true,
});
