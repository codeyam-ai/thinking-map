"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/BoardChat";
import type { ExchangeEvent } from "../../lib/exchange";
import type { GalaxyNodeInput, GalaxyTheme } from "../../lib/galaxyLayout";

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

/** Hues as `hueForIndex` hands them out for themes 0, 1 and 2, written as
 *  literals so a scenario cannot drift if the sequence is ever re-anchored. */
const THREE_THEMES: GalaxyTheme[] = [
  { id: "th-who", label: "Who turns up", hue: 318, order: 0 },
  { id: "th-broken", label: "When a repair fails", hue: 96, order: 1 },
  { id: "th-money", label: "Money", hue: 233, order: 2 },
];

/** Only the fields the panel reads — it resolves an answer's node id to a
 *  theme and stops there. */
const card = (id: string, themeId: string): GalaxyNodeInput => ({
  id,
  themeId,
  kind: "open-question",
  label: "A question",
  detail: null,
  status: "answered",
});

const scenarios: Record<
  string,
  { events: ExchangeEvent[]; themes?: GalaxyTheme[]; nodes?: GalaxyNodeInput[] }
> = {
  // The ordinary case: a worked exchange, both sides, with the three
  // board-visible kinds present in the log and absent from the panel.
  Default: { events: EXCHANGE },

  // The headline frame: three answers to three differently-themed cards and one
  // general note, so three hues and one neutral bubble appear together. Read as
  // a picture, this is the entire rule — colour is not decoration here, it is
  // the visible difference between answering something specific and saying
  // something about the whole map.
  // The lines are deliberately SHORT. The transcript is bounded and pins to the
  // newest turn, so a fixture with realistic-length answers pushes the first
  // hue above the fold — and a frame whose whole job is showing three hues at
  // once cannot afford to show two. Length is exercised by LongAnswer instead.
  ThreeThemes: {
    events: [
      // ONE event closing three cards. The old reducer joined these with " · "
      // into a single lime bubble; three subjects cannot share one background,
      // which is why the reducer splits them.
      at(1, "user.answer", "user", {
        answers: [
          { id: "c-who", answer: "A rota of two or three" },
          { id: "c-broken", answer: "Only if it covers breakage" },
          { id: "c-money", answer: "A shared fund" },
        ],
      }),
      at(2, "user.note", "user", {
        text: "Change direction — who shows up, not what breaks",
      }),
    ],
    themes: THREE_THEMES,
    nodes: [card("c-who", "th-who"), card("c-broken", "th-broken"), card("c-money", "th-money")],
  },

  // An answer to a card that has since been taken off the board. It renders
  // neutral — not broken, and not in a colour that lies about a theme it no
  // longer belongs to.
  DeletedTheme: {
    events: [
      at(1, "user.answer", "user", {
        answers: [
          { id: "c-who", answer: "A rota of two or three" },
          { id: "c-gone", answer: "Said before that card came off the board" },
        ],
      }),
    ],
    themes: THREE_THEMES,
    nodes: [card("c-who", "th-who")],
  },

  // The length people actually write, at the width it now has to wrap in. A
  // 720px bar made this question invisible; a 360px panel is where it is asked.
  LongAnswer: {
    events: [
      at(1, "user.answer", "user", {
        answers: [
          {
            id: "c-who",
            answer:
              "A rota of two or three, plus whoever turns up curious — but the honest answer is that it has been me every Saturday since March, and that is exactly the fragile bit nobody has said out loud yet.",
          },
        ],
      }),
      at(2, "agent.note", "agent", {
        text: "Then the question is not who turns up, it is what happens the first Saturday you cannot.",
      }),
    ],
    themes: THREE_THEMES,
    nodes: [card("c-who", "th-who")],
  },

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
  // The size is explicit rather than `100%`: the panel's root is absolutely
  // positioned, so it contributes nothing to its parent's intrinsic size, and a
  // shrink-to-fit capture element collapses to a hairline around it. This box is
  // a corner of the board — enough ground around the 360px panel to show that
  // it is IN a corner, which is the arrangement worth looking at, and enough
  // height that a long transcript reaches its bound rather than running off.
  return (
    <div
      id="codeyam-capture"
      style={{
        background: "#0a0a0b",
        height: 560,
        width: 720,
        position: "relative",
      }}
    >
      <Component
        events={scenario.events}
        onSend={setSent}
        themes={scenario.themes}
        nodes={scenario.nodes}
      />
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
