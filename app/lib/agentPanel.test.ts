import { describe, expect, it } from 'vitest';
import { agentPanelRequested } from './agentPanel';

// The gate that decides whether a real agent driving this page can find the dev
// panel at all. Every case here is a way the old `NODE_ENV`-only check said yes
// when it should have said no, or a way a sloppier opt-in would do the same.

describe('agentPanelRequested', () => {
  // The reported case, and the default: an ordinary dev session with no opt-in.
  // This is the one that was previously true for every map in development.
  it('is false for a plain map URL in development', () => {
    expect(agentPanelRequested({})).toBe(false);
  });

  // The gesture itself. A person types it; nothing stumbles onto it.
  it('is true when agentPanel=1 is present', () => {
    expect(agentPanelRequested({ agentPanel: '1' })).toBe(true);
  });

  // `=1` exactly, not any truthy string. Someone turning the panel OFF by
  // editing the URL to 0 would be badly served by a truthiness check, which
  // would read "0" as present-and-therefore-on.
  it('is false for agentPanel=0', () => {
    expect(agentPanelRequested({ agentPanel: '0' })).toBe(false);
  });

  // A bare `?agentPanel` with no value. Next hands this over as an empty
  // string, which is not the opt-in.
  it('is false for a valueless agentPanel param', () => {
    expect(agentPanelRequested({ agentPanel: '' })).toBe(false);
  });

  // A repeated param arrives as an array. Reading the first entry keeps a
  // doubled `?agentPanel=1&agentPanel=1` working the way it plainly means,
  // rather than failing a strict string comparison against an array.
  it('reads the first entry when the param is repeated', () => {
    expect(agentPanelRequested({ agentPanel: ['1', '1'] })).toBe(true);
  });

  // Other query params are none of its business — a map opened with a filter or
  // a tracking param on the URL must not accidentally summon the panel.
  it('ignores unrelated query params', () => {
    expect(agentPanelRequested({ tab: 'map', ref: 'agentPanel=1' })).toBe(false);
  });
});
