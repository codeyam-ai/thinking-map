// Guarantees that `DATABASE_URL` points at a PostgreSQL server that is
// actually running, before anything tries to use it.
//
// ---------------------------------------------------------------------------
// Why this file exists
// ---------------------------------------------------------------------------
//
// `npm run setup` used to be `npm install && npm run db:push && npm run
// db:seed`, which silently assumed a database already existed. On a fresh
// clone or a fresh codeyam container it does not, so `prisma db push` failed
// with `The datasource.url property is required in your Prisma config file`
// — and because `db:push` chains `prisma generate` AFTER the push, the client
// was never generated either. The result was the worst possible shape of
// broken: `next dev` starts, binds its port, and looks healthy, while every
// request 500s with `Cannot find module '.prisma/client/default'`.
//
// So setup brings its own database, the same way the test suite already does
// (see app/lib/testDatabase.ts). `npm install` is enough; nothing has to be
// installed, hosted, or configured by hand.
//
// ---------------------------------------------------------------------------
// A hosted DATABASE_URL always wins
// ---------------------------------------------------------------------------
//
// If `DATABASE_URL` is set to anything this script did not provision, it is
// left alone and no server is started. Deployments, shared staging databases,
// and a developer who prefers their own Postgres all keep working, and this
// script can never point `db:push` at the wrong database.
//
// ---------------------------------------------------------------------------
// Why not `embedded-postgres` directly
// ---------------------------------------------------------------------------
//
// The package registers an exit hook that stops every cluster it started when
// the parent process exits — correct for tests, fatal here, since the whole
// point is a server that outlives `npm run setup`. So this uses the same
// binaries the package ships (`@embedded-postgres/<platform>`) and starts them
// through `pg_ctl`, which daemonizes. Same engine, different lifetime.

import '../app/lib/loadEnv';

import { execFileSync } from 'node:child_process';
import { createServer } from 'node:net';
import {
  chmodSync,
  chownSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';
import { arch, platform } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Client } from 'pg';

/** Everything this script owns lives here. Gitignored; safe to delete. */
const CLUSTER_ROOT = path.resolve(process.cwd(), '.dev-postgres');
const DATA_DIR = path.join(CLUSTER_ROOT, 'cluster');
const LOG_FILE = path.join(CLUSTER_ROOT, 'postgres.log');
/**
 * The connection string of the cluster this script provisioned, recorded on
 * disk. It is what makes "did I create this database?" answerable: a
 * `DATABASE_URL` matching this file is ours to start and stop, and anything
 * else is somebody's real database.
 */
const URL_FILE = path.join(CLUSTER_ROOT, 'url.txt');

const DATABASE_NAME = 'thinking_map';
const USER = 'postgres';
const PASSWORD = 'postgres';
const PREFERRED_PORT = 5432;

/** The `.env.local` line this script manages, and how to find it again. */
const ENV_FILE = path.resolve(process.cwd(), '.env.local');
const ENV_KEY = 'DATABASE_URL';

/**
 * codeyam's own copy of the same variable.
 *
 * `.codeyam/stack.json` declares the database as `${DATABASE_URL}`, and the
 * editor resolves that reference from the process environment, the `env` block
 * of a gitignored `.codeyam/*.local.json`, and the project's committed `.env`
 * — in that order, and deliberately NOT from `.env.local`. So writing only
 * `.env.local` produces a split brain where the app and the Prisma CLI work
 * while every scenario activation fails with "environment variable
 * `DATABASE_URL` is referenced but not set". This file is the `.local.json`
 * the message points at; it is gitignored, like `.env.local`.
 */
const CODEYAM_ENV_FILE = path.resolve(
  process.cwd(),
  '.codeyam',
  'stack.local.json',
);

type Ids = { uid: number; gid: number };

/**
 * PostgreSQL refuses to run as root, and codeyam's containers run as root.
 * Mirrors the check in app/lib/testDatabase.ts.
 */
export function needsPostgresUser(): boolean {
  return process.getuid?.() === 0;
}

/**
 * Replace (or add) one `KEY=value` line in a dotenv file's text, leaving every
 * other line — comments and unrelated keys alike — byte-for-byte intact.
 *
 * Exported for tests: this edits the one file in the project that holds real
 * credentials, so "does it clobber the other keys?" has to be answerable
 * without provisioning a database first.
 */
export function upsertEnvLine(
  contents: string,
  key: string,
  value: string,
): string {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^[ \\t]*(export[ \\t]+)?${key}[ \\t]*=.*$`, 'm');

  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }

  const separator = contents === '' || contents.endsWith('\n') ? '' : '\n';
  return `${contents}${separator}${line}\n`;
}

/** The connection string for a database on the local managed cluster. */
export function localUrl(port: number, database = DATABASE_NAME): string {
  return `postgresql://${USER}:${PASSWORD}@127.0.0.1:${port}/${database}`;
}

