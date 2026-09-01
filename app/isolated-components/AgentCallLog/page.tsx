import Component from "../../components/AgentCallLog";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The log is the evidence that the panel drives the real catalog: every detail
// here is a reply a tool actually produced.
const scenarios: Record<string, Props> = {
  Default: {
    lines: [
      { label: "post_note", detail: "→ says what it is about to do", failed: false },
      { label: "post_note", detail: "Noted. The map is now at revision 15.", failed: false },
      { label: "read_map", detail: "→ reads the map", failed: false },
      {
        label: "read_map",
        detail:
          "revision: 15\n# Tool for tracking reading\nphase: explore\nseed idea: I want to build something that helps me keep track of what I read.",
        failed: false,
      },
    ],
  },
  // Before anything has run — the panel has to say so rather than look broken.
  Empty: { lines: [] },
  // A failed call among successful ones, which is how a real run surfaces a
  // bad input without stopping the sequence.
  WithFailure: {
    lines: [
      { label: "post_note", detail: "Noted. The map is now at revision 15.", failed: false },
      {
        label: "add_nodes",
        detail: "Could not run add_nodes (HTTP 400). nodes.0.kind: invalid enum value",
        failed: true,
      },
      { label: "read_map", detail: "revision: 15\n# Tool for tracking reading", failed: false },
    ],
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
  // Sized to the dev panel's log area: 340px panel, 16px padding each side.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 308, height: 260, display: "flex" }}>
        <Component {...props} />
      </div>
    </div>
  );
}
