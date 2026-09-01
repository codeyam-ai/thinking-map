// The shape of a node as every consumer passes it around.
//
// This file used to hold the tidy-tree layout as well — absolute pixel geometry
// for a map drawn on a zoomable plane, and the dotted connector paths between
// the nodes. The map is a scrolling column of card rows now, so there is no
// plane left to place anything on and the geometry went with it.
//
// `FlatNode` stayed, because it was never about geometry: it is the shape the
// database hands out and the shape the cards, the rounds, the brief coverage
// and the summary all read.

export interface FlatNode {
  id: string;
  parentId: string | null;
  kind: string;
  label: string;
  detail: string | null;
  status: string;
  sourceUrl: string | null;
  order: number;
  /** Which side of the exchange authored the node. Optional because a caller
   *  that only draws geometry has no reason to carry it. */
  origin?: string | null;
  /** A nudge away from the tidy position this layout computes — not a
   *  position. Optional for the same reason `origin` is: a caller that only
   *  wants geometry should not have to carry an arrangement it never set. */
  offsetX?: number | null;
  offsetY?: number | null;
  /** The brief section this node was derived from. Optional for the same
   *  reason `origin` is — and doubly so, since most maps have no brief at
   *  all for it to point into. */
  sourceRef?: string | null;
  /** A few likely answers to offer beside an open question, as the JSON array
   *  of strings the column stores. Optional for the same reason `origin` is: a
   *  caller that only wants the node's text has no reason to carry them, and
   *  most nodes are not questions. Parsed by `parseOptions` in `mapAnswers`. */
  options?: string | null;
}

