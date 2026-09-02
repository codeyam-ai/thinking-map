import Component from "../../../app/components/CardIcon";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// One scenario per FAMILY, which is one per glyph — the component draws six
// marks and nothing else, so six scenarios is the whole of it. Each names the
// kind a reader would most expect to meet that mark on, rather than the family
// slug, because the kind is what the card's eyebrow says.
const scenarios: Record<string, Props> = {
  // The map's subject: the one filled mark, because the root is the node
  // everything else hangs from.
  Subject: { kind: "idea" },
  // The question mark, worn by every kind that records that nobody has
  // answered something — including a gap.
  Question: { kind: "open-question" },
  Gap: { kind: "gap" },
  // Strata: what is already true about the world the idea sits in.
  Ground: { kind: "goal" },
  // The magnifier, carried across from the retired node pill — the one mark
  // that reads as an activity rather than a category.
  Found: { kind: "research" },
  // Plus over minus: the two directions a judgment can point, in one mark,
  // because pro and risk share a family and colour is what separates them.
  Judgment: { kind: "risk" },
  Pro: { kind: "pro" },
  // The arrow, pointing the way the map grows.
  Forward: { kind: "slice" },
  // Kinds arrive from the database and from the model unvalidated. An
  // unrecognised one must lose its precision, never its mark.
  UnknownKind: { kind: "sticky-note" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Subject" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
