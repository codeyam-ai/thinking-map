import { describe, expect, it } from 'vitest';
import { deriveTitle } from './mapStore';

const brief = (text: string) => ({
  text,
  sourceName: 'spec.pdf',
  mediaType: 'application/pdf',
});

// The title becomes the root pill on the map, so it has to read like a name.
// Before a brief could be attached this was always a slice of the seed idea;
// paste a twenty-page spec into that and you get an unreadable root node.
describe('deriveTitle', () => {
  // A brief's own first heading is the document's title, and almost always right.
  it('prefers the first markdown heading of a brief', () => {
    expect(
      deriveTitle('anything', brief('# Northgate Renewal\n\n## Background\n\nText.')),
    ).toBe('Northgate Renewal');
  });

  // Any heading level, and any leading blank space before it.
  it('accepts a deeper heading level and leading blank lines', () => {
    expect(deriveTitle('', brief('\n\n### Deep heading\n\nBody.'))).toBe(
      'Deep heading',
    );
  });

  // A brief with no headings still has a first line worth naming it after.
  it('falls back to the first non-empty line of a headless brief', () => {
    expect(deriveTitle('', brief('\n\nRenewal, digitally\nMore text.'))).toBe(
      'Renewal, digitally',
    );
  });

  // A long heading is clipped with an ellipsis so the pill stays readable.
  it('clips a long brief heading to 60 characters', () => {
    const title = deriveTitle('', brief(`# ${'a'.repeat(100)}`));
    expect(title).toHaveLength(58);
    expect(title.endsWith('…')).toBe(true);
  });

  // Without a brief this is the behaviour every existing map was named by,
  // and it must not have changed.
  it('uses the seed idea when there is no brief', () => {
    expect(deriveTitle('  Should the bakery deliver?  ')).toBe(
      'Should the bakery deliver?',
    );
  });

  // The same clipping rule as before, unchanged.
  it('clips a long seed idea to 60 characters', () => {
    const title = deriveTitle('b'.repeat(100));
    expect(title).toHaveLength(58);
    expect(title.endsWith('…')).toBe(true);
  });

  // A short seed idea is left exactly as it is.
  it('leaves a short seed idea untouched', () => {
    expect(deriveTitle('c'.repeat(60))).toBe('c'.repeat(60));
  });

  // A brief with nothing but blank lines cannot name anything, so the seed
  // idea takes over rather than the map being titled an empty string.
  it('falls back to the seed idea when the brief has no usable line', () => {
    expect(deriveTitle('A fallback idea', brief('\n   \n\t\n'))).toBe(
      'A fallback idea',
    );
  });
});
