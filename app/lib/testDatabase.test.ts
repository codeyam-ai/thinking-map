import { describe, expect, it } from 'vitest';
import { needsPostgresUser, schemaUrl, uniqueSchemaName } from './testDatabase';

// The two pure halves of the test-database helper. Everything else in that
// module needs a real PostgreSQL to say anything, which is exactly why these
// two are worth separating: they are where the silent, hard-to-notice breakage
// lives, and they can be pinned without one.

describe('uniqueSchemaName', () => {
  // OS-user creation requires administrator privileges, so regular developer
  // runs must start Postgres as the account already running the test process.
  it('only asks Embedded Postgres to create an OS user when running as root', () => {
    expect(needsPostgresUser()).toBe(process.getuid?.() === 0);
  });

  // The fixed `test_` prefix is what makes a stray schema identifiable as test
  // debris on a database that may also hold someone's real data.
  it('prefixes the label so test schemas are recognisable on a shared server', () => {
    expect(uniqueSchemaName('exchange', 'abcd1234')).toBe(
      'test_exchange_abcd1234',
    );
  });

  // Two files that differ only by case would collide: an unquoted Postgres
  // identifier folds to lower case, so `Test_A` and `test_a` are one schema.
  it('lowercases the label', () => {
    expect(uniqueSchemaName('ExchangeRoute', 'ff00')).toBe(
      'test_exchangeroute_ff00',
    );
  });

  // The name reaches a DROP SCHEMA statement. A label carrying a quote should
  // produce a dull name rather than a broken — or dangerous — statement.
  it('reduces anything outside [a-z0-9_] to an underscore', () => {
    expect(uniqueSchemaName('a"; DROP TABLE users; --', 'dead')).toBe(
      'test_a_drop_table_users_dead',
    );
  });

  // Uniqueness is what lets the same test file run twice concurrently — two
  // runs sharing a schema would see each other's rows and fail intermittently.
  it('gives two calls with the same label different names', () => {
    expect(uniqueSchemaName('same')).not.toBe(uniqueSchemaName('same'));
  });
});

describe('schemaUrl', () => {
  // The base case: a local DSN with no query string gains exactly one.
  it('points a plain connection string at the schema', () => {
    expect(schemaUrl('postgresql://u:p@localhost:5432/db', 'test_a')).toBe(
      'postgresql://u:p@localhost:5432/db?schema=test_a',
    );
  });

  // The failure this exists to prevent: a hosted DSN arrives carrying its own
  // query parameters, and naive concatenation would produce a URL with two `?`
  // — dropping pgbouncer settings that the connection actually depends on.
  it('keeps query parameters the base connection string already carries', () => {
    const url = new URL(
      schemaUrl(
        'postgresql://u:p@aws.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1',
        'test_b',
      ),
    );
    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.searchParams.get('connection_limit')).toBe('1');
    expect(url.searchParams.get('schema')).toBe('test_b');
  });

  // Two `schema` parameters would leave which one wins up to the driver, so a
  // base that already names one must be overridden rather than appended to.
  it('replaces a schema the base already specifies rather than adding a second', () => {
    const url = new URL(
      schemaUrl('postgresql://u:p@localhost:5432/db?schema=public', 'test_c'),
    );
    expect(url.searchParams.getAll('schema')).toEqual(['test_c']);
  });

  // Only the schema parameter may change. Rewriting the host or database would
  // silently point the whole suite at somewhere it was never meant to reach.
  it('leaves the host and database untouched', () => {
    const url = new URL(
      schemaUrl('postgresql://u:p@localhost:5432/thinking_map', 'test_d'),
    );
    expect(url.host).toBe('localhost:5432');
    expect(url.pathname).toBe('/thinking_map');
  });
});
