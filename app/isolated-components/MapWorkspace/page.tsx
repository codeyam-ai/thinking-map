import Component from "../../components/MapWorkspace";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: {
    mapId: "map-game",
    messages: [
    { id: "m1", role: "user", content: "I want to build an educational game for kids, but I don't know what it should be." },
    { id: "m2", role: "assistant", content: "Interesting. Before thinking about the game itself, there are three things I'd like to understand:\nWho is this actually for?\nWhat are you hoping they learn?\nAnd what are they doing instead today?" },
    { id: "m3", role: "user", content: "Probably kids around 6 to 8, and I want them to learn vocabulary." },
  ],
    nodes: [
    { id: "n-idea", parentId: null, kind: "idea", label: "Educational game for kids", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-age", parentId: "n-idea", kind: "assumption", label: "Ages 6-8", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-prob", parentId: "n-idea", kind: "problem", label: "Vocabulary", detail: null, status: "answered", sourceUrl: null, order: 1 },
    { id: "n-goal", parentId: "n-idea", kind: "goal", label: "Not yet explored", detail: null, status: "open", sourceUrl: null, order: 2 },
    { id: "n-res", parentId: "n-prob", kind: "research", label: "3 existing apps found", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-g1", parentId: "n-res", kind: "gap", label: "No parent involvement", detail: null, status: "answered", sourceUrl: null, order: 0 },
    { id: "n-g2", parentId: "n-res", kind: "gap", label: "Fixed difficulty level", detail: null, status: "answered", sourceUrl: null, order: 1 },
  ],
    caption: "5 answered, 1 still open",
  },
  // Day one inside the workspace: the seed idea and the three questions the
  // partner asked, with nothing answered yet.
  Seeded: {
    mapId: "map-game",
    messages: [
      { id: "m1", role: "user", content: "I want to build an educational game for kids, but I don't know what it should be." },
      { id: "m2", role: "assistant", content: "Interesting. Before thinking about the game itself, there are three things I'd like to understand:\nWho is this actually for?\nWhat are you hoping they learn?\nAnd what are they doing instead today?" },
    ],
    nodes: [
      { id: "n-idea", parentId: null, kind: "idea", label: "Educational game for kids", detail: null, status: "answered", sourceUrl: null, order: 0 },
      { id: "q1", parentId: "n-idea", kind: "open-question", label: "Who is it for?", detail: null, status: "open", sourceUrl: null, order: 0 },
      { id: "q2", parentId: "n-idea", kind: "open-question", label: "What's the problem?", detail: null, status: "open", sourceUrl: null, order: 1 },
      { id: "q3", parentId: "n-idea", kind: "open-question", label: "What's the goal?", detail: null, status: "open", sourceUrl: null, order: 2 },
    ],
    caption: "one seed, 3 open questions",
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
      <div className="flex flex-col" style={{ height: 640 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
