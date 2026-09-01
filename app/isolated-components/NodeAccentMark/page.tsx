import Component from "../../../app/components/NodeAccentMark";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  // Research wears the magnifier: the one accent that reads as an activity —
  // the partner went and looked — rather than a judgement.
  Research: { kind: "research" },

  // A slice earns the same weight, because it is the one thing you actually go
  // and build.
  Slice: { kind: "slice" },

  // Pro and risk are the design system's two sparing colours, so they are a
  // dot rather than a glyph: the colour IS the information.
  Pro: { kind: "pro" },
  Risk: { kind: "risk" },

  // Most kinds carry no accent at all, and must render nothing rather than a
  // neutral placeholder — an empty corner is the correct output here.
  None: { kind: "open-question" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Research" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // The mark sits in a card's top-right corner, so the box stands in for that
  // corner and the kind is named on the left where a card's marker would be.
  //
  // The label is not decoration: a bare coloured dot is 10px of no text and no
  // svg, which reads to a capture as an empty page — and the `None` case is a
  // deliberate absence, which cannot be demonstrated by a frame holding
  // literally nothing. Naming the kind is what makes both legible.
  return (
    <div id="codeyam-capture">
      <div
        style={{
          width: 220,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
          padding: 20,
          borderRadius: 20,
          border: "1px solid var(--line)",
          background: "var(--surface)",
        }}
      >
        <span className="eyebrow">{props.kind}</span>
        <Component {...props} />
      </div>
    </div>
  );
}
