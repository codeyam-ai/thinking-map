import Component from "../../components/InsightSources";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The questions an insight came out of.
//
// The reason a card opens at all: a claim about the whole idea is worth exactly
// as much as the thinking behind it is visible. The absent case is the one that
// earns its own scenario — an agent that cited nothing must produce NO heading
// rather than an empty one, because "What this came out of" with nothing under
// it reads as something that failed to load.
//
// The rule in the row's own colour is the other thing to look at: these are
// quotations from elsewhere on the board, and the colour is what says where
// from.

const CITED = [
  { id: "q-owner", label: "Who is carrying a case between shifts?" },
  { id: "q-wipe", label: "What happens the moment the board is wiped?" },
];

const scenarios: Record<string, Props> = {
  // The ordinary case: an insight drawn out of two questions the person
  // actually answered.
  Default: { sources: CITED, hue: 62 },

  // One source. A single citation still reads as a list rather than as a
  // stray line, which is what the rule down the left edge is for.
  Single: { sources: [CITED[0]], hue: 62 },

  // Nothing cited — an insight drawn from the whole map, or written by an
  // agent that never learned the field. Renders nothing at all. The harness
  // says so, because a genuinely empty frame is indistinguishable from a
  // broken one.
  NoSources: { sources: [], hue: 62 },

  // Four, including a long one. An agent can write questions of any length and
  // the list wraps rather than clipping — these are things to read.
  Many: {
    sources: [
      ...CITED,
      { id: "q-where", label: "Where do the tools actually live between borrowings?" },
      {
        id: "q-long",
        label:
          "If the person who bought the drill moves away, who decides whether it stays on the street or goes with them?",
      },
    ],
    hue: 62,
  },

  // Another row's colour. Read beside Default this is the argument for the
  // rule carrying the hue at all: it says which line of thinking this came out
  // of without a word of explanation.
  OtherRow: { sources: CITED, hue: 318 },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // The board's near-black plane and the stack's own column width less the
  // card's padding — this never renders on paper and never at another width.
  // The caption is the HARNESS naming the state, and it earns its place on
  // NoSources, which is deliberately nothing at all: without it that capture
  // reads to the blank-page check as a broken page rather than as a component
  // correctly declining to draw a heading.
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
