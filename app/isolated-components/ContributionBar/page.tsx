import Component from "../../components/ContributionBar";
import BridgeFixture from "../BridgeFixture";

// The two direct ways to put something into the map. Deliberately NOT a chat
// box: one line, no history under it, and what you send lands in the activity
// rail rather than in a thread.
//
// It opens on Note. Switching to Add node — which reveals the kind picker — is
// a real interaction, so it is driven against the running component rather
// than seeded through a prop that exists only for the capture.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  if (s !== "Default") return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260 }}>
        <BridgeFixture status="connected" revision={14}>
          <Component />
        </BridgeFixture>
      </div>
    </div>
  );
}
