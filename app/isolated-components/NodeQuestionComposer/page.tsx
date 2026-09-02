"use client";

// A client harness wrapped in BridgeFixture: the composer reads agent presence
// from the bridge, and an isolated capture renders in an iframe where WebMCP is
// unreachable by definition — so `unavailable` is the only state it could
// produce on its own. The listening case is reachable only by providing it.

import { Suspense, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import BridgeFixture from "../BridgeFixture";
import Component from "../../components/NodeQuestionComposer";
import type { BridgeStatus } from "../../components/WebMcpBridge";

type Props = ComponentProps<typeof Component>;

// The composer always knows which node it is about — that is the whole point of
// the kind — so every scenario names one. What varies is whether anyone is
// there to hear the question, which is the one thing the UI could mislead about.
const scenarios: Record<string, Props & { status: BridgeStatus }> = {
  // Nothing attached: the send control and the line beneath it both say the
  // question will wait in the log. This is also the state every real capture
  // produces, so it is the honest default.
  NoAgent: {
    status: "unavailable",
    nodeId: "xn-appr",
    label: "Capture the thought, not the book",
    onClose: () => {},
  },
  // An agent is bound and idle: asking wakes it, and the control says so.
  Listening: {
    status: "connected",
    nodeId: "xn-appr",
    label: "Capture the thought, not the book",
    onClose: () => {},
  },
  // Mid-tool-call still counts as listening — the agent sees the question when
  // its turn comes back round, so `working` must not read as absence.
  AgentWorking: {
    status: "working",
    nodeId: "xn-goal",
    label: "Refind a half-remembered idea",
    onClose: () => {},
  },
  // A long node label, which an agent can freely write: the header truncates
  // rather than pushing the field or the close control out of the card.
  LongLabel: {
    status: "connected",
    nodeId: "xn-appr",
    label:
      "Capture the thought rather than the book, so that retrieval works from a half-remembered idea",
    onClose: () => {},
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "NoAgent";
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  const { status, ...props } = scenario;

  // The empty field is the composer's opening state, so the disabled send
  // control is visible in every one of these captures rather than needing a
  // scenario of its own.
  return (
    <div id="codeyam-capture">
      <BridgeFixture status={status}>
        <Component {...props} />
      </BridgeFixture>
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <Harness />
    </Suspense>
  );
}
