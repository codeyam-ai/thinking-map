"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/NodeKindPicker";

// The picker reads the same controlled vocabulary the agent's tools are bound
// to, so a node a person adds is indistinguishable in kind from one the agent
// added — which is what makes the map genuinely co-authored.
const START: Record<string, string> = {
  Default: "finding",
  // A coloured kind, to show the picker covers the whole vocabulary rather
  // than the neutral kinds alone.
  Risk: "risk",
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const initial = START[s];
  const [kind, setKind] = useState(initial ?? "finding");
  if (!initial) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 260 }}>
        {/* The picker's own text lives inside <option>, which the capture
            checker does not count as visible content — so the fixture carries
            the eyebrow the contribution bar shows above it in context. */}
        <h2 className="eyebrow mb-2">Add node</h2>
        <Component kind={kind} onChange={setKind} />
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
