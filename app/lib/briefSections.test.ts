import { describe, expect, it } from 'vitest';
import { splitIntoSections } from './briefSections';

const HEADED = [
  '# Northgate Library — Digital Membership Renewal',
  '',
  '## Background',
  '',
  'The district serves 41,000 cardholders across six branches.',
  '',
  '## Residency verification',
  '',
  'This is the part we are least sure about.',
].join('\n');

// Section ids are the addresses an agent pulls passages by, and they are
// derived from the text rather than stored. That only works if the same
// document always yields the same ids — which is what most of these pin.
describe('splitIntoSections', () => {
  // A brief with markdown headings splits on them, one section per heading.
  it('splits a headed document on its headings', () => {
    const sections = splitIntoSections(HEADED);
    expect(sections.map((s) => s.heading)).toEqual([
      'Northgate Library — Digital Membership Renewal',
      'Background',
      'Residency verification',
    ]);
  });

  // Ids are sequential from s1 and carry the matching index.
  it('numbers sections from s1 in document order', () => {
    const sections = splitIntoSections(HEADED);
    expect(sections.map((s) => s.id)).toEqual(['s1', 's2', 's3']);
    expect(sections.map((s) => s.index)).toEqual([1, 2, 3]);
  });

  // The whole design rests on this: no table, so the ids must be reproducible.
  it('produces identical ids and text on a repeated run', () => {
    expect(splitIntoSections(HEADED)).toEqual(splitIntoSections(HEADED));
  });

  // charCount describes the section body, so the outline can be trusted
  // without reading any passage.
  it('reports each section body length', () => {
    const [, background] = splitIntoSections(HEADED);
    expect(background.text).toBe(
      'The district serves 41,000 cardholders across six branches.',
    );
    expect(background.charCount).toBe(background.text.length);
  });

  // A heading with nothing under it is still part of the document's shape —
  // a section the client left empty is worth an agent seeing.
  it('keeps a heading that has no body under it', () => {
    const sections = splitIntoSections('# Title\n\n## Risks\n\n## Budget\n\nTwo lines.');
    expect(sections.map((s) => s.heading)).toEqual(['Title', 'Risks', 'Budget']);
    expect(sections[1].charCount).toBe(0);
  });

  // Prose before the first heading is usually the summary, and must not vanish.
  it('keeps the text that appears before the first heading', () => {
    const sections = splitIntoSections('An opening paragraph.\n\n## Later\n\nMore.');
    expect(sections).toHaveLength(2);
    expect(sections[0].text).toBe('An opening paragraph.');
  });

  // A plain-prose brief has no headings at all; it must still come back as a
  // readable handful of passages rather than one enormous block.
  it('groups paragraphs when the document has no headings', () => {
    const paragraph = `${'word '.repeat(200).trim()}.`;
    const sections = splitIntoSections(
      [paragraph, paragraph, paragraph].join('\n\n'),
    );
    expect(sections.length).toBeGreaterThan(1);
    expect(sections.map((s) => s.id)).toEqual(
      sections.map((_, i) => `s${i + 1}`),
    );
  });

  // A headingless section still needs something to recognise it by, so the
  // opening words stand in for a heading.
  it('names a headingless section after its opening words', () => {
    const [only] = splitIntoSections('Renewal is done in person at a desk.');
    expect(only.heading).toBe('Renewal is done in person at a desk.');
  });

  // One long paragraph is left whole rather than cut mid-sentence.
  it('does not split a single oversized paragraph', () => {
    const sections = splitIntoSections('x'.repeat(6000));
    expect(sections).toHaveLength(1);
    expect(sections[0].charCount).toBe(6000);
  });

  // "No sections" and "one empty section" are different facts, and an agent
  // should be told the first one plainly.
  it('returns no sections for an empty document', () => {
    expect(splitIntoSections('')).toEqual([]);
    expect(splitIntoSections('   \n\n  ')).toEqual([]);
  });
});
