"use client";

// A client harness: the close control is a callback prop, and a function
// cannot cross the server-component boundary.

import { Suspense, type ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import Component from "../../components/NodeQuestionHeader";

type Props = ComponentProps<typeof Component>;

// What the composer is about. The label is repeated from the pill because the
// composer covers part of the map, and someone mid-sentence should not have to
// move it to remember which node they clicked.
const scenarios: Record<string, Props> = {
  Default: {
    label: "Capture the thought, not the book",
    onClose: () => {},
  },
  // Node labels are written by an agent and are not length-checked, so the
  // truncation is a real state rather than a hypothetical one: it must not push
  // the close control off the edge.
  LongLabel: {
    label:
      "Capture the thought rather than the book, so that retrieval works from a half-remembered idea",
    onClose: () => {},
  },
};

function Harness() {
  const s = useSearchParams().get("s") ?? "Default";
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // Bounded to the composer's real inner width, which is what makes the
  // truncation behave the way it does in context.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 266 }}>
        <Component {...props} />
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
