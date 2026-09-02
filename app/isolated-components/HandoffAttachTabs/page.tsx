import Component from "../../../app/components/HandoffAttachTabs";
import type { ComponentProps } from "react";
import type { HandoffAttachTab } from "../../lib/handoffCopy";

type Props = ComponentProps<typeof Component>;

// The ways to attach an agent, one at a time.
//
// Worth capturing because the whole point is a SUBTRACTION: two of the three
// routes are off screen at any moment. A stack of all three is what this
// replaced, and it is what a careless edit would restore — these frames are
// where "one at a time" is either visibly true or has come undone.
//
// It takes no `onSelect`, so it needs no client harness: which tab is open is
// this component's own state, and it opens on `agent` by itself.

/** The three tabs as `handoffCopy` builds them, for a given endpoint. */
const tabsFor = (url: string, command: string): readonly HandoffAttachTab[] => [
  {
    id: "browser",
    label: "MCP-enabled browser",
    body: "A browser that implements WebMCP — Chrome 146+, at the top level, over HTTPS or localhost — drives this map directly, with nothing to copy. If you can read this panel, yours does not.",
  },
  {
    id: "agent",
    label: "Any agent",
    body: "Add this endpoint in your agent’s connector settings. An agent parked on await_new_map then picks up your next idea the moment you submit it, with nothing to copy.",
    copy: { text: url, label: "Copy MCP URL" },
  },
  {
    id: "claude",
    label: "Claude Code",
    body: "Run this once and this map’s tools are available in your session.",
    copy: { text: command, label: "Copy MCP command" },
  },
];

const scenarios: Record<string, Props> = {
  // The resting state a reader meets: opened on `agent` without being told to,
  // with exactly one endpoint on screen and the other two routes named but not
  // spelled out.
  Default: {
    tabs: tabsFor(
      "https://thinking-map.example.com/api/mcp",
      "claude mcp add --transport http thinking-map https://thinking-map.example.com/api/mcp",
    ),
  },
  // The server render, where the browser's own address is not knowable yet so
  // the endpoint degrades to the relative path. The copyable block shrinks to a
  // fraction of the width while the strip above it does not move — the
  // arrangement where a small mono box is most at risk of reading as a stray
  // fragment rather than as this tab's answer.
  ServerRender: {
    tabs: tabsFor("/api/mcp", "npm run mcp"),
  },
  // The default-tab fallback. `agent` is missing entirely, so the component
  // must open on whatever comes first rather than rendering nothing — the
  // branch that exists because this renderer does not own the copy list it is
  // handed, and no capture of the happy path would show it working.
  NoAgentTab: {
    tabs: tabsFor(
      "https://thinking-map.example.com/api/mcp",
      "claude mcp add --transport http thinking-map https://thinking-map.example.com/api/mcp",
    ).filter((t) => t.id !== "agent"),
  },
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
  // Full-width surface: this sits inside the footnote group, which spans the
  // whole band between the header and the workspace.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
