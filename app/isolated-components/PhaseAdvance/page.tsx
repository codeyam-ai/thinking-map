import Component from "../../../app/components/PhaseAdvance";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The one action worth taking when a phase's work is done. Each working phase
// asks for something different and hands off to something different, so each
// gets its own scenario — the sentence and the label both come from PHASE_ASK,
// and these are what would show a drift between a phase and its ask.
const scenarios: Record<string, Props> = {
  // End of 02 Map: the questions are answered, so what is left is research.
  EndOfMap: { phase: "map", mapId: "map-game" },

  // End of 03 Research: enough on the map to pick a direction.
  EndOfResearch: { phase: "research", mapId: "map-game" },

  // End of 04 Explore: the directions are laid out, so the plan comes next.
  EndOfExplore: { phase: "explore", mapId: "map-game" },

  // No map to advance — the isolated case, and also a genuine one: the button
  // is disabled rather than absent, so the step is still legible as the next
  // thing even where it cannot be taken.
  NoMapToAdvance: { phase: "map" },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "EndOfMap" } = await searchParams;
  const props = scenarios[s];
  if (!props) {
    return <div>Unknown scenario: {s}</div>;
  }
  return (
    <div id="codeyam-capture">
      <div style={{ width: "100%", maxWidth: 620 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
