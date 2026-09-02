import Component from "../../../app/components/HandoffReattach";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The strip a map wears once the agent that worked it has gone.
//
// Worth capturing because this component is defined by what it OMITS, and an
// omission is invisible in a unit test that asserts presence. Side by side with
// the full band's own scenarios, these frames are where "demoted" is either
// true or has quietly grown its steps and its quote back.
//
// The real wording, exactly as `handoffCopy` returns it for `worked: true` —
// paraphrasing here would let the strip pass a capture while the app said
// something else.
const scenarios: Record<string, Props> = {
  // The ordinary case: a browser-served map, so the MCP command carries an
  // origin an agent on another machine can actually reach.
  Default: {
    eyebrow: "The agent that was here has gone",
    instruction: "Pick this back up",
    startPrompt:
      'Work on thinking map cmtixt5tg000wymek3vbmllaj — "A weekend app for splitting chores fairly between housemates". Start with read_map, then deconstruct the idea.',
    mcpCommand:
      "claude mcp add --transport http thinking-map https://thinking-map.example.com/api/mcp",
  },
  // The server render, before the browser's own address is knowable. The
  // fallback is far shorter than the HTTP form, so this is also the frame that
  // shows the two-column grid holding up when one cell is nearly empty.
  ServerRender: {
    eyebrow: "The agent that was here has gone",
    instruction: "Pick this back up",
    startPrompt:
      'Work on thinking map cmtixt5tg000wymek3vbmllaj — "A weekend app for splitting chores fairly between housemates". Start with read_map, then deconstruct the idea.',
    mcpCommand: "npm run mcp",
  },
  // A brief-started map has no sentence to fold into the prompt, so this is the
  // shortest the left cell ever gets — and the prompt names read_brief, because
  // read_map would send the agent to the emptier of the two things it could
  // read.
  FromBrief: {
    eyebrow: "The agent that was here has gone",
    instruction: "Pick this back up",
    startPrompt:
      "Work on thinking map cmtixt5tg000wymek3vbmllaj. Start with read_brief to read the brief it was started from, then deconstruct it.",
    mcpCommand:
      "claude mcp add --transport http thinking-map https://thinking-map.example.com/api/mcp",
  },
  // The finished-plan screen. `MapScreen` is an `h-screen` flex column and this
  // strip is `shrink-0`, so every row it takes is a row the summary loses — and
  // on that screen the summary is the whole reason someone came back. One row,
  // both commands truncated, heading dropped.
  Dense: {
    eyebrow: "The agent that was here has gone",
    instruction: "Pick this back up",
    startPrompt:
      'Work on thinking map cmtixt5tg000wymek3vbmllaj — "A weekend app for splitting chores fairly between housemates". Start with read_map, then deconstruct the idea.',
    mcpCommand:
      "claude mcp add --transport http thinking-map https://thinking-map.example.com/api/mcp",
    dense: true,
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
  // Full-width surface: this strip spans the whole column between the header
  // and the map, exactly as the full band does — and its two-column grid only
  // has anything to say at that width.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
