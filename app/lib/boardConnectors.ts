// The lines between things on the board.
//
// Split out of `GalaxyBoard` because it is string math: a wrong control point
// produces a kinked or backwards curve that no type checker will notice and no
// screenshot of the one board that happens to look fine will catch either.
//
// In abstract board units, like the layout it reads from. Nothing here knows
// about pixels, the viewport or the current zoom.

import type { PlacedCluster } from './galaxyLayout';

/**
 * The fan: idea to one theme's hub.
 *
 * Both control points sit on the run between the two ends — one holding the
 * idea's horizontal, one holding the row's — so every branch LEAVES the idea
 * flat and ARRIVES at its row flat. That is what makes several of them read as
 * one splaying bundle rather than as a set of unrelated diagonals.
 */
export function fanPath(
  coreRadius: number,
  hubRadius: number,
  cluster: { x: number; y: number },
): string {
  const midX = (coreRadius + cluster.x) / 2;
  return `M ${coreRadius} 0 C ${midX} 0, ${midX} ${cluster.y}, ${cluster.x - hubRadius} ${cluster.y}`;
}

/**
 * The mirror of the fan: the end of a finished row back to the conclusion.
 *
 * Null when the row has no cards — there is no end to leave from, and a curve
 * drawn from the hub itself would promise a conclusion the row has not reached.
 */
export function joinPath(
  cluster: PlacedCluster,
  convergenceX: number,
): string | null {
  const last = cluster.cards[cluster.cards.length - 1];
  if (!last) return null;
  const end = last.x + last.w;
  const midX = (end + convergenceX) / 2;
  return `M ${end} ${cluster.y} C ${midX} ${cluster.y}, ${midX} 0, ${convergenceX - 90} 0`;
}

/**
 * Whether a row has been finished.
 *
 * A row is done when it HAS questions and none of them is still open. An empty
 * row is deliberately not done — it has not started — and the difference
 * matters because this is what decides whether the line to the conclusion is
 * drawn at all. Treating empty as finished would run a line to a conclusion
 * from a line of thinking nobody has answered anything in.
 */
export function rowDone(cluster: PlacedCluster): boolean {
  const questions = cluster.cards.filter((c) => c.kind === 'open-question');
  return questions.length > 0 && questions.every((q) => q.status === 'answered');
}
