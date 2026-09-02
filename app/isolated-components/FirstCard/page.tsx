import Component from "../../components/FirstCard";

// Where a board begins: the one card on the landing screen.
//
// It takes no props. Everything it can be — a typed idea, files picked, the
// submit in flight, a failed start — is internal state set by the person using
// it, with no seam to preset from outside. So there is one honest frame here:
// the resting state a person actually arrives at. The rest are reachable only
// by driving the real controls, and the behaviour behind them is asserted in
// the tests rather than pictured.

const scenarios: Record<string, { note: string }> = {
  Default: { note: "at rest" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  if (!scenarios[s]) return <div>Unknown scenario: {s}</div>;

  // It sits alone on the landing screen's dark ground, at the width the card
  // actually takes there rather than filling whatever it is given.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div style={{ width: 620 }}>
        <Component />
      </div>
    </div>
  );
}
