"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/OpenQuestionRow";

// One question the agent is waiting on, with somewhere to answer it.
//
// Only the resting states are seeded here. The typed-and-sendable state is a
// real interaction — the send control turns live on the draft — so it is
// driven against the running component rather than forced with a prop that
// exists only for the capture.
const scenarios: Record<string, { label: string }> = {
  Default: { label: "Do you reread your own notes today?" },
  // A full-sentence question that wraps: the shape an agent deconstructing an
  // idea actually produces, rather than a keyword.
  LongQuestion: {
    label:
      "What would have to be true for you to open this on an ordinary Tuesday rather than only when you remember it exists?",
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const fixture = scenarios[s];
  const [answered, setAnswered] = useState<string | null>(null);
  if (!fixture) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260 }}>
        <ul>
          <Component
            id="xn-q1"
            label={fixture.label}
            onAnswer={async (_id, _label, answer) => setAnswered(answer)}
          />
        </ul>
        <p className="sr-only">{answered ?? "unanswered"}</p>
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
