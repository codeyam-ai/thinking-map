// The board's reading of the insight stream.
//
// `insightStream` is shared with the server door that renders `read_map`, so it
// takes rows: every node carries `createdAt` and `updatedAt` because every row
// does. The BOARD is passed `GalaxyNodeInput`s, where those fields are optional
// — an isolated fixture mounts the board with hand-written nodes and has no
// reason to invent timestamps for them.
//
// Bridging the two is a decision, not a cast, which is why it is here rather
// than inline in `BoardWorkspace`: what an undated node MEANS has to be settled,
// and the answer has to be the same every render or the stack reshuffles under
// the person.

import { insightStream, type InsightStream } from './insightStream';
import type { GalaxyNodeInput } from './galaxyLayout';

/**
 * The epoch, for a node that arrived with no timestamps.
 *
 * The value matters less than its CONSTANCY. Every undated node gets the same
 * one, so an undated map is a single cohort in which nothing was written after
 * anything: no answer sorts later than any insight, so nothing reads as stale.
 * That is the right answer for a fixture, where staleness would be a claim
 * about answers the person never gave.
 *
 * `Date.now()` was the alternative and is worse twice over: it is a new value
 * on every render, so the memo it feeds would never hold, and on a map where
 * SOME nodes are dated it would sort every undated node to the front.
 */
const UNDATED = new Date(0);

/**
 * The stream, from the nodes the board already has.
 *
 * Deliberately not a second query. The board lays these nodes out and the
 * agent's `read_map` reads the same function over the same rule, so computing
 * the stack from anything else is how the two came to disagree about what was
 * on the board — the disagreement `insightStream` was extracted to prevent.
 */
export function boardInsightStream(nodes: GalaxyNodeInput[]): InsightStream {
  return insightStream(
    nodes.map((node) => ({
      ...node,
      createdAt: node.createdAt ?? UNDATED,
      updatedAt: node.updatedAt ?? UNDATED,
      fromNodeIds: node.fromNodeIds ?? null,
    })),
  );
}

export interface StackSplit<T> {
  /** The cards that stand in the column. */
  shown: T[];
  /** How many are behind the affordance. Zero means there is no affordance. */
  hidden: number;
}

/**
 * How many insights stand, and how many wait behind "show older".
 *
 * The plane has bounds and the stack hangs off one point on it, so a column
 * that grew with the map would run past them — but a hard cap that silently
 * dropped the older ones would lose the map's history to a layout constraint.
 * The split is the compromise, and the arithmetic is worth pinning: the
 * off-by-one that shows four and claims "show 3 older" out of six is invisible
 * in a screenshot of a map that happens to have exactly five.
 */
export function splitStack<T>(insights: T[], limit: number): StackSplit<T> {
  if (limit <= 0) return { shown: [], hidden: insights.length };
  const shown = insights.slice(0, limit);
  return { shown, hidden: insights.length - shown.length };
}