/** The port encoded in a managed URL, so a restart reuses the same one. */
export function portOf(url: string): number | null {
  try {
    const port = Number(new URL(url).port);
    return Number.isInteger(port) && port > 0 ? port : null;
  } catch {
    return null;
  }
}

/**
 * Resolves the shipped `initdb` / `pg_ctl` binaries.
 *
 * `embedded-postgres` keeps the platform lookup in an unexported subpath, so
 * the per-platform package is imported directly — it is a plain dependency of
 * the one already in `devDependencies`, and its module exports the absolute
 * paths of the binaries it ships.
 */
async function binaries(): Promise<{ initdb: string; pgCtl: string }> {
  const pkg = `@embedded-postgres/${platform()}-${arch()}`;

  // Imported lazily, and by name, so a platform with no prebuilt binary fails
  // here with a message naming the missing package — rather than at import
  // time, on a machine that was going to use a hosted database anyway.
  const { initdb, pg_ctl: pgCtl } = (await import(pkg)) as {
    initdb: string;
    pg_ctl: string;
  };

  // npm does not always restore the executable bit (notably when node_modules
  // was unpacked from a cache or a read-only layer). embedded-postgres fixes
  // this up on every run for the same reason.
  for (const binary of [initdb, pgCtl]) chmodSync(binary, 0o755);

  return { initdb, pgCtl };
}

function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, '127.0.0.1', () => {
      server.close(() => resolve(true));
    });
  });
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (address === null || typeof address === 'string') {
        server.close();
        reject(new Error('could not find a free port for the dev database'));
        return;
      }
      const { port } = address;
      server.close(() => resolve(port));
    });
  });
}

/** An unused localhost port, preferring Postgres's own 5432. */
async function choosePort(): Promise<number> {
  if (await isPortFree(PREFERRED_PORT)) return PREFERRED_PORT;
  return freePort();
}

function lookUpPostgresUser(): Ids {
  // stderr is discarded on purpose: "no such user" is the expected answer the
  // first time through, and it is not an error the developer should read.
  const lookUp = (flag: string) =>
    Number(
      execFileSync('id', [flag, USER], {
        encoding: 'utf-8',
        stdio: ['ignore', 'pipe', 'ignore'],
      }).trim(),
    );

  const uid = lookUp('-u');
  const gid = lookUp('-g');
  if (!Number.isInteger(uid) || !Number.isInteger(gid)) {
    throw new Error(`could not resolve the uid/gid of the "${USER}" user`);
  }
  return { uid, gid };
}

/**
 * The uid/gid Postgres should run as, creating the account when this script is
 * root and no `postgres` user exists yet. Returns `null` when we are already
 * unprivileged and can run as ourselves.
 */
function postgresIds(): Ids | null {
  if (!needsPostgresUser()) return null;

  try {
    return lookUpPostgresUser();
  } catch {
    // `groupadd`/`useradd` are what embedded-postgres reaches for in this same
    // case; `-f` keeps a re-run from failing on an existing group.
    execFileSync('groupadd', ['-f', USER], { stdio: 'ignore' });
    execFileSync('useradd', ['-g', USER, USER], { stdio: 'ignore' });
    return lookUpPostgresUser();
  }
}

/** Runs a cluster command as the Postgres account, when there is one. */
function runAsPostgres(file: string, args: string[], ids: Ids | null): void {
  execFileSync(file, args, {
    stdio: 'inherit',
    ...(ids ?? {}),
    env: { ...process.env, LC_MESSAGES: 'C' },
  });
}

/** Creates the cluster on disk. Idempotent: a cluster that exists is kept. */
async function initialiseCluster(ids: Ids | null): Promise<void> {
  if (existsSync(path.join(DATA_DIR, 'PG_VERSION'))) return;

  const { initdb } = await binaries();

  mkdirSync(DATA_DIR, { recursive: true });
  // Postgres refuses to start on a data directory that is group- or
  // world-readable, and insists on owning it itself.
  chmodSync(DATA_DIR, 0o700);
  if (ids) chownSync(DATA_DIR, ids.uid, ids.gid);

  const passwordFile = path.join(CLUSTER_ROOT, 'initdb-password');
  writeFileSync(passwordFile, `${PASSWORD}\n`, { mode: 0o600 });
  if (ids) chownSync(passwordFile, ids.uid, ids.gid);

  try {
    runAsPostgres(
      initdb,
      [
        `--pgdata=${DATA_DIR}`,
        '--auth=password',
        `--username=${USER}`,
        `--pwfile=${passwordFile}`,
        '--lc-messages=C',
      ],
      ids,
    );
  } finally {
    // The password is `postgres` and the cluster only listens on loopback, but
    // a plaintext credential file is still not something to leave behind.
    rmSync(passwordFile, { force: true });
  }
}

