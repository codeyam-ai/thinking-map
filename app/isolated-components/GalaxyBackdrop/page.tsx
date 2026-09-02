import Component from "../../../app/components/GalaxyBackdrop";

// The galaxy the board sits in.
//
// It takes no props — what it draws is fixed. So the scenarios here vary the
// only thing that can vary: the SCALE it is seen at, which on the board is the
// camera's. That is not a contrived axis. The whole trick is that the rings'
// accumulating twist makes their overlaps sweep outward into something the eye
// reads as an arm, and whether that reads at all depends entirely on how much
// of it you can see at once.

const scenarios: Record<string, { scale: number; note: string }> = {
  // Roughly the scale a populated board opens at, where the arms are the
  // point — this is what someone actually sees behind their thinking.
  Default: { scale: 0.16, note: "board scale" },

  // Far out, where the whole disc fits. The tilt is visible here: ellipses
  // rather than circles, so the galaxy reads as seen from slightly above
  // rather than dead on.
  Whole: { scale: 0.075, note: "the whole disc" },

  // Close in, where the individual rings resolve. Worth its own frame because
  // it shows there is no spiral path being drawn — just plain ellipses, each
  // one turned a little further than the last.
  Close: { scale: 0.4, note: "individual rings" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // On the board this sits under the same transform as the cards, anchored at
  // the origin — a backdrop that stayed fixed would slide against the map and
  // destroy the sense that the galaxy is where the thinking lives. The harness
  // reproduces that: a dark frame, the origin at its centre, and one scale.
  return (
    <div id="codeyam-capture" style={{ background: "#000" }}>
      <div
        style={{
          position: "relative",
          width: 760,
          height: 560,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: `scale(${scenario.scale})`,
          }}
        >
          <Component />
        </div>
        <div className="absolute left-4 top-4 text-[11px] uppercase tracking-[0.14em] text-white/30">
          {scenario.note}
        </div>
      </div>
    </div>
  );
}
