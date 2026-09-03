// The whole browser-eval dance, as one command.
//
// ---------------------------------------------------------------------------
// Why this is a script and not a line in package.json
// ---------------------------------------------------------------------------
//
// A browser eval needs four things that the local suite does not: a database
// nobody minds losing, a map seeded inside it, a dev server pointed at that
// database, and a real Chrome. The first three have to be created before the
// run and destroyed after it — including when the run fails, which is exactly
// when a shell one-liner stops cleaning up. A `&&` chain cannot express "drop
// the schema and kill the server whatever happened", so this does.
//
// ---------------------------------------------------------------------------
// It cannot touch your development data
// ---------------------------------------------------------------------------
//
// `DATABASE_URL` is not used as given. Its `?schema=` parameter is REPLACED
// with a freshly minted name, so the tables this run creates, the map it seeds
// and the writes the agent makes all land in a schema that did not exist a
// moment ago and will not exist a moment later. That is the same unit of
// isolation the integration tests use (see `app/lib/testDatabase.ts`), and it
// is why pointing this at your ordinary development database is safe. The
// cluster is shared; nothing else is.
//
// ---------------------------------------------------------------------------
// What it does NOT provide
// ---------------------------------------------------------------------------
//
// A Chrome and a model API key. `webmcp-evals browser` drives a real browser
// through `puppeteer-core`'s `channel` option, which resolves a Chrome that is
// already INSTALLED on the machine — the Playwright Chromium this repo's
// postinstall fetches is a different browser and does not satisfy it. WebMCP
// also rides behind `--enable-features=WebMCP`, so the channel has to be one
// that ships it. See `evals/README.md`, "Browser mode".
//
// Run with: npm run evals:browser -- --model anthropic:claude-haiku-4-5-20251001

import '../app/lib/loadEnv';

import { execFileSync, spawn, type ChildProcess } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { requireDatabaseUrl } from '../app/lib/databaseUrl';
import { schemaUrl } from '../app/lib/testDatabase';
import { dropSchema, pushSchema } from '../app/lib/schemaLifecycle';
import { freePort } from '../app/lib/freePort';
import { browserEvalArgs, evalSchemaName } from '../app/lib/browserEvalRun';

/** The suite this runner exists to run. */
const SUITE = 'evals/suites/standing-wait.json';

/**
 * Where the eval run's Next build goes.
 *
 * Never `.next`: a `npm run dev` the developer already had open is using that,
 * and two dev servers writing one build directory produce failures that look
 * like application bugs. See the `distDir` note in `next.config.ts`.
 */
const DIST_DIR = '.next-evals';

/** How long to wait for the dev server to answer before giving up, in ms. */
const SERVER_READY_TIMEOUT_MS = 120_000;

/** Seed the disposable map and return its id. */
function seedMap(url: string): string {
  const out = execFileSync('npx', ['tsx', 'scripts/seed-eval-map.ts'], {
    env: { ...process.env, DATABASE_URL: url },
    // stdout is captured (it carries the id and nothing else); stderr is
    // inherited so the seeder's progress line reaches the person watching.
    stdio: ['ignore', 'pipe', 'inherit'],
  });
  const id = out.toString().trim();
  if (!id) throw new Error('scripts/seed-eval-map.ts printed no map id');
  return id;
}

/**
 * Start `next dev` against the throwaway schema and wait for it to serve
 * `readyPath`.
 *
 * The path is the eval's own map URL rather than `/` on purpose. Next compiles
 * a route the first time it is asked for, so probing `/` would report ready and
 * then hand the browser a page that still has several seconds of compilation in
 * front of it — during which `bindTools` has not run and the CLI sees zero
 * registered tools.
 */
