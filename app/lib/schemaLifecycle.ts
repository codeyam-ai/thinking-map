// Creating and destroying a disposable PostgreSQL schema.
//
// Two callers need exactly this pair and for exactly the same reason. The test
// suite (`app/lib/testDatabase.ts`) gives each test file its own schema so the
// files cannot see each other's tables; the browser eval run
// (`scripts/run-browser-evals.ts`) gives each run its own so it can drive the
// real tools against a real database without touching anyone's data. Both push
// the app's tables in, and both drop the schema afterwards whatever happened.
//
// The schema — rather than the database — is the unit of isolation in both
// cases, because it needs no second server: one cluster can hold a developer's
// data, a test file's tables and an eval run's tables at once, and a failed run
// leaves at most one stray schema on a database that can identify it by name.

import { execFileSync } from 'node:child_process';
import { Client } from 'pg';

/**
 * Create the schema and build the app's tables inside it.
 *
 * @param url - a connection string carrying the `?schema=` to build into.
 */
export function pushSchema(url: string): void {
  // `--url` rather than the env alone: this Prisma reads its datasource from
  // prisma.config.ts, so DATABASE_URL by itself would push to the dev database.
  // `db push` creates the schema when it is missing.
  try {
    execFileSync('npx', ['prisma', 'db', 'push', '--url', url], {
      env: { ...process.env, DATABASE_URL: url },
      stdio: 'pipe',
    });
  } catch (err) {
    // Never swallow the push output. Without this the failure surfaces as an
    // opaque `beforeAll` throw and the real Prisma error — the one naming the
    // broken model or the unreachable host — is lost.
    const e = err as { stderr?: Buffer; stdout?: Buffer };
    throw new Error(
      `prisma db push failed:\n${e.stderr?.toString() ?? ''}${e.stdout?.toString() ?? ''}`,
    );
  }
}

/**
 * Remove the schema and everything in it.
 *
 * @param base - the connection string WITHOUT the schema parameter. Dropping a
 *   schema cannot be done from a session inside it.
 */
export async function dropSchema(base: string, schema: string): Promise<void> {
  const client = new Client({ connectionString: base });
  await client.connect();
  try {
    // Both callers mint the name themselves — `uniqueSchemaName` reduces its
    // label to `[a-z0-9_]`, `evalSchemaName` uses hex — but quote it anyway so
    // this can never become an injection site if either ever loosens.
    await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  } finally {
    await client.end();
  }
}
