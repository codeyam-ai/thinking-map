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
  // The headline of the card-visual change: a round that is mostly research
  // reads as its own TERRITORY — banded ground, hairline enclosure, and an
  // eyebrow that names what it is rather than which number it is — so what
  // already exists is legible before a single card on it is read.
  ResearchRound: {
    // The research batch is round TWO on purpose — directly under the idea —
    // so the band and the unbanded row above it are in frame together. That
    // contrast IS the claim; a band you have to scroll to demonstrates nothing.
    nodes: [
      node("r-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
      node("r-res", "r-idea", "research", "Looked at eleven reading tools people kept", "answered", 0, "agent"),
      node("r-f1", "r-idea", "finding", "Every one that stuck gave something back weekly", "answered", 1, "agent"),
      node("r-f2", "r-idea", "finding", "None of them let you search your own sentences", "answered", 2, "agent"),
      node("r-gap", "r-idea", "gap", "Nobody knows what people do with a digest", "open", 3, "agent"),
      node("r-appr", "r-res", "approach", "Capture the sentence, not the book", "answered", 0, "agent"),
      node("r-pro", "r-res", "pro", "One sentence is cheap enough to actually write", "answered", 1, "agent"),
      node("r-risk", "r-res", "risk", "A weekly digest is another thing to ignore", "answered", 2, "agent"),
    ],
    caption: "a research round, set apart",
    events: [
      at(1, "node.added", "user", { id: "r-idea", label: "Tool for tracking reading" }),
      at(2, "agent.note", "agent", { text: "Before proposing anything I went and looked at what already exists." }),
      // Four adds in one contiguous run, three of them research kinds — a
      // clear majority, so the row bands.
      at(4, "node.added", "agent", { id: "r-res", label: "Looked at eleven reading tools people kept" }),
      at(5, "node.added", "agent", { id: "r-f1", label: "Every one that stuck gave something back weekly" }),
      at(6, "node.added", "agent", { id: "r-f2", label: "None of them let you search your own sentences" }),
      at(7, "node.added", "agent", { id: "r-gap", label: "Nobody knows what people do with a digest" }),
      at(9, "node.added", "agent", { id: "r-appr", label: "Capture the sentence, not the book" }),
      at(10, "node.added", "agent", { id: "r-pro", label: "One sentence is cheap enough to actually write" }),
      at(11, "node.added", "agent", { id: "r-risk", label: "A weekly digest is another thing to ignore" }),
    ],
    status: "connected",
    tools: TOOLS,
  },
  // The boundary case, and the one most likely to be got wrong: a round with
  // research in it but not a majority. It must NOT band — otherwise the band
  // stops meaning "this round is about what exists" and starts meaning
  // "somebody looked something up once".
  MixedWithOneFinding: {
    nodes: [
      node("x-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
      node("x-find", "x-idea", "finding", "Every tool that stuck had a weekly digest", "answered", 0, "agent"),
      node("x-q1", "x-idea", "open-question", "Would a weekly digest actually get read?", "open", 1, "agent"),
      node("x-con", "x-idea", "constraint", "It has to work on a train, offline", "answered", 2, "user"),
    ],
    caption: "one finding among three",
    events: [
      at(1, "node.added", "user", { id: "x-idea", label: "Tool for tracking reading" }),
      at(3, "node.added", "agent", { id: "x-find", label: "Every tool that stuck had a weekly digest" }),
      at(4, "node.added", "agent", { id: "x-q1", label: "Would a weekly digest actually get read?" }),
      at(5, "node.added", "agent", { id: "x-con", label: "It has to work on a train, offline" }),
    ],
    status: "connected",
    tools: TOOLS,
  },
  // All six families at once, plus the single updated card. The question this
  // scenario exists to answer is whether six reads as a SYSTEM or as noise —
  // and whether the one lime card still wins the page with five other colours
  // competing for it.
  AllFamilies: {
    // One contiguous agent run, so all five non-root families land in a SINGLE
    // row directly under the subject. Spread across five rounds they would
    // never share a screen and the question this scenario asks — do six read
    // as a system — could not be looked at.
    nodes: [
      node("a-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
      node("a-goal", "a-idea", "goal", "Refind a half-remembered idea", "answered", 0, "agent"),
      node("a-q", "a-idea", "open-question", "Is this for you alone, or shared?", "open", 1, "agent"),
      node("a-find", "a-idea", "finding", "Logging gives nothing back", "answered", 2, "agent"),
      node("a-risk", "a-idea", "risk", "Offline search is expensive to build", "answered", 3, "agent"),
      // Five children, not six: five is what fits abreast at desktop width,
      // and a sixth would wrap the lime card below the fold — which is the one
      // card this scenario most needs in frame. Judgment's other colour (the
      // green of a `pro`) is shown in ResearchRound.
      node("a-slice", "a-idea", "slice", "One box, one sentence, one search", "updated", 4, "agent"),
    ],
    caption: "six families, one lime",
    events: [
      at(1, "node.added", "user", { id: "a-idea", label: "Tool for tracking reading" }),
      at(3, "node.added", "agent", { id: "a-goal", label: "Refind a half-remembered idea" }),
      at(4, "node.added", "agent", { id: "a-q", label: "Is this for you alone, or shared?" }),
      at(5, "node.added", "agent", { id: "a-find", label: "Logging gives nothing back" }),
      at(6, "node.added", "agent", { id: "a-risk", label: "Offline search is expensive to build" }),
      at(7, "node.added", "agent", { id: "a-slice", label: "One box, one sentence, one search" }),
    ],
    status: "connected",
    tools: TOOLS,
  },
  // Six cards in one round, so the band wraps onto two lines. The case the
  // thread measurement is most likely to get wrong: a card on the second line
  // is not below its parent in any useful sense, and the layer has to draw
  // nothing rather than a curve travelling backwards through the row.
  WrappingRound: {
    nodes: [
      node("w-idea", null, "idea", "Tool for tracking reading", "answered", 0, "user"),
      node("w-1", "w-idea", "open-question", "Do you reread your own notes today?", "open", 0, "agent"),
      node("w-2", "w-idea", "open-question", "Is this for you alone, or shared?", "open", 1, "agent"),
      node("w-3", "w-idea", "open-question", "Would a weekly digest actually get read?", "open", 2, "agent"),
      node("w-4", "w-idea", "open-question", "What would make you open it twice?", "open", 3, "agent"),
      node("w-5", "w-idea", "open-question", "Where do you read — phone, or desk?", "open", 4, "agent"),
      node("w-6", "w-idea", "open-question", "What have you tried and dropped?", "open", 5, "agent"),
    ],
    caption: "six questions in one round",
    events: [
      at(1, "node.added", "user", { id: "w-idea", label: "Tool for tracking reading" }),
      at(3, "node.added", "agent", { id: "w-1", label: "Do you reread your own notes today?" }),
      at(4, "node.added", "agent", { id: "w-2", label: "Is this for you alone, or shared?" }),
      at(5, "node.added", "agent", { id: "w-3", label: "Would a weekly digest actually get read?" }),
      at(6, "node.added", "agent", { id: "w-4", label: "What would make you open it twice?" }),
      at(7, "node.added", "agent", { id: "w-5", label: "Where do you read — phone, or desk?" }),
      at(8, "node.added", "agent", { id: "w-6", label: "What have you tried and dropped?" }),
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
