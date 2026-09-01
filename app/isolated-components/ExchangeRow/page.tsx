import Component from "../../components/ExchangeRow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// One thing that happened to the map. The rows are marked by SIDE — the agent
// gets the dark disc, the person a hollow counterpart of the same size — which
// is what lets the rail read as one column of events rather than two feeds.
const scenarios: Record<string, Props> = {
  // The agent's plainest row: a node landed on the map.
  AgentAdded: {
    entry: {
      id: "e1",
      revision: 8,
      origin: "agent",
      text: "Agent added “Logging gives nothing back”",
      note: null,
    },
  },
  // A run collapsed into one line — an agent turn that wrote four nodes is one
  // thing that happened, not four.
  AgentAddedMany: {
    entry: {
      id: "e2",
      revision: 12,
      origin: "agent",
      text: "Agent added 4 nodes",
      note: null,
    },
  },
  // An agent note carrying a question, which keeps the bold treatment.
  AgentNote: {
    entry: {
      id: "e3",
      revision: 7,
      origin: "agent",
      text: "Agent left a note",
      note: "Your goal is retrieval, so I dropped the shelf-management branch entirely.\nDo you reread your own notes today?",
    },
  },
  // The person's side: the hollow marker, and the answer they gave.
  YourAnswer: {
    entry: {
      id: "e4",
      revision: 15,
      origin: "user",
      text: "You answered a question",
      note: "Almost never, which is probably the whole problem.",
    },
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "AgentAdded" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // The exchange column is 300px wide with 20px padding each side.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260 }}>
        <ul>
          <Component {...props} />
        </ul>
      </div>
    </div>
  );
}
