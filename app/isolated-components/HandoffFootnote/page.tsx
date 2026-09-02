import Component from "../../../app/components/HandoffFootnote";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The honest paragraph about why nobody is attached, what attaching buys, and
// the three ways in as tabs — kept, and kept small, beneath the action.
//
// Worth capturing because "demoted" is a visual claim and this is where it is
// either true or not. These paragraphs used to OPEN the panel; if they ever
// read as loud as the instruction again, the change this component exists to
// hold has quietly come undone. Two more claims only a capture can settle:
// that a reader sees ONE way in at a time rather than a stack of all three,
// and that a long unbreakable endpoint wraps INSIDE its rounded box.

// The real wording, shared because it is identical across frames — what varies
// between them is only the endpoint, which is the variable under test here.
const EXPLANATION =
  "Your idea is saved. Nothing is working on it yet — a map cannot summon a thinking partner, so an agent has to come to it.";
const ATTACH_HINT =
  "Attach an agent and it gets this map’s tools — it can read the brief, add nodes and ask you questions in place, with nothing pasted back and forth.";
const BROWSER_BODY =
  "A browser that implements WebMCP — Chrome 146+, at the top level, over HTTPS or localhost — drives this map directly, with nothing to copy. If you can read this panel, yours does not.";
const AGENT_BODY =
  "Add this endpoint in your agent’s connector settings. An agent parked on await_new_map then picks up your next idea the moment you submit it, with nothing to copy.";
const CLAUDE_BODY =
  "Run this once and this map’s tools are available in your session.";

/** The three tabs as `handoffCopy` builds them, for a given endpoint. */
const tabsFor = (url: string, command: string): Props["attachTabs"] => [
  { id: "browser", label: "MCP-enabled browser", body: BROWSER_BODY },
  {
    id: "agent",
    label: "Any agent",
    body: AGENT_BODY,
    copy: { text: url, label: "Copy MCP URL" },
  },
  {
    id: "claude",
    label: "Claude Code",
    body: CLAUDE_BODY,
    copy: { text: command, label: "Copy MCP command" },
  },
];

const scenarios: Record<string, Props> = {
  // The real wording, exactly as handoffCopy returns it, on the tab the panel
  // opens to. This is the frame that shows the resting state a reader meets:
  // two short grey lines, a strip of three, and exactly one thing to copy.
  Default: {
    explanation: EXPLANATION,
    attachHint: ATTACH_HINT,
    attachTabs: tabsFor(
      "https://thinking-map.example.com/api/mcp",
      "claude mcp add --transport http thinking-map https://thinking-map.example.com/api/mcp",
    ),
  },
  // The server render's fallback, where the browser's own address is not
  // knowable yet so the endpoint degrades to the relative path. Worth its own
  // frame because the copyable block shrinks to a fraction of the width here
  // while the tab strip above it does not move — the arrangement where a small
  // mono box is most at risk of reading as a stray fragment.
  ServerRender: {
    explanation: EXPLANATION,
    attachHint: ATTACH_HINT,
    attachTabs: tabsFor("/api/mcp", "npm run mcp"),
  },
  // The frame the wrap fix exists for: a deployment whose host is long enough
  // that the endpoint is comfortably wider than its box even before the column
  // is narrowed, and the column is narrowed as well (see FRAME_CLASS). Default
  // above happens to reproduce the overflow today, but only because its origin
  // is long; this frame makes that a property of the scenario rather than a
  // coincidence a shorter example origin could quietly remove.
  LongOrigin: {
    explanation: EXPLANATION,
    attachHint: ATTACH_HINT,
    attachTabs: tabsFor(
      "https://thinking-map-staging.eu-west-1.internal.example-corp.com/api/mcp",
      "claude mcp add --transport http thinking-map https://thinking-map-staging.eu-west-1.internal.example-corp.com/api/mcp",
    ),
  },
};

// How wide the column is for each frame. The band is full-width in the app, so
// full width is the honest default; `LongOrigin` narrows it because the bug is
// a relationship between a token and the box holding it, and squeezing the box
// is the other half of that relationship.
const FRAME_CLASS: Record<string, string> = {
  LongOrigin: "max-w-[380px]",
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // Full-width surface by default: this sits at the foot of the band, which
  // spans the whole column between the header and the workspace. A frame that
  // is specifically about a narrow column says so in FRAME_CLASS.
  return (
    <div id="codeyam-capture" className={FRAME_CLASS[s] ?? ""}>
      <Component {...props} />
    </div>
  );
}
