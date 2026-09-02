import { afterEach, describe, expect, it, vi } from 'vitest';
import { CODEYAM_LAUNCH_ENV, codeyamLaunched, devSurfacesPermitted } from './codeyamOnly';

// The gate that decides whether a codeyam-only route appears at all. Every case
// here is a way the old `NODE_ENV`-only check said yes when it should have said
// no, or a way an over-corrected gate would say no when it must say yes.

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('codeyamLaunched', () => {
  // The regression this pins. The gate used to be NODE_ENV alone, so every
  // ordinary `npm run dev` served the whole fixture surface — 104 pages
  // rendering invented maps that look exactly like a person's real ones. A
  // hand-started server has no CODEYAM_APP_PORT, so this is the case the old
  // gate got wrong and the only one that distinguishes the two callers.
  it('is false on a dev server a person started by hand', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, undefined);
    expect(codeyamLaunched()).toBe(false);
  });

  // The editor's own server, which must keep working. A gate that refused
  // everything would pass the case above and break all 344 captures, so this
  // is here to stop the over-correction rather than to describe new behaviour.
  it('is true on a server the editor launched', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(codeyamLaunched()).toBe(true);
  });

  // The floor, which no environment variable can lift.
  it('is false in production however the server was launched', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '3001');
    expect(codeyamLaunched()).toBe(false);
  });

  // An empty string counts as absent, matching the producing side: the editor's
  // env_builder reads its ports as `X || fallback`, which treats '' as missing.
  // Treating it as present here would put this predicate at odds with the thing
  // it reads. This is also the shape `vi.stubEnv` produces for `undefined`.
  it('is false when the variable is set but empty', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, '');
    expect(codeyamLaunched()).toBe(false);
  });

  // Presence is the signal, not the value. The predicate must not start
  // parsing the port — the editor is free to change what it injects there, and
  // a gate that only accepted digits would silently close if it ever did.
  it('is true for a non-numeric value', () => {
    vi.stubEnv('NODE_ENV', 'development');
    vi.stubEnv(CODEYAM_LAUNCH_ENV, 'anything');
    expect(codeyamLaunched()).toBe(true);
  });
});

describe('devSurfacesPermitted', () => {
  // The ordinary dev case: the floor is open, and whatever sits above it
  // decides. This is the only state in which any dev-only surface can appear.
  it('is true in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    expect(devSurfacesPermitted()).toBe(true);
  });

  // The whole reason the floor is shared rather than written per-surface: one
  // place to be wrong, and it is not wrong here.
  it('is false in production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(devSurfacesPermitted()).toBe(false);
  });

  // Anything that is not production is permitted, rather than an allowlist of
  // known environment names — a new NODE_ENV value must not silently close a
  // developer's own surfaces.
  it('is true under test', () => {
    vi.stubEnv('NODE_ENV', 'test');
    expect(devSurfacesPermitted()).toBe(true);
  });
});
