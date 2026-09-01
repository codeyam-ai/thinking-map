import { describe, expect, it } from 'vitest';
import { buildSequence } from './buildSequence';
import type { SummaryNode } from './summaryGroups';

const node = (
  id: string,
  kind: string,
  order: number,
  testsNodeId: string | null = null,
): SummaryNode => ({
  id,
  kind,
  label: id,
  detail: null,
  order,
  testsNodeId,
});

// The build sequence is the map's answer to "what do I actually go and build
// first?". Its whole opinion is that an increment which settles nothing is not
// a validating slice, so most of these cases are about that distinction
// surviving into the render.
describe('buildSequence', () => {
  // The ordinary path: a slice that names a live node reports what it settles.
  it('resolves the node a slice would settle', () => {
    const sequence = buildSequence([
      node('u1', 'unknown', 0),
      node('b1', 'slice', 1, 'u1'),
    ]);
    expect(sequence).toHaveLength(1);
    expect(sequence[0].proves).toEqual({
      id: 'u1',
      kind: 'unknown',
      label: 'u1',
    });
    expect(sequence[0].provesNothing).toBe(false);
    expect(sequence[0].danglingId).toBeNull();
  });

  // The sequence is numbered on screen and claims the first entry is the
  // smallest thing worth building, so insertion order would misstate the plan.
  it('orders slices by order rather than input position', () => {
    const sequence = buildSequence([
      node('third', 'slice', 3),
      node('first', 'slice', 1),
      node('second', 'slice', 2),
    ]);
    expect(sequence.map((entry) => entry.slice.id)).toEqual([
      'first',
      'second',
      'third',
    ]);
  });

  // The state the feature exists to make visible: work scheduled early that
  // tests no assumption. It is reported, never filtered out.
  it('flags a slice that names no node at all', () => {
    const sequence = buildSequence([node('b1', 'slice', 0)]);
    expect(sequence[0].provesNothing).toBe(true);
    expect(sequence[0].proves).toBeNull();
    // Distinct from a dangling link: this slice never claimed to settle
    // anything, so there is no lost node to report.
    expect(sequence[0].danglingId).toBeNull();
  });

  // A slice can outlive the assumption it was written for. That is reported as
  // its own state rather than rendered as a blank line.
  it('reports a slice whose target has been deleted', () => {
    const sequence = buildSequence([node('b1', 'slice', 0, 'u-gone')]);
    expect(sequence[0].provesNothing).toBe(true);
    expect(sequence[0].proves).toBeNull();
    expect(sequence[0].danglingId).toBe('u-gone');
  });

  // A slice may settle a risk or an open question just as legitimately as an
  // assumption, so the link is not restricted by the target's kind.
  it('resolves a target of any kind, not just assumptions', () => {
    const sequence = buildSequence([
      node('r1', 'risk', 0),
      node('q1', 'open-question', 1),
      node('b1', 'slice', 2, 'r1'),
      node('b2', 'slice', 3, 'q1'),
    ]);
    expect(sequence.map((entry) => entry.proves?.kind)).toEqual([
      'risk',
      'open-question',
    ]);
  });

  // Every other kind on a finished map — the idea, the next steps, the
  // directions — belongs to a different region of the summary screen.
  it('ignores nodes that are not slices', () => {
    const sequence = buildSequence([
      node('idea', 'idea', 0),
      node('s1', 'next-step', 1),
      node('d1', 'direction', 2),
      node('b1', 'slice', 3),
    ]);
    expect(sequence.map((entry) => entry.slice.id)).toEqual(['b1']);
  });

  // A map that ended in next steps with no slices must render its hint rather
  // than break, so the empty case is a value and not a special case.
  it('returns an empty sequence for a map with no slices', () => {
    expect(buildSequence([])).toEqual([]);
    expect(buildSequence([node('s1', 'next-step', 0)])).toEqual([]);
  });

  // A slice pointing at itself resolves to itself rather than looping or
  // being treated as dangling — nothing here walks the link transitively.
  it('tolerates a slice that names itself', () => {
    const sequence = buildSequence([node('b1', 'slice', 0, 'b1')]);
    expect(sequence[0].provesNothing).toBe(false);
    expect(sequence[0].proves?.id).toBe('b1');
  });
});
