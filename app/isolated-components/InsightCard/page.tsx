import Component from "../../components/InsightCard";
import type { BoardInsight } from "../../components/InsightCard";

// One thing the partner is willing to say about the idea as a whole, closed.
//
// Closed is the card's whole job here: the kind, the claim, and — when the
// thinking has moved past it — how far behind it is. What OPENING it reveals is
// `InsightDetail`, which has its own fixture, because a component reachable
// only by clicking its parent could only ever be photographed shut.
//
// The claims are deliberately hunches rather than conclusions. That is the
// point of the ungated stack: a suggestion is something the partner is willing
// to be wrong about in front of you, and the honest way to show one is early
// and marked as provisional.

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

const scenarios: Record<string, { insight: BoardInsight }> = {
  // The ordinary case, and the one four of them stacked are made of.
  Default: { insight: insight({ id: "i-ownership" }) },

  // Behind the person's last four answers. Nothing is hidden by being stale —
  // an insight the thinking has moved past is still worth reading — so the gap
  // is named on the card's face rather than the card being withdrawn.
  Stale: {
    insight: insight({ id: "i-ownership", answersSince: 4, stale: true }),
  },

  // One answer, not four. The singular is its own case because "your last 1
  // answers" is the sentence a count with no plural rule produces.
  StaleByOne: {
    insight: insight({ id: "i-ownership", answersSince: 1, stale: true }),
  },

  // An experiment rather than a suggestion: the eyebrow says "Try this",
  // exactly as it would on the same node drawn inside a row.
  Experiment: {
    insight: insight({
      id: "i-callback",
      kind: "experiment",
      label: "Call back three owners yourself tomorrow",
    }),
  },

  // A claim long enough to wrap, which an agent can freely write. It sets the
  // card's height rather than being clipped — this is a thing to read, and the
  // column has room to grow downward.
  LongLabel: {
    insight: insight({
      id: "i-long",
      kind: "risk",
      label:
        "Naming an owner for each case may move the blame rather than the work, if the person named is the one who was already carrying it informally",
    }),
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

  // The stack sits on the board's near-black plane and is 460px wide, so the
  // harness supplies both rather than the page's default paper — on which a
  // near-black card on near-white would be a different component.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      <div style={{ width: 460 }}>
        <Component insight={props.insight} />
      </div>
    </div>
  );
}
