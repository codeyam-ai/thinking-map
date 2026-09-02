"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/BoardChat";
import type { ExchangeEvent } from "../../lib/exchange";

// A client harness rather than a server page, because the panel takes an
// `onSend` callback and a function cannot cross the server/client boundary as
// a prop.

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

/** A real exchange, with the board-visible kinds deliberately mixed in. The
 *  panel's editorial rule is that `node.added`, `theme.added` and `phase.set`
 *  produce NOTHING here — they are things you can see on the board, and
 *  narrating them would make the conversation a changelog of a picture the
 *  person is already looking at. A fixture that omitted them could not show
 *  that rule holding. */
const EXCHANGE: ExchangeEvent[] = [
  at(1, "user.note", "user", {
    text: "Our vets lose things between the morning and evening shift. Everyone blames the whiteboard but I don't think the whiteboard is the problem.",
  }),
  at(2, "theme.added", "agent", { id: "th-context", label: "What actually gets lost" }),
  at(3, "agent.note", "agent", {
    text: "Agreed that the whiteboard is probably a symptom. Three things worth pulling apart: what falls through, who is carrying it when it falls, and only then what a fix looks like.",
  }),
  at(4, "node.added", "agent", { id: "g-ctx-1", kind: "open-question" }),
  // The shape `toolRuntime` actually records — `{ id, text }` per question, not
  // a bare string. The fixture uses the production shape on purpose: with
  // strings here the panel looked correct while every real agent question
  // rendered as "[object Object]".
  at(5, "question.asked", "agent", {
    questions: [
      { id: "g-ctx-1", text: "Which handover item goes missing most often?" },
    ],
  }),
  at(6, "user.answer", "user", {
    answers: [
      {
        id: "g-ctx-1",
        answer:
          "Owner call-backs. A missed re-check surfaces the next morning; a missed call-back surfaces in a public review three weeks later.",
      },
    ],
  }),
  at(7, "phase.set", "agent", { phase: "explore" }),
  at(8, "agent.note", "agent", {
    text: "If the receptionist is the system, then the board is documentation of a system that lives in one person's head.",
  }),
];

const scenarios: Record<string, { events: ExchangeEvent[] }> = {
  // The ordinary case: a worked exchange, both sides, with the three
  // board-visible kinds present in the log and absent from the panel.
  Default: { events: EXCHANGE },

  // Nothing said yet. The panel has to be present and inviting rather than a
  // blank box — an empty conversation is the state every new board starts in,
  // so it is the one state that must not look broken.
  Empty: { events: [] },

  // A log containing ONLY the kinds the panel drops. It renders as though
  // nothing was said, because as far as the conversation goes nothing was —
  // the board moved, and the board is where you can see that.
  BoardVisibleOnly: {
    events: [
      at(1, "node.added", "agent", { id: "n1", kind: "open-question" }),
      at(2, "theme.added", "agent", { id: "t1", label: "Who is holding it" }),
      at(3, "phase.set", "agent", { phase: "explore" }),
    ],
  },

  // One turn. The panel should read as the start of a conversation rather than
  // as a system message.
  JustOpened: { events: [EXCHANGE[0]] },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const scenario = scenarios[s];
  // Held so sending is genuinely wired up rather than dropped on the floor.
  const [sent, setSent] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The panel sits OVER the board, so the harness supplies the dark ground and
  // a box the size it would occupy there. On white it would read as a different
  // object entirely.
  //
  // The width is explicit rather than `100%`: the panel's root is absolutely
  // positioned, so it contributes nothing to its parent's intrinsic size, and a
  // shrink-to-fit capture element collapses to a hairline around it. 860 leaves
  // the `min(720px, 90%)` panel at its full 720 with the board's margin either
  // side.
  return (
    <div
      id="codeyam-capture"
      style={{
        background: "#0a0a0b",
        height: 720,
        width: 860,
        position: "relative",
      }}
    >
      <Component events={scenario.events} onSend={setSent} />
      {sent ? (
        <div className="absolute left-3 top-3 text-[12px] text-white/40">
          sent: {sent}
        </div>
      ) : null}
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
