import Component from "../../../app/components/MapCardHeader";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The header is a full-width row inside a card, so it is wrapped below at the
// card's real width (300px, the max in MapRow's flex band) rather than left to
// fill the viewport — the whole point of the component is that its two marks
// sit at OPPOSITE corners, and that reads as nothing at 1440px.
const scenarios: Record<string, Props> = {
  // The ordinary case: a card in the second of four rounds, wearing its
  // family's colour on both marks.
  Default: { kind: "goal", round: 2, totalRounds: 4, isRoot: false },
  // The root's marker stays neutral grey. The subject family's colour is ink,
  // and ink on "1/4" would read as emphasis on a number nobody needs
  // emphasised rather than as a category.
  Root: { kind: "idea", round: 1, totalRounds: 4, isRoot: true },
  // Risk keeps its own colour rather than a shared judgment hue, so the marker
  // and the mark are terracotta here and sage on a pro.
  Risk: { kind: "risk", round: 3, totalRounds: 4, isRoot: false },
  // A research card, which is where the magnifier and the ochre show up.
  Found: { kind: "research", round: 3, totalRounds: 5, isRoot: false },
  // Double digits on both halves of the marker — the case that would push the
  // two marks together if the row were not a space-between.
  ManyRounds: { kind: "finding", round: 12, totalRounds: 18, isRoot: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 300 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
