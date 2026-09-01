import Component from "../../components/AgentSimulator";

// The stand-in agent, at rest.
//
// It opens collapsed — present enough to find, quiet enough to ignore — and
// opening it is a real interaction, so the open panel is driven against the
// running component rather than seeded here. What this scenario pins is that
// the launcher renders at all outside production, which is the only reason the
// exchange can be demonstrated in a preview.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  if (s !== "Default") return <div>Unknown scenario: {s}</div>;
  // The panel pins itself to the VIEWPORT corner, which in a capture means it
  // escapes the frame and leaves a page of empty space. A transform makes this
  // wrapper the containing block for fixed children, so the panel anchors to
  // the frame instead — the same corner placement, actually in shot.
  return (
    <div id="codeyam-capture">
      <div
        style={{
          width: 440,
          height: 560,
          position: "relative",
          transform: "translateZ(0)",
        }}
      >
        <Component />
      </div>
    </div>
  );
}
