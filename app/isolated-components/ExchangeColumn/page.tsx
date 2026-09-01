import Component from "../../components/ExchangeColumn";
import BridgeFixture from "../BridgeFixture";
import type { ExchangeEvent } from "../../lib/exchange";
import type { FlatNode } from "../../lib/mapLayout";

const at = (
  revision: number,
  kind: ExchangeEvent["kind"],
  origin: ExchangeEvent["origin"],
  payload: unknown,
): ExchangeEvent => ({
  id: `e${revision}`,
  revision,
  kind,
  origin,
  payload,
  createdAt: new Date(0),
});

const node = (
  id: string,
  kind: string,
  label: string,
  status: string,
  order: number,
): FlatNode => ({
  id,
  parentId: "xn-appr",
  kind,
  label,
  detail: null,
  status,
  sourceUrl: null,
  order,
  origin: "agent",
});

const QUESTIONS: FlatNode[] = [
  node("xn-q1", "open-question", "Do you reread your own notes today?", "open", 0),
  node("xn-q2", "open-question", "Is this for you alone, or shared?", "open", 1),
];

const HISTORY: ExchangeEvent[] = [
  at(2, "agent.note", "agent", {
    text: "Treating the abandonment as the real problem rather than the tracking.",
  }),
  at(3, "node.added", "agent", { id: "xn-prob", label: "Abandoned after a week" }),
  at(5, "user.answer", "user", {
    answers: [
      {
        id: "xn-q0",
        text: "What were you hoping to get out of the record?",
        answer: "To find a half-remembered idea again months later.",
      },
    ],
  }),
  at(6, "user.node", "user", { id: "xn-goal", label: "Refind a half-remembered idea" }),
  at(7, "agent.note", "agent", {
    text: "Your goal is retrieval, so I dropped the shelf-management branch entirely.",
  }),
  at(13, "question.asked", "agent", {
    questions: [
      { id: "xn-q1", text: "Do you reread your own notes today?" },
      { id: "xn-q2", text: "Is this for you alone, or shared?" },
    ],
  }),
];

// The whole of the page's half of the exchange, in the order that matters:
// what is being waited on, then the ways to put something in, then the record
// of what already happened. That order is the argument.
const scenarios: Record<
  string,
  { nodes: FlatNode[]; events: ExchangeEvent[]; revision: number | null }
> = {
  // A map both sides have worked, with two questions outstanding.
  Default: { nodes: QUESTIONS, events: HISTORY, revision: 14 },
  // Nothing waiting: the column gives the questions' space back to the record.
  NothingWaiting: {
    nodes: [node("xn-q1", "open-question", "Do you reread your own notes today?", "answered", 0)],
    events: HISTORY,
    revision: 16,
  },
  // Day one — no agent has ever touched this map, so the rail carries its own
  // explanation of how anything gets into it.
  Quiet: { nodes: [], events: [], revision: 1 },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const fixture = scenarios[s];
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  // The column sets its own 300px width; the height comes from the workspace.
  return (
    <div id="codeyam-capture">
      <div style={{ height: 620, display: "flex" }}>
        <BridgeFixture
          status="connected"
          events={fixture.events}
          revision={fixture.revision}
        >
          <Component nodes={fixture.nodes} />
        </BridgeFixture>
      </div>
    </div>
  );
}
