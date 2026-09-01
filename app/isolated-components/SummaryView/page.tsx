import Component from "../../components/SummaryView";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: { nodes: [
    ...[
    { id: "k1", kind: "known", label: "Vocabulary is the strongest fit for ages 6-8.", detail: null, order: 0 },
    { id: "k2", kind: "known", label: "Three existing apps miss parent involvement.", detail: null, order: 1 },
    { id: "k3", kind: "known", label: "Teachers are a viable second audience.", detail: null, order: 2 },
  ],
    { id: "u1", kind: "unknown", label: "Whether teachers would pay for this.", detail: null, order: 3 },
    { id: "u2", kind: "unknown", label: "How much parent involvement really matters.", detail: null, order: 4 },
    ...[
    { id: "d1", kind: "direction", label: "Classroom vocabulary game", detail: null, order: 0 },
    { id: "d2", kind: "direction", label: "Teacher assessment tool", detail: null, order: 1 },
    { id: "d3", kind: "direction", label: "Shared parent-teacher app", detail: null, order: 2 },
  ],
    ...[
    { id: "s1", kind: "next-step", label: "Interview 3 teachers", detail: null, order: 0 },
    { id: "s2", kind: "next-step", label: "Shortlist one approach to prototype", detail: null, order: 1 },
    { id: "s3", kind: "next-step", label: "Sketch the classroom vocabulary flow", detail: null, order: 2 },
    { id: "s4", kind: "next-step", label: "Test the flow with one teacher", detail: null, order: 3 },
    { id: "s5", kind: "next-step", label: "Check what district buy-in needs", detail: null, order: 4 },
  ],
  ] },
  Empty: { nodes: [] },
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
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
