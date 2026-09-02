// Whether codeyam launched the server this request is running on.
//
// Some routes in this app exist only to serve codeyam — the component fixtures
// under `/isolated-components/*` are the bulk of them. They used to decide
// whether to appear by asking `NODE_ENV`, which answers "is this a dev build"
// when the question that matters is "did codeyam launch this server". Every
// ordinary `npm run dev` is a dev build too, so that gate served a person their
// own 104 fixture pages — maps that are invented but look exactly like the real
// ones they came to look at.
//
// The discriminator is `CODEYAM_APP_PORT`, and the reason to key on this
// variable rather than declare a new one is that it is injected by the editor's
// own launch path (`build_env_for_proxied_dev_server` in the separate
// codeyam-editor repo, crates/process-manager/src/env_builder.rs) rather than
// by anything in this project. A setting this project declares can drift out of
// sync with what the editor actually does; a variable the editor sets on the way
// to starting the server cannot. And it is absent by construction on a server a
// person started themselves, which is exactly the case being excluded.
//
// This lives beside `agentPanelRequested` in `agentPanel.ts` and carries the
// same production floor, for the same reason: a predicate is testable in
// milliseconds, a route is not.

/** The environment variable codeyam sets on every dev server it launches. */
export const CODEYAM_LAUNCH_ENV = 'CODEYAM_APP_PORT';

/**
 * The floor under every dev-only surface in this app: nothing below it may
 * appear in a production build, whatever else is asked for.
 *
 * It is separate from `codeyamLaunched()` because the two dev-only surfaces
 * need different amounts. The agent panel is summoned per tab by a person on
 * their own server, so it needs only this floor; the component fixtures must
 * additionally know codeyam started the server. Sharing the floor and nothing
 * else keeps the production rule written once without forcing either surface to
 * adopt the other's gate.
 */
export function devSurfacesPermitted(): boolean {
  return process.env.NODE_ENV !== 'production';
}

export function codeyamLaunched(): boolean {
  // The floor, checked first: no environment variable can summon a codeyam-only
  // route into a production build. Everything below narrows an already-permitted
  // case; it never widens a forbidden one.
  if (!devSurfacesPermitted()) return false;

  // An empty string counts as absent. That follows the producing side rather
  // than inventing a rule: the editor's own env_builder reads its ports as
  // `X || fallback`, which treats `""` as missing, so treating it as present
  // here would put this predicate at odds with the thing it is reading.
  const port = process.env[CODEYAM_LAUNCH_ENV];
  return typeof port === 'string' && port !== '';
}
