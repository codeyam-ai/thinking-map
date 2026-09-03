// The database the integration tests run against.
//
// ---------------------------------------------------------------------------
// Why this file exists
// ---------------------------------------------------------------------------
//
// The four `*.integration.test.ts` files each used to stand up their own
// temporary SQLite *file* with `mkdtempSync`. That worked because the database
// was a file. It stopped working when the datasource moved to PostgreSQL for
// deployment, so all four needed a real Postgres — and the obvious answers
// (install one, or host one) both make `npm test` fail on a fresh clone with a
// connection error rather than a useful message.
//
// So the suite brings its own. `embedded-postgres` downloads an official
// PostgreSQL binary and runs it as a subprocess, which means `npm test` works
// after nothing but `npm install`: no Docker, no system service, no network,
// and the same engine the deployed app talks to.
//
// ---------------------------------------------------------------------------
// TEST_DATABASE_URL is the opt-out
// ---------------------------------------------------------------------------
//
// If `TEST_DATABASE_URL` is set, it is used verbatim and no server is started.
// That keeps a system-wide Postgres, or a second hosted Supabase project,
// working for anyone who prefers one. Leaving it unset is the normal case.
//
// If you point it at a *pooled* connection string (Supabase's port 6543), note
// that `prisma db push` wants a direct connection — use the 5432 host here.
//
// ---------------------------------------------------------------------------
// Isolation
// ---------------------------------------------------------------------------
//
// One server, one schema per test file. The schema — not the database — is the
// unit of isolation, so files cannot see each other's tables and a failed run
// leaves at most one stray schema behind on a database that is thrown away
// anyway.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { freePort } from './freePort';
import { dropSchema, pushSchema } from './schemaLifecycle';

type EmbeddedServer = {
  url: string;
  stop: () => Promise<void>;
};

let serverPromise: Promise<EmbeddedServer> | null = null;

/**
 * PostgreSQL refuses to run as root. Embedded Postgres can create a temporary
 * unprivileged account for that unusual case, but asking it to do so on a
 * normal developer machine needlessly depends on OS account administration.
 */
export function needsPostgresUser(): boolean {
  return process.getuid?.() === 0;
}

async function startEmbeddedPostgres(): Promise<EmbeddedServer> {
  // Imported lazily so that setting TEST_DATABASE_URL avoids loading the
  // package — and, more usefully, so a machine with no embedded-postgres
  // binary for its platform can still run the suite against its own database.
  const { default: EmbeddedPostgres } = await import('embedded-postgres');

  const port = await freePort('test database');
  const dataDir = mkdtempSync(path.join(tmpdir(), 'codeyam-testdb-'));

  const server = new EmbeddedPostgres({
    databaseDir: dataDir,
    user: 'postgres',
    password: 'postgres',
    port,
    // Postgres refuses to run as root. Only ask the package to create an
    // unprivileged user in that case: on developer machines it otherwise
    // relies on OS account creation and can fail before Postgres starts.
    createPostgresUser: needsPostgresUser(),
    // The cluster is disposable; do not leave one behind between runs.
    persistent: false,
  });

  try {
    await server.initialise();
    await server.start();
  } catch (cause) {
    rmSync(dataDir, { recursive: true, force: true });
    // The one failure worth translating. After dropping to an unprivileged
    // user, Postgres has to execute its own binary inside node_modules — which
    // fails if any parent directory is not traversable by that user (a 0700
    // home or checkout is the usual cause). The raw error is `EACCES` on
    // `spawn initdb`, which points at the wrong thing entirely.
    if (cause instanceof Error && /EACCES/.test(String(cause.message ?? cause))) {
      throw new Error(
        'The embedded PostgreSQL server could not start: its binary in ' +
          'node_modules is not executable by an unprivileged user. Make the ' +
          'directories above node_modules traversable (chmod a+rX), or set ' +
          'TEST_DATABASE_URL to point the tests at your own PostgreSQL.',
        { cause },
      );
    }
    throw cause;
  }

  return {
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`,
    stop: async () => {
      await server.stop();
      rmSync(dataDir, { recursive: true, force: true });
    },
  };
}

/**
 * The base connection string the tests build their per-file schema onto.
 *
 * Starts the embedded server on first call and reuses it thereafter, so a
 * worker running several test files pays the ~2s startup once.
 */
export async function testDatabaseUrl(): Promise<string> {
  const configured = process.env.TEST_DATABASE_URL;
  if (configured) return configured;

  serverPromise ??= startEmbeddedPostgres();
  const server = await serverPromise;
  return server.url;
}

/** Stops the embedded server if this process started one. */
export async function stopTestDatabase(): Promise<void> {
  const pending = serverPromise;
  if (!pending) return;
  serverPromise = null;
  const server = await pending;
  await server.stop();
}

/**
 * Give one test file its own empty schema, with the app's tables pushed into
 * it, and a teardown that removes it.
 *
 * Assigns `DATABASE_URL` as a side effect, and must therefore be awaited
 * BEFORE the modules under test are imported — `app/lib/prisma.ts` reads the
 * variable at import time, so a later assignment is ignored.
 */
export async function setUpTestSchema(label: string): Promise<{
  url: string;
  teardown: () => Promise<void>;
}> {
  const base = await testDatabaseUrl();
  const schema = uniqueSchemaName(label);
  const url = schemaUrl(base, schema);

  process.env.DATABASE_URL = url;
  pushSchema(url);

  return {
    url,
    teardown: async () => {
      await dropSchema(base, schema);
      // Whoever started the server stops it. When TEST_DATABASE_URL supplied
      // the database this is a no-op, so both modes tear down correctly and
      // no run leaves a Postgres behind.
      await stopTestDatabase();
    },
  };
}

/**
 * A schema name unique to one run of one test file.
 *
 * Lowercased because an unquoted Postgres identifier folds to lower case
 * anyway, so a name that only differs by case is not actually distinct. The
 * label is reduced to `[a-z0-9_]` rather than trusted: it reaches a `DROP
 * SCHEMA` statement, and a caller passing something with a quote in it should
 * produce a boring name, not a broken statement.
 */
export function uniqueSchemaName(
  label: string,
  suffix: string = randomBytes(4).toString('hex'),
): string {
  const safe = label
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `test_${safe}_${suffix}`;
}

/**
 * The base connection string, pointed at one schema.
 *
 * Built through `URL` rather than string concatenation so that a base which
 * already carries query parameters keeps them — a Supabase DSN arrives with
 * its own, and appending `?schema=…` to it would produce a URL with two `?`
 * and silently drop the rest.
 */
export function schemaUrl(base: string, schema: string): string {
  const parsed = new URL(base);
  parsed.searchParams.set('schema', schema);
  return parsed.toString();
}

