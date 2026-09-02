// Whether the dev agent panel has been deliberately asked for on this page.
//
// `NODE_ENV !== 'production'` answers "is this a dev build", but the question
// that matters is "can a real agent reach this page" — and every `npm run dev`
// session is a dev build, including the ones where a genuine agent is driving
// the browser. An agent that finds the panel presses the most clickable thing
// on it, and "Run the demo sequence" drives the REAL bound catalog against the
// person's REAL map.
//
// So the panel needs a gesture no agent stumbles onto. `?agentPanel=1` is that:
// a person types it, it survives a reload, it needs no server restart to
// toggle, and it varies per tab rather than per process.
//
// It lives here rather than in the page file for the reason `handoffCopy` does:
// in a route it can only be exercised by loading the route, and this predicate
// carries the production floor — the part most worth a test that runs in
// milliseconds.

import { devSurfacesPermitted } from './codeyamOnly';

/** Next's parsed query object: a repeated param arrives as an array. */
export type QueryParams = Record<string, string | string[] | undefined>;

/** The query param a person adds to summon the panel. */
export const AGENT_PANEL_PARAM = 'agentPanel';

export function agentPanelRequested(query: QueryParams): boolean {
  // The floor, checked first: no query string can summon the panel into a
  // production build. The opt-in narrows an already-permitted case; it never
  // widens a forbidden one.
  //
  // The floor itself now lives in `codeyamOnly.ts` so it is written once across
  // every dev-only surface. Only the floor is shared: this predicate still
  // answers a different question from `codeyamLaunched()` — "did a person ask
  // for this panel in this tab", not "did codeyam start this server" — so the
  // query-param check below stays here.
  if (!devSurfacesPermitted()) return false;

  // A repeated `?agentPanel=1&agentPanel=1` arrives as an array. Reading the
  // first entry rather than rejecting the array keeps a doubled param working
  // the way the person plainly meant, and `=1` exactly — not any truthy value —
  // keeps `?agentPanel=0` off rather than quietly on.
  const flag = query[AGENT_PANEL_PARAM];
  return (Array.isArray(flag) ? flag[0] : flag) === '1';
}
