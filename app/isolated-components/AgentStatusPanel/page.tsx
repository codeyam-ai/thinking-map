import Component from "../../components/AgentStatusPanel";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

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

// The detail behind the header line. It exists because the page used to say
// "Agent attached · 9 tools" while the browser had accepted none of them, and
// nothing anywhere printed which ones got through — so these scenarios are the
// states that fact can be in, including the two that used to be invisible.
const scenarios: Record<string, Props> = {
  // Bound to this page, everything accepted. The strongest state: this agent
  // can be asked a question and will wait for the answer.
  BoundToPage: {
    status: "connected",
    channel: "webmcp",
    reason: null,
    registered: TOOLS,
    bindFailures: [],
    convention: "registerTool",
    mapMissing: false,
  },
  // The state that was invisible until presence stopped meaning "a binding
  // exists in this tab": an agent working the map over HTTP. It can read and
  // write, but it cannot raise a question on this page — the distinction the
  // copy has to make, because a person waiting for a reply here would wait
  // forever.
  OverMcpServer: {
    status: "connected",
    channel: "mcp",
    reason: null,
    registered: [],
    bindFailures: [],
    convention: null,
    mapMissing: false,
  },
  // The ordinary case, not an error: WebMCP is top-level-secure-context only,
  // so every preview, every capture, and every browser without an agent lands
  // here. The panel's job is to say the map still works.
  NoAgent: {
    status: "unavailable",
    channel: null,
    reason: "running inside an iframe",
    registered: [],
    bindFailures: [],
    convention: null,
    mapMissing: false,
  },
  // The other state that had no way to be seen. Two tools refused, seven
  // accepted — a page that is genuinely half-bound, and used to be reported as
  // simply "attached".
  PartiallyRefused: {
    status: "connected",
    channel: "webmcp",
    reason: null,
    registered: TOOLS.slice(0, 7),
    bindFailures: [
      { name: "ask_user", reason: "InvalidStateError" },
      {
        name: "await_user_activity",
        reason: "DataCloneError: function could not be cloned",
      },
    ],
    convention: "registerTool",
    mapMissing: false,
  },
  // Deleted underneath an open tab. The tools are still registered and the
  // browser is still bound, so every honest-looking indicator says "attached"
  // while each of those tools answers "No such map" — which is how an agent
  // came to report the app broken to the person using it.
  MapDeleted: {
    status: "unavailable",
    channel: null,
    reason: "this map no longer exists — reload to start a new one",
    registered: TOOLS,
    bindFailures: [],
    convention: "registerTool",
    mapMissing: true,
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "BoundToPage" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // The panel sets its own 300px width, matching the popover it opens as.
  return (
    <div id="codeyam-capture">
      <div style={{ padding: 24 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
