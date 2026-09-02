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

const stated = (
  id: string,
  kind: string,
  label: string,
  order: number,
): FlatNode => ({
  id,
  parentId: "root",
  kind,
  label,
  detail: null,
  status: "answered",
  sourceUrl: null,
  order,
});

// Three of four cards are research kinds — a clear majority, so the row bands.
// The gap is in the mix on purpose: it counts toward the band because it is a
// fact about what already exists, even though it wears the question colour
// because what it records is that nobody has an answer.
const RESEARCH = [
  stated("r-res", "research", "Looked at eleven tool libraries that lasted", 0),
  stated("r-find", "finding", "Every one that survived had one named keyholder", 1),
  stated("r-gap", "gap", "Nobody tracks what happens after the first winter", 2),
  stated("r-goal", "goal", "Nobody on the street buys a second tile cutter", 3),
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

  // A round that is mostly research gets its own TERRITORY rather than just
  // its own card colour: a tinted ground behind the whole row, a hairline
  // enclosing it, and an eyebrow that says what the row is instead of which
  // number it is. What already exists becomes legible before a single card on
  // it is read.
  ResearchBand: {
    round: { index: 3, nodes: RESEARCH, phase: null },
    totalRounds: 4,
    answers: noAnswers,
    askedIds: noneAsked,
  },

  // The boundary case, and the one most likely to be got wrong: research in
  // the row but not a majority, so NO band. Otherwise the band would stop
  // meaning "this round is about what exists" and start meaning "somebody
  // looked something up once".
  BelowResearchThreshold: {
    round: {
      index: 3,
      nodes: [RESEARCH[1]!, question("q-key", "Who holds the second key?", 1), stated("s-con", "constraint", "It has to survive a wet winter", 2)],
      phase: null,
    },
    totalRounds: 4,
    answers: noAnswers,
    askedIds: noneAsked,
  },

  // An older round, stepped back so the newest thinking sits forward of it.
  // Recession, not perspective — opacity only, because a transform would move
  // the answer boxes out from under the pointer.
  Receded: {
    round: { index: 2, nodes: THREE, phase: null },
    totalRounds: 6,
    answers: noAnswers,
    askedIds: noneAsked,
    receded: true,
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
