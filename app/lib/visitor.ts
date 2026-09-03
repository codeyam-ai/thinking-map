import { cookies } from 'next/headers';
import { codeyamLaunched } from './codeyamOnly';

/**
 * Who a browser is, for the purpose of listing its own maps.
 *
 * This is NOT an account and NOT an identity. It is an opaque token a browser
 * earns the moment it creates its first map, so the landing page can show that
 * browser its own work instead of everyone's. Nothing else in the app may read
 * it as identity: there is no profile behind it, no login, and clearing cookies
 * costs the person their saved-map list and nothing else, because every map is
 * still sitting at its own URL.
 *
 * The value lives in an httpOnly cookie rather than in `localStorage` because
 * the landing page is a server component that queries the database before it
 * renders. A browser-held list of ids would force that strip to render on the
 * client and would still leave `GET /api/maps` handing out everything.
 */
export const VISITOR_COOKIE = 'tm_visitor';

/**
 * A year. Long enough that "pick up where you left off" means something a week
 * later, and short enough that an abandoned browser eventually forgets.
 */
const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * How the cookie is written, in one place.
 *
 * `httpOnly` because no client code has any business reading it — it is not a
 * feature flag or a preference. `lax` because the map list is followed from
 * ordinary link navigation and nothing here is a cross-site form post.
 * `secure` only in production so that http://localhost development still works.
 */
export function visitorCookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    maxAge: VISITOR_MAX_AGE_SECONDS,
    path: '/',
  };
}

/** A fresh opaque id. Random, meaningless, and never derived from the request. */
export function mintVisitorId(): string {
  return crypto.randomUUID();
}

/**
 * The current browser's visitor id, or null when it has never made a map.
 *
 * Null is the honest answer for a first arrival and callers must treat it as
 * "no maps", never as "all maps" — that default is the bug this whole thing
 * exists to remove.
 */
export async function readVisitorId(): Promise<string | null> {
  const store = await cookies();
  return store.get(VISITOR_COOKIE)?.value ?? null;
}

/** The query param that stands in for the cookie on a codeyam-launched server. */
export const VISITOR_PARAM = 'visitor';

/**
 * Which visitor a codeyam scenario is being viewed as, or null.
 *
 * A cookie is minted by a POST, and the capture harness has no way to put one in
 * the browser before it navigates. Without a seam, every seeded saved-map
 * scenario would capture as the empty day-one screen and the one state worth
 * showing — two browsers, one database, each seeing only their own — could not be
 * demonstrated at all.
 *
 * So this reuses the seam this app already has for exactly this shape of problem
 * (`agentPanelRequested`, `?agentPanel=1`): a query param behind
 * `codeyamLaunched()`, which is false in a production build AND false on a server
 * a person started themselves, because the editor injects the variable it keys
 * on. It is read per request, so it varies per scenario rather than being fixed
 * for the life of the dev server.
 *
 * The cookie always wins where both are present: a real returning browser is
 * never overridden by a URL.
 */
export function scenarioVisitorId(query: VisitorQuery): string | null {
  if (!codeyamLaunched()) return null;
  const raw = query?.[VISITOR_PARAM];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return typeof value === 'string' && value.length > 0 ? value : null;
}

/** Next's parsed query object: a repeated param arrives as an array. */
export type VisitorQuery =
  | Record<string, string | string[] | undefined>
  | undefined;

/**
 * The visitor whose maps this request should list: the browser's own cookie, or
 * — only on a codeyam-launched server — the one a scenario URL names.
 */
export async function resolveVisitorId(
  query?: VisitorQuery,
): Promise<string | null> {
  return (await readVisitorId()) ?? scenarioVisitorId(query);
}
