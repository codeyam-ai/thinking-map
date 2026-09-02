// The galaxy the board sits in.
//
// Concentric ellipses, each one slightly larger and slightly more rotated than
// the last. That progressive twist is the whole trick: individually they are
// plain ellipses, but the accumulating rotation makes their overlaps sweep
// outward, which the eye reads as a spiral arm. Drawing actual spiral paths
// gives a tidier, deader figure — a logo rather than a place.
//
// Ellipses rather than circles because the disc is meant to read as tilted,
// seen from slightly above rather than dead on.
//
// One SVG under the board's own transform, so it scales and pans with the
// cards. A backdrop that stayed fixed would slide against the map and destroy
// the sense that the galaxy is where the thinking lives.

/** How many rings. Enough that the arms resolve; past ~40 the added lines only
 *  thicken the haze near the centre. */
const RINGS = 34;
const INNER = 210;
const STEP = 96;
/** Degrees of extra rotation per ring. Small — the arms come from accumulation
 *  across many rings, and a large step just looks like a shuffled deck. */
const TWIST = 4.4;
/** Vertical squash. 1 would be face-on; this is the tilt. */
const FLATTEN = 0.56;

export default function GalaxyBackdrop() {
  return (
    <svg
      className="pointer-events-none absolute left-0 top-0 overflow-visible"
      width={1}
      height={1}
      aria-hidden="true"
    >
      {Array.from({ length: RINGS }, (_, i) => {
        const rx = INNER + i * STEP;
        return (
          <ellipse
            key={i}
            cx={0}
            cy={0}
            rx={rx}
            ry={rx * FLATTEN}
            fill="none"
            stroke="rgba(255,255,255,0.13)"
            strokeWidth={1.4}
            transform={`rotate(${i * TWIST})`}
          />
        );
      })}
    </svg>
  );
}
