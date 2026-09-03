// The parts of scripts/ensureDevDatabase.ts that can be checked without
// standing up a PostgreSQL server.
//
// The provisioning itself is left to the integration suite's own embedded
// server (app/lib/testDatabase.ts). What is worth pinning here is the file
// editing: this script rewrites `.env.local` and `.codeyam/stack.local.json`,
// two gitignored files where a developer's real credentials and overrides
// live, and clobbering something in either of them is the failure that would
// cost the most to discover.

import { describe, expect, it } from 'vitest';
import {
  envLocalValue,
  localUrl,
  portOf,
  upsertEnvLine,
  withCodeyamEnv,
} from './ensureDevDatabase';

const URL_ONE = 'postgresql://postgres:postgres@127.0.0.1:5432/thinking_map';
const URL_TWO = 'postgresql://user:pw@db.example.com:5432/app';

describe('upsertEnvLine', () => {
  // The first run on a fresh clone has no `.env.local` at all, so writing the
  // key into empty text is the ordinary path rather than an edge case.
  it('adds the key to an empty file', () => {
    expect(upsertEnvLine('', 'DATABASE_URL', URL_ONE)).toBe(
      `DATABASE_URL=${URL_ONE}\n`,
    );
  });

  // Re-pointing an existing declaration must edit that line where it stands.
  // Appending a second DATABASE_URL would leave which one wins up to the
  // reader's parser.
  it('replaces an existing value in place', () => {
    const before = `# comment\nDATABASE_URL=${URL_TWO}\nOTHER=keep\n`;
    expect(upsertEnvLine(before, 'DATABASE_URL', URL_ONE)).toBe(
      `# comment\nDATABASE_URL=${URL_ONE}\nOTHER=keep\n`,
    );
  });

  // A developer who wrote `export DATABASE_URL=` still declared the key, so it
  // is replaced rather than duplicated alongside the export form.
  it('replaces an _export_-prefixed declaration', () => {
    expect(
      upsertEnvLine(`export DATABASE_URL=${URL_TWO}\n`, 'DATABASE_URL', URL_ONE),
    ).toBe(`DATABASE_URL=${URL_ONE}\n`);
  });

  // This edits the one file in the project holding real credentials, so
  // clobbering an unrelated key or comment is the costliest thing it could do.
  it('leaves every other key and comment untouched', () => {
    const before = '# header\nAPI_KEY=secret\n\n# db\nOTHER_URL=x\n';
    expect(upsertEnvLine(before, 'DATABASE_URL', URL_ONE)).toBe(
      `${before}DATABASE_URL=${URL_ONE}\n`,
    );
  });

  // `TEST_DATABASE_URL` is a real key in this project's `.env`, and a suffix
  // match would silently repoint the test suite's database at the dev one.
  it('does not match a key that merely ends with the same name', () => {
    const before = `TEST_DATABASE_URL=${URL_TWO}\n`;
    expect(upsertEnvLine(before, 'DATABASE_URL', URL_ONE)).toBe(
      `${before}DATABASE_URL=${URL_ONE}\n`,
    );
  });

  // Without the separator the new key would be glued onto the end of the last
  // line, producing a key nothing can read back.
  it('adds a newline before the key when the file lacks a trailing one', () => {
    expect(upsertEnvLine('OTHER=1', 'DATABASE_URL', URL_ONE)).toBe(
      `OTHER=1\nDATABASE_URL=${URL_ONE}\n`,
    );
  });
});

describe('envLocalValue', () => {
  // This is what tells a developer's own `.env.local` entry apart from a real
  // environment export, which decides whether the URL gets mirrored to codeyam.
  it('reads a declared value', () => {
    expect(envLocalValue(`DATABASE_URL=${URL_TWO}\n`, 'DATABASE_URL')).toBe(
      URL_TWO,
    );
  });

  // Quoting a connection string is ordinary dotenv style, and keeping the
  // quotes would produce a URL nothing can connect with.
  it('strips surrounding quotes', () => {
    expect(envLocalValue(`DATABASE_URL="${URL_TWO}"\n`, 'DATABASE_URL')).toBe(
      URL_TWO,
    );
  });

  // Same rule codeyam's own resolver uses: a half-set variable is a
  // half-written config, not an answer.
  it('treats a blank value as absent', () => {
    expect(envLocalValue('DATABASE_URL=\n', 'DATABASE_URL')).toBeNull();
  });

  // An undeclared key must read as absent rather than as an empty string, or
  // the caller cannot tell "not configured" from "configured to nothing".
  it('returns null when the key is not declared', () => {
    expect(envLocalValue('OTHER=1\n', 'DATABASE_URL')).toBeNull();
  });
});

describe('withCodeyamEnv', () => {
  // Most projects have no `stack.local.json` yet, so the block has to be
  // created rather than merged into on the first provisioning run.
  it('creates the env block in an empty file', () => {
    expect(JSON.parse(withCodeyamEnv('', URL_ONE))).toEqual({
      env: { DATABASE_URL: URL_ONE },
    });
  });

  // This is a per-developer overrides file. Dropping a sibling key, or another
  // env variable beside DATABASE_URL, would silently discard their config.
  it('keeps other keys and other env variables', () => {
    const before = JSON.stringify({
      env: { STRIPE_KEY: 'sk_test', DATABASE_URL: URL_TWO },
      somethingElse: { kept: true },
    });

    expect(JSON.parse(withCodeyamEnv(before, URL_ONE))).toEqual({
      env: { STRIPE_KEY: 'sk_test', DATABASE_URL: URL_ONE },
      somethingElse: { kept: true },
    });
  });

  // A file that does not parse contributes nothing to codeyam's lookup anyway,
  // so writing a valid one beats refusing and leaving the URL unrecorded.
  it('starts over from an unparseable file rather than refusing to write', () => {
    expect(JSON.parse(withCodeyamEnv('{ not json', URL_ONE))).toEqual({
      env: { DATABASE_URL: URL_ONE },
    });
  });

  // A trailing newline keeps the file well-formed for anything that appends to
  // it and keeps its diffs clean.
  it('ends with a newline', () => {
    expect(withCodeyamEnv('', URL_ONE).endsWith('\n')).toBe(true);
  });
});

describe('portOf', () => {
  // This is what makes a restart reuse the cluster's existing port instead of
  // starting a second server the app is not pointed at.
  it('reads the port back out of a managed URL', () => {
    expect(portOf(localUrl(5433))).toBe(5433);
  });

  // A URL leaning on Postgres's default port declares no port of its own, and
  // guessing 5432 for it would claim a cluster this script never provisioned.
  it('returns null for a URL with no explicit port', () => {
    expect(portOf('postgresql://user@host/db')).toBeNull();
  });

  // Garbage in DATABASE_URL must read as "no port" rather than throw, or the
  // whole provisioning run dies on someone's typo.
  it('returns null for something that is not a URL', () => {
    expect(portOf('not a url')).toBeNull();
  });
});
