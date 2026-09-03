import { describe, expect, it } from 'vitest';
import { grownHeight } from './growField';

describe('grownHeight', () => {
  // A short idea does not get a tall box. The field holding its floor is what
  // keeps the card's empty space — the space that says "this is yours to fill".
  it('holds the floor for something short', () => {
    expect(grownHeight({ content: 20, min: 90, max: 320 })).toBe(90);
  });

  // The whole point: three lines of a long idea used to scroll inside a
  // three-row box, so most of what someone had written was hidden while they
  // were still writing it.
  it('grows to fit what has been written', () => {
    expect(grownHeight({ content: 180, min: 90, max: 320 })).toBe(180);
  });

  // But not without end. The field lives on a card, and a card that grew with
  // an essay would run off the screen the essay was being typed onto — so past
  // the ceiling it goes back to scrolling, which is the honest trade.
  it('stops at the ceiling rather than running off the card', () => {
    expect(grownHeight({ content: 900, min: 90, max: 320 })).toBe(320);
  });

  // The boundary itself, which is where an off-by-one would show as a field
  // that scrolls one line early or one line late.
  it('is exact at the ceiling', () => {
    expect(grownHeight({ content: 320, min: 90, max: 320 })).toBe(320);
  });
});
