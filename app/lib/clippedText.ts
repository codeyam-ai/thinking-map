// Whether a scrolling box is currently hiding text below its bottom edge.
//
// Pulled out of the core card as a predicate over three numbers rather than
// left inside the hook that reads them, for one reason: jsdom has no layout
// engine, so a test driving the real DOM sees scrollHeight and clientHeight
// both at 0 and can assert nothing about the interesting cases. Here they are
// just numbers, and every case is reachable.

/** The measurements a scrolling element reports about itself. */
export type ScrollMetrics = {
  scrollHeight: number;
  clientHeight: number;
  scrollTop: number;
};

/**
 * Absorbs sub-pixel rounding. Browsers routinely report a scrollHeight a
 * fraction taller than clientHeight for text that fits, and without this slack
 * that would put a "there is more" fade on every card on the board.
 */
const SUBPIXEL_SLACK = 1;

/**
 * True when there is more text below the visible box AND the reader has not
 * already scrolled to it.
 *
 * The second half matters as much as the first: a cue that stayed on after you
 * reached the end would dim the last line of a finished sentence.
 */
export function isTextClipped({
  scrollHeight,
  clientHeight,
  scrollTop,
}: ScrollMetrics): boolean {
  const overflows = scrollHeight > clientHeight + SUBPIXEL_SLACK;
  const atEnd = scrollTop + clientHeight >= scrollHeight - SUBPIXEL_SLACK;
  return overflows && !atEnd;
}
