import type { ReactNode } from 'react';
import { familyOf, type NodeFamily } from '../lib/mapKinds';
import { familyLineVar } from '../lib/nodeAppearance';

/**
 * The mark in a card's top-right corner, naming its family.
 *
 * One glyph per FAMILY, not per kind: eighteen glyphs would be a legend to
 * learn, and the eyebrow beneath already names the exact kind. Six is what the
 * colour system already asks a person to hold, so the icon costs them nothing
 * new — it is the same six categories said a second way, which is what makes
 * the card legible from across the room and still precise up close.
 *
 * Drawn inline, in the manner of `Wordmark` and the magnifier this lifts from
 * `NodeAccentMark`, rather than pulled from an icon package. The reference puts
 * emoji in this slot; emoji render differently on every platform and would be
 * the only mark in the product that this codebase did not draw.
 */

/**
 * The paths inside the ring, one per family, on a 14x14 viewBox centred at
 * (7, 7).
 *
 * A lookup rather than a component that switches on the family: picking one of
 * six fixed path sets is a table, and writing it as a table says so — there is
 * no logic here to give a component a reason to exist.
 */
const FAMILY_GLYPH: Record<NodeFamily, ReactNode> = {
  // The map's subject: the one filled mark, because the root is the one node
  // everything else hangs from.
  subject: <circle cx="7" cy="7" r="2.6" fill="currentColor" />,

  question: (
    <>
      <path
        d="M5.4 5.6a1.7 1.7 0 1 1 1.9 1.9v1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <circle cx="7.3" cy="10.2" r="0.75" fill="currentColor" />
    </>
  ),

  // Strata: what is already true about the world this idea sits in, stacked up
  // underneath it.
  ground: (
    <path
      d="M3.6 6h6.8M3.6 8.4h6.8M3.6 10.8h4"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
    />
  ),

  // The magnifier, carried across from the retired node pill by way of the
  // accent mark: the one glyph that reads as an activity — somebody went and
  // looked — rather than as a category.
  found: (
    <>
      <circle
        cx="6.2"
        cy="6.2"
        r="2.9"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M8.4 8.4 L10.8 10.8"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // Plus over minus: the two directions a judgment can point, in one mark,
  // because pro and risk share a family and the colour is what separates them.
  judgment: (
    <>
      <path
        d="M4.4 5.4h5.2M7 2.8v5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M4.4 10.4h5.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </>
  ),

  // The arrow, pointing the way the map grows.
  forward: (
    <>
      <path
        d="M7 11V3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      <path
        d="M4.4 6.2 7 3.4l2.6 2.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
};

export default function CardIcon({ kind }: { kind: string }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      className="mt-0.5 shrink-0"
      // The family colour as a paint value rather than a class: the ring and
      // the glyph are one colour, and `currentColor` carries it to both.
      style={{ color: familyLineVar(kind) }}
      aria-hidden="true"
    >
      {/* The outlined circle from the timeline reference. Lighter than the
          glyph so the ring reads as a container rather than as part of the
          mark. */}
      <circle
        cx="11"
        cy="11"
        r="10.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
        opacity="0.45"
      />
      <g transform="translate(4 4)">{FAMILY_GLYPH[familyOf(kind)]}</g>
    </svg>
  );
}
