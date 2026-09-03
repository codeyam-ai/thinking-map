// What the bar over the map needs to know, and where the camera goes.
//
// All of it is a reading of the layout the board has already computed — no
// DOM, no camera, no React. That split is the point: which cards are still
// waiting, which one comes next, and where to point the camera at the plan are
// each a rule that can be got wrong quietly, and inside a component the only
// way to see one of them is to look at a screenshot and squint. Here they are
// four functions with tests.
//
// `conclusionCamera` is the clearest case for the split. Its first version
// framed the plan's top edge at the top of the SCREEN, which is exactly where
// the bar is pinned — so the plan's headline rendered underneath it, cut in
// half, and nothing but a capture could have shown that.

import { isOpenCard } from './cardPresentation';
import type {
  GalaxyNodeInput,
  PlacedCard,
  PlacedCluster,
} from './galaxyLayout';
import type { SummaryNode } from './summaryGroups';

/** One question as the bar lists it. */
export interface NavQuestion {
  id: string;
  label: string;
  hue: number;
}

/**
 * The cards still asking something, in the order the board reads them.
 *
 * Row by row, left to right — the order the eye would take if the whole board
 * fitted on one screen, which is what makes it the right order for the bar's
 * "next". Both clauses of the filter matter and neither implies the other:
 * `status === 'open'` drops what has been answered, and `isOpenCard` drops what
 * was never a question — the partner's own findings, gaps and risks, and any
 * card carrying a diagram or a picture, all of which are shown TO you rather
 * than asked OF you however their status reads.
 */
export function openQuestionsOf(clusters: PlacedCluster[]): PlacedCard[] {
  return clusters.flatMap((cluster) =>
    cluster.cards.filter((card) => card.status === 'open' && isOpenCard(card)),
  );
}

/**
 * The next question after wherever you are, wrapping.
 *
 * Anchored on the FOCUSED card rather than on a counter the board keeps. A
 * counter would keep walking a list the person has been changing underneath it
 * — answering a card removes it — and would send them somewhere they had
 * already been. A focus that resolves to nothing means "start at the
 * beginning", which is both the first press on a fresh board and the press
 * right after answering: the card you were on has left the list, and anything
 * derived from where it used to sit would pick a question by the position of
 * one you had just finished.
 */
export function nextOpenAfter(
  open: PlacedCard[],
  focusedId: string | null,
): PlacedCard | null {
  if (open.length === 0) return null;
  const at = open.findIndex((card) => card.id === focusedId);
  return open[(at + 1) % open.length];
}

/** The open cards, in the shape the bar lists them: their words, and the colour
 *  of the card they belong to, so a row in the list and a card on the board
 *  read as the same object. */
export function navQuestionsOf(open: PlacedCard[]): NavQuestion[] {
  return open.map((card) => ({
    id: card.id,
    label: card.label,
    hue: card.hue,
  }));
}

/**
 * The board's nodes, in the shape the plan reads them.
 *
 * A projection rather than a second fetch. `order` and `testsNodeId` ride on
 * the board's own nodes precisely so the plan standing at the far end and the
 * cards behind it can never become two different readings of one map.
 *
 * `order` falls back to 0 for a fixture that never dated its nodes: one cohort
 * in which nothing sorts ahead of anything, which leaves `groupSummaryNodes`'s
 * sort stable rather than arbitrary.
 */
export function summaryNodesOf(nodes: GalaxyNodeInput[]): SummaryNode[] {
  return nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    label: node.label,
    detail: node.detail,
    order: node.order ?? 0,
    testsNodeId: node.testsNodeId ?? null,
    tradeoffs: node.tradeoffs ?? null,
  }));
}

/** Board units of clearance for the bar, which is pinned over the top of the
 *  board. Without it the camera frames the plan's top edge at the top of the
 *  screen — which is where the bar is — and the headline renders underneath it. */
const UNDER_THE_BAR = 96;

/** Reading size. Deliberately not derived from the viewport: the plan is longer
 *  than any viewport at a size anyone can read, so what gets framed is its
 *  BEGINNING and the rest is one pan away — which is how everything else on
 *  this board is reached. A scale fitted to the height would shrink the type
 *  until the plan was a picture of a plan. */
const READING_SCALE = 0.9;

/** Half the plan column's width, so the camera centres on the column rather
 *  than on the convergence point the column hangs off. */
const HALF_COLUMN = 190;

/**
 * Where to point the camera to read the plan from its beginning.
 *
 * `focusOn` centres the point it is given, so putting the column's top edge
 * near the top of the screen means looking at a point half a viewport BELOW it
 * — less the bar's clearance.
 */
export function conclusionCamera({
  convergence,
  viewportHeight,
}: {
  convergence: { x: number; y: number };
  viewportHeight: number;
}): { x: number; y: number; scale: number } {
  return {
    x: convergence.x + HALF_COLUMN,
    y: convergence.y + (viewportHeight / 2 - UNDER_THE_BAR) / READING_SCALE,
    scale: READING_SCALE,
  };
}
