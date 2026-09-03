import Component from "../../components/AgentStartCue";
import { attachedStartCopy } from "../../lib/handoffCopy";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The nudge for a map an agent can see but has not been asked to work. Before
// it existed, `AgentHandoff` returned null the moment WebMCP bound — so the
// page reached its most capable state and showed nothing to act on, while an
// agent sat beside it with the whole catalog and no instruction.
//
// Copy comes from `attachedStartCopy` rather than being retyped here, so what
// a capture shows is what the product says.
const scenarios: Record<string, Props> = {
  // The ordinary attached-but-idle map: someone typed an idea, an agent is
  // bound, and nothing is happening until they send it one sentence.
  FromIdea: { ...attachedStartCopy({ hasBrief: false }) },
  // The same map reached through a document. The only thing that differs is
  // which read tool the prompt names, and that difference matters — an agent
  // told to read the map when a brief is the real input starts from the
  // summary instead of the source.
  FromBrief: { ...attachedStartCopy({ hasBrief: true }) },
  // One row instead of a block, for the finished-plan view where the summary
  // is what the person came back for and every row this takes is a row the
  // summary loses.
  Dense: { ...attachedStartCopy({ hasBrief: false }), dense: true },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "FromIdea" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;
  // Sits in the map screen's main column, which is the 930px content width.
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 930 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
