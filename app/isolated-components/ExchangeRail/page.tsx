import Component from "../../components/ExchangeRail";
import type { ExchangeEvent } from "../../lib/exchange";

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

// A map both sides have worked. The rail renders the RAW log, so these
// scenarios also exercise the two suppression rules: the open-question nodes
// that ask_user created are hidden behind "asked 2 questions", and the
// node.updated that closed an answered question does not get its own row.
const HISTORY: ExchangeEvent[] = [
  at(1, "node.added", "user", { id: "xn-idea", label: "Tool for tracking reading" }),
  at(2, "agent.note", "agent", {
    text: "Treating the abandonment as the real problem rather than the tracking.",
  }),
  at(3, "node.added", "agent", { id: "xn-prob", label: "Abandoned after a week" }),
  at(4, "question.asked", "agent", {
    questions: [{ id: "xn-q0", text: "What were you hoping to get out of the record?" }],
  }),
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
  at(8, "node.added", "agent", { id: "xn-find", label: "Logging gives nothing back" }),
  at(9, "user.note", "user", {
    text: "That is exactly it — I kept feeding it and it never fed me back.",
  }),
  at(10, "node.added", "agent", { id: "xn-appr", label: "Capture the thought, not the book" }),
  at(11, "node.added", "agent", { id: "xn-q1", label: "Do you reread your own notes today?" }),
  at(12, "node.added", "agent", { id: "xn-q2", label: "Is this for you alone, or shared?" }),
  at(13, "question.asked", "agent", {
    questions: [
      { id: "xn-q1", text: "Do you reread your own notes today?" },
      { id: "xn-q2", text: "Is this for you alone, or shared?" },
    ],
  }),
  at(14, "phase.set", "agent", { phase: "explore" }),
];

const scenarios: Record<string, ExchangeEvent[]> = {
  // The give-and-take that got the map here, both sides interleaved.
  Default: HISTORY,
  // Nothing has happened yet, so the rail explains how anything gets into it.
  Empty: [],
  // An answer arriving, with the mechanical node.updated behind it suppressed
  // so one act reads as one line.
  JustAnswered: [
    ...HISTORY,
    at(15, "user.answer", "user", {
      answers: [
        {
          id: "xn-q1",
          text: "Do you reread your own notes today?",
          answer: "Almost never, which is probably the whole problem.",
        },
      ],
    }),
    at(16, "node.updated", "user", { id: "xn-q1", status: "answered" }),
  ],
  // A single agent turn that wrote a lot: the run collapses to a count rather
  // than burying the rest of the log.
  BigTurn: [
    ...HISTORY,
    ...Array.from({ length: 6 }, (_, i) =>
      at(15 + i, "node.added", "agent", { id: `bulk-${i}`, label: `Finding ${i + 1}` }),
    ),
  ],
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const events = scenarios[s];
  if (!events) return <div>Unknown scenario: {s}</div>;
  // The exchange column: 300px wide, 20px padding, and the rail takes the
  // height left under the questions and the contribution bar.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260, height: 460, display: "flex" }}>
        <Component events={events} />
      </div>
    </div>
  );
}
