import { describe, expect, it } from 'vitest';
import { staleNote } from './insightStale';

describe('staleNote', () => {
  // Nothing has landed since this was written, so there is nothing to admit.
  // Null rather than an empty string so a caller that forgets to check renders
  // nothing rather than an empty marker holding space in the layout.
  it('has no marker for an insight nothing has happened since', () => {
    expect(staleNote(0)).toBeNull();
  });

  // The singular is the FIRST thing anyone ever reads here — the marker appears
  // the moment one answer lands after an insight — so "your last 1 answers"
  // would be the debut, not an edge case.
  it('says answer, not answers, after exactly one', () => {
    expect(staleNote(1)).toBe('Written before your last answer');
  });

  // The ordinary case, and the one the demo shows.
  it('counts the answers when there is more than one', () => {
    expect(staleNote(2)).toBe('Written before your last 2 answers');
    expect(staleNote(4)).toBe('Written before your last 4 answers');
  });

  // A long session leaves a genuinely large gap. The sentence stays the same
  // shape rather than degrading to "many" — the number is the point.
  it('keeps counting on a map that has moved a long way', () => {
    expect(staleNote(37)).toBe('Written before your last 37 answers');
  });

  // A negative can only come from a counting bug upstream. It reads as
  // not-stale rather than rendering "your last -1 answers", which would put
  // the bug in front of the person instead of in the logs.
  it('treats an impossible negative count as not stale', () => {
    expect(staleNote(-1)).toBeNull();
  });
});
