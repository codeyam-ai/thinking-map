import Component from "../../components/LandingScreen";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: { maps: [
    { id: "map-game", title: "Educational game for kids", phase: "explore", _count: { nodes: 8 } },
    { id: "map-events", title: "A better way for my team to plan events", phase: "research", _count: { nodes: 6 } },
    { id: "map-bakery", title: "Should the bakery deliver?", phase: "map", _count: { nodes: 2 } },
    { id: "map-garden", title: "Something for my kids to do outside", phase: "map", _count: { nodes: 2 } },
  ] },
  DayOne: { maps: [] },
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
