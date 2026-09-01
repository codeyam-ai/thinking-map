"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/AnswerChips";

// A client harness rather than a server page, because the component takes a
// callback: a function cannot cross the server/client boundary as a prop, and
// passing one from a server page 500s the route. This is the same shape
// `SuggestionChips` already uses for the same reason.

const scenarios: Record<string, { question: string; options: string[] }> = {
  // The ordinary shortlist an agent offers alongside a question.
  Default: {
    question: "Where would the tools physically live?",
    options: ["Somebody's garage", "The building's bike room", "A rented locker"],
  },

  // No suggestions renders nothing at all rather than an empty strip, which is
  // what lets a card without options be simply a card with a box. The frame
  // shows the question sitting directly on the box, with no gap where a chip
  // row would have been.
  Empty: {
    question: "What happens when something comes back broken?",
    options: [],
  },

  // One suggestion is a legitimate shortlist; it must not read as a button.
  Single: {
    question: "Who is this for — you, or the whole street?",
    options: ["Just me"],
  },

  // Enough options to wrap onto several rows, with a long one among them.
  Wrapping: {
    question: "Who is this for — you, or the whole street?",
    options: [
      "Just my building",
      "The whole street",
      "Anyone who can walk here",
      "Only people who contribute a tool of their own",
    ],
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  // Held so the fill-don't-submit behaviour is genuinely wired up rather than
  // dropped on the floor — and so the frame shows where a picked chip lands.
  const [picked, setPicked] = useState("");
  const scenario = scenarios[s];
  if (!scenario) return <div>Unknown scenario: {s}</div>;

  // The chips only ever appear between a question and its answer box, so the
  // harness supplies both. That is also what makes the `Empty` case
  // demonstrable at all: a component that correctly renders nothing is an
  // empty frame on its own, and an empty frame shows nothing about it.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 260 }}>
        <h3 className="mb-2 text-[15px] font-bold leading-snug text-ink">
          {scenario.question}
        </h3>
        <Component options={scenario.options} onPick={setPicked} />
        <div className="w-full rounded-full border border-line bg-surface py-2 pl-3.5 pr-11 text-[12.5px] text-ink">
          {picked || <span className="text-muted">Answer…</span>}
        </div>
      </div>
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
