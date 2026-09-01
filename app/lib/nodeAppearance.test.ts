import { describe, expect, it } from 'vitest';
import { nodeShellClasses } from './nodeAppearance';

// Status drives the treatment — the single most important rule in the design
// system. These assert the rule rather than the exact utility classes, so a
// restyle does not break them but a behaviour change does.
describe('nodeShellClasses', () => {
  const shell = (over: Partial<Parameters<typeof nodeShellClasses>[0]> = {}) =>
    nodeShellClasses({
      kind: 'problem',
      status: 'answered',
      isRoot: false,
      ...over,
    });

  // The root is the map's subject and the only dark shape on the page; losing
  // that fill would leave the map without a visual anchor.
  it('fills the root idea solid, the one dark shape on the page', () => {
    const cls = shell({ kind: 'idea', isRoot: true });
    expect(cls).toContain('bg-ink');
    expect(cls).toContain('text-white');
  });

  // Dashed-and-unfilled is how the map says "nobody has answered this" — the
  // provisional look is the whole point.
  it('draws an unanswered question dashed and unfilled', () => {
    const cls = shell({ kind: 'open-question', status: 'open' });
    expect(cls).toContain('border-dashed');
    expect(cls).toContain('text-muted');
  });

  // Lime marks exactly what just changed, which is what makes a direction
  // change legible at a glance.
  it('gives the just-changed node the lime border', () => {
    expect(shell({ status: 'updated' })).toContain('border-lime');
  });

  // A root that is somehow also "updated" is still the map's subject, so the
  // root treatment has to win.
  it('lets the root treatment win over every other rule', () => {
    const cls = shell({ kind: 'idea', isRoot: true, status: 'updated' });
    expect(cls).toContain('bg-ink');
    expect(cls).not.toContain('border-dashed');
  });

  // Exactly one thing per screen wears the lime, and it is what just changed —
  // an accent colour must not steal it.
  it('lets "updated" win over an accent kind', () => {
    expect(shell({ kind: 'risk', status: 'updated' })).toContain('border-lime');
  });

  // Pro and risk are the only kinds carrying colour; colour used more widely
  // would stop meaning anything.
  it('accents risk and pro nodes, and only those', () => {
    expect(shell({ kind: 'risk' })).toContain('border-risk');
    expect(shell({ kind: 'pro' })).toContain('border-pro');
  });

  // Gaps are the most valuable finding on the map, not a warning — the mockups
  // draw them as plain pills, and an earlier build wrongly reddened them.
  it('leaves a gap node neutral', () => {
    const cls = shell({ kind: 'gap' });
    expect(cls).not.toContain('border-risk');
    expect(cls).toContain('border-ink');
  });

  // A research node is what the partner just went and found, so it carries the
  // lime outline and the magnifier.
  it('marks a research node as a find', () => {
    expect(shell({ kind: 'research' })).toContain('border-lime-deep');
  });

  // Most nodes are ordinary settled facts and must render as plain ink pills.
  it('falls back to the plain answered treatment for an ordinary kind', () => {
    const cls = shell({ kind: 'problem' });
    expect(cls).toContain('border-ink');
    expect(cls).not.toContain('border-dashed');
  });
});
