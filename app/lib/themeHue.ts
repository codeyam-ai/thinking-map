// Colour assignment for themes.
//
// The agent names a theme; this decides what colour it is. That split is
// deliberate. On this board colour is not decoration — it is how you know which
// galaxy you are looking at when the map is zoomed out far enough that the
// labels have stopped being readable. So the hues have to stay mutually
// distinguishable for however many themes an idea turns out to need, which is
// not something a model choosing "a nice pink" can guarantee across a session
// it does not remember.
//
// Hues are handed out on the golden angle (137.5°). Stepping the colour wheel
// by an irrational fraction of a turn means consecutive themes land far apart,
// and — unlike dividing the wheel into N slots — it needs no advance knowledge
// of how many themes there will be. Theme 9 is as distinguishable from theme 8
// as theme 2 was from theme 1.

/** Degrees per step. The golden angle: 360° × (1 − 1/φ). */
const GOLDEN_ANGLE = 137.508;

/** Where the sequence starts. Magenta, because the first theme a map opens is
 *  the one the whole board is introduced by, and it should look like the
 *  mockup rather than like whatever 0° happens to be. */
const FIRST_HUE = 318;

/**
 * The hue for the nth theme of a map (0-based).
 *
 * Pure and total: the same index always yields the same hue, so a theme's
 * colour survives a reload without being stored twice, and a map rendered on
 * two screens looks identical.
 */
export function hueForIndex(index: number): number {
  const raw = FIRST_HUE + index * GOLDEN_ANGLE;
  // Non-negative modulo: a negative index would otherwise produce a negative
  // hue, which every CSS colour function reads as invalid rather than as
  // wrapping around the wheel.
  return Math.round(((raw % 360) + 360) % 360);
}

/** The theme's colour as a CSS value, at the given lightness and saturation.
 *  One place decides what a theme looks like, so a card, its connector and its
 *  cluster label cannot drift apart. */
export function themeColor(
  hue: number,
  { s = 74, l = 66, a = 1 }: { s?: number; l?: number; a?: number } = {},
): string {
  return a === 1 ? `hsl(${hue} ${s}% ${l}%)` : `hsl(${hue} ${s}% ${l}% / ${a})`;
}
