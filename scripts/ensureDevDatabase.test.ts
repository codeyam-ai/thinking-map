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
  it('adds the key to an empty file', () => {
    expect(upsertEnvLine('', 'DATABASE_URL', URL_ONE)).toBe(
      `DATABASE_URL=${URL_ONE}\n`,
    );
  });

  it('replaces an existing value in place', () => {
    const before = `# comment\nDATABASE_URL=${URL_TWO}\nOTHER=keep\n`;
    expect(upsertEnvLine(before, 'DATABASE_URL', URL_ONE)).toBe(
      `# comment\nDATABASE_URL=${URL_ONE}\nOTHER=keep\n`,
    );
  });

  it('replaces an `export`-prefixed declaration', () => {
    expect(
      upsertEnvLine(`export DATABASE_URL=${URL_TWO}\n`, 'DATABASE_URL', URL_ONE),
    ).toBe(`DATABASE_URL=${URL_ONE}\n`);
  });

  it('leaves every other key and comment untouched', () => {
    const before = '# header\nAPI_KEY=secret\n\n# db\nOTHER_URL=x\n';
    expect(upsertEnvLine(before, 'DATABASE_URL', URL_ONE)).toBe(
      `${before}DATABASE_URL=${URL_ONE}\n`,
    );
  });

  it('does not match a key that merely ends with the same name', () => {
    // `TEST_DATABASE_URL` is a real key in this project's `.env`, and a
    // suffix match would silently repoint the test suite's database.
    const before = `TEST_DATABASE_URL=${URL_TWO}\n`;
    expect(upsertEnvLine(before, 'DATABASE_URL', URL_ONE)).toBe(
      `${before}DATABASE_URL=${URL_ONE}\n`,
    );
  });

  it('adds a newline before the key when the file lacks a trailing one', () => {
    expect(upsertEnvLine('OTHER=1', 'DATABASE_URL', URL_ONE)).toBe(
      `OTHER=1\nDATABASE_URL=${URL_ONE}\n`,
    );
  });
});

describe('envLocalValue', () => {
  it('reads a declared value', () => {
    expect(envLocalValue(`DATABASE_URL=${URL_TWO}\n`, 'DATABASE_URL')).toBe(
      URL_TWO,
    );
  });

  it('strips surrounding quotes', () => {
    expect(envLocalValue(`DATABASE_URL="${URL_TWO}"\n`, 'DATABASE_URL')).toBe(
      URL_TWO,
    );
  });

  it('treats a blank value as absent', () => {
    // Same rule codeyam's own resolver uses: a half-set variable is a
    // half-written config, not an answer.
    expect(envLocalValue('DATABASE_URL=\n', 'DATABASE_URL')).toBeNull();
  });

  it('returns null when the key is not declared', () => {
    expect(envLocalValue('OTHER=1\n', 'DATABASE_URL')).toBeNull();
  });
});

describe('withCodeyamEnv', () => {
  it('creates the env block in an empty file', () => {
    expect(JSON.parse(withCodeyamEnv('', URL_ONE))).toEqual({
      env: { DATABASE_URL: URL_ONE },
    });
  });

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

  it('starts over from an unparseable file rather than refusing to write', () => {
    expect(JSON.parse(withCodeyamEnv('{ not json', URL_ONE))).toEqual({
      env: { DATABASE_URL: URL_ONE },
    });
  });

  it('ends with a newline', () => {
    expect(withCodeyamEnv('', URL_ONE).endsWith('\n')).toBe(true);
  });
});

describe('portOf', () => {
  it('reads the port back out of a managed URL', () => {
    // This is what makes a restart reuse the cluster's existing port instead
    // of starting a second server the app is not pointed at.
    expect(portOf(localUrl(5433))).toBe(5433);
  });

  it('returns null for a URL with no explicit port', () => {
    expect(portOf('postgresql://user@host/db')).toBeNull();
  });

  it('returns null for something that is not a URL', () => {
    expect(portOf('not a url')).toBeNull();
  });
});
