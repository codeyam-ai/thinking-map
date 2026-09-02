import Component from "../../../app/components/HandoffFootnote";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The honest paragraph about why nobody is attached, plus the two ways to fix
// that for good — kept, and kept small, beneath the action.
//
// Worth capturing because "demoted" is a visual claim and this is where it is
// either true or not. These two paragraphs used to OPEN the panel; if they
// ever read as loud as the instruction again, the change this component exists
// to hold has quietly come undone.
const scenarios: Record<string, Props> = {
  // The real wording, exactly as handoffCopy returns it. Both paragraphs are
  // long, which is the point — they have to stay quiet at this length.
  Default: {
    explanation:
      "Your idea is saved. Nothing is working on it yet — a map cannot summon a thinking partner, so an agent has to come to it.",
    attachHint:
      "Attach one two ways: a browser agent (Chrome 146+, top-level, secure context), or the MCP server (npm run mcp, or /api/mcp) — where an agent parked on await_new_map picks up the next idea the moment it is submitted, with nothing to copy.",
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
  // Full-width surface: this sits at the foot of the band, which spans the
  // whole column between the header and the workspace.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
