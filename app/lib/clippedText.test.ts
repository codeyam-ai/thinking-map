import { describe, expect, it } from 'vitest';
import { isTextClipped } from './clippedText';

// Whether to tell someone there is more of their idea below the fold.
//
// This is the decision behind the fade on the core card. It is a predicate over
// three numbers rather than a hook so it can be tested at all: jsdom has no
// layout engine, so scrollHeight and clientHeight are both 0 there and a test
// against the real DOM would assert nothing.
//
// Two things have to hold. It must say YES only when text is genuinely cut off
// — a fade painted over the last line of a sentence that already fits claims
// there is more when there is not. And it must say NO once you have scrolled to
// the end, so a finished sentence is never left dimmed.

describe('isTextClipped', () => {
  // The ordinary overflowing case: a long idea at the card's height cap, not
  // yet scrolled. This is the state the fade exists for.
  it('is true when the text overflows and has not been scrolled', () => {
    expect(
      isTextClipped({ scrollHeight: 1400, clientHeight: 870, scrollTop: 0 }),
    ).toBe(true);
  });

  // The common case by far: an idea that fits. No fade, because there is
  // nothing below to point at.
  it('is false when the text fits inside the box', () => {
    expect(
      isTextClipped({ scrollHeight: 400, clientHeight: 400, scrollTop: 0 }),
    ).toBe(false);
  });

  // Scrolled to the very bottom. The text still overflows the box, but there
  // is nothing further down, so dimming the last line would be a lie.
  it('is false once scrolled to the end, even though it still overflows', () => {
    expect(
      isTextClipped({ scrollHeight: 1400, clientHeight: 870, scrollTop: 530 }),
    ).toBe(false);
  });

  // Part-way through. Still more to come, so the cue stays.
  it('is true part-way through a scroll', () => {
    expect(
      isTextClipped({ scrollHeight: 1400, clientHeight: 870, scrollTop: 200 }),
    ).toBe(true);
  });

  // Sub-pixel rounding. A browser will report a scrollHeight a fraction taller
  // than clientHeight on text that fits perfectly well; without slack that
  // renders a fade on every card on the board.
  it('treats a sub-pixel overflow as fitting', () => {
    expect(
      isTextClipped({ scrollHeight: 400.6, clientHeight: 400, scrollTop: 0 }),
    ).toBe(false);
  });

  // The mirror of the case above, at the end of a scroll: landing a fraction
  // short of the bottom still counts as the bottom.
  it('treats a sub-pixel gap at the end as the end', () => {
    expect(
      isTextClipped({ scrollHeight: 1400, clientHeight: 870, scrollTop: 529.4 }),
    ).toBe(false);
  });

  // Before layout has happened at all — the first render, and jsdom always.
  // Zeroes must read as "nothing to point at", never as an overflow.
  it('is false when nothing has been laid out yet', () => {
    expect(
      isTextClipped({ scrollHeight: 0, clientHeight: 0, scrollTop: 0 }),
    ).toBe(false);
  });

  // Overshoot. Elastic scrolling can report a scrollTop past the true end, and
  // that must not flip the answer back to "there is more".
  it('is false when the scroll overshoots the end', () => {
    expect(
      isTextClipped({ scrollHeight: 1400, clientHeight: 870, scrollTop: 600 }),
    ).toBe(false);
  });
});
