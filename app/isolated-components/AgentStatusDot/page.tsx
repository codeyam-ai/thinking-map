import Component from "../../components/AgentStatusDot";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// All three states of agent presence. Absence is the ORDINARY case here — a
// preview iframe, Safari, any page opened without an agent — so it gets the
// neutral line colour rather than a warning one, which is the whole point of
// seeing the three side by side.
const scenarios: Record<string, Props> = {
  Connected: { status: "connected" },
  Working: { status: "working" },
  Unavailable: { status: "unavailable" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Connected" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // An 8px dot needs a frame, or the capture is a few stray pixels.
  return (
    <div id="codeyam-capture">
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: 24 }}>
        <Component {...props} />
        <span className="text-[12px] text-muted">{props.status}</span>
      </div>
    </div>
  );
}
