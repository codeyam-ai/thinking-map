import Component from "../../../app/components/AttachTabPanel";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// What one way in actually says: a line, and at most one thing to copy.
//
// Worth capturing because of the decision it owns — that a tab with nothing to
// copy renders NO box, not an empty one. `Browser` below is the frame where
// that is either true or quietly undone: a placeholder box under "there is
// nothing to copy" would contradict the sentence above it in the most visible
// way available, and no unit test reads as an empty box.
const scenarios: Record<string, Props> = {
  // The route the band opens on, and the one every reader can act on.
  AnyAgent: {
    tab: {
      id: "agent",
      label: "Any agent",
      body: "Add this endpoint in your agent’s connector settings. An agent parked on await_new_map then picks up your next idea the moment you submit it, with nothing to copy.",
      copy: {
        text: "https://thinking-map.example.com/api/mcp",
        label: "Copy MCP URL",
      },
    },
  },
  // The route with NOTHING to copy. The absence of a mono box below the line
  // is the whole frame.
  Browser: {
    tab: {
      id: "browser",
      label: "MCP-enabled browser",
      body: "A browser that implements WebMCP — Chrome 146+, at the top level, over HTTPS or localhost — drives this map directly, with nothing to copy. If you can read this panel, yours does not.",
    },
  },
  // The longest copyable string this panel ever holds, on a deployment whose
  // host is long enough that the command is wider than its box. The wrap has
  // to happen INSIDE the rounded border — the reported bug, rendered.
  ClaudeCodeLongOrigin: {
    tab: {
      id: "claude",
      label: "Claude Code",
      body: "Run this once and this map’s tools are available in your session.",
      copy: {
        text: "claude mcp add --transport http thinking-map https://thinking-map-staging.eu-west-1.internal.example-corp.com/api/mcp",
        label: "Copy MCP command",
      },
    },
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "AnyAgent" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // Full-width surface: this panel spans the footnote group, which spans the
  // whole band between the header and the workspace.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
