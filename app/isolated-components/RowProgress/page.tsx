import Component from "../../../app/components/RowProgress";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// How far through the round you are. Deliberately a count and nothing else — a
// button here would invite skipping past questions nobody has looked at.
const scenarios: Record<string, Props> = {
  // The ordinary working state, mid-round.
  Default: { answered: 2, questions: 3 },

  // A round that has just landed, with nothing done yet.
  NoneAnswered: { answered: 0, questions: 3 },

  // One question is a legitimate round, and the line must not read oddly for it.
  SingleQuestion: { answered: 0, questions: 1 },

  // A wide round, where the count is doing real work.
  LongRound: { answered: 4, questions: 7 },
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
      <div style={{ width: "100%", maxWidth: 620 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
