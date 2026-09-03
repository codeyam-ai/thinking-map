import { afterEach, describe, expect, it, vi } from 'vitest';
import { CODEYAM_LAUNCH_ENV } from './codeyamOnly';
import {
  VISITOR_COOKIE,
  VISITOR_PARAM,
  mintVisitorId,
  scenarioVisitorId,
  visitorCookieOptions,
} from './visitor';

// The pure half of the visitor identity: what the cookie looks like, what a
// fresh id looks like, and when a URL is allowed to stand in for a cookie.
// `readVisitorId` and `resolveVisitorId` are not here — they call `cookies()`
// from `next/headers`, which only exists inside a request, and their behaviour
// is covered end-to-end by the saved-map scenarios.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('visitorCookieOptions', () => {
  // The reason the cookie exists at all is to say which browser owns a map, so
  // nothing in the page may read it. httpOnly is what makes that structural
  // rather than a convention nobody enforces.
  it('is httpOnly so no client code can read it', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(visitorCookieOptions().httpOnly).toBe(true);
  });

  // Lax, not Strict: the saved-map list is reached by following an ordinary
  // link, and Strict would drop the cookie on exactly that navigation — the
  // returning visitor would land on the day-one screen holding a valid cookie.
  it('is SameSite lax so following a link still carries it', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(visitorCookieOptions().sameSite).toBe('lax');
  });

  // Deployed, the cookie must not travel in clear text.
  it('is secure in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(visitorCookieOptions().secure).toBe(true);
  });

  // But NOT secure in development, or http://localhost would never receive it
  // and the whole feature would look broken on the machine it is built on.
  it('is not secure in development so http localhost still works', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(visitorCookieOptions().secure).toBe(false);
  });

  // Scoped to the whole site and long-lived. A path-scoped cookie would be
  // missing on `/map/<id>`, where the Boards menu reads the same list, and a
  // session cookie would make "pick up where you left off" mean "until you
  // close the tab".
  it('is site-wide and long-lived', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const options = visitorCookieOptions();
    expect(options.path).toBe('/');
    expect(options.maxAge).toBeGreaterThan(60 * 60 * 24 * 30);
  });
});

describe('mintVisitorId', () => {
  // Two browsers must never be handed the same id, or each would see the
  // other's maps — the bug this feature exists to remove, reintroduced.
  it('gives a different id every time', () => {
    expect(mintVisitorId()).not.toBe(mintVisitorId());
  });

  // Opaque and non-empty. An empty string would read as "no cookie" everywhere
  // downstream, since every caller treats absence as no maps.
  it('gives a non-empty opaque string', () => {
    const id = mintVisitorId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });
});

describe('scenarioVisitorId', () => {
  // The floor, and the case that matters most: no query string may name a
  // visitor on a deployed build. This is the one that keeps the seam from
  // being a way to read a stranger's list by guessing.
  it('is null in production even when the param is present', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(scenarioVisitorId({ [VISITOR_PARAM]: 'demo-returning' })).toBeNull();
  });

  // Off on a server a person started themselves, exactly like the agent panel's
  // gate. A dev build is not enough; the editor has to have launched it.
  it('is null on a dev server started by hand', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, undefined);
    expect(scenarioVisitorId({ [VISITOR_PARAM]: 'demo-returning' })).toBeNull();
  });

  // The case the seam exists for: a codeyam capture browser has no way to be
  // handed a cookie before it navigates, so the scenario URL names the visitor.
  it('reads the param on a codeyam-launched server', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(scenarioVisitorId({ [VISITOR_PARAM]: 'demo-returning' })).toBe(
      'demo-returning',
    );
  });

  // A landing page with no query string at all — the day-one scenario. Absence
  // must mean nobody, never everybody.
  it('is null when no param is present', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(scenarioVisitorId({})).toBeNull();
    expect(scenarioVisitorId(undefined)).toBeNull();
  });

  // A bare `?visitor` with no value arrives as an empty string. Returning it
  // would hand `listMaps` an empty-string owner, which matches no row and is a
  // confusing way to spell "nobody" — null is the honest answer.
  it('is null for a valueless param', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(scenarioVisitorId({ [VISITOR_PARAM]: '' })).toBeNull();
  });

  // A repeated param arrives as an array, the same shape `agentPanelRequested`
  // handles. Reading the first entry keeps a doubled param working.
  it('reads the first entry when the param is repeated', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(
      scenarioVisitorId({ [VISITOR_PARAM]: ['demo-a', 'demo-b'] }),
    ).toBe('demo-a');
  });

  // Other query params are none of its business — a map URL carrying a filter
  // or an agent-panel opt-in must not be read as naming a visitor.
  it('ignores unrelated query params', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(scenarioVisitorId({ agentPanel: '1', s: 'Default' })).toBeNull();
  });
});

describe('VISITOR_COOKIE', () => {
  // The name is part of the contract between the route that writes the cookie
  // and the pages that read it, so it is exported rather than typed twice.
  it('is a stable non-empty cookie name', () => {
    expect(VISITOR_COOKIE).toBe('tm_visitor');
  });
});