async function startDevServer(
  url: string,
  port: number,
  readyPath: string,
): Promise<ChildProcess> {
  const server = spawn(
    path.join('node_modules', '.bin', 'next'),
    ['dev', '--webpack', '-H', '127.0.0.1', '-p', String(port)],
    {
      env: {
        ...process.env,
        DATABASE_URL: url,
        NEXT_DIST_DIR: DIST_DIR,
        // `npm run dev` chains `db:ensure` first; this does not, because the
        // schema is already pushed by the time we get here and `db:ensure`
        // would only re-check the cluster.
      },
      stdio: ['ignore', 'inherit', 'inherit'],
      // Its OWN process group, so `stopDevServer` can signal the whole tree.
      // Next spawns children, and a signal sent to this pid alone leaves them
      // running: the observed symptom was a dev server still serving the
      // throwaway port long after the run had finished and its schema had been
      // dropped. Invoking the binary directly rather than through `npx` removes
      // one more layer that would have to forward the signal.
      detached: true,
    },
  );

  const deadline = Date.now() + SERVER_READY_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`next dev exited with code ${server.exitCode} before serving`);
    }
    try {
      const res = await fetch(`http://127.0.0.1:${port}${readyPath}`);
      // 200 specifically: anything else means the map did not render, and
      // handing that page to the CLI produces "0 tools registered" — an error
      // that points at WebMCP when the real fault was the seed or the schema.
      if (res.status === 200) return server;
    } catch {
      // Not listening yet.
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  // Stop it HERE rather than leaving it to the caller's `finally`: this throw
  // means `startDevServer` never returned, so `main` holds no handle to the
  // process and its cleanup cannot reach it.
  await stopDevServer(server);
  throw new Error(
    `dev server did not answer on 127.0.0.1:${port}${readyPath} within ${SERVER_READY_TIMEOUT_MS}ms`,
  );
}

/**
 * Stop the dev server and wait for the process to be gone.
 *
 * `kill()` only asks. Next takes a moment to shut down, and everything this
 * script does afterwards — dropping the schema it is connected to, deleting the
 * build directory it is watching — is only safe once it has actually exited.
 * SIGKILL is the backstop for a server that will not go quietly, so cleanup can
 * never be the thing that hangs.
 */
async function stopDevServer(server: ChildProcess | undefined): Promise<void> {
  if (!server || server.pid === undefined || server.exitCode !== null) return;

  // Negative pid = the whole process group, which is why the server is spawned
  // `detached`. Next runs its work in child processes, and signalling only the
  // pid we hold leaves those children serving the port after this script has
  // exited.
  const signalGroup = (signal: NodeJS.Signals) => {
    try {
      process.kill(-server.pid!, signal);
    } catch {
      // Already gone, which is the outcome we wanted anyway.
    }
  };

  const exited = new Promise<void>((resolve) => server.once('exit', () => resolve()));
  signalGroup('SIGTERM');

  const gaveUp = Symbol('timeout');
  const raced = await Promise.race([
    exited,
    new Promise<typeof gaveUp>((r) => setTimeout(() => r(gaveUp), 10_000)),
  ]);
  if (raced === gaveUp) {
    signalGroup('SIGKILL');
    await exited;
  }
}

async function main(): Promise<number> {
  const base = requireDatabaseUrl();
  const schema = evalSchemaName();
  const url = schemaUrl(base, schema);

  // Everything after `--` on the npm command line reaches here, so `--model`,
  // `--runs`, `--chrome-channel` and the reporters are the caller's to choose,
  // exactly as they are for the local suite.
  const forwarded = process.argv.slice(2);

  let server: ChildProcess | undefined;
  try {
    console.error(`Building tables in throwaway schema ${schema}…`);
    pushSchema(url);

    const mapId = seedMap(url);

    const port = await freePort('eval server');
    console.error(`Starting dev server on 127.0.0.1:${port}…`);
    server = await startDevServer(url, port, `/map/${mapId}`);

    // 127.0.0.1 rather than `localhost`: the server is bound to the literal
    // address, and on a host where the two resolve differently `localhost`
    // would reach nothing.
    const target = `http://127.0.0.1:${port}/map/${mapId}`;
    console.error(`Running ${SUITE} against ${target}`);

    const result = spawn('npx', browserEvalArgs(target, SUITE, forwarded), {
      stdio: 'inherit',
    });
    return await new Promise<number>((resolve) => {
      result.on('close', (code) => resolve(code ?? 1));
    });
  } finally {
    // ORDER MATTERS, and the first version of this got it wrong. Removing the
    // build directory while the server is still alive makes Next log "The
    // directory ... was deleted" and RESTART ITSELF — which both leaks a dev
    // server that outlives this script and re-creates the directory that was
    // just removed. So: stop the server, wait for it to actually be gone, and
    // only then take its build directory away.
    await stopDevServer(server);
    await dropSchema(base, schema);
    rmSync(path.resolve(process.cwd(), DIST_DIR), { recursive: true, force: true });
    console.error(`Dropped schema ${schema}.`);
  }
}

main()
  .then((code) => process.exit(code))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
