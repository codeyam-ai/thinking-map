import Component from "../../components/AssistantBubble";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

const scenarios: Record<string, Props> = {
  Default: {
    content:
      "Interesting. Before thinking about the game itself, there are three things I'd like to understand:\nWho is this actually for?\nWhat are you hoping they learn?\nAnd what are they doing instead today?",
  },
  Statement: {
    content:
      "That changes a few things, not everything. I kept your original idea and updated who it's for.",
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
      <div style={{ width: "100%", maxWidth: 340 }}><Component {...props} /></div>
    </div>
  );
}
