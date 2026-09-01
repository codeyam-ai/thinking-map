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
      phase: "map",
      _count: { nodes: 1 },
    },
  },
  // Deliberately still stored as the phase that no longer exists. Every other
  // fixture was moved to `map` when the two phases merged; this one is kept
  // behind so the alias is demonstrated on screen and not only in a unit test —
  // it must render as "02 Map", never as the raw word the row holds.
  LegacyPhase: {
    map: {
      id: "map-chores",
      title: "A weekend app for splitting chores fairly",
      phase: "deconstruct",
      _count: { nodes: 5 },
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
