import Component from "../../components/AgentStatus";
import BridgeFixture from "../BridgeFixture";
import type { AgentChannel } from "../../lib/agentPresence";

const TOOLS = [
  "read_map",
  "create_themes",
  "read_brief",
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
//
// The header is now one line at every state: the tool count moved behind the
// click into `AgentStatusPanel`, because it answers a question nobody in front
// of a map is asking. The one exception is a deleted map, which stays inline.
interface Fixture {
  status: "unavailable" | "connected" | "working";
  channel: AgentChannel | null;
  reason: string | null;
  registered: string[];
  mapMissing: boolean;
  /** Which registration convention the browser offered. A page bound over
   *  WebMCP got its tools through one of them, so leaving this null would make
   *  the panel's dev row say "api none" about a binding that plainly happened. */
  convention: "registerTool" | "provideContext" | null;
}

const scenarios: Record<string, Fixture> = {
  // The state every preview and capture genuinely produces, and the one a
  // person meets first. It has to read as a fact about the page, not a fault.
  NoAgent: {
    status: "unavailable",
    channel: null,
    reason: "running inside an iframe",
    registered: [],
    mapMissing: false,
    convention: null,
  },
  Connected: {
    status: "connected",
    channel: "webmcp",
    reason: null,
    registered: TOOLS,
    mapMissing: false,
    convention: "registerTool",
  },
  // A tool is mid-flight: the agent's turn is parked on the person.
  Working: {
    status: "working",
    channel: "webmcp",
    reason: null,
    registered: TOOLS,
    mapMissing: false,
    convention: "registerTool",
  },
  // An agent working this map over HTTP with no WebMCP binding at all. This
  // used to render as "No agent attached" while that agent wrote nodes onto
  // the board — presence meant "a binding exists in this tab", so a whole door
  // was invisible to the page.
  AttachedViaMcp: {
    status: "connected",
    channel: "mcp",
    reason: null,
    registered: [],
    mapMissing: false,
    // Nothing bound in this tab at all — the agent is not coming through the
    // browser, so there is no convention to name.
    convention: null,
  },
  // Deleted underneath an open tab. The only reason that stays on the line
  // rather than behind the click: a person has to act on it, and burying it
  // would mean the page knows the tab is dead and declines to say so.
  MapDeleted: {
    status: "unavailable",
    channel: null,
    reason: "this map no longer exists — reload to start a new one",
    registered: TOOLS,
    mapMissing: true,
    // Still bound, which is the whole trap: the binding succeeded and every
    // tool it registered now answers "No such map".
    convention: "registerTool",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "NoAgent" } = await searchParams;
  const fixture = scenarios[s];
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  // It sits in the header beside the wordmark and the board menu, so it is a
  // single row.
  return (
    <div id="codeyam-capture">
      <div style={{ padding: 24 }}>
        <BridgeFixture
          status={fixture.status}
          channel={fixture.channel}
          reason={fixture.reason}
          registered={fixture.registered}
          convention={fixture.convention}
          tools={TOOLS}
          mapMissing={fixture.mapMissing}
          revision={14}
        >
          <Component />
        </BridgeFixture>
      </div>
    </div>
  );
}
