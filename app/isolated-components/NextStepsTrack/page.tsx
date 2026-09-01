import Component from "../../components/NextStepsTrack";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: { steps: [
    { id: "s1", kind: "next-step", label: "Interview 3 teachers", detail: null, order: 0 },
    { id: "s2", kind: "next-step", label: "Shortlist one approach to prototype", detail: null, order: 1 },
    { id: "s3", kind: "next-step", label: "Sketch the classroom vocabulary flow", detail: null, order: 2 },
    { id: "s4", kind: "next-step", label: "Test the flow with one teacher", detail: null, order: 3 },
    { id: "s5", kind: "next-step", label: "Check what district buy-in needs", detail: null, order: 4 },
  ] },
  Empty: { steps: [] },
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
