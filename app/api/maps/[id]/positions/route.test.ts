import { describe, expect, it } from 'vitest';
import { parseNudges } from './route';

// The arrangement endpoint is vestigial — the map is a scrolling column of card
// rows now, so nothing produces a nudge any more. Its validation is still worth
// holding: the columns it writes are still there, and a rule that stops being
// checked is a rule that quietly stops being true.

describe('parseNudges', () => {
  // A drag could settle several nodes at once, so a batch is the shape of the
  // request.
  it('accepts a batch of nudges', () => {
    const parsed = parseNudges([
      { nodeId: 'a', offsetX: 10, offsetY: -20 },
      { nodeId: 'b', offsetX: 0, offsetY: 0 },
    ]);
    expect(parsed).toEqual([
      { nodeId: 'a', offsetX: 10, offsetY: -20 },
      { nodeId: 'b', offsetX: 0, offsetY: 0 },
    ]);
  });

  // A lone object is accepted as a batch of one, so the common case does not
  // have to wrap itself in an array.
  it('accepts a single nudge without an array wrapper', () => {
    expect(parseNudges({ nodeId: 'a', offsetX: 5, offsetY: 5 })).toEqual([
      { nodeId: 'a', offsetX: 5, offsetY: 5 },
    ]);
  });

  // An empty batch asks for nothing and is more likely a bug than an intent.
  it('rejects an empty batch', () => {
    expect(parseNudges([])).toBe('Expected at least one node position.');
  });

  // Without a node id there is nothing to move.
  it('rejects a missing or empty node id', () => {
    expect(parseNudges([{ offsetX: 1, offsetY: 1 }])).toBe(
      '`nodeId` must be a non-empty string.',
    );
    expect(parseNudges([{ nodeId: '', offsetX: 1, offsetY: 1 }])).toBe(
      '`nodeId` must be a non-empty string.',
    );
  });

  // Finite, not merely numeric: NaN and Infinity are both `typeof number`, and
  // either one written to the column would put a node nowhere.
  it('rejects offsets that are not finite numbers', () => {
    const message = '`offsetX` and `offsetY` must be finite numbers.';
    expect(parseNudges([{ nodeId: 'a', offsetX: NaN, offsetY: 0 }])).toBe(message);
    expect(parseNudges([{ nodeId: 'a', offsetX: 0, offsetY: Infinity }])).toBe(message);
    expect(parseNudges([{ nodeId: 'a', offsetX: '10', offsetY: 0 }])).toBe(message);
  });

  // One bad entry rejects the whole batch rather than silently moving the rest —
  // a partial arrangement is harder to explain than a refused one.
  it('rejects the whole batch when one entry is malformed', () => {
    expect(
      parseNudges([
        { nodeId: 'a', offsetX: 1, offsetY: 1 },
        { nodeId: 'b', offsetX: 'nope', offsetY: 1 },
      ]),
    ).toBe('`offsetX` and `offsetY` must be finite numbers.');
  });

  // A null or non-object entry must be reported, not thrown on.
  it('rejects a null entry without throwing', () => {
    expect(parseNudges([null])).toBe('`nodeId` must be a non-empty string.');
  });
});
