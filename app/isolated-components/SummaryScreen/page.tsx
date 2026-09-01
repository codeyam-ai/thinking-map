import Component from "../../components/SummaryScreen";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: {
    mapId: "map-game",
    messages: [
      { id: "m1", role: "user", content: "So where would you start?" },
      { id: "m2", role: "assistant", content: "Here's what we've learned, and where I'd start tomorrow." },
    ],
    nodes: [
    { id: "k1", kind: "known", label: "Vocabulary is the strongest fit for ages 6-8.", detail: null, order: 0 },
    { id: "k2", kind: "known", label: "Three existing apps miss parent involvement.", detail: null, order: 1 },
    { id: "u1", kind: "unknown", label: "Whether teachers would pay for this.", detail: null, order: 2 },
    { id: "d1", kind: "direction", label: "Classroom vocabulary game", detail: null, order: 3 },
    { id: "d2", kind: "direction", label: "Teacher assessment tool", detail: null, order: 4 },
    { id: "s1", kind: "next-step", label: "Interview 3 teachers", detail: null, order: 5 },
    { id: "s2", kind: "next-step", label: "Sketch the classroom vocabulary flow", detail: null, order: 6 },
  ],
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  return (
    <div id="codeyam-capture">
      <div className="flex flex-col" style={{ height: 900 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
