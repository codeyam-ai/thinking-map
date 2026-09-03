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

  // The same control in its second home. Reaching the board at all is the
  // point: this was built and then wired into a view the galaxy board replaced,
  // so until now nothing on the page a person actually looks at could move the
  // map's phase. The board's chat panel is near-black, where the paper tone's
  // filled ink button would be black on black — so the fill goes and an outline
  // takes its place, which also reads correctly as the secondary move beside
  // the round's lime primary.
  OnTheBoard: { phase: "map", mapId: "map-game", tone: "board" },

  // The last working phase, in board tone: the step immediately before the
  // conclusion, which is the destination this whole route exists to reach.
  OnTheBoardEndOfExplore: {
    phase: "explore",
    mapId: "map-game",
    tone: "board",
  },
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
  // The board tone is only legible on the ground it was drawn for. Captured on
  // the page's paper white it would look like a broken paper variant rather
  // than a correct board one, so the harness supplies the chat panel's ground.
  const board = props.tone === "board";

  return (
    <div
      id="codeyam-capture"
      style={board ? { background: "#0a0a0b", padding: 28 } : undefined}
    >
      <div style={{ width: "100%", maxWidth: 620 }}>
        <Component {...props} />
      </div>
    </div>
  );
}
