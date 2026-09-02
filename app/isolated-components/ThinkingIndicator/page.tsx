import Component from "../../../app/components/ThinkingIndicator";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// "Your partner is reading this."
//
// The gap between someone writing an idea and the first questions arriving is
// unavoidable and can be long — under WebMCP the page cannot ask an agent to
// hurry, and cannot even know one is coming. So the wait has to be legible, and
// legible in the right PLACE: on the axis the branches will grow along, so the
// animation points at where the answer is about to appear.

const scenarios: Record<string, Props> = {
  // The ordinary wait, starting from the right edge of the idea.
  Default: { x: 0 },

  // The wording is a prop because what the partner is doing changes. "Reading"
  // is the first beat; this is a later one, and the line has to hold its
  // position on the axis whatever it says.
  Thinking: { x: 0, label: "Thinking it through" },

  // A long label, which is where a line that grew past its lane would start
  // colliding with the cards it is pointing at.
  LongLabel: { x: 0, label: "Working out which questions are worth asking" },

  // Started further right, as it is on a board whose idea card is wider. The
  // offset is the caller's, so the indicator must place itself from it rather
  // than assume the origin.
  FurtherOut: { x: 220 },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "Default" } = await searchParams;
  const props = scenarios[s];
  if (!props) return <div>Unknown scenario: {s}</div>;

  // It positions itself from the board's origin and is vertically centred on
  // it, so the harness supplies that origin against the board's dark ground.
  return (
    <div id="codeyam-capture" style={{ background: "#000" }}>
      <div style={{ position: "relative", width: 760, height: 200 }}>
        <div style={{ position: "absolute", left: 40, top: "50%" }}>
          <Component {...props} />
        </div>
      </div>
    </div>
  );
}
