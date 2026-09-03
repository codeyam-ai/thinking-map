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
  imageUrl?: string | null;
  imageAlt?: string | null;
  diagram?: { steps: string[]; note?: string } | null;
  /** The fields `insightStream` reads, carried through so the board can build
   *  the stream from the same nodes it lays out rather than fetching twice.
   *
   *  `layOutGalaxy` itself never touches them: an insight is themeless, so it
   *  is already excluded from every cluster by the `themeId === theme.id`
   *  filter below, and no geometry moves because these are here. They are
   *  optional so every existing caller — and every layout test — is unchanged. */
  origin?: string | null;
  createdAt?: Date | string;
  updatedAt?: Date | string;
  /** Node ids this insight was drawn out of, already parsed. */
  fromNodeIds?: string[] | null;
}

export interface PlacedCard extends GalaxyNodeInput {
  x: number;
  y: number;
  /** This card's own width. Not every card carries the same amount: a diagram
   *  or a screenshot needs room the default column cannot give without
   *  squeezing its content into a strip. */
  w: number;
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
/** What a card carrying a diagram or a picture gets instead. Wide enough that a
 *  four-step flow reads as a flow rather than as a stack of slivers. */
const CARD_W_WIDE = 420;
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
/** How wide a card needs to be. Driven by what it carries, not declared by the
 *  agent: the model should describe content and let the board decide how much
 *  room that content takes, or every card becomes a layout negotiation. */
function widthFor(node: GalaxyNodeInput): number {
  if (node.diagram || node.imageUrl) return CARD_W_WIDE;
  return CARD_W;
}

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
    //
    // Each card's x is the running sum of the widths before it rather than an
    // index times a constant, so a wide card pushes its neighbours along
    // instead of sitting under them.
    let run = cx + HUB_RADIUS + RUN_GAP;
    const cards: PlacedCard[] = own.map((node) => {
      const w = widthFor(node);
      const card: PlacedCard = {
        ...node,
        hue: theme.hue,
        w,
        x: run,
        y: cy - CARD_H / 2,
      };
      run += w + CARD_GAP;
      return card;
    });

    return { theme, x: cx, y: cy, cards };
  });

  // The convergence sits beyond the longest row, so no line has to bend
  // backwards to reach it.
  const longest = clusters.reduce((max, c) => {
    const last = c.cards[c.cards.length - 1];
    return last ? Math.max(max, last.x + last.w) : max;
  }, FAN_X + HUB_RADIUS);
  const convergence = { x: longest + RUN_GAP + 160, y: 0 };

  // Seed the bounds with the idea and the convergence so a map with no themes
  // yet still frames on something real rather than on an inverted-infinity box.
  let minX = core.x - CORE_RADIUS;
  // KNOWN GAP, deliberately not closed here. The core is no longer a disc: its
  // WIDTH is still `CORE_RADIUS * 2`, so minX/maxX stay exact, but its HEIGHT
  // now grows with the length of the idea and these vertical bounds do not know
  // it. A long idea therefore extends a little past what "frame the whole board"
  // fits to.
  //
  // This is a widening of a gap that already existed rather than a new class of
  // problem — the attachments hung below the core have always sat outside these
  // same bounds. Teaching the layout the core's real height is its own change
  // with its own tests in `galaxyLayout.test.ts`, and it needs the height to
  // come from measurement rather than from a constant duplicated here.
  let minY = core.y - CORE_RADIUS;
  // Wide enough for the insight stack that stands here. It is a 460-unit
  // column starting 40 to the LEFT of the convergence point, so the board runs
  // 420 past it — under-reporting that framed the board with the newest
  // insight half outside the frame, which is the one thing at this end of the
  // board somebody is trying to read.
  let maxX = convergence.x + 440;
  let maxY = core.y + CORE_RADIUS;
  for (const cluster of clusters) {
    minY = Math.min(minY, cluster.y - HUB_RADIUS);
    maxY = Math.max(maxY, cluster.y + HUB_RADIUS);
    for (const card of cluster.cards) {
      minX = Math.min(minX, card.x);
      minY = Math.min(minY, card.y);
      maxX = Math.max(maxX, card.x + card.w);
      maxY = Math.max(maxY, card.y + CARD_H);
    }
  }
  void n;

  return { core, clusters, convergence, bounds: { minX, minY, maxX, maxY } };
}

export const CARD_SIZE = { width: CARD_W, height: CARD_H };
export const CORE_SIZE = { radius: CORE_RADIUS };
export const HUB_SIZE = { radius: HUB_RADIUS };
