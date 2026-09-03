import { describe, expect, it } from 'vitest';
import { mergeBriefs } from './briefMerge';
import { splitIntoSections } from './briefSections';
import type { FetchedBrief } from './briefFetch';

function page(sourceName: string, text: string): FetchedBrief {
  return { text, sourceName, mediaType: 'text/html', warning: null };
}

// The card takes as many links as you point it at, but a board is allowed
// exactly one brief. These pin the fold: what several pages become on the way
// out, and — the case that matters most — that one page is left completely
// alone, because every existing map's section ids depend on that.
describe('mergeBriefs', () => {
  // "Nothing attached" has to stay ONE case for the caller. Returning an empty
  // document instead would make the POST body carry a brief made of nothing.
  it('returns undefined when nothing was attached', () => {
    expect(mergeBriefs([])).toBeUndefined();
  });

  // The most common map there is. A heading added here would shift every
  // section id on it, so the single page must come back byte-identical.
  it('passes a single page through verbatim', () => {
    const only = page('example.gov/spec', '## Background\n\nForty-one thousand.');

    expect(mergeBriefs([only])).toEqual({
      text: '## Background\n\nForty-one thousand.',
      sourceName: 'example.gov/spec',
      mediaType: 'text/html',
    });
  });

  // Each page arrives under its own name, in the order it was added — the
  // order is the person's, so it has to survive the merge unreordered.
  it('joins several pages under their own headings, in order', () => {
    const merged = mergeBriefs([
      page('example.gov/spec', 'The spec.'),
      page('competitor.example/pricing', 'Their pricing.'),
    ]);

    expect(merged?.text).toBe(
      '# example.gov/spec\n\nThe spec.\n\n# competitor.example/pricing\n\nTheir pricing.',
    );
  });

  // A document made of three pages is not the first page, and saying so would
  // be a lie the readout repeats. It is also markdown now, whatever the pages
  // were made of, because the headings this added are markdown.
  it('names the merged document by its count and calls it markdown', () => {
    const merged = mergeBriefs([
      page('a.example', 'A.'),
      page('b.example', 'B.'),
      page('c.example', 'C.'),
    ]);

    expect(merged?.sourceName).toBe('3 pages');
    expect(merged?.mediaType).toBe('text/markdown');
  });

  // Untrimmed, a page ending in blank lines would meet the next page's heading
  // with a run of empties — whitespace nobody wrote, carried into a document
  // that is then immutable.
  it('trims each page so the join cannot leave blank runs', () => {
    const merged = mergeBriefs([
      page('a.example', 'A.\n\n\n'),
      page('b.example', '\n  B.'),
    ]);

    expect(merged?.text).toBe('# a.example\n\nA.\n\n# b.example\n\nB.');
  });

  // A name carrying a newline would stop being a heading at all — the splitter
  // matches a WHOLE line — and the page would silently fold into the one above
  // it. Collapsing the whitespace is what keeps the join's promise.
  it('collapses whitespace in a name so it stays one heading line', () => {
    const merged = mergeBriefs([
      page('Annual\nReport   2026', 'A.'),
      page('b.example', 'B.'),
    ]);

    expect(merged?.text).toContain('# Annual Report 2026\n');
  });

  // The join between this module and the splitter, which is the assertion that
  // catches a change to either one breaking the other: the outline an agent
  // reads back IS the list of pages, addressable as s1..sN.
  it('produces a document whose outline is the pages that were attached', () => {
    const merged = mergeBriefs([
      page('example.gov/spec', 'The spec.'),
      page('competitor.example/pricing', 'Their pricing.'),
    ]);
    const sections = splitIntoSections(merged!.text);

    expect(sections.map((s) => s.id)).toEqual(['s1', 's2']);
    expect(sections.map((s) => s.heading)).toEqual([
      'example.gov/spec',
      'competitor.example/pricing',
    ]);
    expect(sections.map((s) => s.text)).toEqual(['The spec.', 'Their pricing.']);
  });

  // A page whose own text already carries headings simply splits finer. That
  // is the splitter working rather than a defect, and it is worth pinning so
  // nobody later "fixes" it by escaping the page's own markdown.
  it('lets a page that carries its own headings split finer', () => {
    const merged = mergeBriefs([
      page('example.gov/spec', '## Background\n\nForty-one thousand.'),
      page('b.example', 'B.'),
    ]);
    const sections = splitIntoSections(merged!.text);

    expect(sections.map((s) => s.heading)).toEqual([
      'example.gov/spec',
      'Background',
      'b.example',
    ]);
  });
});
