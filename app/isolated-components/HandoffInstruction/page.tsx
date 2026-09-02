import Component from "../../../app/components/HandoffInstruction";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The block that now opens the handoff band: the eyebrow, the instruction at
// heading weight, and the two steps as numbered steps.
//
// Worth its own scenarios because the ORDER is the content here. A capture is
// the only place you can see that the numbers read as a sequence rather than
// as decoration, and that the heading wins against the steps beneath it — a
// render test can assert an <ol> exists but not that it looks like one.
const scenarios: Record<string, Props> = {
  // The real wording, exactly as handoffCopy returns it for a map started from
  // a sentence. This is the state every unattached map actually shows.
  Default: {
    eyebrow: "No one is on this yet",
    instruction: "Hand this to your agent",
    steps: [
      "Copy the prompt below.",
      "Paste it into your agent’s chat window.",
    ],
  },
  // A longer instruction and wordier steps, which is where a heading that
  // wraps either still reads as the headline or stops doing so. Nothing
  // renders this today; it is here because the wording lives in a module
  // designed to be edited, and the layout has to survive an edit.
  LongWording: {
    eyebrow: "No one is on this yet",
    instruction: "Hand this map to your thinking partner to get started",
    steps: [
      "Copy the start prompt below — it already names this map and quotes your idea.",
      "Paste it into your agent’s chat window and send it, and the agent will read the map before it does anything else.",
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
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  // Full-width surface: on the map page this block spans the whole band, which
  // itself spans the column between the header and the workspace.
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
