import { describe, expect, it } from 'vitest';
import { databaseConnection, requireDatabaseUrl } from './databaseUrl';

// The whole value of this helper is that a missing connection string stops the
// process instead of silently opening the wrong database. That is the behaviour
// under test — not the string it returns on the happy path.

describe('requireDatabaseUrl', () => {
  // The happy path still has to work: a configured string is passed through
  // unchanged, with no normalising or rewriting that could corrupt a DSN.
  it('returns the configured connection string', () => {
    expect(
      requireDatabaseUrl({ DATABASE_URL: 'postgresql://u:p@host:5432/db' }),
    ).toBe('postgresql://u:p@host:5432/db');
  });

  // The core guarantee. Before this migration a missing value silently opened
  // a local SQLite file; on a serverless host that is a file no other function
  // instance can see, so the failure looked like missing data instead.
  it('throws when DATABASE_URL is absent', () => {
    expect(() => requireDatabaseUrl({})).toThrow(/DATABASE_URL is not set/);
  });

  // An empty value is the shape a committed `.env` placeholder actually takes,
  // and it is the one most likely to reach a deploy. Treating it as "set" would
  // hand the adapter an empty string and move the failure somewhere unreadable.
  it('treats an empty DATABASE_URL as unset', () => {
    expect(() => requireDatabaseUrl({ DATABASE_URL: '' })).toThrow(
      /DATABASE_URL is not set/,
    );
  });

  // The message is the only instruction a developer gets at the moment the app
  // refuses to boot, so it has to name the file that explains what to do.
  it('points at the file that explains how to fix it', () => {
    expect(() => requireDatabaseUrl({})).toThrow(/DATABASE\.md/);
  });
});

describe('databaseConnection', () => {
  // The bug this function exists to prevent, stated directly: `?schema=` is a
  // Prisma convention that the `pg` driver does not parse, so unless it is
  // lifted out and handed to the adapter separately, every query silently runs
  // against `public` while the tables live somewhere else.
  it('lifts the schema out of the connection string', () => {
    expect(
      databaseConnection({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db?schema=test_abc',
      }).schema,
    ).toBe('test_abc');
  });

  // The ordinary deployment case. No schema parameter means the default
  // search_path, and forcing one would be wrong.
  it('reports no schema when the URL does not name one', () => {
    expect(
      databaseConnection({
        DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
      }).schema,
    ).toBeUndefined();
  });

  // The adapter still needs the whole string to connect with — host, database,
  // credentials and any pooler parameters must survive untouched.
  it('passes the connection string through intact', () => {
    const url = 'postgresql://u:p@pooler.supabase.com:6543/postgres?pgbouncer=true';
    expect(databaseConnection({ DATABASE_URL: url }).connectionString).toBe(url);
  });

  // Not every valid connection string is a parseable URL (libpq key/value form
  // is legal). That should mean "no schema", not a crash on startup.
  it('treats an unparseable connection string as naming no schema', () => {
    expect(
      databaseConnection({ DATABASE_URL: 'host=localhost dbname=db' }).schema,
    ).toBeUndefined();
  });

  // Inherits the guard from requireDatabaseUrl rather than re-implementing it.
  it('throws when DATABASE_URL is missing', () => {
    expect(() => databaseConnection({})).toThrow(/DATABASE_URL is not set/);
  });
});
