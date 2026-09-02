// The shape of a thread between two card rows.
//
// Pulled out of `RowThreads` because it is the part with rules in it. The
// component's job is measurement — asking the DOM where the cards ended up
// after a flex wrap — and measurement can only be checked by looking. These
// two functions decide what to DRAW given those measurements, and what they
// decide (how deep the bend goes, how wide the fan opens) is exactly the kind
// of thing that is easy to get subtly wrong and impossible to notice in a
// screenshot.

/** Bend floor. Below this a curve reads as a straight line, and a straight
 *  line between two rows reads as a table rule rather than a thread. */
const MIN_PULL = 14;
/** Bend ceiling. Past this the curve overshoots its own endpoints and loops. */
const MAX_PULL = 64;
/** How far apart two departures sit along a parent's bottom edge. */
const FAN_SPACING = 44;
/** Kept clear at each end of that edge, so a thread never appears to leave
 *  from the card's rounded corner. */
const FAN_INSET = 36;

/**
 * The cubic from a parent card's bottom edge to a child card's top edge.
 *
 * Both control points are pulled VERTICALLY off their endpoints and never
 * horizontally, so the line leaves the card it came from going down and
 * arrives at the next one going down. That is what produces the S-travel of
 * the design references instead of a bowed rope slung between two points, and
 * it is what keeps a thread readable when the two cards are far apart across a
 * wide row.
 */
export function curve(x1: number, y1: number, x2: number, y2: number): string {
  const pull = threadPull(y2 - y1);
  return `M ${x1} ${y1} C ${x1} ${y1 + pull}, ${x2} ${y2 - pull}, ${x2} ${y2}`;
}

/**
 * How deep the curve bends, for a given vertical gap between the two rows.
 *
 * Two thirds of the gap, clamped at both ends: a tight gap still bends, and a
 * tall one does not loop back on itself.
 */
export function threadPull(gap: number): number {
  return Math.min(Math.max(gap * 0.66, MIN_PULL), MAX_PULL);
}

/**
 * Where along a parent's bottom edge each of its threads departs.
 *
 * Every thread from one parent starting at the same point is what turns four
 * curves into one frayed rope: they overlap for the first stretch and only
 * separate once they are already travelling sideways. Fanning the departures
 * across the parent's own bottom edge makes the same four curves read as a
 * hand opening.
 *
 * Returns one x per thread, left to right and evenly spaced. The caller passes
 * its threads in the order of the children they land on, so no two of one
 * parent's threads cross.
 */
export function fanOrigins(
  left: number,
  width: number,
  count: number,
): number[] {
  const centre = left + width / 2;
  if (count <= 1) return [centre];

  // Never wider than the card minus its corner inset, and never wider than the
  // fan needs — a wide card with two children gets a narrow fan, not one
  // departure at each corner.
  const span = Math.max(Math.min(width - FAN_INSET, FAN_SPACING * (count - 1)), 0);
  const start = centre - span / 2;
  return Array.from(
    { length: count },
    (_, i) => start + (span / (count - 1)) * i,
  );
}
