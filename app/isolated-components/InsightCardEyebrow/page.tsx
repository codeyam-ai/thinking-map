import Component from "../../components/InsightCardEyebrow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The line above an insight's claim: what kind of thing it is, and how far
// behind the thinking it has fallen.
//
// Two facts at opposite ends of one line rather than stacked, because they
// answer different questions — what is this, and can I still trust it. Someone
// scanning a column of four cards reads the left edge for the first and notices
// the second only on the cards that have it, which is exactly the weighting the
// layout is trying to produce.
//
// The staleness marker is the honesty mechanism of the whole ungated stack, so
// most of these scenarios are about it: an insight the thinking has moved past
// is not withdrawn, it says so.

const scenarios: Record<string, Props> = {
  // A hunch the partner is willing to be wrong about in front of you, current
  // as of the last thing the person said. No marker at all.
  Default: { kind: "suggestion", answersSince: 0, hue: 62 },

  // The singular, which is the FIRST thing anyone ever reads here: the marker
  // appears the moment one answer lands after an insight. "your last 1
  // answers" would be its debut.
  StaleByOne: { kind: "suggestion", answersSince: 1, hue: 62 },

  // The ordinary stale case, and the longest the line gets — this is the width
  // the two halves have to share without colliding.
  Stale: { kind: "risk", answersSince: 4, hue: 62 },

  // A long session leaves a genuinely large gap. The sentence keeps its shape
  // rather than degrading to "many": the number is the point.
  VeryStale: { kind: "finding", answersSince: 37, hue: 62 },

  // An experiment says "Try this" — the same eyebrow every other card on the
  // map uses, so an insight names its kind the way a card in a row does.
  Experiment: { kind: "experiment", answersSince: 0, hue: 62 },

  // A kind the eyebrow map has no entry for falls back to the raw word rather
  // than rendering blank. An agent can write any kind it likes.
  UnknownKind: { kind: "hunch", answersSince: 0, hue: 62 },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // The board's plane, at the width the card gives this line — the two halves
  // sit at opposite ends of it, so the width is the whole test.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      <div style={{ width: 420 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
