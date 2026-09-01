import Component from "../../components/ExchangeRailEmpty";

// Day one, with no agent attached and nothing in the log. Per the design
// system an empty state describes the next action rather than the absence of
// data — and here that carries more weight than usual, because it is the only
// cue a person has that the map is something two parties write to.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  if (s !== "Default") return <div>Unknown scenario: {s}</div>;
  // The exchange column is 300px wide with 20px padding.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260 }}>
        <Component />
      </div>
    </div>
  );
}
