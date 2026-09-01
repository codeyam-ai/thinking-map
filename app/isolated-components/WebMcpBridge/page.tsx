import { WebMcpBridge as Component } from "../../../app/components/WebMcpBridge";
import type { ComponentProps } from "react";
import BridgeReadout from "./BridgeReadout";

type Props = ComponentProps<typeof Component>;

// The bridge renders only a context provider, so every scenario gives it the
// readout as children — that consumer is what makes its state visible at all.
//
// A capture runs inside codeyam's iframe, and WebMCP is top-level-secure-context
// only, so `NoAgent` is the state this environment genuinely produces rather
// than one staged for the screenshot. It is also the state most people will
// meet first, and the one the headless driver exists to keep workable.
const scenarios: Record<string, Props> = {
  NoAgent: {
    mapId: "map-exchange",
    children: <BridgeReadout />,
  },
  // The none-to-some boundary: exactly one question outstanding, which is what
  // a follow-up looks like once the deconstruction is done.
  OneQuestion: {
    mapId: "map-exchange",
    children: (
      <BridgeReadout questions={["Is this for you alone, or shared?"]} />
    ),
  },
  // The state an agent deconstructing a vague idea actually produces: several
  // questions, each a full sentence rather than a label. Exercises wrapping and
  // the height the pending block grows to.
  ManyQuestions: {
    mapId: "map-exchange",
    children: (
      <BridgeReadout
        questions={[
          "Who is this for, specifically — you, or someone you have watched struggle with it?",
          "What are they doing today instead, and what does that cost them?",
          "If this existed and worked perfectly, what would change about their week?",
          "What have you already tried and bounced off, and what made you stop?",
          "Is there a version of this that is a habit rather than a product?",
        ]}
      />
    ),
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
  // Full-width surface: #codeyam-capture fills the layout-centered viewport.
  // Bounded card? Wrap to match the component's real container width:
  //   <div id="codeyam-capture">
  //     <div style={{ width: "100%", maxWidth: 384 }}>
  //       <Component {...props} />
  //     </div>
  //   </div>
  return (
    <div id="codeyam-capture">
      <Component {...props} />
    </div>
  );
}
