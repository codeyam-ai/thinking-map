import Component from "../../components/SavedMapRow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: {
    map: {
      id: "map-game",
      title: "Educational game for kids",
      phase: "research",
      _count: { nodes: 7 },
    },
  },
  SingleNode: {
    map: {
      id: "map-bakery",
      title: "Should the bakery deliver?",
      phase: "deconstruct",
      _count: { nodes: 1 },
    },
  },
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
      <div style={{ width: "100%", maxWidth: 930 }}><Component {...props} /></div>
    </div>
  );
}
