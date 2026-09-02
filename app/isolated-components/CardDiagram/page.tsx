import Component from "../../../app/components/CardDiagram";

// A small drawn shape on a card: declarative steps rather than markup, so the
// partner can describe a flow with one string per step and the board decides
// how it looks.

const ACCENT = "hsl(233 74% 66%)";

const scenarios: Record<
  string,
  { steps: string[]; note?: string; accent: string }
> = {
  // The ordinary case, and the one the wide card width exists for: four steps
  // read as a flow rather than as a stack of slivers.
  Default: {
    steps: [
      "Vet promises a call-back",
      "It joins the open list with their name on it",
      "Evening shift sees it unclosed",
      "Closing it needs a person, not a wipe",
    ],
    note: "The wipe is what deletes the state today.",
    accent: ACCENT,
  },

  // No note. The caption is optional and its absence must not leave a gap
  // where a line of type would have been.
  NoNote: {
    steps: ["Owner calls", "Front desk logs it", "Vet closes it"],
    accent: ACCENT,
  },

  // Two steps is the shortest thing that is still a flow — one arrow, and it
  // must not read as a heading with a subtitle.
  Shortest: {
    steps: ["Something is promised", "Somebody closes it"],
    accent: ACCENT,
  },

  // Steps long enough to wrap, which is what happens when the partner
  // describes a real process rather than a demo one.
  LongSteps: {
    steps: [
      "A vet promises an owner a call-back during an afternoon consult",
      "The promise is written on the whiteboard with no name against it",
      "The board is wiped at 6pm before the evening shift has read it",
    ],
    note: "Photographed on two consecutive Tuesdays.",
    accent: ACCENT,
  },

  // The palette follows the theme the card belongs to, so the same diagram in
  // a different galaxy is a different colour.
  MagentaTheme: {
    steps: ["Ask", "Answer", "Close"],
    accent: "hsl(318 74% 66%)",
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

  // The diagram only ever appears inside a card, so the harness supplies the
  // card's dark ground and its wide column width. On white, and at an
  // arbitrary width, it would be a different object entirely.
  return (
    <div id="codeyam-capture" style={{ background: "#141416", padding: 28 }}>
      <div style={{ width: 364, color: "#fff" }}>
        <Component {...props} />
      </div>
    </div>
  );
}
