import Component from "../../components/AgentToolChips";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The tools the browser actually ACCEPTED, named. This row is the visible proof
// of the bug the whole feature was built around: the page used to report a tool
// count while the browser had taken none of them, and nothing printed which
// ones got through.
const scenarios: Record<string, Props> = {
  // Every catalog tool through. What a working binding looks like, and the
  // capture that shows discovery is fixed.
  AllNine: {
    names: [
      "read_map",
      "create_themes",
      "read_brief",
      "add_nodes",
      "update_node",
      "set_phase",
      "post_note",
      "ask_user",
      "await_user_activity",
    ],
  },
  // A partly-accepted binding. Seven names where there should be nine is the
  // whole signal — which is why the names are listed rather than counted.
  PartiallyAccepted: {
    names: [
      "read_map",
      "create_themes",
      "read_brief",
      "add_nodes",
      "update_node",
      "set_phase",
      "post_note",
    ],
  },
  // A single tool through. The state the original bug actually produced, and
  // the one a count alone made look like a rounding difference.
  OnlyOne: { names: ["post_note"] },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "AllNine" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // Wraps inside the 300px panel, and the wrapping is the point — nine mono
  // chips at this width is what the row really looks like.
  return (
    <div id="codeyam-capture">
      <div style={{ width: 300, padding: 16 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
