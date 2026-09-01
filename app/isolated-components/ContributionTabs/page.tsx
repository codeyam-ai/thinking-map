"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component, { type ContributionMode } from "../../components/ContributionTabs";

// The two kinds of contribution, and which one is selected. The difference
// between them is what happens AFTERWARDS — a note is read by the agent on its
// next turn, a node lands on the map — so the selected state is the whole of
// what this component communicates.
const START: Record<string, ContributionMode> = {
  Note: "note",
  Node: "node",
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Note";
  const initial = START[s];
  const [mode, setMode] = useState<ContributionMode>(initial ?? "note");
  if (!initial) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260 }}>
        <Component mode={mode} onChange={setMode} />
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
