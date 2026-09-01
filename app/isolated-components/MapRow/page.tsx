import Component from "../../../app/components/MapRow";
import type { ComponentProps } from "react";
import type { FlatNode } from "../../lib/mapLayout";

type Props = ComponentProps<typeof Component>;

const question = (
  id: string,
  label: string,
  order: number,
  options?: string[],
): FlatNode => ({
  id,
  parentId: "root",
  kind: "open-question",
  label,
  detail: null,
  status: "open",
  sourceUrl: null,
  order,
  ...(options ? { options: JSON.stringify(options) } : {}),
});

const THREE = [
  question("q-who", "Who is this for — you, or the whole street?", 0, [
    "Just my building",
    "The whole street",
    "Anyone who can walk here",
  ]),
  question("q-lend", "What happens when something comes back broken?", 1, [
    "The borrower replaces it",
    "A shared repair fund",
  ]),
  question("q-store", "Where would the tools physically live?", 2, [
    "Somebody's garage",
    "The building's bike room",
  ]),
];

const noAnswers = new Map<string, string>();
const noneAsked = new Set<string>();

const scenarios: Record<string, Props> = {
  // A round of three questions, which is the ordinary batch an agent asks.
  // The cards share a top edge and end where their content does.
  Default: {
    round: { index: 2, nodes: THREE, phase: null },
    totalRounds: 4,
    answers: noAnswers,
    askedIds: noneAsked,
  },

  // The mixed state — one settled, two still asking. The state most likely to
  // look wrong, because the answered card is shorter than the ones beside it.
  PartlyAnswered: {
    round: { index: 2, nodes: THREE, phase: null },
    totalRounds: 4,
    answers: new Map([
      ["q-lend", "A shared repair fund — asking one neighbour to replace a £200 sander is how you lose the neighbour."],
    ]),
    askedIds: noneAsked,
  },

  // The map's first row: the seed idea alone, eyebrowed as the idea rather
  // than numbered, because nobody asked for it.
  TheIdea: {
    round: {
      index: 1,
      nodes: [
        {
          id: "root",
          parentId: null,
          kind: "idea",
          label: "A tool library for the street",
          detail:
            "Nobody on this street needs to own a tile cutter, and four of us have bought one.",
          status: "answered",
          sourceUrl: null,
          order: 0,
          origin: "user",
        },
      ],
      phase: null,
    },
    totalRounds: 4,
    answers: noAnswers,
    askedIds: noneAsked,
  },

  // A row wide enough to wrap. Five cards is past what one line holds at
  // desktop width, and wrapping is what makes one layout work at every size.
  Wrapping: {
    round: {
      index: 3,
      nodes: [
        ...THREE,
        question("q-key", "Who is the second person holding a key?", 3),
        question("q-money", "Does anyone pay anything, ever?", 4),
      ],
      phase: null,
    },
    totalRounds: 4,
    answers: noAnswers,
    askedIds: noneAsked,
  },

  // A round that opened a phase names itself after the phase rather than its
  // number — the more useful label once the thinking has moved on.
  NamedByPhase: {
    round: { index: 4, nodes: THREE.slice(0, 2), phase: "explore" },
    totalRounds: 4,
    answers: noAnswers,
    askedIds: noneAsked,
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
  // A row fills the map panel, so it is captured at the panel's real width.
  return (
    <div id="codeyam-capture" style={{ width: "100%" }}>
      <Component {...props} />
    </div>
  );
}
