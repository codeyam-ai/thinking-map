"use client";

// Asking the partner to go further on one insight.
//
// A client harness inside BridgeFixture: the composer reads agent presence from
// the bridge, and an isolated capture renders in an iframe where WebMCP is
// unreachable by definition — so `unavailable` is the only state it could
// produce on its own, and the listening case is reachable only by providing it.
// That distinction is the one thing this surface could genuinely mislead about,
// so both are captured.
//
// The prompts FILL the box and never send it. Reaching that state needs a real
// click, so it is driven rather than propped — `preview-interact` on a prompt,
// which is what the Demo filmstrip shows.

import { Suspense, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import BridgeFixture from "../BridgeFixture";
import Component from "../../components/InsightGoDeeper";
import type { BridgeStatus } from "../../components/WebMcpBridge";

type Props = ComponentProps<typeof Component>;

const CLAIM = "The whiteboard is a symptom of an ownership gap";

const scenarios: Record<string, Omit<Props, "onClose"> & { status: BridgeStatus }> = {
  // Nothing attached: the send control and the line beneath it both say the
  // question will wait in the log. This is the state every real capture
  // produces, so it is the honest default.
  NoAgent: { status: "unavailable", nodeId: "i-ownership", label: CLAIM },

  // An agent is bound and idle: asking wakes it, and the control says so.
  Listening: { status: "connected", nodeId: "i-ownership", label: CLAIM },

  // Mid-tool-call still counts as listening — the agent sees the question when
  // its turn comes back round, so `working` must not read as absence.
  AgentWorking: { status: "working", nodeId: "i-ownership", label: CLAIM },

  // A long claim, which an agent can freely write. The composer's header
  // truncates rather than pushing the field or the close control out of the
  // card — the full text is on the insight above it.
  LongClaim: {
    status: "connected",
    nodeId: "i-long",
    label:
      "Naming an owner for each case may move the blame rather than the work, if the person named is the one who was already carrying it informally",
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "NoAgent";
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  const { status, ...props } = scenario;

  // The board's plane at the stack's own column width less the card's padding.
  // The empty field is this component's opening state, so the dimmed send
  // control is visible in every one of these captures rather than needing a
  // scenario of its own.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      <div style={{ width: 420 }}>
        <BridgeFixture status={status}>
          <Component {...props} onClose={() => {}} />
        </BridgeFixture>
      </div>
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
