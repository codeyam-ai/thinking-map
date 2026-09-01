import Component from "../../../app/components/MapCardAnswer";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const OPTIONS = [
  "Somebody's garage",
  "The building's bike room",
  "A rented locker",
];

const scenarios: Record<string, Props> = {
  // Unanswered, with a shortlist: chips over a box. Clicking a chip fills the
  // box rather than sending it, so these are a head start on the person's own
  // words rather than a set of choices.
  Default: {
    id: "q-store",
    label: "Where would the tools physically live?",
    options: OPTIONS,
    answer: null,
  },

  // The ordinary case for a question nobody could guess the answers to: just
  // the box. Proves the options field is genuinely optional.
  NoOptions: {
    id: "q-bare",
    label: "What happens when something comes back broken?",
    options: [],
    answer: null,
  },

  // Answered: the affordance is replaced by what the person said, with a quiet
  // way back in. An answered question is settled, so reopening it should be
  // available without being an invitation.
  Answered: {
    id: "q-store",
    label: "Where would the tools physically live?",
    options: OPTIONS,
    answer: "The bike room, if the building agrees to it",
  },

  // A long answer, to show the body wrapping rather than truncating — what the
  // person actually said is never worth clipping.
  LongAnswer: {
    id: "q-store",
    label: "Where would the tools physically live?",
    options: OPTIONS,
    answer:
      "The bike room, if the building agrees to it — otherwise my garage for now, on the understanding that it moves the moment somebody else has space.",
  },

  // Many suggestions, wrapping onto several rows. The chips must stay legible
  // rather than compressing into an unreadable strip.
  ManyOptions: {
    id: "q-who",
    label: "Who is this for — you, or the whole street?",
    options: [
      "Just my building",
      "The whole street",
      "Anyone who can walk here",
      "Only people who contribute a tool",
    ],
    answer: null,
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
  // The affordance lives in a card's body, so it is captured at the card's
  // inner width — 300px less the card's 20px padding on each side.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 260 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
