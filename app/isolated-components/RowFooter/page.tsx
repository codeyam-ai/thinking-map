import Component from "../../../app/components/RowFooter";
import { settledNote } from "../../../app/lib/pendingRow";
import type { ComponentProps } from "react";

type Props = ComponentProps<typeof Component>;

// The footer's whole job is choosing which of two things belongs under a round,
// so these scenarios are that choice: the count while there is still answering
// to do, and the phase's action once nothing more is coming.
const scenarios: Record<string, Props> = {
  // Mid-round. The cards are the action, so the footer only counts.
  StillAnswering: {
    phase: "map",
    answered: 2,
    questions: 3,
    pending: { kind: "hidden" },
    mapId: "map-game",
  },

  // NOTE: the "answered, and the map is still reaching" state deliberately has
  // no scenario here. The footer renders NOTHING in it — the shimmering row
  // above is already saying it, and a second sentence one line apart was the
  // first thing that looked wrong on screen. A screenshot of nothing is not
  // evidence of anything, so that case is pinned in RowFooter.render.test.tsx
  // instead, where "renders nothing" is a claim a test can actually make.

  // The wait settled with nothing coming, so the phase's action appears.
  ReadyToResearch: {
    phase: "map",
    answered: 3,
    questions: 3,
    pending: {
      kind: "settled",
      note: settledNote("unavailable"),
    },
    mapId: "map-game",
  },

  // A round of statements rather than questions is complete on arrival — there
  // was never anything in it for the person to do, so it goes straight to the
  // action without ever showing a count.
  RoundOfStatements: {
    phase: "research",
    answered: 0,
    questions: 0,
    pending: {
      kind: "settled",
      note: settledNote("working"),
    },
    mapId: "map-game",
  },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ s?: string }>;
}) {
  const { s = "StillAnswering" } = await searchParams;
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
