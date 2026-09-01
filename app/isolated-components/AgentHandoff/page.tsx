import Component from "../../../app/components/AgentHandoff";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The panel a person meets when they submit an idea and nothing picks it up.
//
// Only the states where it RENDERS are worth a scenario. The three states where
// it deliberately renders nothing — an agent connected, an agent mid-tool-call,
// a map an agent has already worked — would each capture as a blank frame,
// which is indistinguishable from the component being broken. Those are pinned
// in AgentHandoff.render.test.tsx instead, where "nothing" is an assertion
// rather than an empty picture.
//
// No bridge provider here on purpose: useOptionalWebMcpBridge returns null
// outside one, which the panel reads as honest absence — the same state a real
// page with no agent attached is in.
const scenarios: Record<string, Props> = {
  // The reported case: someone typed a sentence, pressed send, and landed here.
  // The prompt points at read_map, because the map is what there is to read.
  Default: {
    mapId: "cmtixt5tg000wymek3vbmllaj",
    seedIdea: "A weekend app for splitting chores fairly",
    hasBrief: false,
  },
  // Started from a document instead of a sentence. There is nothing to quote
  // back, and the prompt points at read_brief — sending an agent to read_map
  // first would show it the emptier of the two things it could read.
  FromBrief: {
    mapId: "cmtixrnsr000symeky9nw5izd",
    hasBrief: true,
  },
  // A long idea, which is the ordinary shape of a real one. Worth its own
  // capture because the quote and the monospace prompt both wrap, and this is
  // where that either reads well or does not.
  LongIdea: {
    mapId: "cmtixp1a4000oymekkvyuiyi9",
    seedIdea:
      "Work out whether our library membership renewal should move online before the March board meeting, and what we would have to build to make that possible",
    hasBrief: false,
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
  // Full-width surface: on the map page this card spans the whole column
  // between the header and the workspace.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
