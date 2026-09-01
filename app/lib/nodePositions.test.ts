import { describe, expect, it } from 'vitest';
import { parseNudges } from './nodePositions';

// What the arrangement endpoint will accept. These matter more than they look:
// the parsed values go straight into a Float column, so anything that gets past
// here is a position the map will try to draw a node at.

describe('parseNudges', () => {
  // The batch is the shape of the request, because a drag can settle several
  // nodes at once.
  it('parses a batch of nudges', () => {
    expect(
      parseNudges([
        { nodeId: 'a', offsetX: 10, offsetY: -4 },
        { nodeId: 'b', offsetX: 0, offsetY: 120 },
      ]),
    ).toEqual([
      { nodeId: 'a', offsetX: 10, offsetY: -4 },
      { nodeId: 'b', offsetX: 0, offsetY: 120 },
    ]);
  });

  // A single move should not have to wrap itself in an array.
  it('accepts a lone object as a batch of one', () => {
    expect(parseNudges({ nodeId: 'a', offsetX: 3, offsetY: 4 })).toEqual([
      { nodeId: 'a', offsetX: 3, offsetY: 4 },
    ]);
  });

  // A nudge is a signed delta from the tidy position, so negatives are ordinary.
  it('accepts negative and fractional offsets', () => {
    expect(parseNudges({ nodeId: 'a', offsetX: -12.5, offsetY: -0.5 })).toEqual([
      { nodeId: 'a', offsetX: -12.5, offsetY: -0.5 },
    ]);
  });

  // An empty array would otherwise reach the database as a transaction that
  // writes nothing and reports success.
  it('rejects an empty batch', () => {
    expect(parseNudges([])).toBe('Expected at least one node position.');
  });

  // Without an id there is nothing to move, and an undefined id would sail
  // into the ownership query as a lookup for `undefined`.
  it('rejects a missing node id', () => {
    expect(parseNudges({ offsetX: 1, offsetY: 2 })).toBe(
      '`nodeId` must be a non-empty string.',
    );
  });

  // An empty id would pass a bare `typeof` check and match no node.
  it('rejects an empty node id', () => {
    expect(parseNudges({ nodeId: '', offsetX: 1, offsetY: 2 })).toBe(
      '`nodeId` must be a non-empty string.',
    );
  });

  // A numeric string is the shape a hand-written client sends most often.
  it('rejects an offset sent as a string', () => {
    expect(parseNudges({ nodeId: 'a', offsetX: '10', offsetY: 2 })).toBe(
      '`offsetX` and `offsetY` must be finite numbers.',
    );
  });

  // NaN and Infinity are both `typeof number`, and either one in the column
  // would put the node nowhere — this is why the check is `isFinite`.
  it('rejects NaN and Infinity', () => {
    const message = '`offsetX` and `offsetY` must be finite numbers.';
    expect(parseNudges({ nodeId: 'a', offsetX: NaN, offsetY: 0 })).toBe(message);
    expect(parseNudges({ nodeId: 'a', offsetX: 0, offsetY: Infinity })).toBe(message);
  });

  // Both axes are required: writing only one would leave the other at whatever
  // the row already held, which is a position nobody chose.
  it('rejects a missing offset', () => {
    expect(parseNudges({ nodeId: 'a', offsetX: 1 })).toBe(
      '`offsetX` and `offsetY` must be finite numbers.',
    );
  });

  // One bad entry fails the whole batch rather than being silently dropped: a
  // half-applied drag is worse than a rejected one.
  it('rejects the whole batch when any entry is malformed', () => {
    expect(
      parseNudges([
        { nodeId: 'a', offsetX: 1, offsetY: 2 },
        { nodeId: 'b', offsetX: 'no', offsetY: 2 },
      ]),
    ).toBe('`offsetX` and `offsetY` must be finite numbers.');
  });

  // The body is whatever a caller posted, so destructuring it must not throw
  // on null or on a bare string.
  it('rejects null and non-object entries', () => {
    expect(parseNudges(null)).toBe('`nodeId` must be a non-empty string.');
    expect(parseNudges(['nope'])).toBe('`nodeId` must be a non-empty string.');
  });
});
