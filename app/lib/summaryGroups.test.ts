import { describe, expect, it } from 'vitest';
import { groupSummaryNodes } from './summaryGroups';

const node = (id: string, kind: string, order: number) => ({
  id,
  kind,
  label: id,
  detail: null,
  order,
});

describe('groupSummaryNodes', () => {
  // The summary screen has four regions; each must draw from its own kind, or
  // findings land in the wrong card.
  it('splits nodes into the four summary buckets', () => {
    const grouped = groupSummaryNodes([
      node('k1', 'known', 0),
      node('u1', 'unknown', 1),
      node('d1', 'direction', 2),
      node('s1', 'next-step', 3),
    ]);
    expect(grouped.known.map((n) => n.id)).toEqual(['k1']);
    expect(grouped.unknown.map((n) => n.id)).toEqual(['u1']);
    expect(grouped.directions.map((n) => n.id)).toEqual(['d1']);
    expect(grouped.steps.map((n) => n.id)).toEqual(['s1']);
  });

  // Next steps are numbered on screen, so their sequence is meaningful —
  // rendering them in insertion order would mislabel the plan.
  it('sorts each bucket by order, not by input position', () => {
    const grouped = groupSummaryNodes([
      node('third', 'next-step', 3),
      node('first', 'next-step', 1),
      node('second', 'next-step', 2),
    ]);
    expect(grouped.steps.map((n) => n.id)).toEqual(['first', 'second', 'third']);
  });

  // A finished map still holds every working node; only the four summary
  // kinds belong on this screen.
  it('ignores kinds that do not belong on the summary screen', () => {
    const grouped = groupSummaryNodes([
      node('idea', 'idea', 0),
      node('gap', 'gap', 1),
      node('k', 'known', 2),
    ]);
    expect(grouped.known.map((n) => n.id)).toEqual(['k']);
    expect(grouped.unknown).toEqual([]);
    expect(grouped.directions).toEqual([]);
    expect(grouped.steps).toEqual([]);
  });

  // The screen must render its empty hints rather than crash on a map that
  // reached the phase with nothing filled in.
  it('returns four empty buckets for an empty map', () => {
    const grouped = groupSummaryNodes([]);
    expect(grouped).toEqual({
      known: [],
      unknown: [],
      directions: [],
      steps: [],
    });
  });
});
