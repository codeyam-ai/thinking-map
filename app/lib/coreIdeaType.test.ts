import { describe, expect, it } from 'vitest';
import {
  CORE_IDEA_TYPE_FLOOR,
  CORE_IDEA_TYPE_CEILING,
  coreIdeaFontSize,
} from './coreIdeaType';

// The rule this file encodes was INVERTED by the change that created it.
//
// The core used to shrink the words to protect a fixed-size circle, and past a
// few hundred characters it stopped even doing that and spilled the person's
// own sentence onto the black board. The rule now is that the type has a floor
// and the CARD grows to hold what it must. Every case here guards one half of
// that: the type still steps down as an idea gets longer, and it never steps
// below the point where the idea stops being readable at board zoom.

const idea = (length: number) => 'x'.repeat(length);

describe('coreIdeaFontSize', () => {
  // The ordinary case: the length someone actually types on the first card.
  // A sentence or two lands at the ceiling, because there is nothing to trade.
  it('gives a short idea the largest type', () => {
    expect(coreIdeaFontSize(idea(46))).toBe(CORE_IDEA_TYPE_CEILING);
  });

  // The empty card. Not a state the board renders for long, but the function
  // must not divide, index, or otherwise fall over on it.
  it('gives an empty idea the largest type rather than failing', () => {
    expect(coreIdeaFontSize('')).toBe(CORE_IDEA_TYPE_CEILING);
  });

  // The floor is the whole point. This is the case that used to render at a
  // size nobody could read, and the assertion that would have caught it.
  it('never goes below the readable floor, however long the idea', () => {
    expect(coreIdeaFontSize(idea(20_000))).toBe(CORE_IDEA_TYPE_FLOOR);
  });

  // Monotonic: a longer idea is never set LARGER than a shorter one. Written
  // as a sweep rather than as one pair, because a hand-written ternary chain
  // is exactly the kind of thing that gets a threshold transposed.
  it('never sets a longer idea in larger type than a shorter one', () => {
    const lengths = [0, 30, 60, 119, 120, 121, 300, 301, 600, 601, 5_000];
    const sizes = lengths.map((n) => coreIdeaFontSize(idea(n)));
    for (let i = 1; i < sizes.length; i += 1) {
      expect(sizes[i]).toBeLessThanOrEqual(sizes[i - 1]);
    }
  });

  // Every size it can return has to sit inside the declared range, so the
  // constants stay the honest description of the scale rather than two numbers
  // that drifted away from the ternary beneath them.
  it('stays within the declared floor and ceiling at every length', () => {
    for (const n of [0, 1, 60, 120, 300, 600, 1_200, 9_999]) {
      const size = coreIdeaFontSize(idea(n));
      expect(size).toBeGreaterThanOrEqual(CORE_IDEA_TYPE_FLOOR);
      expect(size).toBeLessThanOrEqual(CORE_IDEA_TYPE_CEILING);
    }
  });

  // It steps, rather than scaling continuously — two ideas a few characters
  // apart must not render at visibly different sizes on the same board.
  it('holds one size across a band rather than changing per character', () => {
    expect(coreIdeaFontSize(idea(130))).toBe(coreIdeaFontSize(idea(200)));
  });

  // Length is measured in characters of the idea itself, so the caller can
  // pass the string and not think about it. A multi-byte character counts once
  // the way JavaScript counts it — the point is that it does not throw.
  it('handles a non-ASCII idea', () => {
    expect(coreIdeaFontSize('¿Qué estoy tratando de resolver?')).toBe(
      CORE_IDEA_TYPE_CEILING,
    );
  });
});
