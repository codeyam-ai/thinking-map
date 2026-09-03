// The one place that answers "where is the database?".
//
// Read by `app/lib/prisma.ts` (the app's client) and `prisma/seed.ts` (which
// must build its own client, so it cannot import that singleton). Both used to
// carry an identical copy of this check; the message is worth keeping identical
// between them, and a copy in two files is a message that drifts.
//
// There is deliberately NO fallback URL. A missing connection string fails here,
// loudly, rather than opening some other database that will never be the right
// one — on a serverless host that fallback would be a local file no other
// function instance can see, and the symptom would be missing data rather than a
// missing database.

/**
 * Just the part of the environment these functions read.
 *
 * Narrower than `NodeJS.ProcessEnv` on purpose. Next.js augments that type to
 * require `NODE_ENV`, so a caller — a test, most obviously — could not pass a
 * small object describing the one case it cares about. Naming only what is
 * actually read is both the honest signature and the usable one; `process.env`
 * satisfies it structurally.
 */
export interface DatabaseEnv {
  DATABASE_URL?: string;
  // Present so `process.env` satisfies this structurally. Without it the type
  // is "weak" — every property optional — and TypeScript rejects an argument
  // that shares no property with it, which is the opposite of the flexibility
  // the narrow signature is for.
  [key: string]: string | undefined;
}

/**
 * The configured PostgreSQL connection string.
 *
 * @param env - the environment to read; defaults to the process environment.
 *   Injectable so this is testable without mutating global state.
 * @throws if `DATABASE_URL` is unset or empty.
 */
export function requireDatabaseUrl(env: DatabaseEnv = process.env): string {
  const url = env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Point it at your PostgreSQL database — see DATABASE.md.',
    );
  }
  return url;
}

/**
 * The connection string split into the two things `PrismaPg` needs.
 *
 * `?schema=…` is a *Prisma* datasource convention, not a PostgreSQL one. The
 * Prisma CLI honours it — `prisma db push --url '…?schema=x'` builds the tables
 * in `x` — but the driver adapter connects through `pg`, which does not parse
 * it and leaves the session on the default `search_path`. Passed a URL naming a
 * schema, the adapter would therefore write to `public` while the CLI had built
 * everything in `x`, and every query would fail with `relation "public.<Table>"
 * does not exist`.
 *
 * So the parameter is read here and handed to the adapter as its `schema`
 * option, which is what actually qualifies generated queries. Without this the
 * per-test schema isolation silently does nothing.
 */
export function databaseConnection(env: DatabaseEnv = process.env): {
  connectionString: string;
  schema?: string;
} {
  const connectionString = requireDatabaseUrl(env);
  // A connection string is not required to be a parseable URL; if it is not,
  // there is no `?schema=` to read and the default search_path is correct.
  let schema: string | undefined;
  try {
    schema = new URL(connectionString).searchParams.get('schema') ?? undefined;
  } catch {
    schema = undefined;
  }
  return { connectionString, schema };
}
