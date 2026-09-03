// Provisioning the cluster on disk, against a real `initdb`.
//
// The unit tests beside this one cover the file editing — the dotenv and
// stack.local.json rewrites — because that is where a bug costs a developer
// their credentials. This file covers the other half: what `initialiseCluster`
// actually leaves on disk. Three things there are only true if something runs
// initdb for real, and all three are load-bearing:
//
//   - The data directory ends up mode 0700. Postgres refuses to start on a
//     directory that is group- or world-readable, so getting this wrong turns
//     into "the dev server is up and every request 500s", which is exactly the
//     failure this whole script exists to prevent.
//   - The initdb password file is deleted afterwards. It holds a plaintext
//     credential; the cleanup sits in a `finally`, and a `finally` nobody
//     exercises is a comment.
//   - A second call is a no-op. `dev` runs setup on every start, so a cluster
//     that got re-initialised would silently discard the developer's data.
//
// It runs initdb once (a few seconds) into a temp directory that is removed
// afterwards, and never touches the real `.dev-postgres/`.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  chmodSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import {
  initialiseCluster,
  needsPostgresUser,
  postgresIds,
} from './ensureDevDatabase';

let clusterRoot: string;
let dataDir: string;

// initdb is genuinely slow, and it is the point of the file — one run serves
// every assertion below rather than one run per test.
beforeAll(async () => {
  clusterRoot = mkdtempSync(path.join(tmpdir(), 'ensuredevdb-'));
  dataDir = path.join(clusterRoot, 'cluster');

  // The same privilege drop production performs: initdb refuses to run as
  // root, and containers here do. Passing the real ids also means the two
  // conditional `chownSync` calls inside `initialiseCluster` are exercised
  // rather than skipped, which is the half of the function a null would miss.
  //
  // `mkdtempSync` makes the directory 0700 and owned by us, so the postgres
  // account could not traverse into it. The real cluster root is an ordinary
  // 0755 directory under the project; this makes the temp one match.
  chmodSync(clusterRoot, 0o755);

  await initialiseCluster(postgresIds(), dataDir, clusterRoot);
}, 120_000);

afterAll(() => {
  if (clusterRoot) rmSync(clusterRoot, { recursive: true, force: true });
});

describe('initialiseCluster', () => {
  // Shows that a real cluster was written to the directory it was handed,
  // rather than to the module's own default.
  it('creates a cluster in the directory it is given', () => {
    expect(existsSync(path.join(dataDir, 'PG_VERSION'))).toBe(true);
  });

  // The permission Postgres insists on. Asserted on the bits that matter
  // (group and other), so a stricter umask elsewhere cannot make this flap.
  it('leaves the data directory unreadable to group and other', () => {
    const mode = statSync(dataDir).mode & 0o077;
    expect(mode).toBe(0);
  });

  // The `finally` cleanup: a plaintext password must not survive setup.
  it('deletes the initdb password file once the cluster is made', () => {
    expect(existsSync(path.join(clusterRoot, 'initdb-password'))).toBe(false);
  });

  // `dev` runs setup on every start, so this is the guard standing between a
  // container restart and a wiped development database.
  it('keeps an existing cluster instead of rebuilding it', async () => {
    const before = statSync(path.join(dataDir, 'PG_VERSION')).mtimeMs;
    const contents = readdirSync(dataDir).sort();

    await initialiseCluster(postgresIds(), dataDir, clusterRoot);

    expect(statSync(path.join(dataDir, 'PG_VERSION')).mtimeMs).toBe(before);
    expect(readdirSync(dataDir).sort()).toEqual(contents);
  }, 120_000);
});

describe('needsPostgresUser', () => {
  // The privilege check that decides whether the cluster commands have to be
  // dropped to an unprivileged account. Compared against the process's own
  // uid so the test states the rule rather than the environment it ran in.
  it('reports whether this process is running as root', () => {
    expect(needsPostgresUser()).toBe(process.getuid?.() === 0);
  });
});
