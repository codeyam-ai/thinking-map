import Component from "../../components/KeepThinkingPanel";
import BridgeFixture from "../BridgeFixture";
import type { ExchangeEvent } from "../../lib/exchange";

const at = (
  revision: number,
  kind: ExchangeEvent["kind"],
  origin: ExchangeEvent["origin"],
  payload: unknown,
): ExchangeEvent => ({
  id: `e${revision}`,
  revision,
  kind,
  origin,
  payload,
  createdAt: new Date(0),
});

// What sits under the finished plan. The summary is the end of the loop and
// deliberately not a dead end — the plan is a starting point, so the map stays
// writable here. There are no open questions on this screen by definition, so
// this is the contribution bar and the record without the waiting-on-you panel.
const scenarios: Record<string, ExchangeEvent[]> = {
  Default: [
    at(21, "agent.note", "agent", { text: "Pulling the plan together from what we settled." }),
    at(22, "node.added", "agent", { label: "Interview 3 teachers" }),
    at(23, "node.added", "agent", { label: "Sketch the classroom vocabulary flow" }),
    at(24, "phase.set", "agent", { phase: "next-steps" }),
    at(25, "user.note", "user", {
      text: "The assessment angle is the one I keep coming back to.",
    }),
  ],
  // Reached the plan with nothing recorded on the way — possible when the map
  // was built through a front door that never posted notes.
  Quiet: [],
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const events = scenarios[s];
  if (!events) return <div>Unknown scenario: {s}</div>;
  // The panel centres itself at 560px under the summary.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 620, height: 460 }}>
        <BridgeFixture
          status="connected"
          events={events}
          revision={events.length > 0 ? 25 : 1}
        >
          <Component />
        </BridgeFixture>
      </div>
    </div>
  );
}