/** Whether the cluster is currently accepting connections. */
function isRunning(pgCtl: string, ids: Ids | null): boolean {
  try {
    execFileSync(pgCtl, ['status', '-D', DATA_DIR], {
      stdio: 'ignore',
      ...(ids ?? {}),
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Starts the cluster through `pg_ctl`, which forks a daemon and waits for it
 * to accept connections. Unlike `embedded-postgres`, the server outlives this
 * process — the entire reason this file talks to `pg_ctl` at all.
 */
async function startCluster(port: number, ids: Ids | null): Promise<void> {
  const { pgCtl } = await binaries();

  if (isRunning(pgCtl, ids)) return;

  writeFileSync(LOG_FILE, '');
  if (ids) chownSync(LOG_FILE, ids.uid, ids.gid);

  runAsPostgres(
    pgCtl,
    [
      'start',
      '-D',
      DATA_DIR,
      '-l',
      LOG_FILE,
      '-o',
      `-p ${port} -c listen_addresses=127.0.0.1`,
      '-w',
    ],
    ids,
  );
}

/**
 * Creates the named databases the cluster does not have yet.
 *
 * The second one is codeyam's. Scenarios seed and render against a *capture*
 * database — the declared database name plus `_codeyam_capture` — so that
 * capturing a scenario can never wipe the database being developed against.
 * codeyam creates it itself when `psql` is on PATH, which in a container using
 * the `embedded-postgres` binaries it is not; the failure surfaces much later,
 * as a scenario that will not activate. Creating it here costs one statement.
 */
async function ensureDatabases(port: number, names: string[]): Promise<void> {
  const client = new Client({ connectionString: localUrl(port, 'postgres') });
  await client.connect();
  try {
    for (const name of names) {
      const { rowCount } = await client.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [name],
      );
      // `CREATE DATABASE` takes no bind parameters, hence the interpolation.
      // The names are this file's own constants, never input.
      if (rowCount === 0) await client.query(`CREATE DATABASE "${name}"`);
    }
  } finally {
    await client.end();
  }
}

/**
 * The value `.env.local` declares for a key, if it declares one.
 *
 * Used to tell a developer's own `.env.local` entry apart from a real
 * environment export: the first is a local dev credential that codeyam should
 * be handed too, the second is CI or a deployment, whose secrets this script
 * has no business writing to disk.
 */
export function envLocalValue(contents: string, key: string): string | null {
  const match = contents.match(
    new RegExp(`^[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=[ \\t]*(.*)$`, 'm'),
  );
  if (!match) return null;

  const raw = match[1].trim().replace(/^(['"])(.*)\1$/, '$2');
  return raw === '' ? null : raw;
}

/**
 * Loads the app's schema into codeyam's capture database.
 *
 * codeyam only ever runs the declared `schemaLoadCommand` in the instant after
 * it creates the capture database itself — and it can only create it when
 * `psql` is on PATH, which it is not when Postgres comes from the
 * `embedded-postgres` binaries. Since this script creates that database, this
 * script owes it a schema; without one, every scenario fails to activate with
 * `relation "ThinkingMap" does not exist`.
 *
 * Run on every invocation rather than only after a create, so a schema change
 * reaches the scenarios too. `db push` against an already-matching database is
 * a no-op that costs a fraction of a second.
 *
 * Never fatal: a capture database is codeyam's, and a developer running
 * `npm run dev` should not be blocked from starting the app by it.
 */
function loadCaptureSchema(port: number): void {
  for (const name of captureDatabases()) {
    try {
      // `--url` rather than an env override: it is the flag `db push` documents
      // for pointing at another database, and it leaves `prisma.config.ts`
      // resolving `DATABASE_URL` the one way it does everywhere else. No
      // `--accept-data-loss` — a destructive push should stop and be read, not
      // be waved through against a database whose contents nobody inspected.
      execFileSync('npx', ['prisma', 'db', 'push', '--url', localUrl(port, name)], {
        stdio: ['ignore', 'ignore', 'pipe'],
      });
    } catch (error) {
      console.warn(
        `db:ensure: could not load the schema into codeyam's capture database ` +
          `("${name}"). Scenario activation may fail until it is loaded.`,
      );
      console.warn(error);
    }
  }
}

/** Records the managed URL in `.env.local` so every reader agrees on it. */
function writeEnvLocal(url: string): void {
  const header =
    '# Real credentials for local development. Gitignored (`.env*.local`).\n' +
    '# The DATABASE_URL below points at the local PostgreSQL cluster that\n' +
    '# `npm run db:ensure` provisions under .dev-postgres/. Replace it with a\n' +
    '# hosted connection string and that cluster is left alone entirely.\n';

  const existing = existsSync(ENV_FILE)
    ? readFileSync(ENV_FILE, 'utf-8')
    : header;
  writeFileSync(ENV_FILE, upsertEnvLine(existing, ENV_KEY, url));
}

/**
 * Merge the managed URL into `.codeyam/stack.local.json`'s `env` block,
 * preserving whatever else that per-developer file already holds.
 *
 * Exported for tests, and for the same reason as `upsertEnvLine`: it edits a
 * file a developer may have put their own overrides in.
 */
export function withCodeyamEnv(contents: string, url: string): string {
  // A missing, empty, or unparseable file contributes nothing to codeyam's own
  // lookup, so it is safe to start from `{}` rather than refuse to write.
  let config: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(contents);
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      config = parsed as Record<string, unknown>;
    }
  } catch {
    // Fall through to `{}`.
  }

  const existing = config.env;
  const env =
    existing !== null && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};

  return `${JSON.stringify(
    { ...config, env: { ...env, [ENV_KEY]: url } },
    null,
    2,
  )}\n`;
}

/**
 * codeyam's capture database, when this is a codeyam project — and nothing
 * otherwise, so a plain clone gets exactly one database.
 */
function captureDatabases(): string[] {
  return existsSync(path.dirname(CODEYAM_ENV_FILE))
    ? [`${DATABASE_NAME}_codeyam_capture`]
    : [];
}

/** Gives codeyam the same URL the app got, when this is a codeyam project. */
function writeCodeyamEnv(url: string): void {
  if (!existsSync(path.dirname(CODEYAM_ENV_FILE))) return;

  const existing = existsSync(CODEYAM_ENV_FILE)
    ? readFileSync(CODEYAM_ENV_FILE, 'utf-8')
    : '';
  writeFileSync(CODEYAM_ENV_FILE, withCodeyamEnv(existing, url));
}

/** The managed URL from a previous run, if this script provisioned one. */
function provisionedUrl(): string | null {
  if (!existsSync(URL_FILE)) return null;
  const recorded = readFileSync(URL_FILE, 'utf-8').trim();
  return recorded === '' ? null : recorded;
}

async function main(): Promise<void> {
  const configured = process.env[ENV_KEY]?.trim();
  const managed = provisionedUrl();

  // Someone else's database — a hosted one, or a system Postgres. Never touch
  // it, and never start a competing server beside it.
  if (configured && configured !== managed) {
    // One thing is still worth doing: a URL the developer typed into
    // `.env.local` is invisible to codeyam, which does not read that file, so
    // mirror it across. A URL that arrived as a real environment export (CI, a
    // deployment) is left exactly where it is — writing those to disk is not
    // this script's business.
    const fromEnvLocal =
      existsSync(ENV_FILE) &&
      envLocalValue(readFileSync(ENV_FILE, 'utf-8'), ENV_KEY) === configured;

    if (fromEnvLocal) writeCodeyamEnv(configured);

    console.log('db:ensure: DATABASE_URL is already set; using it as-is.');
    return;
  }

  mkdirSync(CLUSTER_ROOT, { recursive: true });

  const ids = postgresIds();
  await initialiseCluster(ids);

  // A cluster that already exists keeps its port: the recorded URL is what
  // `.env.local` and any running dev server are already pointing at.
  const port = (managed && portOf(managed)) || (await choosePort());

  await startCluster(port, ids);
  await ensureDatabases(port, [DATABASE_NAME, ...captureDatabases()]);
  loadCaptureSchema(port);

  const url = localUrl(port);
  writeFileSync(URL_FILE, `${url}\n`);
  writeEnvLocal(url);
  writeCodeyamEnv(url);
  process.env[ENV_KEY] = url;

  console.log(
    `db:ensure: local PostgreSQL ready on port ${port}; ` +
      'DATABASE_URL written to .env.local and .codeyam/stack.local.json.',
  );
}

// Only provision when run as a script. Without this guard, importing the
// module to test the pure helpers above would start a PostgreSQL server and
// rewrite `.env.local` as a side effect — the same guard, for the same reason,
// as scripts/postinstall.mjs.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    console.error(
      'db:ensure: could not provision a local PostgreSQL server.\n' +
        'Set DATABASE_URL in .env.local to a database you control and re-run — ' +
        'see DATABASE.md, "Where Credentials Go".',
    );
    console.error(error);
    process.exitCode = 1;
  });
}
