import Component from "../../components/SummaryScreen";
import BridgeFixture from "../BridgeFixture";
import type { ExchangeEvent } from "../../lib/exchange";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const EVENTS: ExchangeEvent[] = [
  { id: "e1", revision: 21, kind: "agent.note", origin: "agent", payload: { text: "Pulling the plan together from what we settled." }, createdAt: new Date(0) },
  { id: "e2", revision: 22, kind: "node.added", origin: "agent", payload: { label: "Interview 3 teachers" }, createdAt: new Date(0) },
  { id: "e3", revision: 23, kind: "node.added", origin: "agent", payload: { label: "Sketch the classroom vocabulary flow" }, createdAt: new Date(0) },
  { id: "e4", revision: 24, kind: "phase.set", origin: "agent", payload: { phase: "next-steps" }, createdAt: new Date(0) },
  { id: "e5", revision: 25, kind: "user.note", origin: "user", payload: { text: "The assessment angle is the one I keep coming back to." }, createdAt: new Date(0) },
];

const scenarios: Record<string, Props> = {
  Default: {
    nodes: [
      { id: "k1", kind: "known", label: "Vocabulary is the strongest fit for ages 6-8.", detail: null, order: 0 },
      { id: "k2", kind: "known", label: "Three existing apps miss parent involvement.", detail: null, order: 1 },
      { id: "u1", kind: "unknown", label: "Whether teachers would pay for this.", detail: null, order: 2 },
      { id: "d1", kind: "direction", label: "Classroom vocabulary game", detail: null, order: 3 },
      { id: "d2", kind: "direction", label: "Teacher assessment tool", detail: null, order: 4 },
      { id: "s1", kind: "next-step", label: "Interview 3 teachers", detail: null, order: 5 },
      { id: "s2", kind: "next-step", label: "Sketch the classroom vocabulary flow", detail: null, order: 6 },
    ],
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div className="flex flex-col" style={{ height: 900 }}>
        {/* The plan is a starting point, so the summary keeps a way to put the
            next thought in — which means it needs a bridge like any other
            contribution surface. */}
        <BridgeFixture status="connected" events={EVENTS} revision={25}>
          <Component {...props} />
        </BridgeFixture>
      </div>
    </div>
  );
}
