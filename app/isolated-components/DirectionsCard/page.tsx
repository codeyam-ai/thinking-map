import Component from "../../components/DirectionsCard";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: { items: [
    { id: "d1", kind: "direction", label: "Classroom vocabulary game", detail: null, order: 0 },
    { id: "d2", kind: "direction", label: "Teacher assessment tool", detail: null, order: 1 },
    { id: "d3", kind: "direction", label: "Shared parent-teacher app", detail: null, order: 2 },
  ] },
  Empty: { items: [] },
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
      <div style={{ width: "100%", maxWidth: 420 }}><Component {...props} /></div>
    </div>
  );
}
