import { describe, expect, it } from 'vitest';
import { familyLineVar, nodeShellClasses } from './nodeAppearance';

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

  // The root is the map's subject and has to be the heaviest shape on the
  // page. It carries that with a doubled ink border rather than an ink fill:
  // inverting 240px of card reads as a hole, and would take the eye before the
  // one lime card that is supposed to have it.
  it('gives the root idea the heaviest border on the page', () => {
    const cls = shell({ kind: 'idea', isRoot: true });
    expect(cls).toContain('border-2');
    expect(cls).toContain('border-fam-subject-line');
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
    expect(cls).toContain('border-fam-subject-line');
    expect(cls).not.toContain('border-lime');
    expect(cls).not.toContain('border-dashed');
  });

  // Exactly one thing per screen wears the lime, and it is what just changed —
  // an accent colour must not steal it.
  it('lets "updated" win over an accent kind', () => {
    expect(shell({ kind: 'risk', status: 'updated' })).toContain('border-lime');
  });

  // Pro and risk keep the two colours the design system gave them rather than
  // being flattened into a shared judgment hue — the whole point of the pair
  // is that they point opposite ways.
  it('keeps pro and risk on their own two colours', () => {
    expect(shell({ kind: 'risk' })).toContain('border-risk');
    expect(shell({ kind: 'pro' })).toContain('border-pro');
  });

  // Gaps are the most valuable finding on the map, not a warning — an earlier
  // build wrongly reddened them. They read as questions, which is what a gap
  // is: something nobody has answered.
  it('draws a gap as a question rather than a warning', () => {
    const cls = shell({ kind: 'gap' });
    expect(cls).not.toContain('border-risk');
    expect(cls).toContain('border-fam-question-line');
  });

  // Every kind now carries its family's colour, which is what makes the map
  // legible as categories from across the room.
  it('gives an ordinary kind its family colour and tint', () => {
    const cls = shell({ kind: 'problem' });
    expect(cls).toContain('border-fam-ground-line');
    expect(cls).toContain('bg-fam-ground-fill');
    expect(cls).not.toContain('border-dashed');
  });

  // This is the rule that must not break: kind colour slots in BELOW status,
  // so an unanswered question is dashed and unfilled whatever it is about.
  it('keeps status above kind for every family', () => {
    for (const kind of ['research', 'risk', 'goal', 'slice', 'gap']) {
      const cls = shell({ kind, status: 'open' });
      expect(cls).toContain('border-dashed');
      expect(cls).toContain('bg-transparent');
    }
  });

  // Lime marks the one thing that just changed. No family may take it, or that
  // card stops meaning anything.
  it('never gives a family the lime', () => {
    for (const kind of ['research', 'finding', 'pro', 'risk', 'slice', 'idea']) {
      expect(shell({ kind })).not.toContain('lime');
    }
  });
});

// The paint value, for the SVG thread layer and the icon — the places that
// need a colour rather than a class name.
describe('familyLineVar', () => {
  // A thread up to a risk should be the risk colour, not a family average.
  it('resolves pro and risk to their own colours', () => {
    expect(familyLineVar('risk')).toBe('var(--risk)');
    expect(familyLineVar('pro')).toBe('var(--pro)');
  });

  // Everything else takes its family's line token.
  it('resolves every other kind to its family token', () => {
    expect(familyLineVar('finding')).toBe('var(--fam-found-line)');
    expect(familyLineVar('goal')).toBe('var(--fam-ground-line)');
    expect(familyLineVar('open-question')).toBe('var(--fam-question-line)');
    expect(familyLineVar('slice')).toBe('var(--fam-forward-line)');
    expect(familyLineVar('idea')).toBe('var(--fam-subject-line)');
  });

  // An unrecognised kind must still get a real colour rather than an undefined
  // one, which would paint the thread black.
  it('gives an unknown kind the neutral family colour', () => {
    expect(familyLineVar('sticky-note')).toBe('var(--fam-ground-line)');
  });
});
