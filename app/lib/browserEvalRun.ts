// The two decisions the browser eval run makes before it touches anything.
//
// `scripts/run-browser-evals.ts` is all side effects: it pushes a schema, spawns
// a database seeder, starts a dev server and launches a browser. None of that
// can be asserted without a PostgreSQL and a Chrome. These two functions are the
// parts that can be — the name of the schema it will later DROP, and the exact
// command line it hands the eval CLI — and both are places where a silent
// mistake is expensive: one reaches a `DROP SCHEMA` statement, and the other
// costs a paid model run to discover.
//
// They live here rather than in the script because the script executes `main()`
// at import time, so a test that imported it would start a dev server.

import { randomBytes } from 'node:crypto';

/** The prefix every eval schema carries. */
const SCHEMA_PREFIX = 'eval_standing_wait_';

/**
 * The name of the throwaway PostgreSQL schema for one eval run.
 *
 * Two properties matter, and neither is cosmetic. The **prefix** is what makes a
 * stray schema identifiable as eval debris on a server that may also hold
 * someone's real data — the same argument `uniqueSchemaName` makes for its
 * `test_` prefix. The **charset** matters because this string is interpolated
 * into a `DROP SCHEMA` statement: hex from `randomBytes` cannot contain a quote,
 * so the identifier is safe by construction rather than by sanitising afterwards.
 *
 * @param suffix - injectable so a test can assert the shape without asserting
 *   randomness.
 */
export function evalSchemaName(
  suffix: string = randomBytes(4).toString('hex'),
): string {
  return `${SCHEMA_PREFIX}${suffix}`;
}

/**
 * The argument list for `webmcp-evals browser`.
 *
 * Built here rather than inline in the `spawn` call because a wrong flag is not
 * a crash — `-u` pointing at the wrong page yields "0 tools registered", which
 * reads as a WebMCP failure, and a missing `--backend` silently changes which
 * model driver runs. Both cost a full run to find out.
 *
 * Caller arguments go LAST so that anything the developer passes after `--`
 * overrides the defaults set here; `commander` takes the last occurrence of a
 * repeated option, which is what makes `--backend gemini` on the command line
 * actually win.
 */
export function browserEvalArgs(
  target: string,
  suite: string,
  forwarded: readonly string[] = [],
): string[] {
  return [
    'webmcp-evals',
    'browser',
    '-u',
    target,
    '-e',
    suite,
    '--backend',
    'vercel',
    ...forwarded,
  ];
}
