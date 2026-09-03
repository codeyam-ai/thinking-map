import Component from "../../components/AgentStatusNarrative";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// What agent presence MEANS, in prose. The wording is the interface here: the
// difference between "it can ask you questions" and "anything you add waits in
// the log" is the entire practical difference between the two doors, stated to
// someone who has never heard of either.
const scenarios: Record<string, Props> = {
  // Bound to the page — the only channel that can put a question in front of a
  // person and wait for the answer.
  BoundToPage: {
    status: "connected",
    channel: "webmcp",
    reason: null,
    mapMissing: false,
  },
  // Reaching the map over HTTP. It can read and write, and it cannot be asked
  // anything — the sentence that stops someone waiting for a reply that is
  // structurally never coming.
  OverMcpServer: {
    status: "connected",
    channel: "mcp",
    reason: null,
    mapMissing: false,
  },
  // Absence with its reason. It has to read as a fact about the page plus what
  // still works, not as a fault.
  NoAgent: {
    status: "unavailable",
    channel: null,
    reason: "no browser agent (needs Chrome 146+)",
    mapMissing: false,
  },
  // Absence with no reason available — the same honest paragraph, minus a
  // diagnosis it does not have. This is the branch that would render a stray
  // leading full stop if the reason were interpolated unconditionally.
  NoAgentNoReason: {
    status: "unavailable",
    channel: null,
    reason: null,
    mapMissing: false,
  },
  // Outranks every other state, because it is the only one here a person can
  // and must act on.
  MapDeleted: {
    status: "unavailable",
    channel: null,
    reason: "this map no longer exists — reload to start a new one",
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
  // Renders inside the 300px panel, so it is captured at that width.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 300, padding: 16 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
