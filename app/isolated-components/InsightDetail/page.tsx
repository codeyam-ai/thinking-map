"use client";

// What opening an insight reveals.
//
// A client harness inside BridgeFixture: the composer at the bottom reads agent
// presence from the bridge, and an isolated capture renders in an iframe where
// WebMCP is unreachable by definition — so `unavailable` is the only state it
// could produce on its own, and the listening case is reachable only by
// providing it. That distinction is the one thing this surface could genuinely
// mislead about, so both are captured.

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import BridgeFixture from "../BridgeFixture";
import Component from "../../components/InsightDetail";
import type { BoardInsight } from "../../components/InsightCard";
import type { BridgeStatus } from "../../components/WebMcpBridge";

const CITED = [
  { id: "q-owner", label: "Who is carrying a case between shifts?" },
  { id: "q-wipe", label: "What happens the moment the board is wiped?" },
];

const BASE: BoardInsight = {
  id: "i-ownership",
  kind: "suggestion",
  label: "The whiteboard is a symptom of an ownership gap",
  detail:
    "Nothing is lost while it is on the board. Things are lost at the moment the board is wiped and nobody is carrying them.",
  themeId: null,
  status: null,
  createdAt: "2026-08-30T09:00:00.000Z",
  updatedAt: "2026-08-30T09:00:00.000Z",
  answersSince: 0,
  stale: false,
  from: CITED,
  choices: [
    "Test a named owner on paper for a week",
    "Look at the evening shift first",
    "Something else",
  ],
};

const scenarios: Record<
  string,
  { insight: BoardInsight; status: BridgeStatus }
> = {
  // Everything at once, with an agent attached: the detail, the questions this
  // came out of, the ways forward, and the box that asks the partner to go
  // further on this one specifically.
  Default: { insight: BASE, status: "connected" },

  // The same thing with nobody attached — the state every real capture
  // produces. The send control says the question will wait in the log rather
  // than implying an answer is coming.
  NoAgent: { insight: BASE, status: "unavailable" },

  // The agent cited nothing. "What this came out of" is absent entirely rather
  // than an empty heading, which would read as something that failed to load.
  NoCitations: { insight: { ...BASE, from: [] }, status: "connected" },

  // A claim with no routes offered and no supporting paragraph: the partner
  // named something without proposing ways to take it. Both absences have to
  // close up rather than leave gaps where a heading would have been.
  ClaimAlone: {
    insight: { ...BASE, detail: null, choices: null, from: [CITED[0]] },
    status: "connected",
  },

  // Mid-tool-call still counts as listening — the agent sees the question when
  // its turn comes back round, so `working` must not read as absence.
  AgentWorking: { insight: BASE, status: "working" },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The board's plane, and the stack's own column width less the card's
  // padding — this never renders on paper and never at another width.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      <div style={{ width: 420 }}>
        <BridgeFixture status={scenario.status}>
          <Component
            insight={scenario.insight}
            onChoose={() => {}}
            onClose={() => {}}
          />
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
