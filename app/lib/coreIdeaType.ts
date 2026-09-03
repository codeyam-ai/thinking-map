// How large the idea is set on the core card.
//
// The rule here is the INVERSE of the one this file replaced. The core used to
// be a fixed circle, so a longer idea could only be accommodated by shrinking
// the words — and past a few hundred characters even that failed and the text
// escaped the circle onto the black board.
//
// Now the type has a FLOOR and the card grows downward to hold what it must.
// The idea a person typed is the one thing on that board entirely theirs, so
// legibility wins and the paper takes up the slack.
//
// It steps rather than scaling continuously: two ideas a few characters apart
// must not read at visibly different sizes on the same board.

/** Below this the idea stops being readable at board zoom. Never go under it. */
export const CORE_IDEA_TYPE_FLOOR = 18;

/** A short idea has nothing to trade, so it gets the whole scale. */
export const CORE_IDEA_TYPE_CEILING = 30;

/**
 * The size, in px, to set an idea of this length at on the core card.
 *
 * Takes the idea itself rather than a number so no caller has to remember
 * which length is being measured.
 */
export function coreIdeaFontSize(idea: string): number {
  const length = idea.length;
  if (length > 600) return CORE_IDEA_TYPE_FLOOR;
  if (length > 300) return 21;
  if (length > 120) return 24;
  return CORE_IDEA_TYPE_CEILING;
}
