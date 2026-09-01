import Component from "../../components/AgentCallLogRow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The two outcomes a call can have. A failure has to be unmistakable: the
// panel's whole claim is that these are real tool calls, so a broken one that
// looked quiet would be worse than no panel at all.
const scenarios: Record<string, Props> = {
  Default: {
    line: {
      label: "post_note",
      detail: "Noted. The map is now at revision 15.",
      failed: false,
    },
  },
  Failed: {
    line: {
      label: "add_nodes",
      detail: "Could not run add_nodes (HTTP 400). nodes.0.kind: invalid enum value",
      failed: true,
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
  if (!props) return <div>Unknown scenario: {s}</div>;
  // The row lives in the dev panel's log, which is 340px wide with padding.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 300 }}>
        <ul>
          <Component {...props} />
        </ul>
      </div>
    </div>
  );
}
