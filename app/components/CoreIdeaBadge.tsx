// The marker on the core, parked at a corner.
//
// It used to orbit — an arm centred on the disc turning once every 54 seconds,
// with the badge counter-rotating so the word stayed upright. That path was a
// circle of radius CORE_RADIUS, which only worked while the core WAS a circle
// of that radius. On a card that is taller than it is wide the same path cuts
// straight through the card's own edges, so the orbit could not survive the
// core becoming paper.
//
// It sits on the corner the orbit used to start from, overlapping enough to
// read as attached to the card but pulled back far enough to clear the card's
// padding — a badge centred exactly on the corner covered the first word of the
// eyebrow beneath it. pointer-events-none because it is scenery, and a marker
// you can click is a target you did not mean to offer.

const BADGE = '#e4ec4b';
const SIZE = 88;
/** Overlap into the card. Clears the card's 40px padding; see above. */
const CORNER_INSET = -58;

export default function CoreIdeaBadge() {
  return (
    <div
      className="pointer-events-none absolute flex items-center justify-center rounded-full text-[16px] font-semibold text-black"
      style={{
        left: 0,
        top: 0,
        width: SIZE,
        height: SIZE,
        marginLeft: CORNER_INSET,
        marginTop: CORNER_INSET,
        background: BADGE,
      }}
    >
      Idea
    </div>
  );
}
