import Component from "../../../app/components/MapCard";
import type { ComponentProps } from "react";
import type { FlatNode } from "../../lib/mapLayout";

type Props = ComponentProps<typeof Component>;

const node = (over: Partial<FlatNode> & { id: string; label: string }): FlatNode => ({
  parentId: "root",
  kind: "open-question",
  detail: null,
  status: "open",
  sourceUrl: null,
  order: 0,
  ...over,
});

const WHERE = node({
  id: "q-store",
  label: "Where would the tools physically live?",
  options: JSON.stringify([
    "Somebody's garage",
    "The building's bike room",
    "A rented locker",
  ]),
});

const scenarios: Record<string, Props> = {
  // The card the whole plan is for: a question, a few suggested answers, and
  // the box you answer it in, all one object.
  Default: { node: WHERE, round: 2, totalRounds: 4 },

  // The field is genuinely optional. An agent that never learned it still
  // produces a usable card — just the question and a box.
  NoOptions: {
    node: node({ id: "q-bare", label: "What happens when something comes back broken?" }),
    round: 2,
    totalRounds: 4,
  },

  // Answered: the eyebrow flips, the answer takes the body, and Edit is there
  // to reopen it. The state most likely to look wrong beside an open card.
  Answered: {
    node: WHERE,
    round: 2,
    totalRounds: 4,
    answer: "The bike room, if the building agrees to it",
  },

  // The map's subject, and the only card with no question in it.
  RootIdea: {
    node: node({
      id: "root",
      parentId: null,
      kind: "idea",
      label: "A tool library for the street",
      status: "answered",
      detail:
        "Nobody on this street needs to own a tile cutter, and four of us have bought one.",
    }),
    round: 1,
    totalRounds: 4,
  },

  // A statement node: its detail is the body, and there is nothing to answer.
  // Also the accent mark, which only three kinds carry.
  Finding: {
    node: node({
      id: "n-find",
      kind: "finding",
      status: "answered",
      label: "Every tool library that lasted had two keyholders",
      detail:
        "Across the four write-ups I could find, the ones that folded had a single custodian and the ones still running had at least two.",
    }),
    round: 4,
    totalRounds: 4,
  },

  // The person's own contribution, badged as theirs — the map is co-authored,
  // and the parts they wrote say so.
  Yours: {
    node: node({
      id: "n-own",
      kind: "constraint",
      status: "answered",
      origin: "user",
      label: "It has to survive me going away for a month",
      detail:
        "If the whole thing stops working the moment one person is unavailable, it is not a library, it is a favour.",
    }),
    round: 3,
    totalRounds: 4,
  },

  // A long question with the maximum three lines of title, against the card's
  // minimum height — the case where the clamp has to hold.
  LongLabel: {
    node: node({
      id: "q-long",
      label:
        "If two neighbours want the same tool on the same weekend, who decides, and does that decision need to be written down anywhere?",
      options: JSON.stringify([
        "First to ask",
        "Whoever asks the custodian",
        "We would work it out",
      ]),
    }),
    round: 2,
    totalRounds: 4,
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
  // The card caps itself at 300px in the row; the wrapper matches the real
  // column so the capture is the width it actually renders at.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 300 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
