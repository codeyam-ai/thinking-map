"use client";

// The far end of the board: everything the partner is willing to say about the
// idea as a whole, newest first.
//
// A client harness inside BridgeFixture — the empty state's sentence depends on
// whether an agent can reach the page, and an isolated capture is `unavailable`
// by definition unless it is supplied.
//
// The empty state is a SEQUENCE, not a variant: it is a dim marker while the
// wait is still young, and the honest sentence once the wait has elapsed. Both
// are captured, because the second is the one that has to be true and the first
// is the one every board opens on.

import { Suspense, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import BridgeFixture from "../BridgeFixture";
import Component from "../../components/InsightStack";
import type { BoardInsight } from "../../components/InsightCard";
import type { BridgeStatus } from "../../components/WebMcpBridge";

type Props = ComponentProps<typeof Component>;

function insight(over: Partial<BoardInsight> & { id: string }): BoardInsight {
  return {
    kind: "suggestion",
    label: "The whiteboard is a symptom of an ownership gap",
    detail: null,
    themeId: null,
    status: null,
    createdAt: "2026-08-30T09:00:00.000Z",
    updatedAt: "2026-08-30T09:00:00.000Z",
    answersSince: 0,
    stale: false,
    from: [],
    choices: null,
    ...over,
  };
}

const FOUR = [
  insight({
    id: "i-1",
    label: "The whiteboard is a symptom of an ownership gap",
    detail:
      "Nothing is lost while it is on the board. Things are lost at the moment it is wiped and nobody is carrying them.",
    from: [{ id: "q-owner", label: "Who is carrying a case between shifts?" }],
    choices: ["Test a named owner on paper for a week"],
  }),
  insight({
    id: "i-2",
    kind: "experiment",
    label: "Call back three owners yourself tomorrow",
  }),
  insight({
    id: "i-3",
    kind: "risk",
    label: "A named owner may just move the blame, not the work",
    answersSince: 2,
    stale: true,
  }),
  insight({
    id: "i-4",
    kind: "finding",
    label: "Two of the three apps you named do handovers already",
  }),
];

const scenarios: Record<string, Props & { status: BridgeStatus }> = {
  // Day one: a seed idea, no themes, nothing written. It has to read as a
  // place waiting to be filled rather than as a failure — this is where the
  // dashed ring used to sit for most of a session.
  //
  // What this marker resolves INTO after twenty seconds is not capturable
  // here — the clock is real and the capture is not going to wait for it — so
  // the settled sentences have their own fixture on `InsightStackEmpty`, which
  // is the presentational half this component drives.
  Waiting: { status: "unavailable", insights: [] },

  // The first insight, on a board where nothing is finished. This is the whole
  // point of ungating: one card, early, marked for what it is.
  OneInsight: { status: "connected", insights: [FOUR[0]] },

  // Three, which is the number the standing ask names as the target.
  ThreeInsights: { status: "connected", insights: FOUR.slice(0, 3) },

  // Past the column's bounds: four stand and the rest go behind the
  // affordance, because a column that grew without limit would run off the
  // plane.
  Overflowing: {
    status: "connected",
    insights: [
      ...FOUR,
      insight({ id: "i-5", kind: "gap", label: "Nobody has said what a shift actually hands over" }),
      insight({ id: "i-6", kind: "assumption", label: "The evening shift is the one under pressure" }),
    ],
  },

  // What an agent can actually write, rather than what a fixture author would:
  // a claim that wraps to four lines, a kind the eyebrow map has never heard
  // of, and one so old the staleness marker is the widest thing on its line.
  // The column has to stay a column — cards of very different heights sharing
  // one gap, none of them clipped.
  EdgeLabels: {
    status: "connected",
    insights: [
      insight({
        id: "e-long",
        kind: "risk",
        label:
          "Naming an owner for each case may move the blame rather than the work, if the person named turns out to be the one who was already carrying it informally and nobody has agreed to take it off them",
      }),
      insight({ id: "e-odd", kind: "hunch", label: "Something is off about Tuesdays" }),
      insight({
        id: "e-old",
        kind: "assumption",
        label: "The tools outlast the people who bought them",
        answersSince: 37,
        stale: true,
      }),
    ],
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Waiting";
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  const { status, ...props } = scenario;

  // The stack positions itself around its parent's ORIGIN — vertically centred
  // on it, starting just left of it — in every state, so unlike the node it
  // replaced the harness can simply put the origin at the middle of a box and
  // size the box for the tallest state.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      <div style={{ position: "relative", width: 560, height: 760 }}>
        <div style={{ position: "absolute", left: 60, top: "50%" }}>
          <BridgeFixture status={status}>
            <Component {...props} status={status} onChoose={() => {}} />
          </BridgeFixture>
        </div>
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
