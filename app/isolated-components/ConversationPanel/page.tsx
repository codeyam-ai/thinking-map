import Component from "../../components/ConversationPanel";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: { mapId: "map-game", messages: [
    { id: "m1", role: "user", content: "I want to build an educational game for kids, but I don't know what it should be." },
    { id: "m2", role: "assistant", content: "Interesting. Before thinking about the game itself, there are three things I'd like to understand:\nWho is this actually for?\nWhat are you hoping they learn?\nAnd what are they doing instead today?" },
    { id: "m3", role: "user", content: "Probably kids around 6 to 8, and I want them to learn vocabulary." },
  ] },
  // A map opened before anyone has spoken.
  Empty: { mapId: "map-game", messages: [] },
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
      <div className="flex" style={{ height: 620 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
