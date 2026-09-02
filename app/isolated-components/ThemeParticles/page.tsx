import Component from "../../../app/components/ThemeParticles";

// The dust around a galaxy's hub.
//
// Deliberately deterministic — a seeded PRNG keyed off the hue — so the server
// and the client render the same dust. That determinism is the testable
// property and the one whose loss produces a real hydration error; the drift
// itself is CSS and is not captured here.

const scenarios: Record<string, { hue: number; muted?: boolean }> = {
  // The first theme's magenta, at rest.
  Default: { hue: 318 },

  // Dimmed while a card is focused, so the dust never competes with the thing
  // being read.
  Muted: { hue: 318, muted: true },

  // The second and third hues the golden angle hands out. Together with the
  // magenta above, these pin what a board's first three galaxies look like.
  Green: { hue: 96 },
  Blue: { hue: 233 },

  // Hue 0 is a real value on the wheel, and a falsy one in JavaScript — worth
  // its own frame because a truthiness check anywhere in the chain would send
  // this to a default colour instead.
  HueZero: { hue: 0 },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // The particles orbit the origin of their positioned parent at a radius of
  // 78–168, so the harness centres that origin in a box wide enough to hold the
  // whole band rather than clipping it at the edges.
  //
  // The hub is drawn here too, and not only for looks: on the board these are
  // always dust around something, so a frame without it shows the component in
  // a state it is never actually in. It also gives the capture's blank-page
  // check something to find — the particles are positioned spans with a
  // background colour and no text, image or SVG, so a field of them reads to
  // that heuristic as an empty page.
  const label = String(props.hue);

  return (
    <div id="codeyam-capture" style={{ background: "#000" }}>
      <div
        style={{
          position: "relative",
          width: 380,
          height: 380,
          display: "grid",
          placeItems: "center",
        }}
      >
        <div style={{ position: "absolute", left: "50%", top: "50%" }}>
          <Component {...props} />
        </div>
        <div
          style={{
            width: 132,
            height: 132,
            borderRadius: "50%",
            background: `hsl(${props.hue} 74% 66%)`,
            display: "grid",
            placeItems: "center",
            color: "#000",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          hue {label}
        </div>
      </div>
    </div>
  );
}
