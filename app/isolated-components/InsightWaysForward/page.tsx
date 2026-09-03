"use client";

// The ways forward an insight offers.
//
// A client harness because taking one is a callback, and a function cannot
// cross the server/client boundary as a prop. The harness prints what was
// chosen, which is the only way a capture can show that these are live.
//
// Taking a way forward is NOT answering: no question on the map is being
// closed, a direction is being taken, and what the partner does next depends on
// which. That is why they are buttons in the row's colour rather than the
// answer chips a question card uses — the visual difference is the claim.

import { Suspense, useState, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/InsightWaysForward";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Omit<Props, "onChoose">> = {
  // Three routes, which is the number an agent tends to offer: two real ones
  // and a way of saying neither.
  Default: {
    choices: [
      "Design the handover, not the catalogue",
      "Try it with four people and one tool",
      "Something else",
    ],
    hue: 62,
  },

  // One route is a legitimate offer and must not read as a submit button —
  // the same rule `AnswerChips - Single` holds for its own chips.
  Single: { choices: ["Test a named owner on paper for a week"], hue: 62 },

  // The partner named a direction without proposing routes. The thinking can
  // still continue by other means, and the absence has to CLOSE UP rather than
  // leave an empty row where the buttons would have been.
  NoChoices: { choices: null, hue: 62 },

  // An empty array is the other shape the same absence arrives in — an agent
  // that wrote the field and put nothing in it. It must read identically.
  EmptyChoices: { choices: [], hue: 62 },

  // A route long enough to wrap. The button grows to hold it rather than
  // truncating: a way forward you cannot read is not a way forward.
  LongChoice: {
    choices: [
      "Lend one tool to one neighbour this week and write down who has it, then see whether the paper survives a fortnight",
      "Something else",
    ],
    hue: 62,
  },

  // Another row's colour, because the buttons take the hue of the line of
  // thinking they belong to.
  OtherRow: { choices: ["Look at the evening shift first"], hue: 318 },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const scenario = scenarios[s];
  const [chosen, setChosen] = useState<string | null>(null);
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The caption is the HARNESS naming the state, and it earns its place twice
  // over on NoChoices and EmptyChoices, which are deliberately nothing at all:
  // without it those captures read to the blank-page check as broken pages
  // rather than as a component correctly declining to draw an empty row.
  return (
    <div id="codeyam-capture" style={{ background: "#000", padding: 40 }}>
      <div className="mb-5 text-[11px] uppercase tracking-[0.14em] text-white/35">
        {s}
      </div>
      <div style={{ width: 420 }}>
        <Component {...scenario} onChoose={setChosen} />
      </div>
      {chosen ? (
        <div className="mt-4 text-[12px] text-white/50">chose: {chosen}</div>
      ) : null}
    </div>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div />}>
      <Harness />
    </Suspense>
  );
}
