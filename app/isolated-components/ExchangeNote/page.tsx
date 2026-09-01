import Component from "../../components/ExchangeNote";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The questions are the product — the partner earns its keep by asking rather
// than answering — so a question inside a note keeps its typographic weight.
// These two scenarios are the rule and its absence, side by side.
const scenarios: Record<string, Props> = {
  // A lead-in, then the questions, which take the bold treatment.
  WithQuestion: {
    text: "Your goal is retrieval, so I dropped the shelf-management branch entirely.\nDo you reread your own notes today?\nIs this for you alone, or shared?",
  },
  // A note with nothing to answer: no line takes emphasis.
  Statement: {
    text: "Treating the abandonment as the real problem rather than the tracking.",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "WithQuestion" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // It renders inside an activity row, which is the 300px column minus the
  // avatar gutter.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 226 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
