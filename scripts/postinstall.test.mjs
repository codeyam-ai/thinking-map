import { describe, expect, it } from 'vitest';
import { shouldSkipBrowserInstall } from './postinstall.mjs';

// The decision this script exists to make. Getting it wrong is expensive in one
// direction and invisible in the other: install on Vercel and every production
// build downloads a ~150MB browser it never loads; skip locally and scenario
// capture stops working with no obvious cause.

describe('shouldSkipBrowserInstall', () => {
  // The default must stay "install", or a fresh clone loses scenario capture
  // with no error to explain why.
  it('installs on a developer machine', () => {
    expect(shouldSkipBrowserInstall({})).toBeNull();
  });

  // The reason this script exists: a ~150MB browser download on every
  // production build, for a devDependency the deployed app never imports.
  it('skips on Vercel, where the browser is never loaded', () => {
    expect(shouldSkipBrowserInstall({ VERCEL: '1' })).toBe('VERCEL');
  });

  // Not Vercel-specific: any CI installing dependencies to run the test suite
  // has the same reason to skip, and the suite needs no browser.
  it('skips on CI generally', () => {
    expect(shouldSkipBrowserInstall({ CI: 'true' })).toBe('CI');
  });

  // Vercel sets both. The reported reason should be the specific one, since it
  // is the only explanation a reader gets in the build log.
  it('reports VERCEL rather than CI when both are set', () => {
    expect(shouldSkipBrowserInstall({ VERCEL: '1', CI: '1' })).toBe('VERCEL');
  });

  // An unset variable arrives as an empty string often enough that treating it
  // as truthy would silently disable capture on developer machines.
  it('treats an empty value as not set', () => {
    expect(shouldSkipBrowserInstall({ VERCEL: '', CI: '' })).toBeNull();
  });
});
