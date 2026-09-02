// The dust around a galaxy.
//
// Dashes and dots orbiting each hub in the theme's own colour, so a cluster
// reads as a place with something going on in it rather than as a circle with
// cards next to it. Purely atmospheric — nothing here is interactive, and the
// whole layer is pointer-events-none so it can never eat a click meant for a
// card.
//
// Two constraints shaped the implementation:
//
// 1. Deterministic. Positions come from a seeded generator keyed on the theme's
//    hue, never from `Math.random()`. A random layout would differ between the
//    server render and the first client render, which React reports as a
//    hydration mismatch — and the particles would visibly jump on load.
//
// 2. Animated by CSS, not by React. Each particle is a rotating ring, so the
//    compositor owns the motion and the board can carry a few hundred of them
//    without a single re-render. Driving this from a rAF loop in state would
//    re-render every card on the board sixty times a second.

import { themeColor } from '@/app/lib/themeHue';

/** A tiny deterministic PRNG (mulberry32). Same seed, same dust, forever. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Enough to read as a field rather than as a few stray marks. The reference
 *  this is drawn from is dense; sparse dust just looks like dirt on the
 *  screen. */
const COUNT = 46;
/** Inner and outer edge of the dust band, measured from the hub's centre.
 *  Starts just outside the hub and stops short of the cards, so the band belongs
 *  to the galaxy rather than drifting across what you are reading. */
const R_MIN = 78;
const R_MAX = 168;

export default function ThemeParticles({
  hue,
  /** Dimmed while a card is focused, so the dust never competes with the thing
   *  being read. */
  muted = false,
}: {
  hue: number;
  muted?: boolean;
}) {
  const rand = seeded(Math.round(hue) * 2654435761);

  const particles = Array.from({ length: COUNT }, (_, i) => {
    const angle = rand() * 360;
    const radius = R_MIN + rand() * (R_MAX - R_MIN);
    // All dots, no dashes. A dash has a direction, and at this size the eye
    // reads that direction as a stray mark or a rendering artefact rather than
    // as motion — the movement is already carried by the orbit.
    //
    // Sizes are spread wide and skewed small: cubing a 0–1 roll puts most
    // particles near the floor and lets a few reach the ceiling, which is what
    // gives the field depth. A uniform roll clusters everything mid-range and
    // reads as one size drawn slightly badly.
    const r = rand();
    const len = 1.6 + r * r * r * 8.5;
    // Vary both duration and direction so the band never rotates as one rigid
    // disc, which is the tell that it is a single spinning element.
    const duration = 26 + rand() * 46;
    const reverse = rand() > 0.6;
    const delay = -rand() * duration;
    // Opacity varies per particle so the band has depth instead of reading as
    // one flat stencil. The floor is high enough that no particle is invisible
    // against black — an invisible particle is just cost.
    return { i, angle, radius, len, duration, reverse, delay, o: 0.45 + rand() * 0.5 };
  });

  return (
    <div
      className="pointer-events-none absolute left-0 top-0"
      style={{ opacity: muted ? 0.25 : 1, transition: 'opacity 400ms ease' }}
      aria-hidden="true"
    >
      {particles.map((p) => (
        <div
          key={p.i}
          className="absolute left-0 top-0"
          style={{
            // The ring is what spins; the particle rides on its edge. Rotating
            // a positioned dot directly would need its own transform-origin
            // maths per particle.
            animation: `cy-orbit ${p.duration}s linear ${p.delay}s infinite${p.reverse ? ' reverse' : ''}`,
            transform: `rotate(${p.angle}deg)`,
          }}
        >
          <span
            className="absolute block rounded-full"
            style={{
              width: p.len,
              height: p.len,
              left: p.radius,
              top: -1,
              background: themeColor(hue, { s: 82, l: 72 }),
              opacity: p.o,
            }}
          />
        </div>
      ))}
    </div>
  );
}
