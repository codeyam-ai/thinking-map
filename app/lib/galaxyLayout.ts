// Where everything sits on the board.
//
// The board reads left to right, as a line of thinking rather than as an orbit.
// The idea is on the left; a few distinct ways of approaching it fan out from
// it; each of those opens its own row of questions running rightward; and once
// every question in every row has an answer, the rows converge again into one
// conclusion at the far end.
//
// That shape is the argument the product is making: your thinking is not a list
// and not a wheel — it starts as one thing, opens into several, and is worth
// something again only when it comes back together. A radial layout said
// "everything relates to the idea", which is true but inert; this one says
// "and it is going somewhere", which is the part a person actually wants.
//
// Pure, and in abstract board units. Nothing here knows about pixels, the
// viewport, or the current zoom; the canvas maps board space to screen space.
// Keeping that split means the layout can be asserted in a test without a DOM,
// and the camera can move without the layout being recomputed.

export interface GalaxyTheme {
  id: string;
  label: string;
  hue: number;
  order: number;
}

export interface GalaxyNodeInput {
  id: string;
  themeId: string | null;
  kind: string;
  label: string;
  detail: string | null;
  status: string;
  /** Options offered with this question, or null for an open-ended one. */
  choices?: string[] | null;
}

export interface PlacedCard extends GalaxyNodeInput {
  x: number;
  y: number;
  /** The hue of the owning theme, copied onto the card so a renderer never has
   *  to hold both collections to draw one card. */
  hue: number;
}

export interface PlacedCluster {
  theme: GalaxyTheme;
  /** Centre of the hub circle this line of thinking hangs off. */
  x: number;
  y: number;
  cards: PlacedCard[];
}

export interface GalaxyLayout {
  core: { x: number; y: number };
  clusters: PlacedCluster[];
  /** Where the lines come back together. Present whatever the state, so the
   *  renderer can decide whether the conclusion has been earned yet without
   *  recomputing geometry. */
  convergence: { x: number; y: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
}

/** How far right of the idea the lines of thinking sit. Wide enough that the
 *  fan has room to curve rather than kink. */
const FAN_X = 1180;
/** Vertical gap between one line of thinking and the next. Sized against the
 *  card height so two neighbouring rows never touch. */
const ROW_GAP = 620;
const HUB_RADIUS = 66;
const CARD_W = 300;
const CARD_H = 360;
const CARD_GAP = 34;
/** Gap between a hub and the first card of its row, and between the last card
 *  and the convergence point. */
const RUN_GAP = 190;
const CORE_RADIUS = 250;

/**
 * Place the idea, the lines of thinking, their questions, and the point where
 * they converge.
 *
 * Rows are centred vertically on the idea, so a map with two lines of thinking
 * is balanced rather than looking like a map with three that lost one.
 */
export function layOutGalaxy(
  themes: GalaxyTheme[],
  nodes: GalaxyNodeInput[],
): GalaxyLayout {
  const core = { x: 0, y: 0 };
  const ordered = [...themes].sort((a, b) => a.order - b.order);
  const n = Math.max(ordered.length, 1);

  const clusters: PlacedCluster[] = ordered.map((theme, i) => {
    const cx = FAN_X;
    const cy = (i - (ordered.length - 1) / 2) * ROW_GAP;

    const own = nodes.filter((n2) => n2.themeId === theme.id);
    // One row running right. Cards are vertically centred on their hub so the
    // whole line — hub, then questions — sits on one axis the eye can follow
    // without hunting.
    const cards: PlacedCard[] = own.map((node, j) => ({
      ...node,
      hue: theme.hue,
      x: cx + HUB_RADIUS + RUN_GAP + j * (CARD_W + CARD_GAP),
      y: cy - CARD_H / 2,
    }));

    return { theme, x: cx, y: cy, cards };
  });

  // The convergence sits beyond the longest row, so no line has to bend
  // backwards to reach it.
  const longest = clusters.reduce((max, c) => {
    const last = c.cards[c.cards.length - 1];
    return last ? Math.max(max, last.x + CARD_W) : max;
  }, FAN_X + HUB_RADIUS);
  const convergence = { x: longest + RUN_GAP + 160, y: 0 };

  // Seed the bounds with the idea and the convergence so a map with no themes
  // yet still frames on something real rather than on an inverted-infinity box.
  let minX = core.x - CORE_RADIUS;
  let minY = core.y - CORE_RADIUS;
  let maxX = convergence.x + 260;
  let maxY = core.y + CORE_RADIUS;
  for (const cluster of clusters) {
    minY = Math.min(minY, cluster.y - HUB_RADIUS);
    maxY = Math.max(maxY, cluster.y + HUB_RADIUS);
    for (const card of cluster.cards) {
      minX = Math.min(minX, card.x);
      minY = Math.min(minY, card.y);
      maxX = Math.max(maxX, card.x + CARD_W);
      maxY = Math.max(maxY, card.y + CARD_H);
    }
  }
  void n;

  return { core, clusters, convergence, bounds: { minX, minY, maxX, maxY } };
}

export const CARD_SIZE = { width: CARD_W, height: CARD_H };
export const CORE_SIZE = { radius: CORE_RADIUS };
export const HUB_SIZE = { radius: HUB_RADIUS };
