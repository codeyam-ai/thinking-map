import Component from "../../components/MapWorkspace";
import BridgeFixture from "../BridgeFixture";
import type { ExchangeEvent } from "../../lib/exchange";
import type { FlatNode } from "../../lib/mapLayout";

// The exchange column reads its state from the bridge, and an isolated capture
// renders in an iframe where no agent can ever attach — so each scenario
// supplies the log and the presence it means to show.
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
  parentId: string | null,
  kind: string,
  label: string,
  status: string,
  order: number,
  origin: string,
): FlatNode => ({
  id, parentId, kind, label, detail: null, status, sourceUrl: null, order, origin,
});

const READING_MAP: FlatNode[] = [
  node("xn-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
  node("xn-prob", "xn-idea", "problem", "Abandoned after a week", "answered", 0, "agent"),
  node("xn-goal", "xn-idea", "goal", "Refind a half-remembered idea", "answered", 1, "user"),
  node("xn-find", "xn-prob", "finding", "Logging gives nothing back", "answered", 0, "agent"),
  node("xn-appr", "xn-goal", "approach", "Capture the thought, not the book", "answered", 0, "agent"),
  node("xn-q1", "xn-appr", "open-question", "Do you reread your own notes today?", "open", 0, "agent"),
  node("xn-q2", "xn-appr", "open-question", "Is this for you alone, or shared?", "open", 1, "agent"),
];

const HISTORY: ExchangeEvent[] = [
  at(2, "agent.note", "agent", { text: "Treating the abandonment as the real problem rather than the tracking." }),
  at(3, "node.added", "agent", { id: "xn-prob", label: "Abandoned after a week" }),
  at(4, "question.asked", "agent", { questions: [{ id: "xn-q0", text: "What were you hoping to get out of the record?" }] }),
  at(5, "user.answer", "user", { answers: [{ id: "xn-q0", text: "What were you hoping to get out of the record?", answer: "To find a half-remembered idea again." }] }),
  at(6, "user.node", "user", { id: "xn-goal", label: "Refind a half-remembered idea" }),
  at(7, "agent.note", "agent", { text: "Your goal is retrieval, so I dropped the shelf-management branch entirely." }),
  at(9, "user.note", "user", { text: "That is exactly it — I kept feeding it and it never fed me back." }),
  at(13, "question.asked", "agent", { questions: [{ id: "xn-q1", text: "Do you reread your own notes today?" }, { id: "xn-q2", text: "Is this for you alone, or shared?" }] }),
];

interface Fixture {
  nodes: FlatNode[];
  caption: string;
  events: ExchangeEvent[];
  status: "unavailable" | "connected" | "working";
  tools: string[];
}

const TOOLS = ["read_map", "add_nodes", "update_node", "set_phase", "post_note", "ask_user", "await_user_activity"];

const scenarios: Record<string, Fixture> = {
  // The working surface: the map with most of the frame, two questions waiting
  // on the person, and the give-and-take that got here in the rail.
  Default: {
    nodes: READING_MAP,
    caption: "5 answered, 2 still open",
    events: HISTORY,
    status: "connected",
    tools: TOOLS,
  },
  // The paused moment: the agent's turn is blocked on the person. Same two
  // questions, but now somebody is actually waiting for them.
  AwaitingAnswer: {
    nodes: READING_MAP,
    caption: "5 answered, 2 still open",
    events: HISTORY,
    status: "working",
    tools: TOOLS,
  },
  // Just answered: one question resolved, so it leaves the panel, the node is
  // marked as just-changed on the map, and the answer is the newest rail row.
  JustAnswered: {
    nodes: [
      ...READING_MAP.slice(0, 5),
      node("xn-q1", "xn-appr", "open-question", "Do you reread your own notes today?", "updated", 0, "agent"),
      node("xn-q2", "xn-appr", "open-question", "Is this for you alone, or shared?", "open", 1, "agent"),
    ],
    caption: "6 answered, 1 still open",
    events: [
      ...HISTORY,
      at(15, "user.answer", "user", { answers: [{ id: "xn-q1", text: "Do you reread your own notes today?", answer: "Almost never, which is probably the whole problem." }] }),
      at(16, "node.updated", "user", { id: "xn-q1", status: "answered" }),
    ],
    status: "connected",
    tools: TOOLS,
  },
  // Day one inside the workspace: the seed idea and the three questions the
  // agent asked, none of them answered. Everything on the map is dashed, and
  // the column is entirely "waiting on you" — the moment the exchange starts.
  Seeded: {
    nodes: [
      node("xn-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
      node("q1", "xn-idea", "open-question", "Who is this for?", "open", 0, "agent"),
      node("q2", "xn-idea", "open-question", "What are you hoping to get back?", "open", 1, "agent"),
      node("q3", "xn-idea", "open-question", "What have you tried already?", "open", 2, "agent"),
    ],
    caption: "one seed, 3 open questions",
    events: [
      at(2, "question.asked", "agent", {
        questions: [
          { id: "q1", text: "Who is this for?" },
          { id: "q2", text: "What are you hoping to get back?" },
          { id: "q3", text: "What have you tried already?" },
        ],
      }),
    ],
    status: "connected",
    tools: TOOLS,
  },
  // Far more than fits: six rounds of give-and-take, so the column runs well
  // past the frame and has to be scrolled. This is the claim the whole change
  // makes — the map builds DOWNWARD, and a long conversation becomes a long
  // page rather than a plane you have to navigate.
  //
  // Two of the agent's batches land at the same tree depth on purpose. By depth
  // they would collapse into one row; by round they stay two, which is the
  // distinction the row grouping exists to preserve.
  ManyRounds: {
    nodes: [
      node("xn-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
      node("m-q1", "xn-idea", "open-question", "Do you reread your own notes today?", "answered", 0, "agent"),
      node("m-q2", "xn-idea", "open-question", "Is this for you alone, or shared?", "open", 1, "agent"),
      node("m-own", "xn-idea", "constraint", "It has to work on my phone, on a train", "answered", 2, "user"),
      node("m-find", "xn-idea", "finding", "Every tool that stuck had a weekly digest", "answered", 3, "agent"),
      node("m-q3", "xn-idea", "open-question", "Would a weekly digest actually get read?", "open", 4, "agent"),
      node("m-q4", "xn-idea", "open-question", "What would make you open it twice?", "open", 5, "agent"),
      node("m-appr", "xn-idea", "approach", "Capture the sentence, not the book", "answered", 6, "agent"),
    ],
    caption: "5 answered, 3 still open",
    events: [
      at(1, "node.added", "user", { id: "xn-idea", label: "Tool for tracking reading" }),
      at(2, "node.added", "agent", { id: "m-q1", label: "Do you reread your own notes today?" }),
      at(3, "node.added", "agent", { id: "m-q2", label: "Is this for you alone, or shared?" }),
      at(4, "question.asked", "agent", {
        questions: [
          { id: "m-q1", text: "Do you reread your own notes today?" },
          { id: "m-q2", text: "Is this for you alone, or shared?" },
        ],
      }),
      at(5, "user.answer", "user", {
        answers: [{ id: "m-q1", text: "Do you reread your own notes today?", answer: "Almost never, which is probably the whole problem." }],
      }),
      at(6, "user.node", "user", { id: "m-own", label: "It has to work on my phone, on a train" }),
      at(7, "agent.note", "agent", { text: "Given that, I went looking for what makes a reading tool survive its first month." }),
      at(8, "node.added", "agent", { id: "m-find", label: "Every tool that stuck had a weekly digest" }),
      // A second agent batch, at the SAME depth as the first — two rows, not one.
      at(10, "node.added", "agent", { id: "m-q3", label: "Would a weekly digest actually get read?" }),
      at(11, "node.added", "agent", { id: "m-q4", label: "What would make you open it twice?" }),
      at(12, "question.asked", "agent", {
        questions: [
          { id: "m-q3", text: "Would a weekly digest actually get read?" },
          { id: "m-q4", text: "What would make you open it twice?" },
        ],
      }),
      at(14, "node.added", "agent", { id: "m-appr", label: "Capture the sentence, not the book" }),
    ],
    status: "connected",
    tools: TOOLS,
  },
  // Day one: a map with nothing in the log yet, so the rail carries its own
  // explanation of how anything gets into it.
  Quiet: {
    nodes: [node("xn-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user")],
    caption: "one seed",
    events: [],
    status: "unavailable",
    tools: [],
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const fixture = scenarios[s];
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div className="flex flex-col" style={{ height: 640 }}>
        <BridgeFixture
          status={fixture.status}
          tools={fixture.tools}
          events={fixture.events}
          revision={fixture.events[fixture.events.length - 1]?.revision ?? null}
        >
          <Component nodes={fixture.nodes} caption={fixture.caption} />
        </BridgeFixture>
      </div>
    </div>
  );
}
