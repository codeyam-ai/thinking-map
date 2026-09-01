"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/RecordedAnswer";

// A client harness rather than a server page, because the component takes an
// `onEdit` callback: a function cannot cross the server/client boundary as a
// prop, and passing one from a server page 500s the route.

const scenarios: Record<string, string> = {
  // What the person said, shown back in the card's body.
  Default: "The bike room, if the building agrees to it",

  // A real answer is often a sentence with a reason attached, not a phrase —
  // it wraps rather than clipping, because this is the person's own words.
  LongAnswer:
    "A shared repair fund — asking one neighbour to replace a £200 sander is how you lose the neighbour, and the whole thing only works if nobody is afraid to borrow.",

  // The shortest real answer, where Edit still has to read as a control rather
  // than a second line of the answer.
  Terse: "Just me",
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const [editing, setEditing] = useState(false);
  const answer = scenarios[s];
  if (!answer) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      {/* A card's inner width — this only ever renders in a card body. */}
      <div style={{ width: 260 }}>
        <Component answer={answer} onEdit={() => setEditing(true)} />
        <p className="sr-only">{editing ? "editing" : "settled"}</p>
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
