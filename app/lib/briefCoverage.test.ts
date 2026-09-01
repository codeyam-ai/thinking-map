import { describe, expect, it } from 'vitest';
import { computeBriefCoverage, type CoverageNode } from './briefCoverage';
import type { BriefSection } from './briefSections';

const section = (
  id: string,
  heading: string,
  charCount: number,
): BriefSection => ({
  id,
  index: Number(id.replace(/^s/, '')),
  heading,
  charCount,
  text: 'x'.repeat(charCount),
});

const SECTIONS: BriefSection[] = [
  section('s1', 'Background', 400),
  section('s2', 'Who this is for', 300),
  section('s3', 'Out of scope', 100),
];

const node = (id: string, sourceRef?: string | null): CoverageNode => ({
  id,
  kind: 'problem',
  label: `node ${id}`,
  sourceRef,
});

// Coverage is the one number in this product an agent cannot assert — it can
// only produce nodes that cite a section. These pin that property: every count
// here comes from the nodes, never from anything a caller claims.
describe('computeBriefCoverage', () => {
  // The base case: each section reports how many nodes cite it, and the list
  // stays in document order so the panel can render it without re-sorting.
  it('counts the nodes citing each section, in document order', () => {
    const coverage = computeBriefCoverage(SECTIONS, [
      node('a', 's1'),
      node('b', 's1'),
      node('c', 's2'),
    ]);

    expect(coverage.sections.map((s) => [s.id, s.nodeCount])).toEqual([
      ['s1', 2],
      ['s2', 1],
      ['s3', 0],
    ]);
    expect(coverage.covered).toBe(2);
    expect(coverage.total).toBe(3);
  });

  // The untouched half is the valuable one, so it is a first-class output
  // rather than something every caller has to filter for itself.
  it('reports untouched sections and how much document they are', () => {
    const coverage = computeBriefCoverage(SECTIONS, [node('a', 's1')]);

    expect(coverage.untouched.map((s) => s.id)).toEqual(['s2', 's3']);
    expect(coverage.untouchedCharCount).toBe(400);
  });

  // A brief nobody has cited yet is the honest day-one picture, not an error.
  it('treats a brief with nothing cited as fully untouched', () => {
    const coverage = computeBriefCoverage(SECTIONS, [node('a'), node('b')]);

    expect(coverage.covered).toBe(0);
    expect(coverage.total).toBe(3);
    expect(coverage.untouched).toHaveLength(3);
    expect(coverage.dangling).toEqual([]);
  });

  // An unreferenced node is the normal case — most nodes have no single source
  // section — so it must not read as a dangling citation.
  it('ignores nodes with no sourceRef rather than counting them as dangling', () => {
    const coverage = computeBriefCoverage(SECTIONS, [
      node('a', null),
      node('b', undefined),
    ]);

    expect(coverage.dangling).toEqual([]);
  });

  // Silently dropping a citation would let `covered` overstate itself, which is
  // the exact failure this feature exists to prevent.
  it('reports a node citing a section the brief does not have', () => {
    const coverage = computeBriefCoverage(SECTIONS, [
      node('a', 's9'),
      node('b', 's9'),
    ]);

    expect(coverage.dangling).toHaveLength(1);
    expect(coverage.dangling[0].sourceRef).toBe('s9');
    expect(coverage.dangling[0].nodes.map((n) => n.id)).toEqual(['a', 'b']);
    // It counts toward no section, so coverage is unmoved by it.
    expect(coverage.covered).toBe(0);
  });

  // A heading with nothing under it is part of the document's shape, but there
  // is nothing in it to have accounted for — counting it as untouched made the
  // panel report one more unread section than the brief has.
  it('leaves an empty section out of both halves of the tally', () => {
    const withEmpty = [section('s0', 'Title', 0), ...SECTIONS];
    const coverage = computeBriefCoverage(withEmpty, [node('a', 's1')]);

    expect(coverage.sections.map((s) => s.id)).toContain('s0');
    expect(coverage.sections[0].isEmpty).toBe(true);
    expect(coverage.untouched.map((s) => s.id)).not.toContain('s0');
    expect(coverage.total).toBe(3);
  });

  // ...unless something actually cites it, in which case the citation is real
  // and the section is genuinely accounted for.
  it('counts an empty section that something cites', () => {
    const withEmpty = [section('s0', 'Title', 0), ...SECTIONS];
    const coverage = computeBriefCoverage(withEmpty, [node('a', 's0')]);

    expect(coverage.total).toBe(4);
    expect(coverage.covered).toBe(1);
  });

  // A map with no brief splits into no sections. Zeroed, not thrown: the
  // workspace renders that state by mounting no panel at all.
  it('returns a zeroed coverage for a map with no brief', () => {
    const coverage = computeBriefCoverage([], [node('a'), node('b', 's1')]);

    expect(coverage.sections).toEqual([]);
    expect(coverage.untouched).toEqual([]);
    expect(coverage.covered).toBe(0);
    expect(coverage.total).toBe(0);
    expect(coverage.untouchedCharCount).toBe(0);
    // The citation cannot resolve against a brief that has no sections, so it
    // is reported rather than lost.
    expect(coverage.dangling.map((d) => d.sourceRef)).toEqual(['s1']);
  });
});
