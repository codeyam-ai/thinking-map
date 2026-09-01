import Component from "../../components/AgentStatus";
import BridgeFixture from "../BridgeFixture";

const TOOLS = [
  "read_map",
  "add_nodes",
  "update_node",
  "set_phase",
  "post_note",
  "ask_user",
  "await_user_activity",
];

// Agent presence reads off the bridge, and an isolated capture renders in an
// iframe where WebMCP is unreachable by definition — so `unavailable` is the
// only state the real bridge could ever produce here. Each state is supplied.
const scenarios: Record<
  string,
  { status: "unavailable" | "connected" | "working"; reason: string | null; tools: string[]; revision: number | null }
> = {
  // The state every preview and capture genuinely produces, and the one a
  // person meets first. It has to read as a fact about the page, not a fault.
  NoAgent: {
    status: "unavailable",
    reason: "running inside an iframe",
    tools: [],
    revision: 14,
  },
  Connected: { status: "connected", reason: null, tools: TOOLS, revision: 14 },
  // A tool is mid-flight: the agent's turn is parked on the person.
  Working: { status: "working", reason: null, tools: TOOLS, revision: 17 },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "NoAgent" } = await searchParams;
  const fixture = scenarios[s];
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  // It sits in the header beside the phase nav, so it is a single row.
  return (
    <div id="codeyam-capture">
      <div style={{ padding: 24 }}>
        <BridgeFixture
          status={fixture.status}
          reason={fixture.reason}
          tools={fixture.tools}
          revision={fixture.revision}
        >
          <Component />
        </BridgeFixture>
      </div>
    </div>
  );
}
