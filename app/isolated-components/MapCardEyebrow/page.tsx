import Component from "../../../app/components/MapCardEyebrow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  // A question nobody has answered.
  Default: { kind: "open-question" },

  // The rule with teeth: an answered question stops calling itself open, or
  // the card would label the answer printed beneath it as unanswered.
  Answered: { kind: "open-question", answered: true },

  // A statement node names its kind and nothing else.
  Finding: { kind: "finding" },

  // The map is co-authored, so the parts the person wrote say so.
  Yours: { kind: "constraint", origin: "user" },

  // Provenance: something has been asked about this node, visible without
  // opening anything.
  Asked: { kind: "goal", asked: true },

  // Where a claim came from, when it came from one identifiable part of the
  // client's brief.
  FromBrief: { kind: "problem", sourceRef: "s7" },

  // Every fact at once, in the fixed order — the longest the line ever gets,
  // and the case where it has to stay one readable row.
  Everything: {
    kind: "open-question",
    answered: true,
    origin: "user",
    asked: true,
    sourceRef: "s3",
  },
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
  // Captured at a card's inner width, which is where the eyebrow has to fit.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 260 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
